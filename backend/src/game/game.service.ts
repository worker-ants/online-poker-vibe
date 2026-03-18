import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from './game.entity.js';
import { GameParticipant } from './game-participant.entity.js';
import { Room } from '../room/room.entity.js';
import { PokerEngineFactory } from './engine/poker-engine.factory.js';
import type { IPokerEngine } from './engine/poker-engine.interface.js';
import type { IGameMode } from './engine/modes/game-mode.interface.js';
import { isAiPlayer } from '../ai/ai-names.js';
import type {
  ActionRequired,
  PublicGameState,
  GameEndResult,
  HandleActionResult,
  GameState,
  PlayerAction,
  PlayerSeat,
  RoomSettings,
  Card,
} from '../common/types';

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

  async startGame(room: Room, aiPlayers: PlayerSeat[] = []): Promise<string> {
    // Guard: prevent duplicate active game for the same room
    if (this.activeGames.has(room.id)) {
      throw new Error('이 방에 이미 진행 중인 게임이 있습니다.');
    }

    // Also check DB for in-progress games
    const existingGame = await this.gameRepository.findOne({
      where: { roomId: room.id, status: 'in-progress' },
    });
    if (existingGame) {
      throw new Error('이 방에 이미 진행 중인 게임이 있습니다.');
    }

    const settings: RoomSettings = room.getSettings();
    const engine = PokerEngineFactory.createEngine(room.variant);
    const mode = PokerEngineFactory.createMode(room.mode, settings);

    const humanPlayers: PlayerSeat[] = room.roomPlayers
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((rp) => ({
        uuid: rp.playerUuid,
        nickname: rp.player?.nickname ?? 'Unknown',
        seatIndex: rp.seatIndex,
        chips: mode.getStartingChips(),
      }));

    const aiPlayersWithChips = aiPlayers.map((ai) => ({
      ...ai,
      chips: mode.getStartingChips(),
    }));

    const players: PlayerSeat[] = [...humanPlayers, ...aiPlayersWithChips].sort(
      (a, b) => a.seatIndex - b.seatIndex,
    );

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
    fromAiLoop = false,
  ): Promise<HandleActionResult> {
    // Prevent external clients from spoofing AI player actions
    if (!fromAiLoop && isAiPlayer(playerUuid)) {
      throw new Error('AI 플레이어의 액션을 직접 전송할 수 없습니다.');
    }

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
          await this.finishGame(active);
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
        gameResult: gameOver ? this.getGameResult(active) : undefined,
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

  getPublicState(roomId: string): PublicGameState | null {
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
        isAI: isAiPlayer(p.uuid),
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

  getActionRequired(roomId: string): ActionRequired | null {
    const active = this.activeGames.get(roomId);
    if (!active) return null;

    const state = active.state;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isFolded || currentPlayer.isAllIn) {
      return null;
    }

    // During draw phase, the current player needs to draw
    if (state.phase === 'draw') {
      return {
        playerUuid: currentPlayer.uuid,
        validActions: [],
        callAmount: 0,
        minRaise: 0,
        maxRaise: 0,
        timeLimit: 30,
        isDraw: true,
      };
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

  private resolvePlayerResult(
    player: { chips: number; isDisconnected: boolean },
    topChips: number,
    topCount: number,
  ): 'win' | 'loss' | 'draw' | 'abandoned' {
    if (player.chips === topChips && player.chips > 0) {
      return topCount > 1 ? 'draw' : 'win';
    }
    if (player.isDisconnected) {
      return 'abandoned';
    }
    return 'loss';
  }

  private async finishGame(active: ActiveGame): Promise<void> {
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

      // Determine placements (all players including AI for overall ranking)
      const sortedPlayers = [...active.state.players].sort(
        (a, b) => b.chips - a.chips,
      );
      const topChips = sortedPlayers[0]?.chips ?? 0;
      const topCount = sortedPlayers.filter((p) => p.chips === topChips).length;

      // Save participants (human players only, with correct placements)
      const humanPlayers = sortedPlayers
        .map((player, i) => ({ player, overallPlacement: i + 1 }))
        .filter(({ player }) => !isAiPlayer(player.uuid));

      for (const { player, overallPlacement } of humanPlayers) {
        const result = this.resolvePlayerResult(player, topChips, topCount);
        const startingChips = active.mode.getStartingChips();
        const participant = this.participantRepository.create({
          gameId: active.gameId,
          playerUuid: player.uuid,
          result,
          chipsDelta: player.chips - startingChips,
          finalChips: player.chips,
          placement: overallPlacement,
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

  private getGameResult(active: ActiveGame): GameEndResult {
    const startingChips = active.mode.getStartingChips();

    // Build results from in-memory state (includes both human and AI)
    const sortedPlayers = [...active.state.players].sort(
      (a, b) => b.chips - a.chips,
    );
    const topChips = sortedPlayers[0]?.chips ?? 0;
    const topCount = sortedPlayers.filter((p) => p.chips === topChips).length;

    const results = sortedPlayers.map((p, i) => ({
      uuid: p.uuid,
      nickname: p.nickname,
      result: this.resolvePlayerResult(p, topChips, topCount),
      chipsDelta: p.chips - startingChips,
      placement: i + 1,
      isAI: isAiPlayer(p.uuid),
    }));

    return {
      roomId: active.roomId,
      gameId: active.gameId,
      results,
    };
  }

  getGameState(roomId: string): GameState | null {
    const active = this.activeGames.get(roomId);
    return active?.state ?? null;
  }

  getGameVariant(roomId: string): string | null {
    const active = this.activeGames.get(roomId);
    return active?.state.variant ?? null;
  }

  isGameActive(roomId: string): boolean {
    return this.activeGames.has(roomId);
  }

  async deleteInProgressGamesByRoom(roomId: string): Promise<void> {
    const queryRunner =
      this.gameRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Query inside transaction to avoid TOCTOU race with finishGame
      const games = await queryRunner.manager.find(Game, {
        where: { roomId, status: 'in-progress' as const },
      });

      if (games.length > 0) {
        const gameIds = games.map((g) => g.id);
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(GameParticipant)
          .where('gameId IN (:...gameIds)', { gameIds })
          .execute();
        await queryRunner.manager.remove(games);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // Clean up in-memory state
    this.activeGames.delete(roomId);
  }
}
