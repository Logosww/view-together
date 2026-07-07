import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import type { WsClientMessage, WsServerMessage, WsRoomMember } from '@/lib/shared/protocol';

type PeerEntry = {
  peerId: string;
  displayName: string;
  ws: { send(data: unknown): void };
};

const rooms = new Map<string, Map<string, PeerEntry>>();

function getRoomMembers(roomId: string): WsRoomMember[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.values()).map((p) => ({
    peerId: p.peerId,
    displayName: p.displayName,
  }));
}

function broadcast(roomId: string, msg: WsServerMessage, excludePeerId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const raw = JSON.stringify(msg);
  for (const entry of room.values()) {
    if (entry.peerId !== excludePeerId) {
      entry.ws.send(raw);
    }
  }
}

function sendTo(roomId: string, peerId: string, msg: WsServerMessage) {
  const entry = rooms.get(roomId)?.get(peerId);
  if (entry) {
    entry.ws.send(JSON.stringify(msg));
  }
}

const port = Number(process.env.PORT ?? 3001);

const server = new Elysia()
  .use(
    cors({
      origin: process.env.ALLOWED_ORIGIN?.split(',').map((item) => item.trim()) ?? true,
    }),
  )
  .get('/health', () => ({ ok: true }))
  .ws('/ws', {
    open(_ws) {},
    message(ws, raw) {
      let msg: WsClientMessage;
      if (typeof raw === 'object' && raw !== null) {
        msg = raw as WsClientMessage;
      } else {
        try {
          msg = JSON.parse(String(raw));
        } catch {
          return;
        }
      }

      switch (msg.type) {
        case 'join-room': {
          const { roomId, peerId, displayName } = msg;
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          const room = rooms.get(roomId)!;
          room.set(peerId, { peerId, displayName, ws });
          (ws as unknown as { __peerId: string }).__peerId = peerId;
          (ws as unknown as { __roomId: string }).__roomId = roomId;

          const members = getRoomMembers(roomId);
          broadcast(roomId, {
            type: 'peer-joined',
            roomId,
            peerId,
            displayName,
            members,
          });
          break;
        }

        case 'leave-room': {
          const { roomId, peerId } = msg;
          const room = rooms.get(roomId);
          if (room) {
            room.delete(peerId);
            if (room.size === 0) {
              rooms.delete(roomId);
            } else {
              broadcast(roomId, {
                type: 'peer-left',
                roomId,
                peerId,
                members: getRoomMembers(roomId),
              });
            }
          }
          break;
        }

        case 'signal': {
          sendTo(msg.roomId, msg.toPeerId, {
            type: 'signal',
            fromPeerId: msg.fromPeerId,
            signal: msg.signal,
          });
          break;
        }

        case 'video-source': {
          broadcast(
            msg.roomId,
            {
              type: 'video-source',
              source: msg.source,
            },
            msg.peerId,
          );
          break;
        }
      }
    },
    close(ws) {
      const peerId = (ws as unknown as { __peerId?: string }).__peerId as string | undefined;
      const roomId = (ws as unknown as { __roomId?: string }).__roomId as string | undefined;
      if (!peerId || !roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.delete(peerId);
      if (room.size === 0) {
        rooms.delete(roomId);
      } else {
        broadcast(roomId, {
          type: 'peer-left',
          roomId,
          peerId,
          members: getRoomMembers(roomId),
        });
      }
    },
  })
  .listen(port);

const host = process.env.RAILWAY_PUBLIC_DOMAIN ?? `localhost:${port}`;
const protocol = process.env.RAILWAY_PUBLIC_DOMAIN ? 'wss' : 'ws';
console.log(`[WS] 信令服务器已启动 → ${protocol}://${host}/ws`);

export default server;
