'use client';

import { useState, type FormEvent } from 'react';
import { Clapperboard, LogIn, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export type RoomLobbyProps = {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onCreate: (displayName: string) => void;
  onJoin: (roomId: string, displayName: string) => void;
  isCreating: boolean;
  isJoining: boolean;
};

export function RoomLobby({
  displayName,
  onDisplayNameChange,
  onCreate,
  onJoin,
  isCreating,
  isJoining,
}: RoomLobbyProps) {
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');

  const loading = isCreating || isJoining;

  const handleCreate = () => {
    onCreate(displayName || 'Guest');
  };

  const extractRoomCode = (value: string) => {
    const raw = value.trim();
    if (!raw) return '';

    // 纯编号输入：直接提取字母数字并取前 4 位
    if (!raw.includes('://') && !raw.includes('/')) {
      return raw
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 4);
    }

    if (URL.canParse(raw)) {
      const url = new URL(raw);
      const segments = url.pathname.split('/').filter(Boolean);
      const roomIdx = segments.findIndex((segment) => segment.toLowerCase() === 'room');
      if (roomIdx >= 0) {
        const candidate = segments[roomIdx + 1] ?? '';
        return candidate
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 4);
      }
    }

    const parts = raw.split(/[/?#&=\s]+/).filter(Boolean);
    const fallback = parts.at(-1) ?? '';
    return fallback
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);
  };

  const handleConfirmJoin = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = extractRoomCode(joinRoomId);
    if (!trimmed) return;
    onJoin(trimmed, displayName || 'Guest');
    setJoinDialogOpen(false);
  };

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-5 text-center sm:min-h-[42vh]">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">
          <Clapperboard className="size-5" aria-hidden="true" />
          <h2 className="text-balance text-lg font-semibold sm:text-xl">还未加入房间</h2>
        </div>
        <p className="text-pretty text-sm text-muted-foreground">创建新房间，或加入已有房间。</p>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <Label htmlFor="display-name">你的昵称</Label>
        <Input
          id="display-name"
          name="display-name"
          autoComplete="nickname"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="例如：小王…"
          maxLength={24}
        />
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Button onClick={handleCreate} disabled={loading} className="w-full sm:w-auto">
          {isCreating ? (
            <Spinner className="size-4" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {isCreating ? '创建中…' : '创建房间'}
        </Button>

        <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={loading} className="w-full sm:w-auto">
              <LogIn className="size-4" aria-hidden="true" />
              加入房间
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>加入房间</DialogTitle>
              <DialogDescription>请输入房间编号后加入。</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConfirmJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-id-input">房间编号</Label>
                <Input
                  id="room-id-input"
                  name="room-code"
                  autoComplete="off"
                  inputMode="text"
                  spellCheck={false}
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="例如：A1B2 或分享链接…"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setJoinDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={isJoining}>
                  {isJoining ? '加入中…' : '加入房间'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
