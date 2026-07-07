import { ThemeToggle } from '@/components/theme-toggle';
import { HomeLobbyCard } from '@/components/home-lobby-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center bg-muted/40 px-3 py-4 sm:px-4 sm:py-6 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <Card className="overflow-hidden py-0">
          <CardHeader className="gap-3 p-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-wrap text-base sm:text-lg">View Together</CardTitle>
              <CardDescription className="mt-1 text-pretty">
                创建房间或加入房间，进入独立房间页开始同步播放。
              </CardDescription>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Badge variant="secondary" className="whitespace-nowrap">
                WebRTC P2P
              </Badge>
              <ThemeToggle />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <HomeLobbyCard />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
