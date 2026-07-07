'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { readJoinedRoomSession, readPendingRoomJoin, useRoom } from '@/hooks/use-room';
import { getRequestErrorMessage } from '@/lib/client/http';

type RoomContextValue = ReturnType<typeof useRoom> & {
  joinError: string | null;
  retryJoin: () => void;
  isAutoJoining: boolean;
};

const RoomContext = createContext<RoomContextValue | null>(null);

type RoomProviderProps = {
  children: React.ReactNode;
};

export function RoomProvider({ children }: RoomProviderProps) {
  const params = useParams();
  const roomCode = String(params.code ?? '')
    .trim()
    .toUpperCase();
  const room = useRoom();
  const { state, savedName, handleJoin, resumeJoin } = room;

  const hasAutoJoinedRef = useRef(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isAutoJoining, setIsAutoJoining] = useState(false);

  const normalizedName = savedName.trim();
  const hasName = normalizedName.length > 0;

  const attemptJoin = useCallback(async () => {
    if (!roomCode || !hasName) return;
    if (state.phase !== 'idle') return;

    setJoinError(null);
    setIsAutoJoining(true);

    const pending = readPendingRoomJoin(roomCode);
    const displayName = pending?.displayName.trim() || normalizedName;

    try {
      const joinedSession = readJoinedRoomSession(roomCode);
      if (joinedSession) {
        resumeJoin(joinedSession.roomCommand, joinedSession.createdNew, joinedSession.displayName);
        return;
      }

      await handleJoin(roomCode, displayName, pending?.peerId);
      if (!pending) {
        toast.success('已加入房间');
      }
    } catch (error) {
      const recoveredSession = readJoinedRoomSession(roomCode);
      if (recoveredSession) {
        resumeJoin(
          recoveredSession.roomCommand,
          recoveredSession.createdNew,
          recoveredSession.displayName,
        );
        return;
      }

      const message = getRequestErrorMessage(error);
      setJoinError(message);
      toast.error(message);
    } finally {
      setIsAutoJoining(false);
    }
  }, [handleJoin, hasName, normalizedName, resumeJoin, roomCode, state.phase]);

  useEffect(() => {
    if (!roomCode || state.phase !== 'idle') return;

    const session = readJoinedRoomSession(roomCode);
    if (session) {
      if (hasAutoJoinedRef.current) return;
      hasAutoJoinedRef.current = true;
      resumeJoin(session.roomCommand, session.createdNew, session.displayName);
      return;
    }

    if (!hasName || hasAutoJoinedRef.current) return;

    hasAutoJoinedRef.current = true;
    void attemptJoin();
  }, [attemptJoin, hasName, roomCode, resumeJoin, state.phase]);

  const retryJoin = useCallback(() => {
    hasAutoJoinedRef.current = false;
    void attemptJoin().finally(() => {
      hasAutoJoinedRef.current = true;
    });
  }, [attemptJoin]);

  const value = useMemo<RoomContextValue>(
    () => ({
      ...room,
      joinError,
      retryJoin,
      isAutoJoining,
    }),
    [room, joinError, retryJoin, isAutoJoining],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const value = useContext(RoomContext);
  if (!value) {
    throw new Error('useRoomContext must be used within RoomProvider');
  }
  return value;
}
