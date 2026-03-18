'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import RankingsTable from '@/src/components/hall-of-fame/RankingsTable';
import PlayerHistoryModal from '@/src/components/hall-of-fame/PlayerHistoryModal';
import { BACKEND_URL } from '@/src/lib/constants';
import type { HallOfFameEntry, GameHistoryEntry } from '@/src/lib/types';

export default function HallOfFamePage() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState<{
    uuid: string;
    nickname: string;
    games: GameHistoryEntry[];
  } | null>(null);

  const limit = 20;

  useEffect(() => {
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/hall-of-fame?page=${page}&limit=${limit}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        setEntries(data.data ?? []);
        setTotal(data.pagination?.total ?? 0);
      } catch {
        setEntries([]);
      }
      setLoading(false);
    };

    fetchRankings();
  }, [page]);

  const handlePlayerClick = async (uuid: string) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/hall-of-fame/${uuid}/history`,
        { credentials: 'include' },
      );
      const data = await res.json();
      setSelectedPlayer({
        uuid,
        nickname: data.nickname ?? 'Unknown',
        games: data.games ?? [],
      });
    } catch {
      // ignore
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          &larr; 로비
        </Link>
        <h1 className="text-2xl font-bold text-white">명예의 전당</h1>
        <div />
      </div>

      {loading ? (
        <div className="text-center text-gray-400">로딩 중...</div>
      ) : (
        <>
          <RankingsTable
            entries={entries}
            onPlayerClick={handlePlayerClick}
          />

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50"
              >
                &lt;
              </button>
              <span className="text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          )}
        </>
      )}

      {selectedPlayer && (
        <PlayerHistoryModal
          isOpen={true}
          onClose={() => setSelectedPlayer(null)}
          nickname={selectedPlayer.nickname}
          games={selectedPlayer.games}
        />
      )}
    </div>
  );
}
