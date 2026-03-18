'use client';

import { useState } from 'react';
import { useIdentity } from '@/src/providers/IdentityProvider';
import HelpModal from './HelpModal';
import type { PokerVariant } from '@/src/lib/types';

interface TopNavProps {
  variant?: PokerVariant;
}

export default function TopNav({ variant }: TopNavProps) {
  const { nickname } = useIdentity();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <nav className="flex items-center justify-between border-b border-gray-700 bg-gray-900 px-6 py-3">
        <div className="text-white">
          <span className="text-gray-400">Player: </span>
          <strong>{nickname ?? 'Unknown'}</strong>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
        >
          ? 도움말
        </button>
      </nav>
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        variant={variant}
      />
    </>
  );
}
