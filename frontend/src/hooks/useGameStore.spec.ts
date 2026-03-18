import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './useGameStore';
import type {
  RoomInfo,
  RoomState,
  PublicGameState,
  Card,
  ActionRequired,
  ShowdownResult,
  GameEndResult,
} from '@/src/lib/types';

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('should have initial state', () => {
    const state = useGameStore.getState();
    expect(state.roomList).toEqual([]);
    expect(state.currentRoom).toBeNull();
    expect(state.gameState).toBeNull();
    expect(state.holeCards).toEqual([]);
    expect(state.actionRequired).toBeNull();
    expect(state.showdown).toBeNull();
    expect(state.gameEnd).toBeNull();
  });

  it('should set room list', () => {
    const rooms: RoomInfo[] = [{ id: '1', name: 'Test', variant: 'texas-holdem', mode: 'cash', status: 'waiting', playerCount: 2, maxPlayers: 6, hostNickname: 'Host', createdAt: '' }];
    useGameStore.getState().setRoomList(rooms);
    expect(useGameStore.getState().roomList).toEqual(rooms);
  });

  it('should set current room', () => {
    const room: RoomState = { roomId: 'r1', name: 'Test', variant: 'texas-holdem', mode: 'cash', status: 'waiting', hostUuid: 'p1', maxPlayers: 6, settings: { startingChips: 1000, smallBlind: 10, bigBlind: 20 }, players: [] };
    useGameStore.getState().setCurrentRoom(room);
    expect(useGameStore.getState().currentRoom).toEqual(room);
  });

  it('should set game state', () => {
    const gameState: PublicGameState = { phase: 'pre-flop', communityCards: [], pot: 100, sidePots: [], currentPlayerUuid: 'p1', dealerUuid: 'p2', players: [], handNumber: 1 };
    useGameStore.getState().setGameState(gameState);
    expect(useGameStore.getState().gameState).toEqual(gameState);
  });

  it('should set hole cards', () => {
    const cards: Card[] = [{ suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'K' }];
    useGameStore.getState().setHoleCards(cards);
    expect(useGameStore.getState().holeCards).toEqual(cards);
  });

  it('should set action required', () => {
    const action: ActionRequired = { playerUuid: 'p1', validActions: ['fold', 'call'], callAmount: 20, minRaise: 40, maxRaise: 1000, timeLimit: 30 };
    useGameStore.getState().setActionRequired(action);
    expect(useGameStore.getState().actionRequired).toEqual(action);
  });

  it('should set showdown result', () => {
    const showdown: ShowdownResult = {
      players: [
        { uuid: 'p1', cards: [{ suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'K' }], handRank: 'high-card', handDescription: 'Ace high' },
      ],
      winners: [{ uuid: 'p1', amount: 100, potType: 'main' }],
    };
    useGameStore.getState().setShowdown(showdown);
    expect(useGameStore.getState().showdown).toEqual(showdown);
  });

  it('should clear showdown result with null', () => {
    const showdown: ShowdownResult = {
      players: [
        { uuid: 'p1', cards: [{ suit: 'hearts', rank: 'A' }], handRank: 'high-card', handDescription: 'Ace high' },
      ],
      winners: [{ uuid: 'p1', amount: 100, potType: 'main' }],
    };
    useGameStore.getState().setShowdown(showdown);
    useGameStore.getState().setShowdown(null);
    expect(useGameStore.getState().showdown).toBeNull();
  });

  it('should set game end result', () => {
    const gameEnd: GameEndResult = {
      roomId: 'r1',
      gameId: 'g1',
      results: [
        { uuid: 'p1', nickname: 'Player1', result: 'win', chipsDelta: 100, placement: 1, isAI: false },
        { uuid: 'p2', nickname: 'Player2', result: 'loss', chipsDelta: -100, placement: 2, isAI: false },
      ],
    };
    useGameStore.getState().setGameEnd(gameEnd);
    expect(useGameStore.getState().gameEnd).toEqual(gameEnd);
  });

  it('should clear game end result with null', () => {
    const gameEnd: GameEndResult = {
      roomId: 'r1',
      gameId: 'g1',
      results: [{ uuid: 'p1', nickname: 'Player1', result: 'win', chipsDelta: 50, placement: 1, isAI: false }],
    };
    useGameStore.getState().setGameEnd(gameEnd);
    useGameStore.getState().setGameEnd(null);
    expect(useGameStore.getState().gameEnd).toBeNull();
  });

  it('should reset to initial state', () => {
    const room: RoomState = { roomId: 'r1', name: 'Test', variant: 'texas-holdem', mode: 'cash', status: 'waiting', hostUuid: 'p1', maxPlayers: 6, settings: { startingChips: 1000, smallBlind: 10, bigBlind: 20 }, players: [] };
    const gameState: PublicGameState = { phase: 'flop', communityCards: [], pot: 0, sidePots: [], currentPlayerUuid: null, dealerUuid: null, players: [], handNumber: 1 };
    const cards: Card[] = [{ suit: 'hearts', rank: 'A' }];
    const showdown: ShowdownResult = {
      players: [{ uuid: 'p1', cards: [], handRank: 'pair', handDescription: 'Pair of Aces' }],
      winners: [{ uuid: 'p1', amount: 50, potType: 'main' }],
    };
    const gameEnd: GameEndResult = {
      roomId: 'r1',
      gameId: 'g1',
      results: [{ uuid: 'p1', nickname: 'Player1', result: 'win', chipsDelta: 50, placement: 1, isAI: false }],
    };

    useGameStore.getState().setCurrentRoom(room);
    useGameStore.getState().setGameState(gameState);
    useGameStore.getState().setHoleCards(cards);
    useGameStore.getState().setShowdown(showdown);
    useGameStore.getState().setGameEnd(gameEnd);

    useGameStore.getState().reset();

    expect(useGameStore.getState().currentRoom).toBeNull();
    expect(useGameStore.getState().gameState).toBeNull();
    expect(useGameStore.getState().holeCards).toEqual([]);
    expect(useGameStore.getState().actionRequired).toBeNull();
    expect(useGameStore.getState().showdown).toBeNull();
    expect(useGameStore.getState().gameEnd).toBeNull();
  });

  it('should not reset roomList on reset', () => {
    const rooms: RoomInfo[] = [{ id: '1', name: 'Test', variant: 'texas-holdem', mode: 'cash', status: 'waiting', playerCount: 0, maxPlayers: 6, hostNickname: '', createdAt: '' }];
    useGameStore.getState().setRoomList(rooms);
    useGameStore.getState().reset();
    expect(useGameStore.getState().roomList).toEqual(rooms);
  });
});
