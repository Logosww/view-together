import { RoomPage } from '@/components/room-page';

type RoomRoutePageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomRoutePage({ params }: RoomRoutePageProps) {
  const { code } = await params;
  return <RoomPage roomCode={code.trim().toUpperCase()} />;
}
