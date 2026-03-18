'use client';

import { useState, useEffect } from 'react';
import type { ActionRequired } from '@/src/lib/types';
import Button from '@/src/components/shared/Button';

interface BettingControlsProps {
  actionRequired: ActionRequired;
  onAction: (action: string, amount?: number) => void;
}

export default function BettingControls({ actionRequired, onAction }: BettingControlsProps) {
  const [raiseAmount, setRaiseAmount] = useState(actionRequired.minRaise);

  useEffect(() => {
    setRaiseAmount(actionRequired.minRaise);
  }, [actionRequired.minRaise]);

  const { validActions, callAmount, minRaise, maxRaise } = actionRequired;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold text-yellow-400">당신의 차례입니다!</h3>

      <div className="flex flex-wrap gap-2">
        {validActions.includes('fold') && (
          <Button variant="danger" onClick={() => onAction('fold')}>
            Fold
          </Button>
        )}
        {validActions.includes('check') && (
          <Button variant="secondary" onClick={() => onAction('check')}>
            Check
          </Button>
        )}
        {validActions.includes('call') && (
          <Button onClick={() => onAction('call')}>
            Call {callAmount}
          </Button>
        )}
        {validActions.includes('all-in') && (
          <Button variant="danger" onClick={() => onAction('all-in')}>
            All-in
          </Button>
        )}
      </div>

      {validActions.includes('raise') && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              min={minRaise}
              max={maxRaise}
              className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-center text-white"
            />
          </div>
          <Button
            variant="success"
            onClick={() => onAction('raise', raiseAmount)}
          >
            Raise to {raiseAmount}
          </Button>
        </div>
      )}
    </div>
  );
}
