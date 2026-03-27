import type { AIChatMessage, AIChatMessageDetail } from '#/plugins/ai/api';

export type ChatMessageItem = AIChatMessageDetail & {
  id: string;
  streaming?: boolean;
};

type AIChatCompletionsSSE =
  | {
      event: 'response.completed' | 'response.final_result';
      data: {
        conversation_id: string;
      };
    }
  | {
      event: 'response.error';
      data: {
        conversation_id: string;
        detail: string;
        message: string;
        message_index: number;
      };
    }
  | {
      event: 'response.output_text.created';
      data: {
        conversation_id: string;
        message_index: number;
        role: 'model';
        timestamp: string;
      };
    }
  | {
      event: 'response.output_text.delta';
      data: {
        conversation_id: string;
        delta: string;
        message_index: number;
      };
    }
  | {
      event: 'response.output_text.done';
      data: {
        content: string;
        conversation_id: string;
        message_index: number;
      };
    }
  | {
      event: 'response.reasoning.created';
      data: {
        conversation_id: string;
        message_index: number;
        role: 'thinking';
        timestamp: string;
      };
    }
  | {
      event: 'response.reasoning.delta';
      data: {
        conversation_id: string;
        delta: string;
        message_index: number;
      };
    }
  | {
      event: 'response.reasoning.done';
      data: {
        content: string;
        conversation_id: string;
        message_index: number;
      };
    }
  | {
      event: 'response.structured.done';
      data: {
        content: string;
        conversation_id: string;
        message_index: number;
        structured_data: unknown;
      };
    }
  | {
      event: 'response.user';
      data: {
        content: string;
        conversation_id: string;
        message_index: number;
        role: 'user';
        timestamp: string;
      };
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
  item: Pick<AIChatMessage, 'content' | 'error_message' | 'structured_data'>,
) {
  if (item.content) {
    return item.content;
  }

  if (item.structured_data) {
    return item.structured_data;
  }

  return item.error_message || '';
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
    id: buildMessageId(
      item.message_id ?? item.message_index ?? `${item.role}-${fallbackIndex}`,
    ),
    is_error: item.is_error ?? false,
    message_id: item.message_id ?? null,
    message_index: item.message_index ?? fallbackIndex,
    role: item.role,
    structured_data: item.structured_data ?? null,
    streaming: false,
    timestamp: item.timestamp,
  };
}

export function toAIChatMessage(
  payload: AIChatCompletionsSSE,
): AIChatMessage | null {
  switch (payload.event) {
    case 'response.user': {
      return payload.data;
    }
    case 'response.reasoning.created': {
      return {
        content: '',
        conversation_id: payload.data.conversation_id,
        message_index: payload.data.message_index,
        role: 'thinking',
        timestamp: payload.data.timestamp,
      };
    }
    case 'response.reasoning.delta': {
      return {
        content: payload.data.delta,
        conversation_id: payload.data.conversation_id,
        message_index: payload.data.message_index,
        role: 'thinking',
        timestamp: new Date().toISOString(),
      };
    }
    case 'response.reasoning.done': {
      return {
        content: payload.data.content,
        conversation_id: payload.data.conversation_id,
        message_index: payload.data.message_index,
        role: 'thinking',
        timestamp: new Date().toISOString(),
      };
    }
    case 'response.output_text.created': {
      return {
        content: '',
        conversation_id: payload.data.conversation_id,
        message_index: payload.data.message_index,
        role: 'model',
        timestamp: payload.data.timestamp,
      };
    }
    case 'response.output_text.delta': {
      return {
        content: payload.data.delta,
        conversation_id: payload.data.conversation_id,
        message_index: payload.data.message_index,
        role: 'model',
        timestamp: new Date().toISOString(),
      };
    }
    case 'response.output_text.done': {
      return {
        content: payload.data.content,
        conversation_id: payload.data.conversation_id,
        message_index: payload.data.message_index,
        role: 'model',
        timestamp: new Date().toISOString(),
      };
    }
    case 'response.structured.done': {
      return {
        content: payload.data.content,
        conversation_id: payload.data.conversation_id,
        message_index: payload.data.message_index,
        role: 'model',
        structured_data: JSON.stringify(payload.data.structured_data, null, 2),
        timestamp: new Date().toISOString(),
      };
    }
    case 'response.error': {
      return {
        content: payload.data.message,
        conversation_id: payload.data.conversation_id,
        error_message: payload.data.detail || payload.data.message,
        is_error: true,
        message_index: payload.data.message_index,
        role: 'model',
        timestamp: new Date().toISOString(),
      };
    }
    default: {
      return null;
    }
  }
}

export function consumeBufferedSSEMessages(
  buffer: string,
  onMessage: (data: AIChatMessage) => void,
) {
  const segments = buffer.split(/\r?\n\r?\n/u);
  const rest = segments.pop() || '';

  for (const segment of segments) {
    const lines = segment
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    let eventName = '';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) {
        continue;
      }

      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        continue;
      }

      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (!eventName || dataLines.length === 0) {
      continue;
    }

    const payload = {
      data: JSON.parse(dataLines.join('\n')),
      event: eventName,
    } as AIChatCompletionsSSE;

    const message = toAIChatMessage(payload);
    if (message) {
      onMessage(message);
    }
  }

  return rest;
}
