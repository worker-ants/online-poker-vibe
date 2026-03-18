'use client';

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/src/providers/SocketProvider';
import { useIdentity } from '@/src/providers/IdentityProvider';
import { useToast } from '@/src/providers/ToastProvider';
import { useGameStore } from '@/src/hooks/useGameStore';
import { WS_EVENTS } from '@/src/lib/constants';
import TopNav from '@/src/components/game/TopNav';
import GameLayout from '@/src/components/game/GameLayout';
import PokerTable from '@/src/components/game/table/PokerTable';
import PlayerList from '@/src/components/game/sidebar/PlayerList';
import BettingControls from '@/src/components/game/sidebar/BettingControls';
import GameRulesPanel from '@/src/components/game/sidebar/GameRulesPanel';
import Button from '@/src/components/shared/Button';
import type {
  RoomState,
  PublicGameState,
  ActionRequired,
  ShowdownResult,
  GameEndResult,
  Card,
} from '@/src/lib/types';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { socket } = useSocket();
  const { playerId } = useIdentity();
  const { addToast } = useToast();

  const currentRoom = useGameStore((s) => s.currentRoom);
  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom);
  const gameState = useGameStore((s) => s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const holeCards = useGameStore((s) => s.holeCards);
  const setHoleCards = useGameStore((s) => s.setHoleCards);
  const actionRequired = useGameStore((s) => s.actionRequired);
  const setActionRequired = useGameStore((s) => s.setActionRequired);
  const showdown = useGameStore((s) => s.showdown);
  const setShowdown = useGameStore((s) => s.setShowdown);
  const gameEnd = useGameStore((s) => s.gameEnd);
  const setGameEnd = useGameStore((s) => s.setGameEnd);
  const reset = useGameStore((s) => s.reset);

  // Connect to room and set up listeners
  useEffect(() => {
    if (!socket || !roomId) return;

    // Join room (idempotent)
    socket.emit(WS_EVENTS.ROOM_JOIN, { roomId }, (response: { success: boolean; room?: RoomState }) => {
      if (response.success && response.room) {
        setCurrentRoom(response.room);
      }
    });

    const handleRoomUpdate = (data: RoomState) => {
      if (data.roomId === roomId) {
        setCurrentRoom(data);
      }
    };

    const handleGameState = (data: PublicGameState) => {
      setGameState(data);
      setShowdown(null);
    };

    const handlePrivate = (data: { holeCards: Card[] }) => {
      setHoleCards(data.holeCards);
    };

    const handleActionRequired = (data: ActionRequired) => {
      setActionRequired(data);
    };

    const handleShowdown = (data: ShowdownResult) => {
      setShowdown(data);
      setActionRequired(null);
    };

    const handleGameEnded = (data: GameEndResult) => {
      setGameEnd(data);
      setActionRequired(null);
    };

    const handleKicked = () => {
      addToast('방에서 추방되었습니다.', 'error');
      reset();
      router.push('/');
    };

    const handleActionPerformed = (data: { playerUuid: string; action: string; amount?: number }) => {
      // Clear action required if it was for the current player
      if (data.playerUuid === playerId) {
        setActionRequired(null);
      }
    };

    socket.on(WS_EVENTS.ROOM_UPDATED, handleRoomUpdate);
    socket.on(WS_EVENTS.GAME_STATE, handleGameState);
    socket.on(WS_EVENTS.GAME_PRIVATE, handlePrivate);
    socket.on(WS_EVENTS.GAME_ACTION_REQUIRED, handleActionRequired);
    socket.on(WS_EVENTS.GAME_ACTION_PERFORMED, handleActionPerformed);
    socket.on(WS_EVENTS.GAME_SHOWDOWN, handleShowdown);
    socket.on(WS_EVENTS.GAME_ENDED, handleGameEnded);
    socket.on(WS_EVENTS.ROOM_KICKED, handleKicked);

    return () => {
      socket.off(WS_EVENTS.ROOM_UPDATED, handleRoomUpdate);
      socket.off(WS_EVENTS.GAME_STATE, handleGameState);
      socket.off(WS_EVENTS.GAME_PRIVATE, handlePrivate);
      socket.off(WS_EVENTS.GAME_ACTION_REQUIRED, handleActionRequired);
      socket.off(WS_EVENTS.GAME_ACTION_PERFORMED, handleActionPerformed);
      socket.off(WS_EVENTS.GAME_SHOWDOWN, handleShowdown);
      socket.off(WS_EVENTS.GAME_ENDED, handleGameEnded);
      socket.off(WS_EVENTS.ROOM_KICKED, handleKicked);
    };
  }, [socket, roomId, playerId, router, addToast, setCurrentRoom, setGameState, setHoleCards, setActionRequired, setShowdown, setGameEnd, reset]);

  const handleReady = useCallback(() => {
    socket?.emit(WS_EVENTS.ROOM_READY, { roomId });
  }, [socket, roomId]);

  const handleKick = useCallback(
    (targetUuid: string) => {
      socket?.emit(WS_EVENTS.ROOM_KICK, { roomId, targetUuid });
    },
    [socket, roomId],
  );

  const handleLeave = useCallback(() => {
    socket?.emit(WS_EVENTS.ROOM_LEAVE, { roomId });
    reset();
    router.push('/');
  }, [socket, roomId, reset, router]);

  const handleAction = useCallback(
    (action: string, amount?: number) => {
      socket?.emit(
        WS_EVENTS.GAME_ACTION,
        { roomId, action, amount },
        (response: { success: boolean; error?: string }) => {
          if (!response.success) {
            addToast(response.error ?? '액션 처리에 실패했습니다.', 'error');
          }
        },
      );
      setActionRequired(null);
    },
    [socket, roomId, addToast, setActionRequired],
  );

  const isWaiting = !gameState && currentRoom?.status === 'waiting';
  const isHost = currentRoom?.hostUuid === playerId;

  return (
    <GameLayout
      topNav={<TopNav variant={currentRoom?.variant} />}
      table={
        gameState ? (
          <PokerTable
            gameState={gameState}
            holeCards={holeCards}
            myUuid={playerId}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="mb-2 text-xl">게임 시작을 기다리는 중...</p>
              <p>모든 플레이어가 준비 완료하면 게임이 시작됩니다.</p>
            </div>
          </div>
        )
      }
      sidebar={
        <div className="flex flex-col gap-4">
          {currentRoom && (
            <GameRulesPanel
              variant={currentRoom.variant}
              mode={currentRoom.mode}
              settings={currentRoom.settings}
            />
          )}

          {currentRoom && (
            <PlayerList
              players={currentRoom.players}
              myUuid={playerId}
              isHost={isHost}
              isWaiting={isWaiting ?? false}
              onKick={handleKick}
            />
          )}

          {isWaiting && (
            <Button variant="success" onClick={handleReady}>
              준비 완료
            </Button>
          )}

          {actionRequired && actionRequired.playerUuid === playerId && (
            <BettingControls
              actionRequired={actionRequired}
              onAction={handleAction}
            />
          )}

          {showdown && (
            <div className="rounded-lg bg-gray-800 p-3">
              <h3 className="mb-2 font-bold text-yellow-400">결과</h3>
              {showdown.winners.map((w, i) => (
                <p key={i} className="text-sm text-green-400">
                  {gameState?.players.find((p) => p.uuid === w.uuid)?.nickname ?? w.uuid}: +{w.amount}
                </p>
              ))}
              {showdown.players.map((p, i) => (
                <p key={i} className="text-xs text-gray-400">
                  {p.handDescription}
                </p>
              ))}
            </div>
          )}

          {gameEnd && (
            <div className="rounded-lg bg-gray-800 p-3">
              <h3 className="mb-2 font-bold text-yellow-400">게임 종료!</h3>
              {gameEnd.results.map((r, i) => (
                <p key={i} className={`text-sm ${r.result === 'win' ? 'text-green-400' : 'text-gray-300'}`}>
                  {r.placement ?? '-'}위 {r.nickname} ({r.result})
                </p>
              ))}
              <Button
                variant="primary"
                className="mt-3 w-full"
                onClick={handleLeave}
              >
                로비로 돌아가기
              </Button>
            </div>
          )}

          <Button variant="danger" onClick={handleLeave}>
            {gameState ? '게임 포기' : '방 나가기'}
          </Button>
        </div>
      }
    />
  );
}
