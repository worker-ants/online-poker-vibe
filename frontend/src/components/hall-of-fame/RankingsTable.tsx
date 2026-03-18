'use client';

import type { HallOfFameEntry } from '@/src/lib/types';

interface RankingsTableProps {
  entries: HallOfFameEntry[];
  onPlayerClick: (uuid: string) => void;
}

export default function RankingsTable({ entries, onPlayerClick }: RankingsTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg bg-gray-800 p-8 text-center text-gray-400">
        아직 기록된 게임이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            <th className="px-3 py-3">순위</th>
            <th className="px-3 py-3">닉네임</th>
            <th className="px-3 py-3 text-center">승</th>
            <th className="px-3 py-3 text-center">무</th>
            <th className="px-3 py-3 text-center">패</th>
            <th className="px-3 py-3 text-center">이탈</th>
            <th className="px-3 py-3 text-center">승률</th>
            <th className="px-3 py-3">마지막 게임</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.uuid}
              onClick={() => onPlayerClick(entry.uuid)}
              className="cursor-pointer border-b border-gray-800 text-white transition-colors hover:bg-gray-800"
            >
              <td className="px-3 py-3 font-bold text-yellow-400">
                {entry.rank}
              </td>
              <td className="px-3 py-3 font-medium">{entry.nickname}</td>
              <td className="px-3 py-3 text-center text-green-400">{entry.wins}</td>
              <td className="px-3 py-3 text-center text-gray-400">{entry.draws}</td>
              <td className="px-3 py-3 text-center text-red-400">{entry.losses}</td>
              <td className="px-3 py-3 text-center text-orange-400">{entry.abandonments}</td>
              <td className="px-3 py-3 text-center font-mono">
                {entry.winRate.toFixed(2)}%
              </td>
              <td className="px-3 py-3 text-gray-400">
                {entry.lastGameTime
                  ? new Date(entry.lastGameTime).toLocaleString('ko-KR')
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
