import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BettingControls from './BettingControls';
import type { ActionRequired } from '@/src/lib/types';

function makeAction(overrides?: Partial<ActionRequired>): ActionRequired {
  return {
    playerUuid: 'p1',
    validActions: ['fold', 'check', 'call', 'raise', 'all-in'],
    callAmount: 20,
    minRaise: 40,
    maxRaise: 1000,
    timeLimit: 30,
    ...overrides,
  };
}

describe('BettingControls', () => {
  it('should render fold button when available', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction()} onAction={onAction} />);
    expect(screen.getByText('Fold')).toBeInTheDocument();
  });

  it('should render check button when available', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction()} onAction={onAction} />);
    expect(screen.getByText('Check')).toBeInTheDocument();
  });

  it('should render call button with amount', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction()} onAction={onAction} />);
    expect(screen.getByText('Call 20')).toBeInTheDocument();
  });

  it('should call onAction with fold when fold clicked', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction()} onAction={onAction} />);
    fireEvent.click(screen.getByText('Fold'));
    expect(onAction).toHaveBeenCalledWith('fold');
  });

  it('should call onAction with check when check clicked', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction()} onAction={onAction} />);
    fireEvent.click(screen.getByText('Check'));
    expect(onAction).toHaveBeenCalledWith('check');
  });

  it('should call onAction with call when call clicked', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction()} onAction={onAction} />);
    fireEvent.click(screen.getByText('Call 20'));
    expect(onAction).toHaveBeenCalledWith('call');
  });

  it('should render raise slider and button when raise available', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction()} onAction={onAction} />);
    expect(screen.getByText(/Raise to/)).toBeInTheDocument();
  });

  it('should not render check when not in validActions', () => {
    const onAction = vi.fn();
    render(<BettingControls actionRequired={makeAction({ validActions: ['fold', 'call', 'raise', 'all-in'] })} onAction={onAction} />);
    expect(screen.queryByText('Check')).not.toBeInTheDocument();
  });

  it('should update raiseAmount when minRaise changes', async () => {
    const onAction = vi.fn();
    const { rerender } = render(<BettingControls actionRequired={makeAction({ minRaise: 40 })} onAction={onAction} />);

    rerender(<BettingControls actionRequired={makeAction({ minRaise: 80 })} onAction={onAction} />);

    expect(screen.getByText('Raise to 80')).toBeInTheDocument();
  });
});
