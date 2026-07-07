import type { SignalingClient } from '@/lib/client/signaling'
import type { DcMessage, SignalPayload } from '@/lib/shared/protocol'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const DATA_CHANNEL_LABEL = 'sync'

export type WebRTCManagerEvents = {
  'dc-message': (fromPeerId: string, msg: DcMessage) => void
  'dc-open': (peerId: string) => void
  'remote-stream': (peerId: string, stream: MediaStream) => void
  'peer-connected': (peerId: string) => void
  'peer-disconnected': (peerId: string) => void
  'connection-state': (peerId: string, state: RTCPeerConnectionState) => void
}

type EventName = keyof WebRTCManagerEvents

type PeerConnection = {
  pc: RTCPeerConnection
  dc: RTCDataChannel | null
  makingOffer: boolean
}

export class WebRTCManager {
  private peers = new Map<string, PeerConnection>()
  private listeners = new Map<EventName, Set<(...args: any[]) => void>>()
  private signaling: SignalingClient
  private localPeerId: string
  private localStream: MediaStream | null = null
  private cleanupFns: (() => void)[] = []

  constructor(signaling: SignalingClient, localPeerId: string) {
    this.signaling = signaling
    this.localPeerId = localPeerId

    this.cleanupFns.push(
      signaling.on('signal', (fromPeerId, signal) => {
        void this.handleSignal(fromPeerId, signal)
      }),
    )
  }

  on<E extends EventName>(event: E, fn: WebRTCManagerEvents[E]) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(fn)
    return () => { this.listeners.get(event)?.delete(fn) }
  }

  private emit<E extends EventName>(event: E, ...args: Parameters<WebRTCManagerEvents[E]>) {
    this.listeners.get(event)?.forEach((fn) => fn(...args))
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async connectToPeer(remotePeerId: string) {
    if (this.peers.has(remotePeerId)) return
    const entry = this.createPeerConnection(remotePeerId)

    const dc = entry.pc.createDataChannel(DATA_CHANNEL_LABEL)
    this.setupDataChannel(dc, remotePeerId)
    entry.dc = dc

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        entry.pc.addTrack(track, this.localStream)
      }
    }
  }

  /**
   * Reconnect to a peer whose connection has failed.
   * Tears down the old connection and initiates a fresh one.
   */
  async reconnectPeer(remotePeerId: string) {
    this.disconnectPeer(remotePeerId)
    await this.connectToPeer(remotePeerId)
  }

  /** Reconnect all peers that are in 'failed' or 'disconnected' state. */
  async reconnectAllFailed() {
    const failedPeerIds: string[] = []
    for (const [peerId, entry] of this.peers) {
      const s = entry.pc.connectionState
      if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        failedPeerIds.push(peerId)
      }
    }
    for (const peerId of failedPeerIds) {
      await this.reconnectPeer(peerId)
    }
  }

  setLocalStream(stream: MediaStream | null) {
    this.localStream = stream
    for (const [, entry] of this.peers) {
      const senders = entry.pc.getSenders()
      if (stream) {
        const tracks = stream.getTracks()
        for (const track of tracks) {
          const existing = senders.find((s) => s.track?.kind === track.kind)
          if (existing) {
            void existing.replaceTrack(track)
          } else {
            entry.pc.addTrack(track, stream)
          }
        }
      } else {
        for (const sender of senders) {
          if (sender.track) entry.pc.removeTrack(sender)
        }
      }
    }
  }

  sendToAll(msg: DcMessage) {
    const raw = JSON.stringify(msg)
    for (const [, entry] of this.peers) {
      if (entry.dc?.readyState === 'open') {
        entry.dc.send(raw)
      }
    }
  }

  sendToPeer(peerId: string, msg: DcMessage) {
    const entry = this.peers.get(peerId)
    if (entry?.dc?.readyState === 'open') {
      entry.dc.send(JSON.stringify(msg))
    }
  }

  disconnectPeer(peerId: string) {
    const entry = this.peers.get(peerId)
    if (!entry) return
    entry.dc?.close()
    entry.pc.close()
    this.peers.delete(peerId)
  }

  get connectedPeerIds(): string[] {
    const ids: string[] = []
    for (const [peerId, entry] of this.peers) {
      if (entry.pc.connectionState === 'connected') ids.push(peerId)
    }
    return ids
  }

  /** Aggregate connection state across all peers. */
  get aggregateState(): 'idle' | 'connecting' | 'connected' | 'failed' {
    if (this.peers.size === 0) return 'idle'
    let hasConnected = false
    let hasFailed = false
    let hasConnecting = false
    for (const [, entry] of this.peers) {
      const s = entry.pc.connectionState
      if (s === 'connected') hasConnected = true
      else if (s === 'failed') hasFailed = true
      else if (s === 'connecting' || s === 'new') hasConnecting = true
    }
    if (hasFailed && !hasConnected) return 'failed'
    if (hasConnected) return 'connected'
    if (hasConnecting) return 'connecting'
    return 'failed'
  }

  destroy() {
    for (const fn of this.cleanupFns) fn()
    this.cleanupFns = []
    for (const [peerId] of this.peers) {
      this.disconnectPeer(peerId)
    }
    this.listeners.clear()
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private createPeerConnection(remotePeerId: string): PeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    const entry: PeerConnection = { pc, dc: null, makingOffer: false }
    this.peers.set(remotePeerId, entry)

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        this.signaling.sendSignal(remotePeerId, {
          type: 'offer',
          sdp: pc.localDescription!.sdp,
        })
      } catch {
        // will surface via connectionstatechange → failed
      } finally {
        entry.makingOffer = false
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendSignal(remotePeerId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        })
      }
    }

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, remotePeerId)
      entry.dc = event.channel
    }

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        this.emit('remote-stream', remotePeerId, event.streams[0])
      }
    }

    pc.onconnectionstatechange = () => {
      this.emit('connection-state', remotePeerId, pc.connectionState)
      if (pc.connectionState === 'connected') {
        this.emit('peer-connected', remotePeerId)
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.emit('peer-disconnected', remotePeerId)
      }
    }

    return entry
  }

  private setupDataChannel(dc: RTCDataChannel, remotePeerId: string) {
    dc.onopen = () => {
      this.emit('dc-open', remotePeerId)
    }
    dc.onmessage = (event) => {
      try {
        const msg: DcMessage = JSON.parse(event.data as string)
        this.emit('dc-message', remotePeerId, msg)
      } catch {
        // ignore malformed messages
      }
    }
  }

  private async handleSignal(fromPeerId: string, signal: SignalPayload) {
    if (signal.type === 'offer') {
      let entry = this.peers.get(fromPeerId)
      if (!entry) {
        entry = this.createPeerConnection(fromPeerId)
        if (this.localStream) {
          for (const track of this.localStream.getTracks()) {
            entry.pc.addTrack(track, this.localStream)
          }
        }
      }

      const isImpolite = this.localPeerId > fromPeerId
      const offerCollision = entry.makingOffer || entry.pc.signalingState !== 'stable'
      if (isImpolite && offerCollision) return

      await entry.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
      const answer = await entry.pc.createAnswer()
      await entry.pc.setLocalDescription(answer)
      this.signaling.sendSignal(fromPeerId, {
        type: 'answer',
        sdp: entry.pc.localDescription!.sdp,
      })
    } else if (signal.type === 'answer') {
      const entry = this.peers.get(fromPeerId)
      if (entry) {
        await entry.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
      }
    } else if (signal.type === 'ice-candidate') {
      const entry = this.peers.get(fromPeerId)
      if (entry) {
        try {
          await entry.pc.addIceCandidate(signal.candidate)
        } catch {
          // ignore candidates that arrive before remote description
        }
      }
    }
  }
}
