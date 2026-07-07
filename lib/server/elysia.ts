import { Elysia, t } from 'elysia';
import { prisma } from '@/lib/server/prisma';
import {
  MemberPlainInputCreate,
  PlaybackStatePlain,
  PlaybackStatus,
  Room,
} from '@/prisma/generated/prismabox/barrel';

import type { TSchema } from 'elysia';

const MAX_ROOM_MEMBERS = 8;
const DisplayNameInput = t.Partial(t.Pick(MemberPlainInputCreate, ['displayName']));
const ErrorMessage = '网络或服务异常，请稍后重试';
const RoomCommandData = t.Object({
  roomId: t.String(),
  peerId: t.String(),
  room: t.Union([Room, t.Null()]),
});
const ApiEnvelope = (data: TSchema) =>
  t.Object({
    data,
    msg: t.String(),
    successful: t.Boolean(),
  });
const ok = <T>(data: T, msg = 'ok') => ({ data, msg, successful: true });
const biz = (msg: string) => ({ data: null, msg, successful: false });

const makeRoomId = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const makePeerId = () => `peer-${crypto.randomUUID().slice(0, 8)}`;

const normalizeName = (name?: string) => {
  const candidate = name?.trim();
  if (!candidate) {
    return 'Guest';
  }
  return candidate.slice(0, 24);
};

export const backendApp = new Elysia({ prefix: '/api' })
  .onError(({ set }) => {
    set.status = 500;
    return biz(ErrorMessage);
  })
  .get('/health', () => ok({ service: 'elysia-prisma', timestamp: Date.now() }), {
    response: {
      200: ApiEnvelope(
        t.Object({
          service: t.String(),
          timestamp: t.Number(),
        }),
      ),
      500: ApiEnvelope(t.Null()),
    },
  })
  .post(
    '/rooms/create',
    async ({ body }) => {
      const roomId = makeRoomId();
      const peerId = makePeerId();
      const displayName = normalizeName(body.displayName);

      const room = await prisma.room.create({
        data: {
          id: roomId,
          hostPeerId: peerId,
          status: 'ACTIVE',
          members: {
            create: {
              peerId,
              displayName,
              connectionState: 'CONNECTED',
            },
          },
          playback: {
            create: {
              status: 'PAUSED',
              positionMs: 0,
              updatedBy: peerId,
            },
          },
        },
        include: {
          members: true,
          playback: true,
        },
      });

      return ok({
        roomId: room.id,
        peerId,
        room,
      });
    },
    {
      body: DisplayNameInput,
      response: {
        200: ApiEnvelope(RoomCommandData),
        500: ApiEnvelope(t.Null()),
      },
    },
  )
  .post(
    '/rooms/join',
    async ({ body }) => {
      const normalizedRoomId = body.roomId.trim().toUpperCase();
      const room = await prisma.room.findUnique({
        where: { id: normalizedRoomId },
        include: {
          members: true,
          playback: true,
        },
      });

      if (!room || room.status !== 'ACTIVE') {
        return biz('房间不存在或已关闭');
      }

      if (room.members.length >= MAX_ROOM_MEMBERS) {
        return biz('房间已满');
      }

      const peerId = body.peerId || makePeerId();
      const displayName = normalizeName(body.displayName);

      const member = await prisma.member.upsert({
        where: {
          roomId_peerId: {
            roomId: room.id,
            peerId,
          },
        },
        create: {
          roomId: room.id,
          peerId,
          displayName,
          connectionState: 'CONNECTED',
        },
        update: {
          displayName,
          connectionState: 'CONNECTED',
          lastSeenAt: new Date(),
        },
      });

      const members = room.members.some((m) => m.peerId === peerId)
        ? room.members.map((m) => (m.peerId === peerId ? member : m))
        : [...room.members, member];

      return ok({
        roomId: room.id,
        peerId,
        room: { ...room, members },
      });
    },
    {
      body: t.Composite([
        t.Object({
          roomId: t.String(),
          peerId: t.Optional(t.String()),
        }),
        DisplayNameInput,
      ]),
      response: {
        200: ApiEnvelope(t.Union([RoomCommandData, t.Null()])),
        500: ApiEnvelope(t.Null()),
      },
    },
  )
  .post(
    '/rooms/leave',
    async ({ body }) => {
      const room = await prisma.room.findUnique({
        where: { id: body.roomId },
        include: { members: true },
      });

      if (!room) {
        return biz('房间不存在');
      }

      await prisma.member.deleteMany({
        where: {
          roomId: body.roomId,
          peerId: body.peerId,
        },
      });

      const membersLeft = await prisma.member.count({
        where: { roomId: body.roomId },
      });

      if (membersLeft === 0 || room.hostPeerId === body.peerId) {
        await prisma.room.update({
          where: { id: body.roomId },
          data: { status: 'CLOSED' },
        });
      }

      return ok({
        roomId: body.roomId,
        leftPeerId: body.peerId,
      });
    },
    {
      body: t.Object({
        roomId: t.String(),
        peerId: t.String(),
      }),
      response: {
        200: ApiEnvelope(
          t.Union([
            t.Object({
              roomId: t.String(),
              leftPeerId: t.String(),
            }),
            t.Null(),
          ]),
        ),
        500: ApiEnvelope(t.Null()),
      },
    },
  )
  .get(
    '/rooms/:roomId',
    async ({ params }) => {
      const room = await prisma.room.findUnique({
        where: { id: params.roomId },
        include: {
          members: true,
          playback: true,
        },
      });

      if (!room || room.status !== 'ACTIVE') {
        return biz('房间不存在或已关闭');
      }

      return ok(room);
    },
    {
      response: {
        200: ApiEnvelope(t.Union([Room, t.Null()])),
        500: ApiEnvelope(t.Null()),
      },
    },
  )
  .post(
    '/rooms/:roomId/playback',
    async ({ params, body }) => {
      const [room, member] = await Promise.all([
        prisma.room.findUnique({
          where: { id: params.roomId },
        }),
        prisma.member.findUnique({
          where: {
            roomId_peerId: {
              roomId: params.roomId,
              peerId: body.peerId,
            },
          },
        }),
      ]);

      if (!room || room.status !== 'ACTIVE') {
        return biz('房间不存在或已关闭');
      }

      if (!member) {
        return biz('成员不在房间中');
      }

      const playback = await prisma.playbackState.upsert({
        where: { roomId: params.roomId },
        create: {
          roomId: params.roomId,
          status: body.status,
          positionMs: body.positionMs,
          updatedBy: body.peerId,
          version: 1,
        },
        update: {
          status: body.status,
          positionMs: body.positionMs,
          updatedBy: body.peerId,
          version: { increment: 1 },
        },
      });

      return ok(playback);
    },
    {
      body: t.Object({
        peerId: t.String(),
        status: PlaybackStatus,
        positionMs: t.Integer({ minimum: 0 }),
      }),
      response: {
        200: ApiEnvelope(t.Union([PlaybackStatePlain, t.Null()])),
        500: ApiEnvelope(t.Null()),
      },
    },
  )
  .post(
    '/rooms/:roomId/heartbeat',
    async ({ params, body }) => {
      const member = await prisma.member.findUnique({
        where: {
          roomId_peerId: {
            roomId: params.roomId,
            peerId: body.peerId,
          },
        },
      });

      if (!member) {
        return biz('成员不存在');
      }

      await prisma.member.update({
        where: {
          roomId_peerId: {
            roomId: params.roomId,
            peerId: body.peerId,
          },
        },
        data: {
          lastSeenAt: new Date(),
          connectionState: 'CONNECTED',
        },
      });

      return ok({ ok: true });
    },
    {
      body: t.Object({
        peerId: t.String(),
      }),
      response: {
        200: ApiEnvelope(t.Union([t.Object({ ok: t.Boolean() }), t.Null()])),
        500: ApiEnvelope(t.Null()),
      },
    },
  );
