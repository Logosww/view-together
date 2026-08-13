import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { ChatRateLimiter, validateChatContent } from '@/lib/shared/chat';
import { prisma } from '@/lib/server/prisma';
import type { WsClientMessage, WsServerMessage, WsRoomMember } from '@/lib/shared/protocol';

type PeerEntry = {
  peerId: string;
  displayName: string;
  ws: { send(data: unknown): void };
};

type RoomState = {
  hostPeerId: string;
  members: Map<string, PeerEntry>;
};

const rooms = new Map<string, RoomState>();
const chatRateLimiter = new ChatRateLimiter();

type SocketMetadata = {
  __peerId?: string;
  __roomId?: string;
};

/**
 * Elysia creates a new ElysiaWS wrapper for every WS event (open/message/close).
 * The wrapper is ephemeral, but `ws.data` (which is `raw.data` on the underlying
 * Bun ServerWebSocket) persists across events. Store metadata there.
 */
function getSocketMetadata(ws: unknown): SocketMetadata {
  const data = (ws as { data?: SocketMetadata }).data;
  return data ?? (ws as SocketMetadata);
}

/**
 * Extract the persistent raw Bun ServerWebSocket from an ElysiaWS wrapper.
 * The raw socket is the same object across all events for a single connection,
 * making it suitable for identity comparison.
 */
function getRawSocket(ws: unknown): unknown {
  return (ws as { raw?: unknown }).raw ?? ws;
}

function getChatRateLimitKey(roomId: string, peerId: string) {
  return `${roomId}:${peerId}`;
}

function getRoomMembers(roomId: string): WsRoomMember[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.members.values()).map((p) => ({
    peerId: p.peerId,
    displayName: p.displayName,
  }));
}

function broadcast(roomId: string, msg: WsServerMessage, excludePeerId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const raw = JSON.stringify(msg);
  for (const entry of room.members.values()) {
    if (entry.peerId !== excludePeerId) {
      entry.ws.send(raw);
    }
  }
}

function sendTo(roomId: string, peerId: string, msg: WsServerMessage) {
  const entry = rooms.get(roomId)?.members.get(peerId);
  if (entry) {
    entry.ws.send(JSON.stringify(msg));
  }
}

function sendChatError(ws: { send(data: unknown): void }, message: string) {
  ws.send(JSON.stringify({ type: 'chat-error', message } satisfies WsServerMessage));
}

function sendError(ws: { send(data: unknown): void }, message: string) {
  ws.send(JSON.stringify({ type: 'error', message } satisfies WsServerMessage));
}

const port = Number(process.env.PORT ?? 3001);

new Elysia()
  .use(
    cors({
      origin: process.env.ALLOWED_ORIGIN?.split(',').map((item) => item.trim()) ?? true,
    }),
  )
  .get('/health', () => ({ ok: true }))
  .ws('/ws', {
    open(_ws) {},
    async message(ws, raw) {
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
          let room = rooms.get(roomId);
          if (!room) {
            // 查询 DB 获取权威 hostPeerId，防止客户端伪造房主身份
            const dbRoom = await prisma.room.findUnique({
              where: { id: roomId },
              select: { hostPeerId: true, status: true },
            });
            if (!dbRoom || dbRoom.status !== 'ACTIVE') {
              sendError(ws, '房间不存在或已关闭');
              break;
            }
            room = { hostPeerId: dbRoom.hostPeerId, members: new Map() };
            rooms.set(roomId, room);
          }
          room.members.set(peerId, { peerId, displayName, ws });
          const metadata = getSocketMetadata(ws);
          metadata.__peerId = peerId;
          metadata.__roomId = roomId;

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
          const metadata = getSocketMetadata(ws);
          const entry = rooms.get(roomId)?.members.get(peerId);
          if (
            !entry ||
            metadata.__roomId !== roomId ||
            metadata.__peerId !== peerId ||
            getRawSocket(entry.ws) !== getRawSocket(ws)
          ) {
            break;
          }
          const room = rooms.get(roomId);
          if (room) {
            room.members.delete(peerId);
            chatRateLimiter.clear(getChatRateLimitKey(roomId, peerId));
            if (room.members.size === 0) {
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
          // 用 metadata 真实身份，防止客户端伪造 fromPeerId
          const metadata = getSocketMetadata(ws);
          const roomId = metadata.__roomId;
          const fromPeerId = metadata.__peerId;
          if (!roomId || !fromPeerId) {
            sendError(ws, '请先加入房间');
            break;
          }
          if (!rooms.get(roomId)?.members.has(fromPeerId)) {
            sendError(ws, '你当前不在该房间中');
            break;
          }
          sendTo(roomId, msg.toPeerId, {
            type: 'signal',
            fromPeerId,
            signal: msg.signal,
          });
          break;
        }

        case 'video-source': {
          // 用 metadata 真实身份，防止客户端伪造 peerId；并校验房主权限
          const metadata = getSocketMetadata(ws);
          const roomId = metadata.__roomId;
          const peerId = metadata.__peerId;
          if (!roomId || !peerId) {
            sendError(ws, '请先加入房间');
            break;
          }
          const room = rooms.get(roomId);
          if (!room || !room.members.has(peerId)) {
            sendError(ws, '你当前不在该房间中');
            break;
          }
          if (room.hostPeerId !== peerId) {
            sendError(ws, '只有房主可以切换视频源');
            break;
          }
          broadcast(
            roomId,
            {
              type: 'video-source',
              source: msg.source,
            },
            peerId,
          );
          break;
        }

        case 'chat-message': {
          const { roomId, peerId } = msg;
          const metadata = getSocketMetadata(ws);
          const entry = rooms.get(roomId)?.members.get(peerId);
          if (
            !entry ||
            metadata.__roomId !== roomId ||
            metadata.__peerId !== peerId ||
            getRawSocket(entry.ws) !== getRawSocket(ws)
          ) {
            sendChatError(ws, '你当前不在该房间中');
            break;
          }

          const content = validateChatContent(msg.content);
          if (!content.ok) {
            sendChatError(ws, content.message);
            break;
          }

          if (!chatRateLimiter.tryConsume(getChatRateLimitKey(roomId, peerId))) {
            sendChatError(ws, '发送过于频繁，请稍后再试');
            break;
          }

          broadcast(roomId, {
            type: 'chat-message',
            id: crypto.randomUUID(),
            peerId,
            displayName: entry.displayName,
            content: content.content,
            sentAt: Date.now(),
          });
          break;
        }
      }
    },
    close(ws) {
      const { __peerId: peerId, __roomId: roomId } = getSocketMetadata(ws);
      if (!peerId || !roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      if (getRawSocket(room.members.get(peerId)?.ws) !== getRawSocket(ws)) return;
      room.members.delete(peerId);
      chatRateLimiter.clear(getChatRateLimitKey(roomId, peerId));
      if (room.members.size === 0) {
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
