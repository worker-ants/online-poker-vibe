'use client';

import type { Card as CardType } from '@/src/lib/types';

interface CardProps {
  card?: CardType;
  faceUp?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-white',
  spades: 'text-white',
};

const sizeClasses = {
  sm: 'w-10 h-14 text-xs',
  md: 'w-14 h-20 text-sm',
  lg: 'w-20 h-28 text-base',
};

export default function Card({ card, faceUp = true, size = 'md', className = '' }: CardProps) {
  if (!card || !faceUp) {
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-lg border-2 border-gray-500 bg-gradient-to-br from-blue-800 to-blue-900 shadow-md ${className}`}
      >
        <div className="text-2xl text-blue-400 opacity-50">?</div>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit] ?? '';
  const suitColor = SUIT_COLORS[card.suit] ?? 'text-white';

  return (
    <div
      className={`${sizeClasses[size]} flex flex-col items-center justify-between rounded-lg border-2 border-gray-300 bg-white p-1 shadow-md ${className}`}
    >
      <div className={`self-start font-bold ${suitColor}`}>
        {card.rank}
      </div>
      <div className={`text-2xl ${suitColor}`}>{suitSymbol}</div>
      <div className={`self-end rotate-180 font-bold ${suitColor}`}>
        {card.rank}
      </div>
    </div>
  );
}
