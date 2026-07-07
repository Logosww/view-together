'use client';

import { RoomProvider } from '@/components/room-provider';

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <RoomProvider>{children}</RoomProvider>;
}
