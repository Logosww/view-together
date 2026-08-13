import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { RoomPage } from '@/components/room-page';
import { RoomProvider } from '@/components/room-provider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { prisma } from '@/lib/server/prisma';

type RoomRoutePageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomRoutePage({ params }: RoomRoutePageProps) {
  return (
    <Suspense fallback={<RoomRouteSkeleton />}>
      <RoomRouteContent params={params} />
    </Suspense>
  );
}

async function RoomRouteContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const roomCode = code.trim().toUpperCase();

  const room = await prisma.room.findUnique({
    where: { id: roomCode },
    select: { id: true, status: true },
  });

  if (!room || room.status !== 'ACTIVE') {
    notFound();
  }

  return (
    <RoomProvider roomCode={roomCode}>
      <RoomPage roomCode={roomCode} />
    </RoomProvider>
  );
}

function RoomRouteSkeleton() {
  return (
    <main id="main-content" className="min-h-screen bg-muted/40 px-3 py-4 sm:px-4 sm:py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Card className="overflow-hidden gap-1.5">
          <CardHeader className="gap-3 px-4 pb-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="size-7 shrink-0 rounded-md" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-wrap items-center gap-1.5 px-4 pt-0 text-sm text-muted-foreground">
            <Skeleton className="h-5 w-20 rounded-full" />
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-4 sm:gap-6 lg:h-116 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card className="min-h-0 overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0">
              <Skeleton className="aspect-video w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card className="min-h-0 overflow-hidden">
            <CardHeader className="gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-8 w-32 rounded-md" />
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <Skeleton className="min-h-32 flex-1 rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
