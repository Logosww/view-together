'use client';

import { useRef, useState } from 'react';
import { Film, Link, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { VideoSource } from '@/lib/shared/protocol';

export type VideoSourceDialogProps = {
  onConfirm: (source: VideoSource, objectUrl?: string) => void;
  disabled?: boolean;
};

export function VideoSourceDialog({ onConfirm, disabled }: VideoSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConfirmUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onConfirm({ type: 'url', url: trimmed });
    setOpen(false);
    setUrl('');
  };

  const handleConfirmFile = () => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    onConfirm({ type: 'file', name: file.name }, objectUrl);
    setOpen(false);
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" disabled={disabled} className="w-full sm:w-auto">
          <Film className="size-4" aria-hidden="true" />
          选择视频
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择视频源</DialogTitle>
          <DialogDescription>输入视频链接或选择本地文件。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">
              <Link className="size-4" aria-hidden="true" />
              视频链接
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="size-4" aria-hidden="true" />
              本地文件
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="video-url">视频 URL</Label>
              <Input
                id="video-url"
                name="video-url"
                type="url"
                autoComplete="off"
                inputMode="url"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="例如：https://example.com/video.mp4…"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                取消
              </Button>
              <Button
                onClick={handleConfirmUrl}
                disabled={!url.trim()}
                className="w-full sm:w-auto"
              >
                设置视频链接
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="file" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="video-file">选择视频文件</Label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="size-4" aria-hidden="true" />
                  浏览文件
                </Button>
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {file ? file.name : '未选择文件'}
                </span>
              </div>
              <input
                id="video-file"
                name="video-file"
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                取消
              </Button>
              <Button onClick={handleConfirmFile} disabled={!file} className="w-full sm:w-auto">
                设置本地文件
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
