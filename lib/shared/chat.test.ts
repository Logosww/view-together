import { describe, expect, test } from 'bun:test';
import {
  CHAT_MAX_LENGTH,
  CHAT_RATE_WINDOW_MS,
  ChatRateLimiter,
  validateChatContent,
} from '@/lib/shared/chat';

describe('validateChatContent', () => {
  test('trims valid text', () => {
    expect(validateChatContent('  一起看吧  ')).toEqual({ ok: true, content: '一起看吧' });
  });

  test('rejects empty and oversized messages', () => {
    expect(validateChatContent('   ')).toEqual({ ok: false, message: '消息不能为空' });
    expect(validateChatContent('😀'.repeat(CHAT_MAX_LENGTH + 1))).toEqual({
      ok: false,
      message: `消息不能超过 ${CHAT_MAX_LENGTH} 个字符`,
    });
  });
});

describe('ChatRateLimiter', () => {
  test('allows five messages per window and resets after the window', () => {
    const limiter = new ChatRateLimiter();
    const now = 1_000;

    for (let index = 0; index < 5; index++) {
      expect(limiter.tryConsume('ROOM:peer', now + index)).toBe(true);
    }
    expect(limiter.tryConsume('ROOM:peer', now + 5)).toBe(false);
    expect(limiter.tryConsume('ROOM:peer', now + CHAT_RATE_WINDOW_MS + 1)).toBe(true);
  });
});
