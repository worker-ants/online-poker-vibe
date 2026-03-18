'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/src/providers/SocketProvider';
import { useIdentity } from '@/src/providers/IdentityProvider';
import { useToast } from '@/src/providers/ToastProvider';
import { WS_EVENTS } from '@/src/lib/constants';
import NicknameInput from '@/src/components/lobby/NicknameInput';
import RoomList from '@/src/components/lobby/RoomList';
import CreateRoomModal from '@/src/components/lobby/CreateRoomModal';
import Button from '@/src/components/shared/Button';
import Link from 'next/link';

export default function LobbyPage() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { nickname } = useIdentity();
  const { addToast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleJoin = useCallback(
    (roomId: string) => {
      if (!socket || !nickname) {
        addToast('닉네임을 먼저 설정해주세요.', 'error');
        return;
      }

      socket.emit(
        WS_EVENTS.ROOM_JOIN,
        { roomId },
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            router.push(`/game/${roomId}`);
          } else {
            addToast(response.error ?? '방 참여에 실패했습니다.', 'error');
          }
        },
      );
    },
    [socket, nickname, router, addToast],
  );

  const handleCreate = useCallback(
    (data: { name: string; variant: string; mode: string; maxPlayers: number; settings: { startingChips: number; smallBlind: number; bigBlind: number } }) => {
      if (!socket || !nickname) {
        addToast('닉네임을 먼저 설정해주세요.', 'error');
        return;
      }

      socket.emit(
        WS_EVENTS.ROOM_CREATE,
        data,
        (response: { success: boolean; roomId?: string; error?: string }) => {
          if (response.success && response.roomId) {
            router.push(`/game/${response.roomId}`);
          } else {
            addToast(response.error ?? '방 생성에 실패했습니다.', 'error');
          }
        },
      );
    },
    [socket, nickname, router, addToast],
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-8 text-center text-4xl font-bold text-white">
        Online Poker
      </h1>

      {!isConnected && (
        <div className="mb-4 rounded-lg bg-yellow-900 p-3 text-center text-yellow-200">
          서버에 연결 중...
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <NicknameInput />
        <Link
          href="/hall-of-fame"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          명예의 전당 &rarr;
        </Link>
      </div>

      <div className="mb-4">
        <Button
          onClick={() => setShowCreateModal(true)}
          disabled={!nickname || !isConnected}
        >
          + Room 만들기
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-300">
          대기 중인 Room
        </h2>
        <RoomList onJoin={handleJoin} disabled={!nickname || !isConnected} />
      </div>

      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
