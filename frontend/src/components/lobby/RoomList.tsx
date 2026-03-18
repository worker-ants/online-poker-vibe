'use client';

import { useRoomList } from '@/src/hooks/useRoomList';
import RoomCard from './RoomCard';

interface RoomListProps {
  onJoin: (roomId: string) => void;
  disabled?: boolean;
}

export default function RoomList({ onJoin, disabled }: RoomListProps) {
  const rooms = useRoomList();

  if (rooms.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center text-gray-400">
        대기 중인 방이 없습니다. 새로운 방을 만들어보세요!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          onJoin={onJoin}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
