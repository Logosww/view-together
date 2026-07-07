'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

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
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Expose video ref to parent
  useEffect(() => {
    onVideoRef?.(videoRef.current);
    return () => onVideoRef?.(null);
  }, [onVideoRef]);

  // Set src on video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (src instanceof MediaStream) {
      video.srcObject = src;
      video.src = '';
    } else if (typeof src === 'string' && src) {
      video.srcObject = null;
      video.src = src;
    } else {
      video.srcObject = null;
      video.src = '';
    }
  }, [src]);

  // Sync volume
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume / 100;
      video.muted = muted;
    }
  }, [volume, muted]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
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

  const handleSeek = (value: number[]) => {
    const posMs = Math.round((value[0] / 100) * duration * 1000);
    onSeek?.(posMs);
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
      setIsFullscreen(false);
    } else {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
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
          {isHost && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleTogglePlay} disabled={controlsDisabled}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? '暂停' : '播放'}
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={handleFullscreen} disabled={controlsDisabled}>
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </Button>
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="space-y-2">
          <Label>播放进度</Label>
          <Slider
            value={[progress]}
            max={100}
            step={0.1}
            onValueCommit={isHost ? handleSeek : undefined}
            disabled={!hasSrc}
          />
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
