'use client';

import type { RoomPlayer } from '@/src/lib/types';
import Button from '@/src/components/shared/Button';

interface PlayerListProps {
  players: RoomPlayer[];
  myUuid: string | null;
  isHost: boolean;
  isWaiting: boolean;
  onKick?: (uuid: string) => void;
}

export default function PlayerList({
  players,
  myUuid,
  isHost,
  isWaiting,
  onKick,
}: PlayerListProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold text-white">플레이어</h3>
      {players.map((player) => (
        <div
          key={player.uuid}
          className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            {player.isHost && (
              <span className="rounded bg-yellow-600 px-1 text-[10px] font-bold text-white">
                HOST
              </span>
            )}
            <span
              className={`text-sm ${player.uuid === myUuid ? 'font-bold text-blue-400' : 'text-white'}`}
            >
              {player.nickname}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isWaiting && (
              <span
                className={`text-xs ${player.isReady ? 'text-green-400' : 'text-gray-500'}`}
              >
                {player.isReady ? 'Ready' : 'Not Ready'}
              </span>
            )}
            {isHost && isWaiting && player.uuid !== myUuid && onKick && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onKick(player.uuid)}
              >
                추방
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
