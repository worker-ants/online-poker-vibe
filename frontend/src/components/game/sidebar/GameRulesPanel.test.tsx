import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import GameRulesPanel from './GameRulesPanel';
import type { PokerVariant, GameMode, RoomSettings } from '@/src/lib/types';

const baseSettings: RoomSettings = {
  startingChips: 1000,
  smallBlind: 10,
  bigBlind: 20,
};

function renderPanel(
  overrides: { variant?: PokerVariant; mode?: GameMode; settings?: RoomSettings } = {},
) {
  return render(
    <GameRulesPanel
      variant={overrides.variant ?? 'texas-holdem'}
      mode={overrides.mode ?? 'cash'}
      settings={overrides.settings ?? baseSettings}
    />,
  );
}

describe('GameRulesPanel', () => {
  it('renders variant and mode', () => {
    renderPanel();
    expect(screen.getByText("Texas Hold'em")).toBeInTheDocument();
    expect(screen.getByText('Cash Game')).toBeInTheDocument();
  });

  it('renders blinds and starting chips', () => {
    renderPanel();
    expect(screen.getByText('10 / 20')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('renders five-card-draw variant', () => {
    renderPanel({ variant: 'five-card-draw' });
    expect(screen.getByText('5 Card Draw')).toBeInTheDocument();
    expect(screen.queryByText('Ante')).not.toBeInTheDocument();
  });

  it('shows ante for seven-card-stud', () => {
    renderPanel({
      variant: 'seven-card-stud',
      settings: { ...baseSettings, ante: 5 },
    });
    expect(screen.getByText('Ante')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('does not show ante when ante is 0', () => {
    renderPanel({
      variant: 'seven-card-stud',
      settings: { ...baseSettings, ante: 0 },
    });
    expect(screen.queryByText('Ante')).not.toBeInTheDocument();
  });

  it('does not show ante for texas-holdem', () => {
    renderPanel();
    expect(screen.queryByText('Ante')).not.toBeInTheDocument();
  });

  it('shows blind schedule for tournament mode', async () => {
    const user = userEvent.setup();
    renderPanel({
      mode: 'tournament',
      settings: {
        ...baseSettings,
        blindSchedule: [
          { level: 1, smallBlind: 10, bigBlind: 20, handsPerLevel: 10 },
          { level: 2, smallBlind: 20, bigBlind: 40, handsPerLevel: 10 },
          { level: 3, smallBlind: 50, bigBlind: 100, handsPerLevel: 10 },
        ],
      },
    });

    // Blind schedule should be collapsed by default
    expect(screen.getByText('Blind Schedule')).toBeInTheDocument();
    expect(screen.queryByText('Lv.1')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText('Blind Schedule'));
    expect(screen.getByText('Lv.1')).toBeInTheDocument();
    expect(screen.getByText('Lv.2')).toBeInTheDocument();
    expect(screen.getByText('Lv.3')).toBeInTheDocument();
    expect(screen.getByText('50 / 100')).toBeInTheDocument();

    // Click to collapse again
    await user.click(screen.getByText('Blind Schedule'));
    expect(screen.queryByText('Lv.1')).not.toBeInTheDocument();
  });

  it('does not show blind schedule for cash mode', () => {
    renderPanel();
    expect(screen.queryByText('Blind Schedule')).not.toBeInTheDocument();
  });

  it('does not show blind schedule when blindSchedule is empty', () => {
    renderPanel({
      mode: 'tournament',
      settings: { ...baseSettings, blindSchedule: [] },
    });
    expect(screen.queryByText('Blind Schedule')).not.toBeInTheDocument();
  });
});
