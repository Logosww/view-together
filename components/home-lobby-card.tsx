'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RoomLobby } from '@/components/room-lobby';
import { createRoom } from '@/lib/client/api';
import { getRequestErrorMessage } from '@/lib/client/http';
import { DISPLAY_NAME_KEY, PENDING_ROOM_JOIN_KEY } from '@/hooks/use-room';

function saveDisplayName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

export function HomeLobbyCard() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
  });
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const onDisplayNameChange = (name: string) => {
    setDisplayName(name);
    saveDisplayName(name);
  };

  const onCreate = async (name: string) => {
    setIsCreating(true);
    try {
      const normalizedName = name.trim() || 'Guest';
      saveDisplayName(normalizedName);
      const data = await createRoom(normalizedName);
      sessionStorage.setItem(
        PENDING_ROOM_JOIN_KEY,
        JSON.stringify({
          roomId: data.roomId,
          peerId: data.peerId,
          displayName: normalizedName,
          createdAt: Date.now(),
        }),
      );
      router.push(`/room/${data.roomId}`);
    } catch (error) {
      toast.error(getRequestErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  const onJoin = async (roomId: string, name: string) => {
    setIsJoining(true);
    try {
      const normalizedName = name.trim() || 'Guest';
      saveDisplayName(normalizedName);
      router.push(`/room/${roomId.trim().toUpperCase()}`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <RoomLobby
      displayName={displayName}
      onDisplayNameChange={onDisplayNameChange}
      onCreate={onCreate}
      onJoin={onJoin}
      isCreating={isCreating}
      isJoining={isJoining}
    />
  );
}
