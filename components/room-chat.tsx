'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, MessageCircle, RefreshCw, SendHorizontal, X } from 'lucide-react';
import { Bubble, BubbleContent, BubbleGroup } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { LocalChatMessage } from '@/lib/shared/protocol';

const VIRTUAL_THRESHOLD = 50;
// 底部 send bar 的高度占位，让消息流可滚到 send bar 背后以支持毛玻璃模糊
const SEND_BAR_GAP = 64;

type ChatMessagesProps = {
  messages: LocalChatMessage[];
  currentPeerId: string;
  onRetry?: (id: string) => void;
  className?: string;
  emptyLabel?: string;
};

/** 单条聊天气泡（IM 风格）：自己右对齐 primary 色，他人左对齐 muted 色。 */
function ChatBubble({
  message,
  isSelf,
  onRetry,
}: {
  message: LocalChatMessage;
  isSelf: boolean;
  onRetry?: (id: string) => void;
}) {
  return (
    <div className={cn('flex min-w-0 items-end gap-1.5', isSelf && 'justify-end')}>
      {/* 状态图标：发送中 loader / 失败重试，始终在气泡左侧 */}
      {message.status === 'sending' && (
        <Loader2
          className="mb-1 size-3 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}
      {message.status === 'failed' && onRetry && (
        <button
          type="button"
          onClick={() => onRetry(message.id)}
          aria-label="重试发送"
          className="mb-1 grid size-4 shrink-0 place-items-center rounded text-destructive transition hover:bg-destructive/10"
        >
          <RefreshCw className="size-3" aria-hidden="true" />
        </button>
      )}
      <Bubble
        variant={isSelf ? 'default' : 'tinted'}
        align={isSelf ? 'end' : 'start'}
        className={cn('data-[align=end]:items-end', message.status === 'sending' && 'opacity-50')}
      >
        <span className="px-1 text-xs text-muted-foreground">{message.displayName}</span>
        <BubbleContent className="rounded-2xl py-2">{message.content}</BubbleContent>
      </Bubble>
    </div>
  );
}

export function ChatMessages({
  messages,
  currentPeerId,
  onRetry,
  className,
  emptyLabel = '还没有消息，和房间成员打个招呼吧。',
}: ChatMessagesProps) {
  const useVirtual = messages.length > VIRTUAL_THRESHOLD;
  // ScrollArea 的 Root 不转发 ref，用容器 ref 在挂载后查询 Viewport 滚动元素
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(messages.length);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  // 挂载后定位 Radix ScrollArea 的 Viewport（实际可滚动元素）
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    setScrollEl(el ?? null);
  }, [useVirtual]);

  const virtualizer = useVirtualizer({
    count: useVirtual ? messages.length : 0,
    getScrollElement: () => scrollEl,
    estimateSize: () => 48,
    overscan: 8,
    enabled: useVirtual,
  });

  // 新消息追加时自动滚动到底部
  const lastMsg = messages[messages.length - 1];
  const lastId = lastMsg?.id;
  const lastStatus = lastMsg?.status;
  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = messages.length;
    if (messages.length <= prevCount) return; // 仅追加时滚动

    if (useVirtual) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    } else {
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [lastId, lastStatus, messages.length, useVirtual, virtualizer]);

  if (messages.length === 0) {
    return (
      <ScrollArea className={cn('min-h-0 flex-1', className)}>
        <div className="flex min-h-full items-center justify-center p-3">
          <p className="max-w-52 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      </ScrollArea>
    );
  }

  if (useVirtual) {
    const items = virtualizer.getVirtualItems();
    return (
      <ScrollArea
        ref={containerRef as React.Ref<HTMLDivElement>}
        className={cn('min-h-0 flex-1', className)}
        scrollFade
      >
        <div
          className="relative p-3"
          style={{ height: virtualizer.getTotalSize() }}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {items.map((item) => {
            const message = messages[item.index];
            if (!message) return null;
            return (
              <div
                key={message.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full py-1"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <ChatBubble
                  message={message}
                  isSelf={message.peerId === currentPeerId}
                  onRetry={onRetry}
                />
              </div>
            );
          })}
        </div>
        <div style={{ height: SEND_BAR_GAP }} aria-hidden="true" />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea
      ref={containerRef as React.Ref<HTMLDivElement>}
      className={cn('min-h-0 flex-1', className)}
      scrollFade
    >
      <BubbleGroup
        className="min-h-full p-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            isSelf={message.peerId === currentPeerId}
            onRetry={onRetry}
          />
        ))}
        <div ref={endRef} />
      </BubbleGroup>
      <div style={{ height: SEND_BAR_GAP }} aria-hidden="true" />
    </ScrollArea>
  );
}

type ChatComposerProps = {
  connected: boolean;
  onSend: (content: string) => boolean;
  compact?: boolean;
  onInteraction?: () => void;
};

export function ChatComposer({
  connected,
  onSend,
  compact = false,
  onInteraction,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const trimmedDraft = draft.trim();
  const disabled = !connected || !trimmedDraft;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedDraft) return;
    if (onSend(trimmedDraft)) {
      setDraft('');
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit} onClick={onInteraction}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={onInteraction}
            placeholder={connected ? '输入消息…' : '聊天连接中…'}
            maxLength={200}
            disabled={!connected}
            aria-label="聊天消息"
            className={cn('pr-8', compact && 'h-8 bg-background/90 text-xs')}
          />
          {draft && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setDraft('')}
              aria-label="清空输入"
              className="absolute right-0.5 top-0.5"
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
        <Button type="submit" size={compact ? 'sm' : 'default'} disabled={disabled}>
          <SendHorizontal data-icon="inline-start" />
          发送
        </Button>
      </div>
    </form>
  );
}

type RoomChatProps = {
  messages: LocalChatMessage[];
  currentPeerId: string;
  connected: boolean;
  onSend: (content: string) => boolean;
  onRetry?: (id: string) => void;
};

export function RoomChat({ messages, currentPeerId, connected, onSend, onRetry }: RoomChatProps) {
  return (
    <div className="relative flex h-64 min-h-0 flex-col overflow-hidden rounded-lg border lg:h-auto lg:flex-1">
      <ChatMessages messages={messages} currentPeerId={currentPeerId} onRetry={onRetry} />
      <div className="absolute inset-x-0 bottom-0 bg-background/70 p-3 backdrop-blur-md">
        <ChatComposer connected={connected} onSend={onSend} />
      </div>
    </div>
  );
}

// ── 全屏浮动弹幕气泡 ────────────────────────────────────────────────────────
// 直播弹幕风格：最新弹幕冒泡，固定时间消失，只展示最新 3 条。
// 默认位于底部 playback control 上方靠左。
// 收起态点击展开输入框；展开/收起高度不变，仅宽度过渡。
// 全屏下消息失败无反馈（弹幕照常显示后消失）。

const BUBBLE_VISIBLE_MS = 6_000;
const MAX_FULLSCREEN_BUBBLES = 3;

type FullscreenChatOverlayProps = {
  fullscreen: boolean;
  messages: LocalChatMessage[];
  connected: boolean;
  onSend: (content: string) => boolean;
};

/** 单条透明弹幕气泡：玻璃质感贴合 video.js control surface。
 * 文字使用 mix-blend-difference 自动反色：暗背景显白、亮背景显黑，始终高对比。
 * 头像取 displayName 首字符，同样应用 mix-blend-difference 保持对比度。 */
function FullscreenDanmakuBubble({ message }: { message: LocalChatMessage }) {
  return (
    <div
      className="
        animate-[chat-bubble_6s_ease-out_forwards] inline-flex max-w-full
        items-start gap-1.5 rounded-xl bg-white/15
        px-2 py-1
        shadow-[0_0_0_1px_rgba(0,0,0,0.2),0_1px_3px_0_rgba(0,0,0,0.3),0_1px_2px_-1px_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.15),inset_0_0_0_1px_rgba(255,255,255,0.08)]
        backdrop-blur-4xl backdrop-saturate-150
      "
    >
      <span
        className="
          grid size-4 shrink-0 place-items-center rounded-full bg-white/20
          text-[10px] font-semibold leading-none text-white
          mix-blend-difference
        "
        aria-hidden="true"
      >
        {message.displayName.charAt(0).toUpperCase()}
      </span>
      <span className="shrink-0 text-xs font-semibold text-white mix-blend-difference">
        {message.displayName}
      </span>
      <span className="break-words text-xs font-medium text-white mix-blend-difference">
        {message.content}
      </span>
    </div>
  );
}

/**
 * 全屏浮动弹幕气泡。
 * 收起态：pill 入口按钮，点击展开输入框。
 * 展开态：输入框 + 发送/收起，弹幕在上方冒泡。
 * 展开前后高度固定（h-8），仅宽度做过渡动画。
 * 默认置于底部 playback control 上方靠左，通过 `fullscreen` prop 控制显隐。
 */
export function FullscreenChatOverlay({
  fullscreen,
  messages,
  connected,
  onSend,
}: FullscreenChatOverlayProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const trimmedDraft = draft.trim();
  const canSend = connected && trimmedDraft.length > 0;

  // 进入全屏时重置
  useEffect(() => {
    if (fullscreen) {
      setExpanded(false);
      setDraft('');
      setNow(Date.now());
    }
  }, [fullscreen]);

  // 弹幕气泡过期驱动
  useEffect(() => {
    if (!fullscreen) return;

    const nextExpiration = Math.min(
      ...messages
        .map((message) => message.sentAt + BUBBLE_VISIBLE_MS - now)
        .filter((remaining) => remaining > 0),
    );
    if (!Number.isFinite(nextExpiration)) return;

    const timeoutId = window.setTimeout(() => setNow(Date.now()), nextExpiration);
    return () => window.clearTimeout(timeoutId);
  }, [messages, fullscreen, now]);

  const visibleMessages = messages
    .filter((message) => message.sentAt + BUBBLE_VISIBLE_MS > now)
    .slice(-MAX_FULLSCREEN_BUBBLES);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canSend) return;
    if (onSend(trimmedDraft)) {
      setDraft('');
    }
  };

  const handleExpand = () => {
    setExpanded(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 ${fullscreen ? '' : 'hidden'}`}
      aria-hidden={!fullscreen}
    >
      <div className="pointer-events-auto absolute bottom-16 left-4 flex w-[min(20rem,calc(100%-2rem))] flex-col items-start gap-2">
        {/* 弹幕气泡流：在气泡上方冒泡，新消息在最底部（靠近气泡） */}
        {visibleMessages.length > 0 && (
          <div className="flex flex-col-reverse gap-2 overflow-hidden">
            {visibleMessages.map((message) => (
              <FullscreenDanmakuBubble key={message.id} message={message} />
            ))}
          </div>
        )}

        {/* 气泡主体：同一容器宽度过渡，高度始终 h-8。样式贴合 video.js control surface。 */}
        <div
          className={cn(
            'flex h-8 items-center overflow-hidden rounded-full bg-white/10 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_1px_3px_0_rgba(0,0,0,0.15),0_1px_2px_-1px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-4xl backdrop-saturate-150 transition-[width] duration-200 ease-out',
            expanded ? 'w-full' : 'w-32',
          )}
        >
          {expanded ? (
            <form
              onSubmit={handleSubmit}
              onClick={(event) => event.stopPropagation()}
              className="flex h-full w-full items-center gap-1.5 pl-3 pr-0.5"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={connected ? '输入消息…' : '聊天连接中…'}
                maxLength={200}
                disabled={!connected}
                aria-label="聊天消息"
                className="
                  min-w-0 flex-1 bg-transparent text-xs text-white
                  placeholder:text-white/50 focus:outline-none
                  disabled:cursor-not-allowed
                "
              />
              <button
                type="button"
                aria-label="收起"
                onClick={() => setExpanded(false)}
                className="
                  grid size-7 shrink-0 place-items-center rounded-full text-white/70
                  transition hover:bg-white/10 hover:text-white
                "
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="submit"
                disabled={!canSend}
                aria-label="发送消息"
                className="
                  grid size-7 shrink-0 place-items-center rounded-full bg-white/15
                  text-white transition hover:bg-white/25
                  disabled:cursor-not-allowed disabled:opacity-40
                "
              >
                <SendHorizontal className="size-3.5" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={handleExpand}
              className="
                flex h-full w-full items-center gap-1.5 px-3 text-xs
                text-white/70 transition hover:text-white
              "
            >
              <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">说点什么…</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
