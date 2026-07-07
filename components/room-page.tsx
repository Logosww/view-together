'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Share2, Users, Wifi, WifiOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

const RTC_STATUS_MAP: Record<
  RtcStatus,
  { label: string; variant: 'outline' | 'secondary' | 'destructive' }
> = {
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

  const { phase, members, isHost, signalingConnected, rtcStatus, videoSrc } = state;
  const isJoined = phase === 'joined';
  const loading = phase === 'joining';
  const rtcFailed = rtcStatus === 'failed';
  const rtcInfo = RTC_STATUS_MAP[rtcStatus];

  return (
    <main id="main-content" className="min-h-screen bg-muted/40 px-3 py-4 sm:px-4 sm:py-6 md:px-8">
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
                name="required-display-name"
                autoComplete="nickname"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="例如：小王…"
                maxLength={24}
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
            <AlertDialogDescription>
              房主离开后房间会立即关闭，确定要离开吗？
            </AlertDialogDescription>
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

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Card className="overflow-hidden gap-1.5">
          <CardHeader className="gap-3 px-4 pb-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-wrap text-base leading-tight sm:text-lg">
                  View Together
                </CardTitle>
                <CardDescription className="mt-0.5 break-words">
                  房间号：<span translate="no">{roomCode}</span>
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <ThemeToggle />
                {isJoined && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCopyInvite} className="h-7">
                      <Share2 className="size-3.5" aria-hidden="true" />
                      分享
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onLeaveRoomClick}
                      disabled={isLeaving}
                      className="h-7"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      退出房间
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="whitespace-nowrap">
                WebRTC P2P
              </Badge>
              {isJoined && isHost && <Badge variant="secondary">房主</Badge>}
            </div>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-wrap items-center gap-1.5 px-4 pt-0 text-sm text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              {signalingConnected ? (
                <Wifi className="size-3.5" aria-hidden="true" />
              ) : (
                <WifiOff className="size-3.5" aria-hidden="true" />
              )}
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
                    <RefreshCw
                      className={`size-3 ${isRetrying ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
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
            <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-destructive">P2P 连接失败</p>
                <p className="text-pretty text-xs text-muted-foreground">
                  WebRTC 无法建立点对点连接，可能是网络代理（VPN/科学上网）或防火墙阻止了连接。
                  请尝试关闭代理后点击重试。
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRetrying}
                className="w-full shrink-0 sm:w-auto"
              >
                <RefreshCw
                  className={`size-4 ${isRetrying ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isRetrying ? '重连中…' : '重试'}
              </Button>
            </CardContent>
          </Card>
        )}

        {joinError && !loading && !isJoined && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="flex flex-col items-start gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-destructive">加入房间失败</p>
                <p className="break-words text-xs text-muted-foreground">{joinError}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retryJoin}
                  disabled={isAutoJoining}
                  className="w-full sm:w-auto"
                >
                  {isAutoJoining ? '重试中…' : '重试'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.replace('/')}
                  className="w-full sm:w-auto"
                >
                  返回首页
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
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
          <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-wrap">播放画面</CardTitle>
                    <CardDescription className="text-pretty">
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
              <CardContent className="min-w-0">
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
                  <Users className="size-4" aria-hidden="true" />
                  房间成员
                </CardTitle>
                <CardDescription>{members.length} 人在线</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.length > 0 ? (
                  members.map((member) => (
                    <div
                      key={member.peerId}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="shrink-0">
                          <AvatarFallback>{member.displayName.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate text-sm font-medium">{member.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.peerId === state.peerId ? '你' : null}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {member.peerId === state.hostPeerId ? '房主' : '成员'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    暂无成员在线。
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
