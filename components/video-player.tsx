'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  createPlayer,
  playbackFeature,
  timeFeature,
  volumeFeature,
  fullscreenFeature,
  controlsFeature,
} from '@videojs/react';
import { I18nProvider } from '@videojs/react/i18n';
import { bufferFeature } from '@videojs/core/dom';
import { Video, VideoSkin } from '@videojs/react/video';
import { FullscreenChatOverlay } from '@/components/room-chat';
import type { LocalChatMessage } from '@/lib/shared/protocol';
import '@videojs/react/video/skin.css';

// 按需引入最小功能集：播放状态、进度时间、缓冲、音量、全屏、控制条自动隐藏。
// bufferFeature 是 TimeSlider 正确更新所必需的。
const Player = createPlayer({
  features: [
    playbackFeature,
    timeFeature,
    bufferFeature,
    volumeFeature,
    fullscreenFeature,
    controlsFeature,
  ],
  displayName: 'RoomPlayer',
});

export type VideoPlayerProps = {
  src: string | MediaStream | null;
  onVideoRef?: (video: HTMLVideoElement | null) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (positionMs: number) => void;
  isHost: boolean;
  disabled?: boolean;
  chatMessages: LocalChatMessage[];
  chatConnected: boolean;
  onSendChatMessage: (content: string) => boolean;
};

type FullscreenChatOverlayWrapperProps = Pick<
  VideoPlayerProps,
  'chatMessages' | 'chatConnected' | 'onSendChatMessage'
>;

/**
 * 读取播放器全屏状态并转发给 FullscreenChatOverlay。
 * 必须在 Player.Provider 内部运行，所以单独拆出此 wrapper。
 */
function FullscreenChatOverlayWrapper({
  chatMessages,
  chatConnected,
  onSendChatMessage,
}: FullscreenChatOverlayWrapperProps) {
  const fullscreen = Player.usePlayer((state) => state.fullscreen);
  return (
    <FullscreenChatOverlay
      fullscreen={fullscreen}
      messages={chatMessages}
      connected={chatConnected}
      onSend={onSendChatMessage}
    />
  );
}

export function VideoPlayer({
  src,
  onVideoRef,
  isHost,
  chatMessages,
  chatConnected,
  onSendChatMessage,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleRef = useCallback(
    (video: HTMLVideoElement | null) => {
      videoRef.current = video;
      onVideoRef?.(video);
    },
    [onVideoRef],
  );

  // 仅处理 MediaStream（srcObject），字符串 src 直接通过 prop 传递给 Video 组件。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (src instanceof MediaStream) {
      video.srcObject = src;
      video.removeAttribute('src');
      video.load();
    } else if (src === null) {
      video.srcObject = null;
      video.removeAttribute('src');
      video.load();
    }
    // 当 src 是字符串时，由 Video 组件的 src prop 处理
  }, [src]);

  // 确定传递给 Video 组件的 src prop
  const videoSrc = typeof src === 'string' ? src : undefined;

  return (
    <Player.Provider>
      <I18nProvider locale="zh-CN">
        <div className="relative aspect-video overflow-hidden rounded-[32px] border bg-black">
          <VideoSkin>
            <Video ref={handleRef} src={videoSrc} playsInline />
            <FullscreenChatOverlayWrapper
              chatMessages={chatMessages}
              chatConnected={chatConnected}
              onSendChatMessage={onSendChatMessage}
            />
          </VideoSkin>
          {!src && (
            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-card to-muted px-4 text-center text-sm text-muted-foreground">
              {isHost ? '请选择视频源开始播放' : '等待房主设置视频源…'}
            </div>
          )}
        </div>
      </I18nProvider>
    </Player.Provider>
  );
}
