'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard, Copy, RefreshCw, Users, Wifi, WifiOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/theme-toggle';
import { VideoPlayer } from '@/components/video-player';
import { VideoSourceDialog } from '@/components/video-source';
import { type RtcStatus } from '@/hooks/use-room';
import { useRoomContext } from '@/components/room-provider';
import { getRequestErrorMessage } from '@/lib/client/http';

const RTC_STATUS_MAP: Record<RtcStatus, { label: string; variant: 'outline' | 'secondary' | 'destructive' }> = {
  idle: { label: 'P2P 等待连接', variant: 'outline' },
  connecting: { label: 'P2P 连接中…', variant: 'secondary' },
  connected: { label: 'P2P 已连接', variant: 'outline' },
  failed: { label: 'P2P 连接失败', variant: 'destructive' },
};

type RoomPageProps = {
  roomCode: string;
};

export function RoomPage({ roomCode }: RoomPageProps) {
  const router = useRouter();
  const {
    state,
    savedName,
    updateDisplayName,
    handleLeave,
    setVideoSource,
    retryConnection,
    bindVideoRef,
    requestPlay,
    requestPause,
    requestSeek,
    joinError,
    retryJoin,
    isAutoJoining,
  } = useRoomContext();

  const [isRetrying, setIsRetrying] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const prevRtcStatus = useRef<RtcStatus>('idle');

  const normalizedName = savedName.trim();
  const hasName = normalizedName.length > 0;

  useEffect(() => {
    if (!hasName) {
      setNameDraft(savedName);
      setNameDialogOpen(true);
    }
  }, [hasName, savedName]);

  useEffect(() => {
    const prev = prevRtcStatus.current;
    const curr = state.rtcStatus;
    prevRtcStatus.current = curr;
    if (prev === curr) return;
    if (curr === 'failed') {
      toast.error('P2P 连接失败', {
        description: '可能是网络代理或防火墙阻止了 WebRTC 连接。请关闭代理后重试。',
      });
    }
  }, [state.rtcStatus]);

  const onRetry = async () => {
    setIsRetrying(true);
    try {
      await retryConnection();
    } finally {
      setIsRetrying(false);
    }
  };

  const confirmLeaveRoom = async () => {
    setIsLeaving(true);
    try {
      await handleLeave();
      router.replace('/');
    } catch (error) {
      toast.error(getRequestErrorMessage(error));
    } finally {
      setIsLeaving(false);
      setLeaveDialogOpen(false);
    }
  };

  const onLeaveRoomClick = () => {
    if (state.isHost) {
      setLeaveDialogOpen(true);
      return;
    }
    void confirmLeaveRoom();
  };

  const handleCopyInvite = async () => {
    if (!state.roomId) return;
    const url = `${window.location.origin}/room/${state.roomId}`;
    await navigator.clipboard.writeText(url);
    toast.success('房间链接已复制');
  };

  const handleConfirmName = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast.error('请先设置昵称');
      return;
    }
    updateDisplayName(trimmed);
    setNameDialogOpen(false);
  };

  const onRoomClosedConfirm = async () => {
    toast.info('房主已离开，房间已关闭');
    try {
      await handleLeave();
    } catch {
      // best-effort
    }
    window.close();
    router.replace('/');
  };

  const { phase, roomId, members, isHost, signalingConnected, rtcStatus, videoSrc } = state;
  const isJoined = phase === 'joined';
  const loading = phase === 'joining';
  const rtcFailed = rtcStatus === 'failed';
  const rtcInfo = RTC_STATUS_MAP[rtcStatus];

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6 md:px-8">
      <Dialog open={nameDialogOpen} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>设置昵称</DialogTitle>
            <DialogDescription>进入房间前，请先设置昵称。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="required-display-name">昵称</Label>
              <Input
                id="required-display-name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="请输入昵称"
                maxLength={24}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit">确认</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要离开房间吗？</AlertDialogTitle>
            <AlertDialogDescription>房主离开后房间会立即关闭，确定要离开吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isLeaving}
              onClick={() => void confirmLeaveRoom()}
            >
              {isLeaving ? '离开中…' : '确定离开'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={state.roomClosedByHost} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>房间已关闭</DialogTitle>
            <DialogDescription>房主已离开房间，本房间已自动关闭。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onRoomClosedConfirm}>我知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <CardDescription>房间编号：{roomCode}</CardDescription>
            </div>
            {isJoined && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{roomId}</Badge>
                {isHost && <Badge variant="secondary">房主</Badge>}
                <Button variant="outline" size="sm" onClick={handleCopyInvite}>
                  <Copy className="size-4" />
                  分享
                </Button>
                <Button variant="destructive" size="sm" onClick={onLeaveRoomClick} disabled={isLeaving}>
                  <X className="size-4" />
                  退出房间
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              {signalingConnected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {signalingConnected ? '信令已连接' : '信令未连接'}
            </Badge>
            {isJoined && (
              <>
                <Badge variant={rtcInfo.variant} className="gap-1">
                  {rtcInfo.label}
                </Badge>
                {rtcFailed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="h-6 gap-1 px-2 text-xs"
                  >
                    <RefreshCw className={`size-3 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? '重连中…' : '重试连接'}
                  </Button>
                )}
                <Badge variant="outline">{members.length} 人在线</Badge>
              </>
            )}
          </CardContent>
        </Card>

        {isJoined && rtcFailed && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex items-center justify-between gap-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-destructive">P2P 连接失败</p>
                <p className="text-xs text-muted-foreground">
                  WebRTC 无法建立点对点连接，可能是网络代理（VPN/科学上网）或防火墙阻止了连接。
                  请尝试关闭代理后点击重试。
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="shrink-0"
              >
                <RefreshCw className={`size-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? '重连中…' : '重试'}
              </Button>
            </CardContent>
          </Card>
        )}

        {joinError && !loading && !isJoined && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex flex-col items-start gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">加入房间失败</p>
                <p className="text-xs text-muted-foreground">{joinError}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={retryJoin} disabled={isAutoJoining}>
                  {isAutoJoining ? '重试中…' : '重试'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => router.replace('/')}>
                  返回首页
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <div className="space-y-3 rounded-lg border p-4">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </CardContent>
            </Card>
          </div>
        )}

        {isJoined && !loading && (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>播放画面</CardTitle>
                    <CardDescription>
                      {isHost ? '你是房主，操作将同步给所有成员。' : '播放由房主控制。'}
                    </CardDescription>
                  </div>
                  {isHost && (
                    <VideoSourceDialog
                      onConfirm={(source, objectUrl) => setVideoSource(source, objectUrl)}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <VideoPlayer
                  src={videoSrc}
                  onVideoRef={bindVideoRef}
                  onPlay={isHost ? requestPlay : undefined}
                  onPause={isHost ? requestPause : undefined}
                  onSeek={isHost ? requestSeek : undefined}
                  isHost={isHost}
                  disabled={rtcFailed}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4" />
                  房间成员
                </CardTitle>
                <CardDescription>{members.length} 人在线</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.peerId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src="" />
                        <AvatarFallback>{member.displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{member.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.peerId === state.peerId ? '你' : ''}
                          {member.peerId === state.hostPeerId ? ' (房主)' : ''}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {member.peerId === state.hostPeerId ? '房主' : '成员'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
