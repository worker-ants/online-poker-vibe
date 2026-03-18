'use client';

import type { Card as CardType } from '@/src/lib/types';
import Card from '@/src/components/cards/Card';

interface CommunityCardsProps {
  cards: CardType[];
}

export default function CommunityCards({ cards }: CommunityCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      {cards.map((card, i) => (
        <Card key={i} card={card} faceUp={true} size="md" />
      ))}
      {/* Placeholder for remaining cards */}
      {Array.from({ length: 5 - cards.length }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-gray-600"
        />
      ))}
    </div>
  );
}
