import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
export class GameService implements OnModuleInit {
  private activeGames = new Map<string, ActiveGame>();
  private finishingRooms = new Set<string>();

  async onModuleInit() {
    await this.gameRepository.update(
      { status: 'in-progress' },
      { status: 'abandoned', finishedAt: new Date() },
    );
  }

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
    if (this.finishingRooms.has(roomId)) {
      throw new Error('핸드 종료 처리 중입니다.');
    }

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
        this.finishingRooms.add(roomId);
        try {
          await this.finishGame(active, alivePlayers);
        } finally {
          this.finishingRooms.delete(roomId);
        }
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
      result[player.uuid] = [...player.holeCards];
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
    const queryRunner =
      this.gameRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update game status
      await queryRunner.manager.update(Game, active.gameId, {
        status: 'completed',
        finishedAt: new Date(),
      });

      // Determine placements
      const sortedPlayers = [...active.state.players].sort(
        (a, b) => b.chips - a.chips,
      );

      // Determine top chips for draw detection
      const topChips = sortedPlayers[0]?.chips ?? 0;

      // Save participants
      for (let i = 0; i < sortedPlayers.length; i++) {
        const player = sortedPlayers[i];
        let result: 'win' | 'loss' | 'draw' | 'abandoned';

        if (player.chips === topChips && player.chips > 0) {
          // Check if multiple players share the top chips
          const topCount = sortedPlayers.filter(
            (p) => p.chips === topChips,
          ).length;
          result = topCount > 1 ? 'draw' : 'win';
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

        await queryRunner.manager.save(participant);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
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
