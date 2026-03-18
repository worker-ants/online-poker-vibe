'use client';

import type { Card as CardType } from '@/src/lib/types';
import Card from '@/src/components/cards/Card';

interface CommunityCardsProps {
  cards: CardType[];
  maxCards?: number;
}

export default function CommunityCards({ cards, maxCards = 5 }: CommunityCardsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {cards.map((card) => (
        <Card key={`${card.suit}-${card.rank}`} card={card} faceUp={true} size="md" />
      ))}
      {/* Placeholder for remaining cards */}
      {Array.from({ length: maxCards - cards.length }).map((_, i) => (
        <div
          key={`placeholder-${i}`}
          className="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-gray-600"
        />
      ))}
    </div>
  );
}
