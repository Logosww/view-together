'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SignalingClient } from '@/lib/client/signaling';
import { WebRTCManager } from '@/lib/client/webrtc-manager';
import { PlaybackSync } from '@/lib/client/playback-sync';
import {
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  leaveRoom as apiLeaveRoom,
  sendHeartbeat,
  getRoom,
  type RoomCommandData,
} from '@/lib/client/api';
import { BusinessError } from '@/lib/client/http';
import type { VideoSource, WsRoomMember } from '@/lib/shared/protocol';

const HEARTBEAT_INTERVAL = 30_000;
const ROOM_POLL_INTERVAL = 10_000;
export const DISPLAY_NAME_KEY = 'view-together-display-name';
export const PENDING_ROOM_JOIN_KEY = 'view-together-pending-room-join';
export const JOINED_ROOM_SESSION_KEY = 'view-together-joined-room-session';
const PENDING_JOIN_TTL_MS = 60_000;
const JOINED_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type PendingRoomJoinData = {
  roomId: string;
  peerId: string;
  displayName: string;
  createdAt: number;
};

export type JoinedRoomSession = {
  roomId: string;
  roomCommand: RoomCommandData;
  displayName: string;
  createdNew: boolean;
  joinedAt: number;
};

export function readPendingRoomJoin(roomCode: string): PendingRoomJoinData | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(PENDING_ROOM_JOIN_KEY);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as PendingRoomJoinData;
    if (pending.roomId !== roomCode) return null;
    if (Date.now() - pending.createdAt > PENDING_JOIN_TTL_MS) {
      sessionStorage.removeItem(PENDING_ROOM_JOIN_KEY);
      return null;
    }
    return pending;
  } catch {
    sessionStorage.removeItem(PENDING_ROOM_JOIN_KEY);
    return null;
  }
}

export function clearPendingRoomJoin() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PENDING_ROOM_JOIN_KEY);
}

export function readJoinedRoomSession(roomCode: string): JoinedRoomSession | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(JOINED_ROOM_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as JoinedRoomSession;
    if (session.roomId !== roomCode) return null;
    if (Date.now() - session.joinedAt > JOINED_SESSION_TTL_MS) {
      sessionStorage.removeItem(JOINED_ROOM_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(JOINED_ROOM_SESSION_KEY);
    return null;
  }
}

export function saveJoinedRoomSession(
  data: RoomCommandData,
  displayName: string,
  createdNew: boolean,
) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    JOINED_ROOM_SESSION_KEY,
    JSON.stringify({
      roomId: data.roomId,
      roomCommand: data,
      displayName,
      createdNew,
      joinedAt: Date.now(),
    } satisfies JoinedRoomSession),
  );
}

export function clearJoinedRoomSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(JOINED_ROOM_SESSION_KEY);
}

export type RtcStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export type RoomState = {
  phase: 'idle' | 'joining' | 'joined';
  roomId: string;
  peerId: string;
  isHost: boolean;
  displayName: string;
  members: WsRoomMember[];
  hostPeerId: string;
  signalingConnected: boolean;
  rtcStatus: RtcStatus;
  videoSrc: string | MediaStream | null;
  videoSource: VideoSource | null;
  roomClosedByHost: boolean;
};

const initialState: RoomState = {
  phase: 'idle',
  roomId: '',
  peerId: '',
  isHost: false,
  displayName: '',
  members: [],
  hostPeerId: '',
  signalingConnected: false,
  rtcStatus: 'idle',
  videoSrc: null,
  videoSource: null,
  roomClosedByHost: false,
};

export function useRoom() {
  const [state, setState] = useState<RoomState>(initialState);
  const stateRef = useRef<RoomState>(initialState);
  const signalingRef = useRef<SignalingClient | null>(null);
  const rtcRef = useRef<WebRTCManager | null>(null);
  const syncRef = useRef<PlaybackSync | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Persist display name
  const [savedName, setSavedName] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
  });

  const updateDisplayName = useCallback((name: string) => {
    setSavedName(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISPLAY_NAME_KEY, name);
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ─── Setup signaling + WebRTC + sync after join ────────────────────────────

  const setupPeerInfra = useCallback(
    (roomId: string, peerId: string, isHost: boolean, hostPeerId: string, displayName: string) => {
      const signaling = new SignalingClient();
      signalingRef.current = signaling;

      signaling.on('connected', () => {
        setState((s) => ({ ...s, signalingConnected: true }));
      });
      signaling.on('disconnected', () => {
        setState((s) => ({ ...s, signalingConnected: false }));
      });

      const rtc = new WebRTCManager(signaling, peerId);
      rtcRef.current = rtc;

      const sync = new PlaybackSync(rtc, isHost);
      syncRef.current = sync;

      sync.on('remote-play', () => {
        videoRef.current?.play().catch(() => {});
      });
      sync.on('remote-pause', () => {
        videoRef.current?.pause();
      });
      sync.on('remote-seek', (posMs) => {
        if (videoRef.current) videoRef.current.currentTime = posMs / 1000;
      });
      sync.on('remote-video-source', (source) => {
        if (source.type === 'url') {
          setState((s) => ({ ...s, videoSrc: source.url, videoSource: source }));
        }
        if (source.type === 'file') {
          setState((s) => ({ ...s, videoSource: source }));
        }
      });

      // Signaling → WebRTC handshake
      signaling.on('peer-joined', (newPeerId, _displayName, members) => {
        setState((s) => ({ ...s, members }));
        if (newPeerId !== peerId) {
          setState((s) => ({ ...s, rtcStatus: 'connecting' }));
          void rtc.connectToPeer(newPeerId);
        }
      });

      signaling.on('peer-left', (leftPeerId, members) => {
        setState((s) => ({ ...s, members }));
        rtc.disconnectPeer(leftPeerId);
        setState((s) => ({ ...s, rtcStatus: rtc.aggregateState }));
        if (!isHost && leftPeerId === hostPeerId) {
          void getRoom(roomId)
            .then(() => {})
            .catch((error: unknown) => {
              if (error instanceof BusinessError) {
                setState((s) => ({ ...s, roomClosedByHost: true }));
              }
            });
        }
      });

      signaling.on('video-source', (source) => {
        if (source.type === 'url') {
          setState((s) => ({ ...s, videoSrc: source.url, videoSource: source }));
        }
        if (source.type === 'file') {
          setState((s) => ({ ...s, videoSource: source }));
        }
      });

      // Track aggregate WebRTC connection state
      rtc.on('connection-state', () => {
        setState((s) => ({ ...s, rtcStatus: rtc.aggregateState }));
      });

      rtc.on('dc-open', (remotePeerId) => {
        if (!isHost && remotePeerId === hostPeerId) {
          rtc.sendToPeer(hostPeerId, { type: 'sync-request' });
        }
      });

      rtc.on('remote-stream', (_remotePeerId, stream) => {
        if (!isHost) {
          setState((s) => ({ ...s, videoSrc: stream }));
        }
      });

      signaling.joinRoom(roomId, peerId, displayName);

      heartbeatRef.current = setInterval(() => {
        void sendHeartbeat(roomId, peerId).catch(() => {});
      }, HEARTBEAT_INTERVAL);

      pollRef.current = setInterval(() => {
        void getRoom(roomId)
          .then((snap) => {
            setState((s) => ({
              ...s,
              members: snap.members.map((m) => ({ peerId: m.peerId, displayName: m.displayName })),
            }));
          })
          .catch((error: unknown) => {
            if (!isHost && error instanceof BusinessError) {
              setState((s) => ({ ...s, roomClosedByHost: true }));
            }
          });
      }, ROOM_POLL_INTERVAL);
    },
    [],
  );

  const teardown = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    syncRef.current?.destroy();
    syncRef.current = null;
    rtcRef.current?.destroy();
    rtcRef.current = null;
    signalingRef.current?.destroy();
    signalingRef.current = null;
    videoRef.current = null;
  }, []);

  // ─── Public actions ────────────────────────────────────────────────────────

  const applyJoin = useCallback(
    (data: RoomCommandData, createdNew: boolean, displayName: string) => {
    const isHost = createdNew || data.room?.hostPeerId === data.peerId;
    const hostPeerId = data.room?.hostPeerId ?? data.peerId;
    const members: WsRoomMember[] = (data.room?.members ?? []).map((m) => ({
      peerId: m.peerId,
      displayName: m.displayName,
    }));

    setState({
      phase: 'joined',
      roomId: data.roomId,
      peerId: data.peerId,
      isHost,
      displayName,
      members,
      hostPeerId,
      signalingConnected: false,
      rtcStatus: 'idle',
      videoSrc: null,
      videoSource: null,
      roomClosedByHost: false,
    });

    saveJoinedRoomSession(data, displayName, createdNew);
    clearPendingRoomJoin();
    setupPeerInfra(data.roomId, data.peerId, isHost, hostPeerId, displayName);
    },
    [setupPeerInfra],
  );

  const handleCreate = useCallback(
    async (displayName: string) => {
      setState((s) => ({ ...s, phase: 'joining' }));
      try {
        const data = await apiCreateRoom(displayName);
        applyJoin(data, true, displayName);
      } catch (e) {
        setState(initialState);
        throw e;
      }
    },
    [applyJoin],
  );

  const handleJoin = useCallback(
    async (roomId: string, displayName: string, peerId?: string) => {
      setState((s) => ({ ...s, phase: 'joining' }));
      try {
        const data = await apiJoinRoom(roomId, displayName, peerId);
        applyJoin(data, false, displayName);
      } catch (e) {
        setState(initialState);
        throw e;
      }
    },
    [applyJoin],
  );

  const handleLeave = useCallback(async () => {
    const { roomId, peerId } = state;
    if (!roomId || !peerId) return;
    signalingRef.current?.leaveRoom();
    teardown();
    try {
      await apiLeaveRoom(roomId, peerId);
    } catch {
      /* best-effort */
    }
    clearJoinedRoomSession();
    clearPendingRoomJoin();
    setState(initialState);
  }, [state.roomId, state.peerId, teardown]);

  const setVideoSource = useCallback((source: VideoSource, objectUrl?: string) => {
    const sync = syncRef.current;
    const rtc = rtcRef.current;

    if (source.type === 'url') {
      setState((s) => ({ ...s, videoSrc: source.url, videoSource: source }));
      sync?.setSource(source);
      signalingRef.current?.broadcastVideoSource(source);
      rtc?.sendToAll({ type: 'video-source', source });
    } else if (source.type === 'file' && objectUrl) {
      setState((s) => ({ ...s, videoSrc: objectUrl, videoSource: source }));
      sync?.setSource(source);
      const video = videoRef.current;
      if (video) {
        const onLoaded = () => {
          // oxlint-disable-next-line typescript/no-explicit-any
          const stream = (video as any).captureStream?.() as MediaStream | undefined;
          if (stream) {
            rtc?.setLocalStream(stream);
          }
          video.removeEventListener('loadeddata', onLoaded);
        };
        video.addEventListener('loadeddata', onLoaded);
      }
      signalingRef.current?.broadcastVideoSource({ type: 'file', name: source.name });
    }
  }, []);

  const retryConnection = useCallback(async () => {
    const rtc = rtcRef.current;
    if (!rtc) return;
    setState((s) => ({ ...s, rtcStatus: 'connecting' }));
    await rtc.reconnectAllFailed();
  }, []);

  const bindVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && syncRef.current) {
      syncRef.current.bindVideo(el);
    }
  }, []);

  const requestPlay = useCallback(() => syncRef.current?.requestPlay(), []);
  const requestPause = useCallback(() => syncRef.current?.requestPause(), []);
  const requestSeek = useCallback((posMs: number) => syncRef.current?.requestSeek(posMs), []);

  // When viewer gets a new video source, request sync once the video can play.
  useEffect(() => {
    if (!state.videoSrc || state.isHost || !state.hostPeerId) return;
    const video = videoRef.current;
    if (!video) return;

    const requestSync = () => {
      rtcRef.current?.sendToPeer(state.hostPeerId, { type: 'sync-request' });
    };

    if (video.readyState >= 3) {
      requestSync();
    } else {
      video.addEventListener('canplay', requestSync, { once: true });
      return () => video.removeEventListener('canplay', requestSync);
    }
  }, [state.videoSrc, state.isHost, state.hostPeerId]);

  // Cleanup on unmount
  useEffect(() => {
    const leaveByBeacon = () => {
      const { roomId, peerId } = stateRef.current;
      if (!roomId || !peerId) return;
      const body = JSON.stringify({ roomId, peerId });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/rooms/leave', blob);
        return;
      }
      void fetch('/api/rooms/leave', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const current = stateRef.current;
      if (current.phase === 'joined' && current.isHost) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    const onPageHide = () => {
      const current = stateRef.current;
      if (current.phase !== 'joined') return;
      signalingRef.current?.leaveRoom();
      leaveByBeacon();
      teardown();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      teardown();
    };
  }, [teardown]);

  return {
    state,
    savedName,
    updateDisplayName,
    handleCreate,
    handleJoin,
    resumeJoin: applyJoin,
    handleLeave,
    setVideoSource,
    retryConnection,
    bindVideoRef,
    requestPlay,
    requestPause,
    requestSeek,
  };
}
