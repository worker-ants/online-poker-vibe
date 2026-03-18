import type { Card } from './card.types.js';

export type PokerVariant =
  | 'texas-holdem'
  | 'five-card-draw'
  | 'seven-card-stud';
export type GameMode = 'tournament' | 'cash';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type GameStatus = 'in-progress' | 'completed' | 'abandoned';
export type GameResult = 'win' | 'loss' | 'draw' | 'abandoned';

export type HoldemPhase =
  | 'deal'
  | 'pre-flop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown';

export type DrawPhase =
  | 'deal'
  | 'first-bet'
  | 'draw'
  | 'second-bet'
  | 'showdown';

export type StudPhase =
  | 'ante'
  | 'third-street'
  | 'fourth-street'
  | 'fifth-street'
  | 'sixth-street'
  | 'seventh-street'
  | 'showdown';

export type GamePhase = HoldemPhase | DrawPhase | StudPhase;

export type BettingAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

export interface PlayerAction {
  type: BettingAction | 'draw';
  amount?: number;
  discardIndices?: number[];
}

export interface PlayerSeat {
  uuid: string;
  nickname: string;
  seatIndex: number;
  chips: number;
}

export interface PlayerState {
  uuid: string;
  nickname: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  holeCards: Card[];
  visibleCards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  isDisconnected: boolean;
  hasActed: boolean;
}

export interface SidePot {
  amount: number;
  playerUuids: string[];
}

export interface ActionRecord {
  playerUuid: string;
  action: PlayerAction;
  timestamp: number;
}

export interface GameState {
  gameId: string;
  variant: PokerVariant;
  phase: GamePhase;
  deck: Card[];
  communityCards: Card[];
  players: PlayerState[];
  pot: number;
  sidePots: SidePot[];
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentBet: number;
  minRaise: number;
  roundHistory: ActionRecord[];
  handNumber: number;
}

export interface HandRank {
  category: HandCategory;
  categoryRank: number;
  values: number[];
  description: string;
}

export enum HandCategory {
  RoyalFlush = 'Royal Flush',
  StraightFlush = 'Straight Flush',
  FourOfAKind = 'Four of a Kind',
  FullHouse = 'Full House',
  Flush = 'Flush',
  Straight = 'Straight',
  ThreeOfAKind = 'Three of a Kind',
  TwoPair = 'Two Pair',
  OnePair = 'One Pair',
  HighCard = 'High Card',
}

export const HAND_CATEGORY_RANKS: Record<HandCategory, number> = {
  [HandCategory.RoyalFlush]: 10,
  [HandCategory.StraightFlush]: 9,
  [HandCategory.FourOfAKind]: 8,
  [HandCategory.FullHouse]: 7,
  [HandCategory.Flush]: 6,
  [HandCategory.Straight]: 5,
  [HandCategory.ThreeOfAKind]: 4,
  [HandCategory.TwoPair]: 3,
  [HandCategory.OnePair]: 2,
  [HandCategory.HighCard]: 1,
};

export interface HandResult {
  winners: {
    uuid: string;
    amount: number;
    potType: 'main' | 'side';
  }[];
  playerHands: {
    uuid: string;
    cards: Card[];
    handRank: HandRank;
  }[];
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
  isAI: boolean;
}

export interface PublicGameState {
  phase: GamePhase;
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];
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
  isDraw?: boolean;
}

export interface ShowdownPlayerInfo {
  uuid: string;
  cards: Card[];
  handRank: string;
  handDescription: string;
}

export interface ShowdownWinner {
  uuid: string;
  amount: number;
  potType: 'main' | 'side';
}

export interface ShowdownResult {
  players: ShowdownPlayerInfo[];
  winners: ShowdownWinner[];
}

export interface GameEndPlayerResult {
  uuid: string;
  nickname: string;
  result: GameResult;
  chipsDelta: number;
  placement: number;
  isAI: boolean;
}

export interface GameEndResult {
  roomId: string;
  gameId: string;
  results: GameEndPlayerResult[];
}

export interface HandleActionResult {
  handComplete: boolean;
  gameOver: boolean;
  showdown?: ShowdownResult;
  gameResult?: GameEndResult;
}

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  handsPerLevel: number;
}

export interface RoomSettings {
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  blindSchedule?: BlindLevel[];
}
