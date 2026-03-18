'use client';

import type { PublicGameState, Card as CardType } from '@/src/lib/types';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import PotDisplay from './PotDisplay';

interface PokerTableProps {
  gameState: PublicGameState;
  holeCards: CardType[];
  myUuid: string | null;
}

// Seat positions for up to 6 players around an oval table
const SEAT_POSITIONS = [
  'bottom-0 left-1/2 -translate-x-1/2',           // 0: bottom center (me)
  'top-1/2 left-0 -translate-y-1/2',               // 1: left middle
  'top-0 left-1/4 -translate-x-1/2',               // 2: top left
  'top-0 right-1/4 translate-x-1/2',               // 3: top right
  'top-1/2 right-0 -translate-y-1/2',              // 4: right middle
  'bottom-0 right-1/4 translate-x-1/2',            // 5: bottom right
];

export default function PokerTable({ gameState, holeCards, myUuid }: PokerTableProps) {
  // Reorder players so current user is at seat position 0 (bottom)
  const myIndex = gameState.players.findIndex((p) => p.uuid === myUuid);
  const reorderedPlayers = [...gameState.players];
  if (myIndex > 0) {
    const before = reorderedPlayers.splice(0, myIndex);
    reorderedPlayers.push(...before);
  }

  return (
    <div className="relative mx-auto h-full min-h-[500px] w-full max-w-3xl">
      {/* Table felt */}
      <div className="absolute inset-12 rounded-[50%] border-4 border-yellow-800 bg-gradient-to-b from-green-800 to-green-900 shadow-inner" />

      {/* Community cards + pot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
        {gameState.communityCards.length > 0 && (
          <CommunityCards cards={gameState.communityCards} />
        )}
        <PotDisplay pot={gameState.pot} sidePots={gameState.sidePots} />
        <div className="text-xs text-gray-400">
          Hand #{gameState.handNumber} - {gameState.phase}
        </div>
      </div>

      {/* Player seats */}
      {reorderedPlayers.map((player, i) => (
        <div
          key={player.uuid}
          className={`absolute ${SEAT_POSITIONS[i] ?? SEAT_POSITIONS[0]}`}
        >
          <PlayerSeat
            player={player}
            isCurrentTurn={player.uuid === gameState.currentPlayerUuid}
            isDealer={player.uuid === gameState.dealerUuid}
            holeCards={player.uuid === myUuid ? holeCards : undefined}
            isMe={player.uuid === myUuid}
          />
        </div>
      ))}
    </div>
  );
}
