import type { Recordable } from '@vben/types';

import type {
  AGUIMessage,
  AGUISSEChunk,
  AGUIStreamEvent,
  AIChatCompletionRequest,
  AIChatForwardedPropsParam,
  RawAIConversationDetail,
  RawAIConversationListItem,
} from './contracts';
import type {
  AIChatConversationDetail,
  AIChatConversationListResult,
  AIChatMessage,
  AIChatMessageDetail,
  AIChatParams,
} from './index';

export interface BuildChatCompletionRequestInput {
  conversationId?: null | string;
  history: AIChatMessageDetail[];
  params: AIChatParams;
  promptText?: string;
}

export interface ConsumedAGUIChunk {
  event: AGUIStreamEvent;
  message: AIChatMessage | null;
}

function parseExtraBody(
  raw: null | string | undefined,
): null | Recordable<unknown> | undefined {
  const text = raw?.trim();
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Recordable<unknown>;
    }
  } catch {
    // Keep compatibility fallback: ignore invalid JSON here and let
    // current page-level validation behavior remain unchanged.
  }

  return undefined;
}

function toForwardedProps(params: AIChatParams): AIChatForwardedPropsParam {
  return {
    enable_builtin_tools: params.enable_builtin_tools ?? true,
    extra_body: parseExtraBody(params.extra_body),
    extra_headers: params.extra_headers ?? undefined,
    frequency_penalty: params.frequency_penalty,
    generation_type: 'text',
    include_thinking: params.include_thinking ?? true,
    logit_bias: params.logit_bias ?? undefined,
    max_tokens: params.max_tokens,
    mcp_ids: params.mcp_ids ?? undefined,
    model_id: params.model_id,
    parallel_tool_calls: params.parallel_tool_calls,
    presence_penalty: params.presence_penalty,
    provider_id: params.provider_id,
    reasoning_effort:
      params.reasoning_effort === undefined || params.reasoning_effort === null
        ? undefined
        : (params.reasoning_effort as AIChatForwardedPropsParam['reasoning_effort']),
    seed: params.seed,
    stop_sequences: params.stop_sequences ?? undefined,
    temperature: params.temperature,
    timeout: params.timeout,
    top_p: params.top_p,
    web_search: params.web_search,
  };
}

function resolveHistoryMessageContent(item: AIChatMessageDetail): string {
  if (item.content) {
    return item.content;
  }

  if (item.structured_data) {
    return item.structured_data;
  }

  return item.error_message || '';
}

function toAGUIHistoryMessage(item: AIChatMessageDetail): AGUIMessage {
  const content = resolveHistoryMessageContent(item);
  const idSeed = item.message_id ?? `${item.role}-${item.message_index}`;
  const id = String(idSeed);

  if (item.role === 'model') {
    return {
      content: content || null,
      id,
      role: 'assistant',
    };
  }

  if (item.role === 'thinking') {
    return {
      content,
      id,
      role: 'reasoning',
    };
  }

  return {
    content,
    id,
    role: 'user',
  };
}

export function buildChatCompletionRequest(
  input: BuildChatCompletionRequestInput,
): AIChatCompletionRequest {
  const promptText = input.promptText?.trim();
  const historyMessages =
    input.conversationId && promptText
      ? []
      : input.history.map((element) => toAGUIHistoryMessage(element));

  if (promptText) {
    historyMessages.push({
      content: promptText,
      id: `user-draft-${Date.now()}`,
      role: 'user',
    });
  }

  return {
    forwarded_props: toForwardedProps(input.params),
    messages: historyMessages,
    thread_id: input.conversationId ?? undefined,
  };
}

export function normalizeConversationList(
  items: RawAIConversationListItem[],
  hasMore: boolean,
  nextCursor?: null | string,
): AIChatConversationListResult {
  return {
    has_more: hasMore,
    items,
    next_cursor: nextCursor ?? undefined,
  };
}

export function normalizeConversationDetail(
  detail: RawAIConversationDetail,
): AIChatConversationDetail {
  return {
    conversation_id: detail.conversation_id,
    created_time: detail.created_time,
    id: detail.id,
    is_pinned: detail.is_pinned ?? false,
    message_count: detail.messages.length,
    messages: detail.messages.map((message) => ({
      content: message.content,
      conversation_id: message.conversation_id ?? detail.conversation_id,
      message_id: message.message_id ?? null,
      message_index: message.message_index,
      role: message.role,
      timestamp: message.timestamp,
    })),
    model_id: detail.model_id,
    provider_id: detail.provider_id,
    title: detail.title,
    updated_time: detail.updated_time ?? undefined,
  };
}

type AGUIStreamMessageState = {
  conversationId?: null | string;
  role: AIChatMessage['role'];
  timestamp: string;
};

type AGUIThinkingState = {
  conversationId?: null | string;
  timestamp: string;
};

export type AGUIStreamAccumulator = {
  currentThreadId?: null | string;
  messages: Map<string, AGUIStreamMessageState>;
  thinking?: AGUIThinkingState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveTimestamp(
  value?: number | string,
  fallback = new Date().toISOString(),
) {
  if (value === undefined) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toISOString();
}

function mapAGUIRole(role?: unknown): AIChatMessage['role'] {
  if (role === 'user') {
    return 'user';
  }
  return 'model';
}

function resolveThreadId(event: AGUIStreamEvent) {
  return 'threadId' in event && typeof event.threadId === 'string'
    ? event.threadId
    : undefined;
}

function resolveConversationId(
  event: AGUIStreamEvent,
  accumulator?: AGUIStreamAccumulator,
) {
  return resolveThreadId(event) ?? accumulator?.currentThreadId;
}

function resolveMessageId(event: AGUIStreamEvent) {
  return 'messageId' in event && typeof event.messageId === 'string'
    ? event.messageId
    : undefined;
}

function getDeltaFromEvent(event: AGUIStreamEvent) {
  return 'delta' in event && typeof event.delta === 'string' ? event.delta : '';
}

export function createAGUIStreamAccumulator(): AGUIStreamAccumulator {
  return {
    currentThreadId: null,
    messages: new Map(),
    thinking: undefined,
  };
}

function clearAGUIStreamAccumulator(accumulator: AGUIStreamAccumulator) {
  accumulator.messages.clear();
  accumulator.thinking = undefined;
}

export function parseAGUIStreamEventFromSSE(
  data: unknown,
): AGUIStreamEvent | null {
  if (isRecord(data) && typeof data.type === 'string') {
    return data as AGUIStreamEvent;
  }
  return null;
}

export function parseAGUIStreamEventFromChunk(
  chunk: AGUISSEChunk,
): AGUIStreamEvent | null {
  const rawData = chunk.data?.trim();
  if (!rawData) {
    return null;
  }

  try {
    return parseAGUIStreamEventFromSSE(JSON.parse(rawData));
  } catch {
    return null;
  }
}

export function consumeBufferedAGUIChunks(
  buffer: string,
  accumulator: AGUIStreamAccumulator,
  onChunk: (chunk: ConsumedAGUIChunk) => void,
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

    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');

    const event = parseAGUIStreamEventFromChunk({ data });
    if (!event) {
      continue;
    }

    onChunk({
      event,
      message: toAIChatMessageFromAGUIEvent(event, accumulator),
    });
  }

  return rest;
}

export function toAIChatMessageFromAGUIEvent(
  event: AGUIStreamEvent,
  accumulator: AGUIStreamAccumulator,
): AIChatMessage | null {
  switch (event.type) {
    case 'RUN_ERROR': {
      const conversationId = resolveConversationId(event, accumulator) ?? null;
      clearAGUIStreamAccumulator(accumulator);
      return {
        content:
          ('message' in event && typeof event.message === 'string'
            ? event.message
            : '生成失败') || '生成失败',
        conversation_id: conversationId,
        error_message:
          ('message' in event && typeof event.message === 'string'
            ? event.message
            : '生成失败') || '生成失败',
        is_error: true,
        role: 'model',
        timestamp: resolveTimestamp(event.timestamp),
      };
    }
    case 'RUN_FINISHED': {
      accumulator.currentThreadId =
        resolveThreadId(event) ?? accumulator.currentThreadId;
      clearAGUIStreamAccumulator(accumulator);
      return null;
    }
    case 'RUN_STARTED': {
      accumulator.currentThreadId = resolveThreadId(event) ?? null;
      clearAGUIStreamAccumulator(accumulator);
      return null;
    }
    case 'TEXT_MESSAGE_CONTENT': {
      const messageId = resolveMessageId(event);
      if (!messageId) {
        return null;
      }
      const previousState = accumulator.messages.get(messageId);
      const state =
        previousState ??
        ({
          conversationId: resolveConversationId(event, accumulator) ?? null,
          role: 'model',
          timestamp: resolveTimestamp(event.timestamp),
        } satisfies AGUIStreamMessageState);

      if (!previousState) {
        accumulator.messages.set(messageId, state);
      }

      return {
        content: getDeltaFromEvent(event),
        conversation_id: state.conversationId ?? null,
        role: state.role,
        timestamp: resolveTimestamp(event.timestamp, state.timestamp),
      };
    }
    case 'TEXT_MESSAGE_END': {
      const messageId = resolveMessageId(event);
      if (!messageId) {
        return null;
      }
      const state = accumulator.messages.get(messageId);
      accumulator.messages.delete(messageId);
      const finalContent = getDeltaFromEvent(event);

      if (!state || !finalContent) {
        return null;
      }

      return {
        content: finalContent,
        conversation_id: state.conversationId ?? null,
        role: state.role,
        timestamp: resolveTimestamp(event.timestamp, state.timestamp),
      };
    }
    case 'TEXT_MESSAGE_START': {
      const messageId = resolveMessageId(event);
      if (!messageId) {
        return null;
      }
      const role =
        'role' in event && typeof event.role === 'string'
          ? event.role
          : undefined;
      const state: AGUIStreamMessageState = {
        conversationId: resolveConversationId(event, accumulator) ?? null,
        role: mapAGUIRole(role),
        timestamp: resolveTimestamp(event.timestamp),
      };
      accumulator.messages.set(messageId, state);
      return {
        content: '',
        conversation_id: state.conversationId ?? null,
        role: state.role,
        timestamp: state.timestamp,
      };
    }
    case 'THINKING_END': {
      accumulator.thinking = undefined;
      return null;
    }
    case 'THINKING_START': {
      accumulator.thinking = {
        conversationId: resolveConversationId(event, accumulator) ?? null,
        timestamp: resolveTimestamp(event.timestamp),
      };
      return null;
    }
    case 'THINKING_TEXT_MESSAGE_CONTENT': {
      const state =
        accumulator.thinking ??
        ({
          conversationId: resolveConversationId(event, accumulator) ?? null,
          timestamp: resolveTimestamp(event.timestamp),
        } satisfies AGUIThinkingState);

      accumulator.thinking = state;

      return {
        content: getDeltaFromEvent(event),
        conversation_id: state.conversationId ?? null,
        role: 'thinking',
        timestamp: resolveTimestamp(event.timestamp, state.timestamp),
      };
    }
    case 'THINKING_TEXT_MESSAGE_END': {
      return null;
    }
    case 'THINKING_TEXT_MESSAGE_START': {
      accumulator.thinking ??= {
        conversationId: resolveConversationId(event, accumulator) ?? null,
        timestamp: resolveTimestamp(event.timestamp),
      };
      return null;
    }
    default: {
      return null;
    }
  }
}
