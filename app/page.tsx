'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { RoomLobby } from '@/components/room-lobby';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createRoom } from '@/lib/client/api';
import { getRequestErrorMessage } from '@/lib/client/http';
import { DISPLAY_NAME_KEY, PENDING_ROOM_JOIN_KEY } from '@/hooks/use-room';

function saveDisplayName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

export default function Home() {
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
    <main className="min-h-screen bg-muted/40 px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card>
          <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clapperboard className="size-4" />
                <CardTitle>View Together</CardTitle>
                <Badge variant="secondary">WebRTC P2P</Badge>
                <ThemeToggle />
              </div>
              <CardDescription>创建房间或加入房间，进入独立房间页开始同步播放。</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RoomLobby
              displayName={displayName}
              onDisplayNameChange={onDisplayNameChange}
              onCreate={onCreate}
              onJoin={onJoin}
              isCreating={isCreating}
              isJoining={isJoining}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
