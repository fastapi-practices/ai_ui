import type {
  AIChatConversationItem,
  AIChatMessage,
  AIChatMessageDetail,
} from '#/plugins/ai/api';

export type ChatMessageItem = AIChatMessageDetail & {
  id: string;
  streaming?: boolean;
};

export const COMPOSER_MIN_HEIGHT = 56;
export const COMPOSER_DEFAULT_HEIGHT = 56;
export const COMPOSER_FALLBACK_MAX_HEIGHT = 420;
export const MIN_MESSAGE_VIEWPORT_HEIGHT = 180;
export const STOP_SEQUENCES_PLACEHOLDER = '["</thinking>"]';
export const EXTRA_HEADERS_PLACEHOLDER = '{"x-trace-id":"chat-demo"}';
export const EXTRA_BODY_PLACEHOLDER = '{"reasoning":{"effort":"medium"}}';
export const LOGIT_BIAS_PLACEHOLDER = '{"198":-100}';

export function buildMessageId(seedValue?: null | number | string) {
  return `${seedValue ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function compareConversations(
  a: AIChatConversationItem,
  b: AIChatConversationItem,
) {
  if (a.is_pinned !== b.is_pinned) {
    return Number(b.is_pinned) - Number(a.is_pinned);
  }

  const aTime = a.is_pinned
    ? a.pinned_time || a.last_activity_time
    : a.last_activity_time;
  const bTime = b.is_pinned
    ? b.pinned_time || b.last_activity_time
    : b.last_activity_time;
  return new Date(bTime).getTime() - new Date(aTime).getTime();
}

export function makeConversationTitle(text: string) {
  return text.replaceAll(/\s+/gu, ' ').trim().slice(0, 24) || '新话题';
}

export function parseDateLabel(value?: null | string, withDate = true) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    day: withDate ? '2-digit' : undefined,
    hour: '2-digit',
    minute: '2-digit',
    month: withDate ? '2-digit' : undefined,
  }).format(date);
}

export function parseJsonField<T>(
  raw: string,
  label: string,
  validator?: (value: T) => boolean,
) {
  const text = raw.trim();
  if (!text) {
    return undefined;
  }

  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} 必须是合法 JSON`);
  }

  if (validator && !validator(parsed)) {
    throw new Error(`${label} 格式不正确`);
  }

  return parsed;
}

export function mergeModelContent(previous: string, incoming: string) {
  if (!previous) {
    return incoming;
  }
  if (incoming.startsWith(previous)) {
    return incoming;
  }
  return `${previous}${incoming}`;
}

export function resolveChatMessageContent(
  item: Pick<AIChatMessage, 'content' | 'error_message'>,
) {
  return item.content || item.error_message || '';
}

export function normalizeMessage(
  item: AIChatMessage | AIChatMessageDetail,
  fallbackIndex: number,
  activeConversationId?: null | string,
): ChatMessageItem {
  return {
    content: resolveChatMessageContent(item),
    conversation_id: item.conversation_id ?? activeConversationId ?? null,
    error_message: item.error_message ?? null,
    id: buildMessageId(item.message_index ?? `${item.role}-${fallbackIndex}`),
    is_error: item.is_error ?? false,
    message_index: item.message_index ?? fallbackIndex,
    role: item.role,
    streaming: false,
    timestamp: item.timestamp,
  };
}

export function consumeBufferedLines(
  buffer: string,
  onLine: (data: AIChatMessage) => void,
) {
  const lines = buffer.split('\n');
  const rest = lines.pop() || '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    onLine(JSON.parse(line) as AIChatMessage);
  }

  return rest;
}
