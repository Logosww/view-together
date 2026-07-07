import { notFound } from 'next/navigation';
import { RoomPage } from '@/components/room-page';
import { prisma } from '@/lib/server/prisma';

type RoomRoutePageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomRoutePage({ params }: RoomRoutePageProps) {
  const { code } = await params;
  const roomCode = code.trim().toUpperCase();

  const room = await prisma.room.findUnique({
    where: { id: roomCode },
    select: { id: true, status: true },
  });

  if (!room || room.status !== 'ACTIVE') {
    notFound();
  }

  return <RoomPage roomCode={roomCode} />;
}
