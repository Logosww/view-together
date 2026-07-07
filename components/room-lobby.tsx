'use client';

import { useState } from 'react';
import { LogIn, Plus } from 'lucide-react';
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

  const handleConfirmJoin = () => {
    const trimmed = extractRoomCode(joinRoomId);
    if (!trimmed) return;
    onJoin(trimmed, displayName || 'Guest');
    setJoinDialogOpen(false);
  };

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-6 text-center">
      <h2 className="text-2xl font-semibold">还未加入房间</h2>
      <p className="text-sm text-muted-foreground">创建新房间，或加入已有房间。</p>

      <div className="w-full max-w-xs space-y-2">
        <Label htmlFor="display-name">你的昵称</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="输入昵称"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={handleCreate} disabled={loading}>
          <Plus className="size-4" />
          {isCreating ? '创建中…' : '创建房间'}
        </Button>

        <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={loading}>
              <LogIn className="size-4" />
              加入房间
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>加入房间</DialogTitle>
              <DialogDescription>请输入房间编号后加入。</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="room-id-input">房间编号</Label>
              <Input
                id="room-id-input"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                placeholder="输入 4 位房间号或粘贴分享链接"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleConfirmJoin} disabled={isJoining}>
                {isJoining ? '加入中…' : '加入房间'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
