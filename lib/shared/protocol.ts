// ── Video source descriptor ──────────────────────────────────────────────────

export type VideoSourceUrl = { type: 'url'; url: string };
export type VideoSourceFile = { type: 'file'; name: string };
export type VideoSource = VideoSourceUrl | VideoSourceFile;

// ── Client → Server (WebSocket) ─────────────────────────────────────────────

export type WsClientJoinRoom = {
  type: 'join-room';
  roomId: string;
  peerId: string;
  displayName: string;
};

export type WsClientLeaveRoom = {
  type: 'leave-room';
  roomId: string;
  peerId: string;
};

export type WsClientSignal = {
  type: 'signal';
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  signal: SignalPayload;
};

export type WsClientVideoSource = {
  type: 'video-source';
  roomId: string;
  peerId: string;
  source: VideoSource;
};

export type WsClientMessage =
  | WsClientJoinRoom
  | WsClientLeaveRoom
  | WsClientSignal
  | WsClientVideoSource;

// ── Server → Client (WebSocket) ─────────────────────────────────────────────

export type WsServerPeerJoined = {
  type: 'peer-joined';
  roomId: string;
  peerId: string;
  displayName: string;
  members: WsRoomMember[];
};

export type WsServerPeerLeft = {
  type: 'peer-left';
  roomId: string;
  peerId: string;
  members: WsRoomMember[];
};

export type WsServerSignal = {
  type: 'signal';
  fromPeerId: string;
  signal: SignalPayload;
};

export type WsServerVideoSource = {
  type: 'video-source';
  source: VideoSource;
};

export type WsServerError = {
  type: 'error';
  message: string;
};

export type WsServerMessage =
  | WsServerPeerJoined
  | WsServerPeerLeft
  | WsServerSignal
  | WsServerVideoSource
  | WsServerError;

// ── WebRTC signaling payload ────────────────────────────────────────────────

export type SignalOffer = { type: 'offer'; sdp: string };
export type SignalAnswer = { type: 'answer'; sdp: string };
export type SignalIceCandidate = { type: 'ice-candidate'; candidate: RTCIceCandidateInit };

export type SignalPayload = SignalOffer | SignalAnswer | SignalIceCandidate;

// ── DataChannel messages (P2P sync) ─────────────────────────────────────────

export type DcPlay = { type: 'play'; positionMs: number; timestamp: number };
export type DcPause = { type: 'pause'; positionMs: number; timestamp: number };
export type DcSeek = { type: 'seek'; positionMs: number; timestamp: number };
export type DcSyncRequest = { type: 'sync-request' };
export type DcSyncResponse = {
  type: 'sync-response';
  status: 'playing' | 'paused';
  positionMs: number;
  timestamp: number;
  source: VideoSource | null;
};
export type DcBuffering = { type: 'buffering'; isBuffering: boolean };
export type DcVideoSource = { type: 'video-source'; source: VideoSource };

export type DcMessage =
  | DcPlay
  | DcPause
  | DcSeek
  | DcSyncRequest
  | DcSyncResponse
  | DcBuffering
  | DcVideoSource;

// ── Shared helper type ──────────────────────────────────────────────────────

export type WsRoomMember = {
  peerId: string;
  displayName: string;
};
