import type { AIChatMessage, AIChatMessageDetail } from '#/plugins/ai/api';

import {
  consumeBufferedAGUIChunks,
  createAGUIStreamAccumulator,
} from '#/plugins/ai/api/chat-compat';

export type ChatMessageItem = AIChatMessageDetail & {
  id: string;
  streaming?: boolean;
};

export interface AIChatProviderMessage {
  content: string;
  conversation_id?: null | string;
  error_message?: null | string;
  is_error?: boolean;
  message_id?: null | string;
  reasoning?: string;
  role: 'assistant' | 'user';
  timestamp: string;
}

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

const aguiStreamAccumulator = createAGUIStreamAccumulator();

export function createProviderSeedMessage(
  timestamp = new Date().toISOString(),
): AIChatProviderMessage {
  return {
    content: '',
    role: 'assistant',
    timestamp,
  };
}

export function createProviderUserMessage(
  content: string,
  timestamp = new Date().toISOString(),
): AIChatProviderMessage {
  return {
    content,
    role: 'user',
    timestamp,
  };
}

export function normalizeProviderMessage(
  message: AIChatProviderMessage,
  fallbackIndex: number,
): ChatMessageItem[] {
  const items: ChatMessageItem[] = [];
  const baseId = message.message_id ?? `provider-${fallbackIndex}`;

  if (message.reasoning) {
    const thinking = normalizeMessage(
      {
        content: message.reasoning,
        conversation_id: message.conversation_id,
        role: 'thinking',
        timestamp: message.timestamp,
      },
      fallbackIndex,
      message.conversation_id,
    );
    thinking.id = `${baseId}-thinking`;
    items.push(thinking);
  }

  const role = message.role === 'assistant' ? 'model' : 'user';
  const chatMessage = normalizeMessage(
    {
      content: message.content,
      conversation_id: message.conversation_id,
      error_message: message.error_message,
      is_error: message.is_error,
      role,
      timestamp: message.timestamp,
    },
    fallbackIndex,
    message.conversation_id,
  );
  chatMessage.id = `${baseId}-${role}`;
  items.push(chatMessage);

  return items;
}

export function mergeStreamMessage(
  current: AIChatProviderMessage | undefined,
  incoming: AIChatProviderMessage,
): AIChatProviderMessage {
  return {
    ...incoming,
    content: mergeModelContent(current?.content ?? '', incoming.content),
    reasoning: mergeModelContent(
      current?.reasoning ?? '',
      incoming.reasoning ?? '',
    ),
  };
}

export function consumeBufferedSSEMessages(
  buffer: string,
  onMessage: (data: AIChatMessage) => void,
) {
  return consumeBufferedAGUIChunks(
    buffer,
    aguiStreamAccumulator,
    ({ message }) => {
      if (message) {
        onMessage(message);
      }
    },
  );
}

export function providerMessageToChatMessage(
  originMessage: AIChatProviderMessage | undefined,
  incoming: AIChatMessage,
) {
  const nextMessage: AIChatProviderMessage = {
    content:
      incoming.role === 'thinking'
        ? originMessage?.content ?? ''
        : incoming.content,
    conversation_id:
      incoming.conversation_id ?? originMessage?.conversation_id ?? null,
    error_message: incoming.error_message ?? originMessage?.error_message,
    is_error: incoming.is_error ?? false,
    message_id:
      incoming.message_id === undefined || incoming.message_id === null
        ? originMessage?.message_id
        : String(incoming.message_id),
    reasoning:
      incoming.role === 'thinking'
        ? incoming.content
        : originMessage?.reasoning ?? '',
    role: incoming.role === 'user' ? 'user' : 'assistant',
    timestamp: incoming.timestamp,
  };

  if (incoming.role === 'thinking' || incoming.role === 'model') {
    return mergeStreamMessage(originMessage, nextMessage);
  }

  return nextMessage;
}

export function buildTransientMessageItems(
  providerMessage: AIChatProviderMessage | undefined,
  fallbackIndex: number,
  status: 'abort' | 'error' | 'loading' | 'local' | 'success' | 'updating',
) {
  if (!providerMessage) {
    return [];
  }

  return normalizeProviderMessage(providerMessage, fallbackIndex).map((item) => {
    if (item.role === 'model' || item.role === 'thinking') {
      return {
        ...item,
        is_error: providerMessage.is_error ?? item.is_error,
        streaming: status === 'loading' || status === 'updating',
      };
    }

    return item;
  });
}
