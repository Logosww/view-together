'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';

const PROGRESS_UPDATE_INTERVAL_MS = 500;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type VideoPlayerProps = {
  src: string | MediaStream | null;
  onVideoRef?: (video: HTMLVideoElement | null) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (positionMs: number) => void;
  isHost: boolean;
  disabled?: boolean;
};

export function VideoPlayer({
  src,
  onVideoRef,
  onPlay,
  onPause,
  onSeek,
  isHost,
  disabled,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const lastProgressUpdateRef = useRef(0);
  const seekingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    onVideoRef?.(videoRef.current);
    return () => onVideoRef?.(null);
  }, [onVideoRef]);

  // Track fullscreen state changes (e.g. when the user presses ESC to exit
  // fullscreen, or switches fullscreen via browser controls).
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (src instanceof MediaStream) {
      video.srcObject = src;
      video.removeAttribute('src');
      video.load();
    } else if (typeof src === 'string' && src) {
      video.srcObject = null;
      video.src = src;
      video.load();
    } else {
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    }
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume / 100;
      video.muted = muted;
    }
  }, [volume, muted]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    }

    // Skip progress updates while the host is dragging the seek slider —
    // otherwise the video's currentTime overwrites the slider position.
    if (seekingRef.current) return;

    const now = Date.now();
    if (now - lastProgressUpdateRef.current < PROGRESS_UPDATE_INTERVAL_MS) return;
    lastProgressUpdateRef.current = now;
    setProgress(video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  }, []);

  const handlePlayEvent = useCallback(() => setPlaying(true), []);
  const handlePauseEvent = useCallback(() => setPlaying(false), []);

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      onPlay?.();
    } else {
      onPause?.();
    }
  };

  const handleSeekChange = (value: number[]) => {
    seekingRef.current = true;
    setProgress(value[0]);
  };

  const handleSeekCommit = (value: number[]) => {
    const posMs = Math.round((value[0] / 100) * duration * 1000);
    onSeek?.(posMs);
    seekingRef.current = false;
  };

  const handleToggleMute = () => setMuted((m) => !m);

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (value[0] > 0 && muted) setMuted(false);
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
    // State is kept in sync via the fullscreenchange listener above.
  };

  const hasSrc = !!src;
  const controlsDisabled = !hasSrc || !!disabled;

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="h-full w-full"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlayEvent}
          onPause={handlePauseEvent}
        />
        {!hasSrc && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-linear-to-br from-card to-muted">
            {isHost ? '请选择视频源开始播放' : '等待房主设置视频源…'}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isHost ? (
              <Button size="sm" onClick={handleTogglePlay} disabled={controlsDisabled}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? '暂停' : '播放'}
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {playing ? <Play className="size-4" /> : <Pause className="size-4" />}
                {playing ? '播放中' : '已暂停'}
              </span>
            )}
            <Button size="sm" variant="ghost" onClick={handleFullscreen} disabled={controlsDisabled}>
              {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
          </div>
          <span ref={timeDisplayRef} className="text-sm text-muted-foreground">
            00:00 / 00:00
          </span>
        </div>

        <div className="space-y-2">
          <Label>播放进度</Label>
          {isHost ? (
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              onValueChange={handleSeekChange}
              onValueCommit={handleSeekCommit}
              disabled={!hasSrc}
            />
          ) : (
            <Progress value={progress} className={!hasSrc ? 'opacity-50' : undefined} />
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <button type="button" onClick={handleToggleMute} className="cursor-pointer">
              {muted || volume === 0 ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
            音量
          </Label>
          <Slider
            value={[muted ? 0 : volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
          />
        </div>
      </div>
    </div>
  );
}
