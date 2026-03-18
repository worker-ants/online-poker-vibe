import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Game } from './game.entity.js';
import { GameParticipant } from './game-participant.entity.js';
import { Room } from '../room/room.entity.js';
import { PokerEngineFactory } from './engine/poker-engine.factory.js';
import type { IPokerEngine } from './engine/poker-engine.interface.js';
import type { IGameMode } from './engine/modes/game-mode.interface.js';
import type {
  GameState,
  PlayerAction,
  PlayerSeat,
  RoomSettings,
  Card,
} from '../common/types/index.js';

interface ActiveGame {
  engine: IPokerEngine;
  mode: IGameMode;
  state: GameState;
  gameId: string;
  roomId: string;
}

@Injectable()
export class GameService {
  private activeGames = new Map<string, ActiveGame>();

  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(GameParticipant)
    private readonly participantRepository: Repository<GameParticipant>,
  ) {}

  async startGame(room: Room): Promise<string> {
    const settings: RoomSettings = room.getSettings();
    const engine = PokerEngineFactory.createEngine(room.variant);
    const mode = PokerEngineFactory.createMode(room.mode, settings);

    const players: PlayerSeat[] = room.roomPlayers
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((rp) => ({
        uuid: rp.playerUuid,
        nickname: rp.player?.nickname ?? 'Unknown',
        seatIndex: rp.seatIndex,
        chips: mode.getStartingChips(),
      }));

    let state = engine.initialize(players, mode);
    state.minRaise = mode.getBigBlind(1);
    state = engine.startHand(state);

    const gameId = state.gameId;

    // Save game to DB
    const game = this.gameRepository.create({
      id: gameId,
      roomId: room.id,
      variant: room.variant,
      mode: room.mode,
      status: 'in-progress',
    });
    await this.gameRepository.save(game);

    // Store active game
    this.activeGames.set(room.id, {
      engine,
      mode,
      state,
      gameId,
      roomId: room.id,
    });

    return gameId;
  }

  async handleAction(
    roomId: string,
    playerUuid: string,
    action: PlayerAction,
  ): Promise<{
    handComplete: boolean;
    gameOver: boolean;
    showdown?: any;
    gameResult?: any;
  }> {
    const active = this.activeGames.get(roomId);
    if (!active) {
      throw new Error('진행 중인 게임이 없습니다.');
    }

    active.state = active.engine.handleAction(active.state, playerUuid, action);

    // Check if hand is complete
    if (active.engine.isHandComplete(active.state)) {
      const result = active.engine.resolveHand(active.state);

      // Distribute winnings
      for (const winner of result.winners) {
        const player = active.state.players.find((p) => p.uuid === winner.uuid);
        if (player) {
          player.chips += winner.amount;
        }
      }

      // Check if game is over
      const alivePlayers = active.state.players.filter((p) => p.chips > 0);
      const gameOver = active.mode.isGameOver(alivePlayers.length);

      if (gameOver) {
        await this.finishGame(active, alivePlayers);
      }

      return {
        handComplete: true,
        gameOver,
        showdown: {
          players: result.playerHands.map((ph) => ({
            uuid: ph.uuid,
            cards: ph.cards,
            handRank: ph.handRank.category,
            handDescription: ph.handRank.description,
          })),
          winners: result.winners,
        },
        gameResult: gameOver ? await this.getGameResult(active) : undefined,
      };
    }

    return { handComplete: false, gameOver: false };
  }

  startNextHand(roomId: string): void {
    const active = this.activeGames.get(roomId);
    if (!active) {
      throw new Error('진행 중인 게임이 없습니다.');
    }

    // Update min raise for the new hand
    active.state.minRaise = active.mode.getBigBlind(
      active.state.handNumber + 1,
    );

    active.state = active.engine.startHand(active.state);
  }

  getPublicState(roomId: string): any {
    const active = this.activeGames.get(roomId);
    if (!active) return null;

    const state = active.state;
    return {
      phase: state.phase,
      communityCards: state.communityCards,
      pot: state.pot,
      sidePots: state.sidePots,
      currentPlayerUuid: state.players[state.currentPlayerIndex]?.uuid ?? null,
      dealerUuid: state.players[state.dealerIndex]?.uuid ?? null,
      players: state.players.map((p) => ({
        uuid: p.uuid,
        nickname: p.nickname,
        seatIndex: p.seatIndex,
        chips: p.chips,
        currentBet: p.currentBet,
        isFolded: p.isFolded,
        isAllIn: p.isAllIn,
        isDisconnected: p.isDisconnected,
        visibleCards: p.visibleCards,
        cardCount: p.holeCards.length,
      })),
      handNumber: state.handNumber,
    };
  }

  getPrivateStates(roomId: string): Record<string, Card[]> | null {
    const active = this.activeGames.get(roomId);
    if (!active) return null;

    const result: Record<string, Card[]> = {};
    for (const player of active.state.players) {
      result[player.uuid] = player.holeCards;
    }
    return result;
  }

  getActionRequired(roomId: string): any {
    const active = this.activeGames.get(roomId);
    if (!active) return null;

    const state = active.state;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isFolded || currentPlayer.isAllIn) {
      return null;
    }

    const validActions = active.engine.getValidActions(
      state,
      currentPlayer.uuid,
    );

    return {
      playerUuid: currentPlayer.uuid,
      validActions: validActions.actions,
      callAmount: validActions.callAmount,
      minRaise: validActions.minRaise,
      maxRaise: validActions.maxRaise,
      timeLimit: 30,
    };
  }

  private async finishGame(
    active: ActiveGame,
    alivePlayers: any[],
  ): Promise<void> {
    // Update game status
    await this.gameRepository.update(active.gameId, {
      status: 'completed',
      finishedAt: new Date(),
    });

    // Determine placements
    const sortedPlayers = [...active.state.players].sort(
      (a, b) => b.chips - a.chips,
    );

    // Save participants
    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      let result: 'win' | 'loss' | 'draw' | 'abandoned';

      if (i === 0) {
        result = 'win';
      } else if (player.isDisconnected) {
        result = 'abandoned';
      } else {
        result = 'loss';
      }

      const startingChips = active.mode.getStartingChips();
      const participant = this.participantRepository.create({
        gameId: active.gameId,
        playerUuid: player.uuid,
        result,
        chipsDelta: player.chips - startingChips,
        finalChips: player.chips,
        placement: i + 1,
      });

      await this.participantRepository.save(participant);
    }

    // Remove from active games
    this.activeGames.delete(active.roomId);
  }

  private async getGameResult(active: ActiveGame): Promise<any> {
    const participants = await this.participantRepository.find({
      where: { gameId: active.gameId },
      relations: ['player'],
      order: { placement: 'ASC' },
    });

    return {
      roomId: active.roomId,
      gameId: active.gameId,
      results: participants.map((p) => ({
        uuid: p.playerUuid,
        nickname: p.player?.nickname ?? 'Unknown',
        result: p.result,
        chipsDelta: p.chipsDelta,
        placement: p.placement,
      })),
    };
  }

  isGameActive(roomId: string): boolean {
    return this.activeGames.has(roomId);
  }
}
