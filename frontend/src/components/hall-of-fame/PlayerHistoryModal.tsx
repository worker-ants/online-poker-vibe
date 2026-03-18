'use client';

import Modal from '@/src/components/shared/Modal';
import type { GameHistoryEntry } from '@/src/lib/types';
import { VARIANT_LABELS, MODE_LABELS } from '@/src/lib/types';
import type { PokerVariant, GameMode } from '@/src/lib/types';

interface PlayerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  games: GameHistoryEntry[];
}

export default function PlayerHistoryModal({
  isOpen,
  onClose,
  nickname,
  games,
}: PlayerHistoryModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${nickname}의 게임 전적`}>
      <div className="max-h-96 overflow-y-auto">
        {games.length === 0 ? (
          <p className="text-gray-400">게임 전적이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {games.map((game) => (
              <div
                key={game.gameId}
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-3"
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {new Date(game.gameTime).toLocaleString('ko-KR')}
                  </span>
                  <div className="flex gap-2">
                    <span className="rounded bg-blue-900 px-2 py-0.5 text-xs text-blue-300">
                      {VARIANT_LABELS[game.variant as PokerVariant] ?? game.variant}
                    </span>
                    <span className="rounded bg-purple-900 px-2 py-0.5 text-xs text-purple-300">
                      {MODE_LABELS[game.mode as GameMode] ?? game.mode}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {game.players.map((p, i) => (
                    <span
                      key={i}
                      className={`text-sm ${
                        p.nickname === nickname
                          ? 'font-bold text-blue-400'
                          : 'text-gray-300'
                      }`}
                    >
                      {p.placement != null ? `${p.placement}위 ` : ''}
                      {p.nickname}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
