import { requestApi } from "@/lib/client/http"

export type RoomMember = {
  id: string
  roomId: string
  peerId: string
  displayName: string
  joinedAt: string
  lastSeenAt: string
  connectionState: "CONNECTING" | "CONNECTED" | "RECONNECTING" | "OFFLINE"
}

export type PlaybackState = {
  roomId: string
  status: "PLAYING" | "PAUSED"
  positionMs: number
  updatedBy: string
  version: number
  updatedAt: string
}

export type RoomSnapshot = {
  id: string
  hostPeerId: string
  status: "ACTIVE" | "CLOSED"
  createdAt: string
  updatedAt: string
  members: RoomMember[]
  playback: PlaybackState | null
}

export type RoomCommandData = {
  roomId: string
  peerId: string
  room: RoomSnapshot | null
}

export async function createRoom(displayName: string) {
  return requestApi<RoomCommandData>("/api/rooms/create", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  })
}

export async function joinRoom(roomId: string, displayName: string, peerId?: string) {
  return requestApi<RoomCommandData>("/api/rooms/join", {
    method: "POST",
    body: JSON.stringify({ roomId, displayName, peerId }),
  })
}

export async function leaveRoom(roomId: string, peerId: string) {
  return requestApi<{ roomId: string; leftPeerId: string }>(
    "/api/rooms/leave",
    {
      method: "POST",
      body: JSON.stringify({ roomId, peerId }),
    },
  )
}

export async function updatePlayback(
  roomId: string,
  peerId: string,
  status: "PLAYING" | "PAUSED",
  positionMs: number,
) {
  return requestApi<PlaybackState | null>(`/api/rooms/${roomId}/playback`, {
    method: "POST",
    body: JSON.stringify({ peerId, status, positionMs }),
  })
}

export async function getRoom(roomId: string) {
  return requestApi<RoomSnapshot>(`/api/rooms/${roomId}`)
}

export async function sendHeartbeat(roomId: string, peerId: string) {
  return requestApi<{ ok: boolean }>(`/api/rooms/${roomId}/heartbeat`, {
    method: "POST",
    body: JSON.stringify({ peerId }),
  })
}
