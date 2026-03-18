'use client';

import { create } from 'zustand';
import type {
  RoomInfo,
  RoomState,
  PublicGameState,
  ActionRequired,
  ShowdownResult,
  GameEndResult,
  Card,
} from '@/src/lib/types';

interface GameStore {
  // Room list
  roomList: RoomInfo[];
  setRoomList: (rooms: RoomInfo[]) => void;

  // Current room
  currentRoom: RoomState | null;
  setCurrentRoom: (room: RoomState | null) => void;

  // Game state
  gameState: PublicGameState | null;
  setGameState: (state: PublicGameState | null) => void;

  // Private cards
  holeCards: Card[];
  setHoleCards: (cards: Card[]) => void;

  // Action required
  actionRequired: ActionRequired | null;
  setActionRequired: (action: ActionRequired | null) => void;

  // Showdown
  showdown: ShowdownResult | null;
  setShowdown: (result: ShowdownResult | null) => void;

  // Game end
  gameEnd: GameEndResult | null;
  setGameEnd: (result: GameEndResult | null) => void;

  // Reset
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  roomList: [],
  setRoomList: (roomList) => set({ roomList }),

  currentRoom: null,
  setCurrentRoom: (currentRoom) => set({ currentRoom }),

  gameState: null,
  setGameState: (gameState) => set({ gameState }),

  holeCards: [],
  setHoleCards: (holeCards) => set({ holeCards }),

  actionRequired: null,
  setActionRequired: (actionRequired) => set({ actionRequired }),

  showdown: null,
  setShowdown: (showdown) => set({ showdown }),

  gameEnd: null,
  setGameEnd: (gameEnd) => set({ gameEnd }),

  reset: () =>
    set({
      currentRoom: null,
      gameState: null,
      holeCards: [],
      actionRequired: null,
      showdown: null,
      gameEnd: null,
    }),
}));
