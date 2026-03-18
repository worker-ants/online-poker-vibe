'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useSocket } from './SocketProvider';
import { WS_EVENTS } from '@/src/lib/constants';

interface IdentityContextType {
  playerId: string | null;
  nickname: string | null;
  setNickname: (name: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

const IdentityContext = createContext<IdentityContextType>({
  playerId: null,
  nickname: null,
  setNickname: async () => ({ success: false }),
  isLoading: true,
});

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nickname, setNicknameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;

    const handleIdentity = (data: { playerId: string; nickname: string | null }) => {
      setPlayerId(data.playerId);
      setNicknameState(data.nickname);
      setIsLoading(false);
    };

    socket.on(WS_EVENTS.IDENTITY_CONFIRMED, handleIdentity);

    return () => {
      socket.off(WS_EVENTS.IDENTITY_CONFIRMED, handleIdentity);
    };
  }, [socket]);

  const setNickname = useCallback(
    async (name: string): Promise<{ success: boolean; error?: string }> => {
      if (!socket) return { success: false, error: '연결되지 않았습니다.' };

      return new Promise((resolve) => {
        socket.emit(
          WS_EVENTS.IDENTITY_SET_NICKNAME,
          { nickname: name },
          (response: { success: boolean; nickname?: string; error?: string }) => {
            if (response.success) {
              setNicknameState(response.nickname ?? name);
              resolve({ success: true });
            } else {
              resolve({ success: false, error: response.error });
            }
          },
        );
      });
    },
    [socket],
  );

  return (
    <IdentityContext.Provider value={{ playerId, nickname, setNickname, isLoading }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  return useContext(IdentityContext);
}
