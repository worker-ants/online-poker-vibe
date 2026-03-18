'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    const onConnect = () => {
      if (!cancelled) setIsConnected(true);
    };
    const onDisconnect = () => {
      if (!cancelled) setIsConnected(false);
    };

    async function init() {
      // /player/me 호출로 서버가 player_uuid 쿠키를 설정하게 한 뒤 소켓 연결
      try {
        await fetch(`${BACKEND_URL}/player/me`, { credentials: 'include' });
      } catch {
        // fetch 실패 시에도 소켓 연결을 시도 (쿠키가 이미 존재할 수 있음)
      }

      if (cancelled) return;

      const newSocket = getSocket();
      socketRef.current = newSocket;

      newSocket.on('connect', onConnect);
      newSocket.on('disconnect', onDisconnect);
      newSocket.connect();

      if (cancelled) {
        newSocket.off('connect', onConnect);
        newSocket.off('disconnect', onDisconnect);
        disconnectSocket();
        return;
      }

      setSocket(newSocket);
    }

    init();

    return () => {
      cancelled = true;
      const currentSocket = socketRef.current;
      if (currentSocket) {
        currentSocket.off('connect', onConnect);
        currentSocket.off('disconnect', onDisconnect);
      }
      disconnectSocket();
      socketRef.current = null;
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
