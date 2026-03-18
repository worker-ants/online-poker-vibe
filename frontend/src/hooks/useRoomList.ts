'use client';

import { useEffect } from 'react';
import { useSocket } from '@/src/providers/SocketProvider';
import { useGameStore } from './useGameStore';
import { WS_EVENTS } from '@/src/lib/constants';
import type { RoomInfo } from '@/src/lib/types';

export function useRoomList() {
  const { socket } = useSocket();
  const roomList = useGameStore((s) => s.roomList);
  const setRoomList = useGameStore((s) => s.setRoomList);

  useEffect(() => {
    if (!socket) return;

    // Request initial room list
    socket.emit(WS_EVENTS.ROOM_LIST, {}, (rooms: RoomInfo[]) => {
      if (Array.isArray(rooms)) {
        setRoomList(rooms);
      }
    });

    // Listen for updates
    const handleUpdate = (rooms: RoomInfo[]) => {
      if (Array.isArray(rooms)) {
        setRoomList(rooms);
      }
    };

    socket.on(WS_EVENTS.ROOM_LIST_UPDATE, handleUpdate);

    return () => {
      socket.off(WS_EVENTS.ROOM_LIST_UPDATE, handleUpdate);
    };
  }, [socket, setRoomList]);

  return roomList;
}
