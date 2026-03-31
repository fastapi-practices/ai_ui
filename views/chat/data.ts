import type { AIChatMessage, AIChatMessageDetail } from '#/plugins/ai/api';

import {
  createAGUIStreamAccumulator,
  parseAGUIStreamEventFromSSE,
  toAIChatMessageFromAGUIEvent,
} from '#/plugins/ai/api/chat-compat';

export type ChatMessageItem = AIChatMessageDetail & {
  id: string;
  streaming?: boolean;
};

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

type ParsedSSEBlock = {
  data: unknown;
};

const aguiStreamAccumulator = createAGUIStreamAccumulator();

function parseSSEBlock(segment: string): null | ParsedSSEBlock {
  const lines = segment
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith(':')) {
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return {
      data: JSON.parse(dataLines.join('\n')),
    };
  } catch {
    return null;
  }
}

export function consumeBufferedSSEMessages(
  buffer: string,
  onMessage: (data: AIChatMessage) => void,
) {
  const segments = buffer.split(/\r?\n\r?\n/u);
  const rest = segments.pop() || '';

  for (const segment of segments) {
    const parsedBlock = parseSSEBlock(segment);
    if (!parsedBlock) {
      continue;
    }

    const aguiEvent = parseAGUIStreamEventFromSSE(parsedBlock.data);
    if (aguiEvent) {
      const aguiMessage = toAIChatMessageFromAGUIEvent(
        aguiEvent,
        aguiStreamAccumulator,
      );
      if (aguiMessage) {
        onMessage(aguiMessage);
      }
      continue;
    }
  }

  return rest;
}
