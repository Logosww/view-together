export const CHAT_MAX_LENGTH = 200;
export const CHAT_RATE_LIMIT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;

export type ChatValidationResult =
  | { ok: true; content: string }
  | { ok: false; message: string };

export function validateChatContent(value: unknown): ChatValidationResult {
  if (typeof value !== 'string') {
    return { ok: false, message: '消息格式无效' };
  }

  const content = value.trim();
  if (!content) {
    return { ok: false, message: '消息不能为空' };
  }

  if (Array.from(content).length > CHAT_MAX_LENGTH) {
    return { ok: false, message: `消息不能超过 ${CHAT_MAX_LENGTH} 个字符` };
  }

  return { ok: true, content };
}

export class ChatRateLimiter {
  private readonly timestampsByKey = new Map<string, number[]>();

  tryConsume(key: string, now = Date.now()) {
    const cutoff = now - CHAT_RATE_WINDOW_MS;
    const timestamps = (this.timestampsByKey.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (timestamps.length >= CHAT_RATE_LIMIT) {
      this.timestampsByKey.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.timestampsByKey.set(key, timestamps);
    return true;
  }

  clear(key: string) {
    this.timestampsByKey.delete(key);
  }
}
