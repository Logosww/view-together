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
        <Button size="lg" variant="outline" disabled={disabled}>
          <Film className="size-4" />
          选择视频
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>选择视频源</DialogTitle>
          <DialogDescription>输入视频链接或选择本地文件。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">
              <Link className="size-4" />
              视频链接
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="size-4" />
              本地文件
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label htmlFor="video-url">视频 URL</Label>
              <Input
                id="video-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleConfirmUrl} disabled={!url.trim()}>
                确定
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="file" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label>选择视频文件</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" />
                  浏览文件
                </Button>
                <span className="truncate text-sm text-muted-foreground">
                  {file ? file.name : '未选择文件'}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleConfirmFile} disabled={!file}>
                确定
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
