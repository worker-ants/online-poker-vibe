export type PokerVariant = 'texas-holdem' | 'five-card-draw' | 'seven-card-stud';
export type GameMode = 'tournament' | 'cash';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'folded' | 'all-in' | 'disconnected';
export type BettingAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';
export type GamePhase = 'pre-deal' | 'deal' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'draw' | 'first-bet' | 'second-bet' | 'ante' | 'third-street' | 'fourth-street' | 'fifth-street' | 'sixth-street' | 'seventh-street' | 'showdown';

export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  faceUp?: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  variant: PokerVariant;
  mode: GameMode;
  status: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  hostNickname: string;
  createdAt: string;
}

export interface RoomPlayer {
  uuid: string;
  nickname: string;
  seatIndex: number;
  isReady: boolean;
  isHost: boolean;
}

export interface RoomState {
  roomId: string;
  name: string;
  variant: PokerVariant;
  mode: GameMode;
  status: RoomStatus;
  hostUuid: string;
  maxPlayers: number;
  players: RoomPlayer[];
}

export interface PlayerPublicState {
  uuid: string;
  nickname: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isDisconnected: boolean;
  visibleCards: Card[];
  cardCount: number;
}

export interface PublicGameState {
  phase: GamePhase;
  communityCards: Card[];
  pot: number;
  sidePots: { amount: number; playerUuids: string[] }[];
  currentPlayerUuid: string | null;
  dealerUuid: string | null;
  players: PlayerPublicState[];
  handNumber: number;
}

export interface ActionRequired {
  playerUuid: string;
  validActions: BettingAction[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  timeLimit: number;
}

export interface ShowdownResult {
  players: {
    uuid: string;
    cards: Card[];
    handRank: string;
    handDescription: string;
  }[];
  winners: {
    uuid: string;
    amount: number;
    potType: 'main' | 'side';
  }[];
}

export interface GameEndResult {
  roomId: string;
  gameId: string;
  results: {
    uuid: string;
    nickname: string;
    result: 'win' | 'loss' | 'draw' | 'abandoned';
    chipsDelta: number;
    placement?: number;
  }[];
}

export interface HallOfFameEntry {
  rank: number;
  uuid: string;
  nickname: string;
  wins: number;
  draws: number;
  losses: number;
  abandonments: number;
  winRate: number;
  totalGames: number;
  lastGameTime: string | null;
}

export interface GameHistoryEntry {
  gameId: string;
  variant: string;
  mode: string;
  gameTime: string;
  result: string;
  players: { nickname: string; placement: number | null }[];
}

export const VARIANT_LABELS: Record<PokerVariant, string> = {
  'texas-holdem': 'Texas Hold\'em',
  'five-card-draw': '5 Card Draw',
  'seven-card-stud': '7 Card Stud',
};

export const MODE_LABELS: Record<GameMode, string> = {
  tournament: 'Tournament',
  cash: 'Cash Game',
};
