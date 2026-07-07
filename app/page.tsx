import { Clapperboard } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { HomeLobbyCard } from '@/components/home-lobby-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Card>
          <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clapperboard className="size-4" />
                <CardTitle>View Together</CardTitle>
                <Badge variant="secondary">WebRTC P2P</Badge>
                <ThemeToggle />
              </div>
              <CardDescription>创建房间或加入房间，进入独立房间页开始同步播放。</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <HomeLobbyCard />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
