import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from './Card';
import type { Card as CardType } from '@/src/lib/types';

describe('Card', () => {
  it('should render card back when no card provided', () => {
    const { container } = render(<Card />);
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-gradient-to-br', 'from-blue-800', 'to-blue-900');
  });

  it('should render card back when faceUp is false', () => {
    const card: CardType = { suit: 'hearts', rank: 'A' };
    render(<Card card={card} faceUp={false} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('should render card face when faceUp is true', () => {
    const card: CardType = { suit: 'hearts', rank: 'A' };
    render(<Card card={card} faceUp={true} />);
    const rankElements = screen.getAllByText('A');
    expect(rankElements.length).toBe(2); // top and bottom rank
  });

  it('should render suit symbol for hearts', () => {
    const card: CardType = { suit: 'hearts', rank: 'K' };
    render(<Card card={card} />);
    expect(screen.getByText('\u2665')).toBeInTheDocument();
  });

  it('should render suit symbol for spades', () => {
    const card: CardType = { suit: 'spades', rank: 'Q' };
    render(<Card card={card} />);
    expect(screen.getByText('\u2660')).toBeInTheDocument();
  });

  it('should render suit symbol for diamonds', () => {
    const card: CardType = { suit: 'diamonds', rank: '10' };
    render(<Card card={card} />);
    expect(screen.getByText('\u2666')).toBeInTheDocument();
  });

  it('should render suit symbol for clubs', () => {
    const card: CardType = { suit: 'clubs', rank: 'J' };
    render(<Card card={card} />);
    expect(screen.getByText('\u2663')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const card: CardType = { suit: 'hearts', rank: 'A' };
    const { container } = render(<Card card={card} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should apply size classes for sm', () => {
    const card: CardType = { suit: 'hearts', rank: 'A' };
    const { container } = render(<Card card={card} size="sm" />);
    expect(container.firstChild).toHaveClass('w-10', 'h-14');
  });

  it('should apply size classes for lg', () => {
    const card: CardType = { suit: 'hearts', rank: 'A' };
    const { container } = render(<Card card={card} size="lg" />);
    expect(container.firstChild).toHaveClass('w-20', 'h-28');
  });
});
