import type { AGUIStreamEvent } from './schema';

import type {
  AIChatMessage,
  AIChatMessageBlock,
} from '#/plugins/ai/runtime/message-types';

import { getRecordValue, resolveTimestamp } from './utils';

export type AGUIStreamMessageState = {
  conversationId?: null | string;
  createdTime: string;
  role: AIChatMessage['role'];
};

export type AGUIThinkingState = {
  conversationId?: null | string;
  createdTime: string;
  messageId?: string;
};

export type AGUIToolCallState = {
  conversationId?: null | string;
  createdTime: string;
  parentMessageId?: string;
  toolCallId: string;
  toolCallName?: string;
};

export type AGUIStreamAccumulator = {
  buffer: string;
  currentRunId?: null | string;
  currentThreadId?: null | string;
  messages: Map<string, AGUIStreamMessageState>;
  stateSnapshot?: unknown;
  thinking?: AGUIThinkingState;
  toolCalls: Map<string, AGUIToolCallState>;
};

export function mapAGUIRole(role?: unknown): AIChatMessage['role'] {
  return role === 'user' ? 'user' : 'assistant';
}

export function resolveThreadId(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'threadId');
  return typeof value === 'string' ? value : undefined;
}

export function resolveRunId(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'runId');
  return typeof value === 'string' ? value : undefined;
}

export function resolveConversationId(
  event: AGUIStreamEvent,
  accumulator?: AGUIStreamAccumulator,
) {
  return resolveThreadId(event) ?? accumulator?.currentThreadId;
}

export function resolveMessageId(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'messageId');
  return typeof value === 'string' ? value : undefined;
}

export function resolveToolCallId(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'toolCallId');
  return typeof value === 'string' ? value : undefined;
}

export function resolveToolCallName(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'toolCallName');
  return typeof value === 'string' ? value : undefined;
}

export function resolveParentMessageId(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'parentMessageId');
  return typeof value === 'string' ? value : undefined;
}

export function resolveActivityType(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'activityType');
  return typeof value === 'string' ? value : undefined;
}

export function resolveStepName(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'stepName');
  return typeof value === 'string' ? value : undefined;
}

export function resolveReasoningEntityId(event: AGUIStreamEvent) {
  const value = getRecordValue(event, 'entityId');
  return typeof value === 'string' ? value : undefined;
}

export function getDeltaFromEvent(event: AGUIStreamEvent) {
  return typeof event.delta === 'string' ? event.delta : '';
}

export function createOrGetMessageState(
  messageId: string,
  event: AGUIStreamEvent,
  accumulator: AGUIStreamAccumulator,
  role?: AIChatMessage['role'],
) {
  const previousState = accumulator.messages.get(messageId);
  const state =
    previousState ??
    ({
      conversationId: resolveConversationId(event, accumulator) ?? null,
      createdTime: resolveTimestamp(event.timestamp),
      role: role ?? 'assistant',
    } satisfies AGUIStreamMessageState);

  if (!previousState) {
    accumulator.messages.set(messageId, state);
  }

  return state;
}

export function createOrGetThinkingState(
  event: AGUIStreamEvent,
  accumulator: AGUIStreamAccumulator,
  messageId?: string,
) {
  const nextMessageId = messageId ?? resolveMessageId(event);
  const state =
    accumulator.thinking &&
    (!nextMessageId || accumulator.thinking.messageId === nextMessageId)
      ? accumulator.thinking
      : ({
          conversationId: resolveConversationId(event, accumulator) ?? null,
          createdTime: resolveTimestamp(event.timestamp),
          messageId: nextMessageId,
        } satisfies AGUIThinkingState);

  accumulator.thinking = state;

  return state;
}

export function createOrGetToolCallState(
  event: AGUIStreamEvent,
  accumulator: AGUIStreamAccumulator,
  toolCallId?: string,
) {
  const nextToolCallId = toolCallId ?? resolveToolCallId(event);

  if (!nextToolCallId) {
    return undefined;
  }

  const previousState = accumulator.toolCalls.get(nextToolCallId);
  const state =
    previousState ??
    ({
      conversationId: resolveConversationId(event, accumulator) ?? null,
      createdTime: resolveTimestamp(event.timestamp),
      parentMessageId: resolveParentMessageId(event),
      toolCallId: nextToolCallId,
      toolCallName: resolveToolCallName(event),
    } satisfies AGUIToolCallState);

  accumulator.toolCalls.set(nextToolCallId, {
    ...state,
    conversationId: state.conversationId ?? resolveConversationId(event, accumulator) ?? null,
    parentMessageId: state.parentMessageId ?? resolveParentMessageId(event),
    toolCallName: state.toolCallName ?? resolveToolCallName(event),
  });

  return accumulator.toolCalls.get(nextToolCallId);
}

export function clearThinkingState(
  accumulator: AGUIStreamAccumulator,
  messageId?: string,
) {
  if (
    messageId &&
    accumulator.thinking?.messageId &&
    accumulator.thinking.messageId !== messageId
  ) {
    return;
  }

  accumulator.thinking = undefined;
}

export function createStreamMessage(
  role: AIChatMessage['role'],
  createdTime: string,
  blocks: AIChatMessageBlock[],
  conversationId?: null | string,
  overrides?: Partial<AIChatMessage>,
): AIChatMessage {
  return {
    blocks,
    conversation_id: conversationId ?? null,
    created_time: createdTime,
    message_type: 'normal',
    model_id: null,
    provider_id: null,
    role,
    ...overrides,
  };
}

export function createAGUIStreamAccumulator(): AGUIStreamAccumulator {
  return {
    buffer: '',
    currentRunId: null,
    currentThreadId: null,
    messages: new Map(),
    stateSnapshot: undefined,
    thinking: undefined,
    toolCalls: new Map(),
  };
}

export function clearAGUIStreamAccumulator(accumulator: AGUIStreamAccumulator) {
  accumulator.buffer = '';
  accumulator.currentRunId = null;
  accumulator.messages.clear();
  accumulator.stateSnapshot = undefined;
  accumulator.thinking = undefined;
  accumulator.toolCalls.clear();
}
