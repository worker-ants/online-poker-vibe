'use client';

import type { PlayerPublicState, Card as CardType } from '@/src/lib/types';
import Card from '@/src/components/cards/Card';

interface PlayerSeatProps {
  player: PlayerPublicState;
  isCurrentTurn: boolean;
  isDealer: boolean;
  holeCards?: CardType[];
  isMe: boolean;
}

export default function PlayerSeat({
  player,
  isCurrentTurn,
  isDealer,
  holeCards,
  isMe,
}: PlayerSeatProps) {
  const cards = isMe ? holeCards : undefined;
  const cardCount = isMe ? (holeCards?.length ?? 0) : player.cardCount;

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl p-3 transition-all ${
        isCurrentTurn
          ? 'bg-yellow-900/40 ring-2 ring-yellow-500'
          : 'bg-gray-800/60'
      } ${player.isFolded ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-1">
        {isDealer && (
          <span className="rounded-full bg-yellow-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
            D
          </span>
        )}
        <span className={`text-sm font-medium ${isMe ? 'text-blue-400' : 'text-white'}`}>
          {player.nickname}
          {player.isAllIn && <span className="ml-1 text-red-400">(All-in)</span>}
          {player.isFolded && <span className="ml-1 text-gray-500">(Fold)</span>}
        </span>
      </div>

      <div className="flex gap-1">
        {cards
          ? cards.map((card, i) => (
              <Card key={i} card={card} faceUp={true} size="sm" />
            ))
          : Array.from({ length: Math.min(cardCount, 7) }).map((_, i) => (
              <Card key={i} faceUp={false} size="sm" />
            ))}
        {player.visibleCards.map((card, i) => (
          <Card key={`v-${i}`} card={card} faceUp={true} size="sm" />
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-yellow-400">{player.chips} chips</span>
        {player.currentBet > 0 && (
          <span className="text-green-400">Bet: {player.currentBet}</span>
        )}
      </div>
    </div>
  );
}
