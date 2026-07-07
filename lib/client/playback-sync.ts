import type { WebRTCManager } from '@/lib/client/webrtc-manager';
import type { DcMessage, VideoSource } from '@/lib/shared/protocol';

const DRIFT_THRESHOLD_MS = 2_000;
const SYNC_INTERVAL_MS = 5_000;

export type PlaybackSyncEvents = {
  'remote-play': (positionMs: number) => void;
  'remote-pause': (positionMs: number) => void;
  'remote-seek': (positionMs: number) => void;
  'remote-video-source': (source: VideoSource) => void;
};

type EventName = keyof PlaybackSyncEvents;

export class PlaybackSync {
  private rtc: WebRTCManager;
  private isHost: boolean;
  private video: HTMLVideoElement | null = null;
  // oxlint-disable-next-line typescript/no-explicit-any
  private listeners = new Map<EventName, Set<(...args: any[]) => void>>();
  private cleanupFns: (() => void)[] = [];
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private suppressLocalEvents = false;
  private currentSource: VideoSource | null = null;
  private pendingPositionMs: number | null = null;

  constructor(rtc: WebRTCManager, isHost: boolean) {
    this.rtc = rtc;
    this.isHost = isHost;

    this.cleanupFns.push(
      rtc.on('dc-message', (_fromPeerId, msg) => {
        this.handleDcMessage(_fromPeerId, msg);
      }),
    );

    if (isHost) {
      this.syncTimer = setInterval(() => this.broadcastSyncState(), SYNC_INTERVAL_MS);
    }
  }

  on<E extends EventName>(event: E, fn: PlaybackSyncEvents[E]) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => {
      this.listeners.get(event)?.delete(fn);
    };
  }

  private emit<E extends EventName>(event: E, ...args: Parameters<PlaybackSyncEvents[E]>) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  bindVideo(video: HTMLVideoElement) {
    this.unbindVideo();
    this.video = video;

    // When a new member joins, applyPosition may be called before the video
    // metadata has loaded (duration is NaN). The browser queues the seek, but
    // as a safety net we also listen for loadedmetadata and re-apply the
    // pending position if the queued seek didn't take effect.
    const onLoadedMetadata = () => {
      if (this.pendingPositionMs != null && Number.isFinite(video.duration)) {
        const drift = Math.abs(video.currentTime * 1000 - this.pendingPositionMs);
        if (drift > DRIFT_THRESHOLD_MS) {
          this.suppressLocalEvents = true;
          video.currentTime = this.pendingPositionMs / 1000;
          requestAnimationFrame(() => {
            this.suppressLocalEvents = false;
          });
        }
        this.pendingPositionMs = null;
      }
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    this.cleanupFns.push(() => video.removeEventListener('loadedmetadata', onLoadedMetadata));

    if (this.isHost) {
      const onPlay = () => {
        if (this.suppressLocalEvents) return;
        this.rtc.sendToAll({
          type: 'play',
          positionMs: Math.round(video.currentTime * 1000),
          timestamp: Date.now(),
        });
      };
      const onPause = () => {
        if (this.suppressLocalEvents) return;
        this.rtc.sendToAll({
          type: 'pause',
          positionMs: Math.round(video.currentTime * 1000),
          timestamp: Date.now(),
        });
      };
      const onSeeked = () => {
        if (this.suppressLocalEvents) return;
        this.rtc.sendToAll({
          type: 'seek',
          positionMs: Math.round(video.currentTime * 1000),
          timestamp: Date.now(),
        });
      };

      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('seeked', onSeeked);

      this.cleanupFns.push(() => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
      });
    }
  }

  unbindVideo() {
    this.video = null;
  }

  setSource(source: VideoSource) {
    this.currentSource = source;
  }

  /**
   * Non-host peer requests a playback action from the host via DataChannel.
   * If this peer IS the host, applies directly and broadcasts.
   */
  requestPlay() {
    if (this.isHost) {
      this.video?.play().catch(() => {});
    } else {
      this.rtc.sendToAll({
        type: 'play',
        positionMs: this.currentPositionMs,
        timestamp: Date.now(),
      });
    }
  }

  requestPause() {
    if (this.isHost) {
      this.video?.pause();
    } else {
      this.rtc.sendToAll({
        type: 'pause',
        positionMs: this.currentPositionMs,
        timestamp: Date.now(),
      });
    }
  }

  requestSeek(positionMs: number) {
    if (this.isHost) {
      if (this.video) this.video.currentTime = positionMs / 1000;
    } else {
      this.rtc.sendToAll({ type: 'seek', positionMs, timestamp: Date.now() });
    }
  }

  destroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.listeners.clear();
    this.video = null;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private get currentPositionMs() {
    return this.video ? Math.round(this.video.currentTime * 1000) : 0;
  }

  private handleDcMessage(fromPeerId: string, msg: DcMessage) {
    switch (msg.type) {
      case 'play': {
        if (this.isHost) {
          this.applyPosition(msg.positionMs);
          this.video?.play().catch(() => {});
        } else {
          // Always seek to the exact position when the host resumes playback.
          // applyPosition skips seeking when drift is below DRIFT_THRESHOLD_MS,
          // which can leave the member slightly ahead/behind the host.
          this.seekExact(msg.positionMs);
          this.emit('remote-play', msg.positionMs);
        }
        break;
      }
      case 'pause': {
        if (this.isHost) {
          this.applyPosition(msg.positionMs);
          this.video?.pause();
        } else {
          // Always seek to the exact position when the host pauses so that
          // all members freeze on the same frame as the host.
          this.seekExact(msg.positionMs);
          this.emit('remote-pause', msg.positionMs);
        }
        break;
      }
      case 'seek': {
        if (this.isHost) {
          this.applyPosition(msg.positionMs);
        } else {
          this.applyPosition(msg.positionMs);
          this.emit('remote-seek', msg.positionMs);
        }
        break;
      }
      case 'sync-request': {
        if (this.isHost) {
          this.rtc.sendToPeer(fromPeerId, {
            type: 'sync-response',
            status: this.video?.paused ? 'paused' : 'playing',
            positionMs: this.currentPositionMs,
            timestamp: Date.now(),
            source: this.currentSource,
          });
        }
        break;
      }
      case 'sync-response': {
        if (!this.isHost) {
          // Emit source first so the video element can start loading,
          // then apply position and play/pause state.
          if (msg.source) {
            this.emit('remote-video-source', msg.source);
          }
          this.applyPosition(msg.positionMs);
          if (msg.status === 'playing') {
            this.emit('remote-play', msg.positionMs);
          } else {
            this.emit('remote-pause', msg.positionMs);
          }
        }
        break;
      }
      case 'video-source': {
        this.emit('remote-video-source', msg.source);
        break;
      }
      case 'buffering': {
        // Future: could pause host while a peer is buffering
        break;
      }
    }
  }

  private applyPosition(positionMs: number) {
    if (!this.video) return;
    // MediaStream (duration === Infinity) cannot be seeked — skip.
    // URL sources may have NaN duration before metadata loads, but the
    // browser queues the currentTime assignment and applies it once
    // metadata is available. We also store a pending position as a
    // safety net (applied in the loadedmetadata listener from bindVideo).
    if (this.video.duration === Infinity) return;
    if (!Number.isFinite(this.video.duration)) {
      this.pendingPositionMs = positionMs;
    }
    const drift = Math.abs(this.video.currentTime * 1000 - positionMs);
    if (drift > DRIFT_THRESHOLD_MS) {
      this.suppressLocalEvents = true;
      this.video.currentTime = positionMs / 1000;
      requestAnimationFrame(() => {
        this.suppressLocalEvents = false;
      });
    }
  }

  /**
   * Seek to the exact position without a drift threshold.
   *
   * Used for discrete play/pause actions (not periodic sync) so that all
   * peers land on the exact same frame as the host, regardless of how
   * small the drift is.  applyPosition is still used for periodic
   * sync-responses to avoid stuttering during normal playback.
   */
  private seekExact(positionMs: number) {
    if (!this.video) return;
    if (this.video.duration === Infinity) return;
    if (!Number.isFinite(this.video.duration)) {
      this.pendingPositionMs = positionMs;
      return;
    }
    this.suppressLocalEvents = true;
    this.video.currentTime = positionMs / 1000;
    requestAnimationFrame(() => {
      this.suppressLocalEvents = false;
    });
  }

  private broadcastSyncState() {
    if (!this.video) return;
    this.rtc.sendToAll({
      type: 'sync-response',
      status: this.video.paused ? 'paused' : 'playing',
      positionMs: this.currentPositionMs,
      timestamp: Date.now(),
      source: this.currentSource,
    });
  }
}
