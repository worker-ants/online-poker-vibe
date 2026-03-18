'use client';

import type { RoomInfo } from '@/src/lib/types';
import { VARIANT_LABELS, MODE_LABELS } from '@/src/lib/types';
import Button from '@/src/components/shared/Button';

interface RoomCardProps {
  room: RoomInfo;
  onJoin: (roomId: string) => void;
  disabled?: boolean;
}

export default function RoomCard({ room, onJoin, disabled }: RoomCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 p-4 transition-colors hover:border-gray-600">
      <div className="flex flex-col gap-1">
        <div className="font-semibold text-white">{room.name}</div>
        <div className="flex gap-2 text-sm">
          <span className="rounded bg-blue-900 px-2 py-0.5 text-blue-300">
            {VARIANT_LABELS[room.variant]}
          </span>
          <span className="rounded bg-purple-900 px-2 py-0.5 text-purple-300">
            {MODE_LABELS[room.mode]}
          </span>
        </div>
        <div className="text-sm text-gray-400">
          호스트: {room.hostNickname}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-gray-300">
          {room.playerCount}/{room.maxPlayers}
        </span>
        <Button
          onClick={() => onJoin(room.id)}
          disabled={disabled || room.playerCount >= room.maxPlayers}
          size="sm"
        >
          참여
        </Button>
      </div>
    </div>
  );
}
