import type {
  WsClientMessage,
  WsServerMessage,
  SignalPayload,
  VideoSource,
  WsRoomMember,
} from '@/lib/shared/protocol';

export type SignalingEvents = {
  'peer-joined': (peerId: string, displayName: string, members: WsRoomMember[]) => void;
  'peer-left': (peerId: string, members: WsRoomMember[]) => void;
  signal: (fromPeerId: string, signal: SignalPayload) => void;
  'video-source': (source: VideoSource) => void;
  connected: () => void;
  disconnected: () => void;
  error: (message: string) => void;
};

type EventName = keyof SignalingEvents;

const MAX_RECONNECT_DELAY = 16_000;
const BASE_RECONNECT_DELAY = 1_000;

function resolveWsBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;

  if (typeof window === 'undefined') {
    return configured ?? 'ws://localhost:3001';
  }

  if (!configured) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//localhost:3001`;
  }

  if (configured.startsWith('wss://') || configured.startsWith('ws://')) {
    if (window.location.protocol === 'https:' && configured.startsWith('ws://')) {
      return configured.replace(/^ws:\/\//, 'wss://');
    }
    return configured;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${configured.replace(/^\/\//, '')}`;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<EventName, Set<SignalingEvents[EventName]>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionallyClosed = false;

  private roomId = '';
  private peerId = '';
  private displayName = '';

  on<E extends EventName>(event: E, fn: SignalingEvents[E]) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => {
      this.listeners.get(event)?.delete(fn);
    };
  }

  private emit<E extends EventName>(event: E, ...args: Parameters<SignalingEvents[E]>) {
    const fns = this.listeners.get(event) as Set<SignalingEvents[E]> | undefined;
    fns?.forEach((fn) => {
      Reflect.apply(fn, undefined, args);
    });
  }

  joinRoom(roomId: string, peerId: string, displayName: string) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.displayName = displayName;
    this.intentionallyClosed = false;
    this.connect();
  }

  leaveRoom() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'leave-room', roomId: this.roomId, peerId: this.peerId });
    }
    this.intentionallyClosed = true;
    this.cleanup();
  }

  sendSignal(toPeerId: string, signal: SignalPayload) {
    this.send({
      type: 'signal',
      roomId: this.roomId,
      fromPeerId: this.peerId,
      toPeerId,
      signal,
    });
  }

  broadcastVideoSource(source: VideoSource) {
    this.send({
      type: 'video-source',
      roomId: this.roomId,
      peerId: this.peerId,
      source,
    });
  }

  destroy() {
    this.intentionallyClosed = true;
    this.cleanup();
    this.listeners.clear();
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── internal ──────────────────────────────────────────────────────────────

  private connect() {
    this.cleanup();
    const ws = new WebSocket(`${resolveWsBaseUrl()}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({
        type: 'join-room',
        roomId: this.roomId,
        peerId: this.peerId,
        displayName: this.displayName,
      });
      this.emit('connected');
    };

    ws.onmessage = (event) => {
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }
      this.handleMessage(msg);
    };

    ws.onclose = () => {
      this.emit('disconnected');
      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private handleMessage(msg: WsServerMessage) {
    switch (msg.type) {
      case 'peer-joined':
        this.emit('peer-joined', msg.peerId, msg.displayName, msg.members);
        break;
      case 'peer-left':
        this.emit('peer-left', msg.peerId, msg.members);
        break;
      case 'signal':
        this.emit('signal', msg.fromPeerId, msg.signal);
        break;
      case 'video-source':
        this.emit('video-source', msg.source);
        break;
      case 'error':
        this.emit('error', msg.message);
        break;
    }
  }

  private send(msg: WsClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(BASE_RECONNECT_DELAY * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
