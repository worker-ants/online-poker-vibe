import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './useGameStore';

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
    const rooms = [{ id: '1', name: 'Test', variant: 'texas-holdem', mode: 'cash', status: 'waiting', playerCount: 2, maxPlayers: 6, hostNickname: 'Host', createdAt: '' }];
    useGameStore.getState().setRoomList(rooms as any);
    expect(useGameStore.getState().roomList).toEqual(rooms);
  });

  it('should set current room', () => {
    const room = { roomId: 'r1', name: 'Test', variant: 'texas-holdem', mode: 'cash', status: 'waiting', hostUuid: 'p1', maxPlayers: 6, settings: {}, players: [] };
    useGameStore.getState().setCurrentRoom(room as any);
    expect(useGameStore.getState().currentRoom).toEqual(room);
  });

  it('should set game state', () => {
    const gameState = { phase: 'pre-flop', communityCards: [], pot: 100, sidePots: [], currentPlayerUuid: 'p1', dealerUuid: 'p2', players: [], handNumber: 1 };
    useGameStore.getState().setGameState(gameState as any);
    expect(useGameStore.getState().gameState).toEqual(gameState);
  });

  it('should set hole cards', () => {
    const cards = [{ suit: 'hearts', rank: 'A' }, { suit: 'spades', rank: 'K' }];
    useGameStore.getState().setHoleCards(cards as any);
    expect(useGameStore.getState().holeCards).toEqual(cards);
  });

  it('should set action required', () => {
    const action = { playerUuid: 'p1', validActions: ['fold', 'call'], callAmount: 20, minRaise: 40, maxRaise: 1000, timeLimit: 30 };
    useGameStore.getState().setActionRequired(action as any);
    expect(useGameStore.getState().actionRequired).toEqual(action);
  });

  it('should reset to initial state', () => {
    useGameStore.getState().setCurrentRoom({ roomId: 'r1' } as any);
    useGameStore.getState().setGameState({ phase: 'flop' } as any);
    useGameStore.getState().setHoleCards([{ suit: 'hearts', rank: 'A' }] as any);

    useGameStore.getState().reset();

    expect(useGameStore.getState().currentRoom).toBeNull();
    expect(useGameStore.getState().gameState).toBeNull();
    expect(useGameStore.getState().holeCards).toEqual([]);
    expect(useGameStore.getState().actionRequired).toBeNull();
  });

  it('should not reset roomList on reset', () => {
    const rooms = [{ id: '1', name: 'Test' }];
    useGameStore.getState().setRoomList(rooms as any);
    useGameStore.getState().reset();
    expect(useGameStore.getState().roomList).toEqual(rooms);
  });
});
