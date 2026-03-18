'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/src/lib/socket';
import { BACKEND_URL } from '@/src/lib/constants';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // player_uuid 쿠키를 먼저 생성한 후 소켓 연결
      await fetch(`${BACKEND_URL}/player/me`, { credentials: 'include' });

      if (cancelled) return;

      const s = getSocket();
      setSocket(s);

      s.on('connect', () => setIsConnected(true));
      s.on('disconnect', () => setIsConnected(false));

      s.connect();
    }

    init();

    return () => {
      cancelled = true;
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
