import type { Recordable } from '@vben/types';

import type { PaginationResult } from '#/types';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

export interface AIChatForwardedPropsParam {
  enable_builtin_tools?: boolean;
  extra_body?: null | Recordable<unknown>;
  extra_headers?: null | Recordable<string>;
  frequency_penalty?: null | number;
  generation_type?: AIChatGenerationType;
  logit_bias?: null | Recordable<number>;
  max_tokens?: null | number;
  mcp_ids?: null | number[];
  model_id: string;
  parallel_tool_calls?: boolean | null;
  presence_penalty?: null | number;
  provider_id: number;
  seed?: null | number;
  stop_sequences?: null | string[];
  temperature?: null | number;
  thinking?: AIChatThinkingType | boolean | null;
  timeout?: null | number;
  top_p?: null | number;
  web_search?: AIWebSearchType;
}

export interface AGUITextInputContent {
  text: string;
  type: 'text';
}

export interface AGUIInputContentDataSource {
  mime_type?: string;
  type: 'data';
  value: string;
}

export interface AGUIInputContentUrlSource {
  mime_type?: null | string;
  type: 'url';
  value: string;
}

export type AGUIInputContentSource =
  | AGUIInputContentDataSource
  | AGUIInputContentUrlSource;

export interface AGUIImageInputContent {
  metadata?: null | Recordable<unknown>;
  source: AGUIInputContentSource;
  type: 'image';
}

export interface AGUIAudioInputContent {
  metadata?: null | Recordable<unknown>;
  source: AGUIInputContentSource;
  type: 'audio';
}

export interface AGUIVideoInputContent {
  metadata?: null | Recordable<unknown>;
  source: AGUIInputContentSource;
  type: 'video';
}

export interface AGUIDocumentInputContent {
  metadata?: null | Recordable<unknown>;
  source: AGUIInputContentSource;
  type: 'document';
}

export interface AGUIBinaryInputContent {
  data?: null | string;
  filename?: null | string;
  id?: null | string;
  identifier?: null | string;
  mime_type?: string;
  provider_name?: null | string;
  type: 'binary';
  url?: null | string;
  vendor_metadata?: null | Recordable<unknown>;
}

export interface AGUIFunctionCall {
  arguments: string;
  name: string;
}

export interface AGUIToolCall {
  encrypted_value?: null | string;
  function: AGUIFunctionCall;
  id: string;
  type?: 'function';
}

export interface AGUIUserMessage {
  conversation_id?: null | string;
  content:
    | Array<
        | AGUIAudioInputContent
        | AGUIBinaryInputContent
        | AGUIDocumentInputContent
        | AGUIImageInputContent
        | AGUITextInputContent
        | AGUIVideoInputContent
      >
    | string;
  created_time?: null | string;
  encrypted_value?: null | string;
  id: string;
  message_index?: null | number;
  message_type?: AIMessageType | null;
  model_id?: null | string;
  name?: null | string;
  persisted_message_id?: null | number;
  provider_id?: null | number;
  role: 'user';
}

export interface AGUIAssistantMessage {
  content?: null | string;
  id: string;
  name?: null | string;
  role: 'assistant';
  tool_calls?: AGUIToolCall[] | null;
}

export interface AGUIReasoningMessage {
  content: string;
  id: string;
  role: 'reasoning';
}

export interface AGUIToolMessage {
  content: string;
  error?: null | string;
  id: string;
  role: 'tool';
  tool_call_id: string;
}

export interface AGUISystemMessage {
  content: string;
  id: string;
  name?: null | string;
  role: 'system';
}

export interface AGUIDeveloperMessage {
  content: string;
  id: string;
  name?: null | string;
  role: 'developer';
}

export interface AGUIActivityMessage {
  activity_type?: string;
  content: Recordable<unknown>;
  id: string;
  role: 'activity';
}

export interface AGUIMessageMetadata {
  content?: unknown;
  conversation_id?: null | string;
  created_time?: null | string;
  encrypted_value?: null | string;
  message_index?: null | number;
  message_type?: AIMessageType | null;
  model_id?: null | string;
  persisted_message_id?: null | number | string;
  provider_id?: null | number;
  raw_event?: unknown;
}

export type AGUIMessage =
  | AGUIActivityMessage
  | AGUIAssistantMessage
  | AGUIDeveloperMessage
  | AGUIReasoningMessage
  | AGUISystemMessage
  | AGUIToolMessage
  | AGUIUserMessage;

export type AGUIConversationMessage = AGUIMessage & AGUIMessageMetadata;

export interface AGUIMessagesSnapshotEvent {
  messages: AGUIConversationMessage[];
  raw_event?: unknown;
  timestamp?: null | number | string;
  type: 'MESSAGES_SNAPSHOT';
}

export interface AIChatCompletionRequest {
  forwarded_props: AIChatForwardedPropsParam;
  message: AGUIUserMessage;
  thread_id?: null | string;
}

export interface RawAIConversationListItem {
  conversation_id: string;
  created_time: string;
  id: number;
  is_pinned: boolean;
  title: string;
  updated_time?: null | string;
}

export type AIChatAttachmentSourceType = 'base64' | 'url';
export type AIChatAttachmentType = 'audio' | 'document' | 'image' | 'video';
export type AIMessageBlockType = 'event' | 'file' | 'reasoning' | 'text';
export type AIMessageType = 'error' | 'normal';
export type AIMessageRoleType = 'assistant' | 'user';

export interface RawAIMessageBlockDetail {
  file_type?: AIChatAttachmentType | null;
  mime_type?: null | string;
  name?: null | string;
  source_type?: AIChatAttachmentSourceType | null;
  text?: null | string;
  type: AIMessageBlockType;
  url?: null | string;
}

export interface RawAIConversationDetail {
  context_cleared_time?: null | string;
  context_start_message_id?: null | number;
  conversation_id: string;
  created_time: string;
  id: number;
  is_pinned?: boolean;
  messages_snapshot: AGUIMessagesSnapshotEvent;
  model_id: string;
  provider_id: number;
  title: string;
  updated_time?: null | string;
}

export interface AIChatRegenerateRequest {
  forwarded_props: AIChatForwardedPropsParam;
  thread_id?: null | string;
}

export type AIChatGenerationType = 'image' | 'text';
export type AIChatThinkingType =
  | 'high'
  | 'low'
  | 'medium'
  | 'minimal'
  | 'xhigh';
export type AIWebSearchType = 'builtin' | 'duckduckgo' | 'exa' | 'tavily';

export type AGUIStreamEventType =
  | 'ACTIVITY_DELTA'
  | 'ACTIVITY_SNAPSHOT'
  | 'MESSAGES_SNAPSHOT'
  | 'REASONING_ENCRYPTED_VALUE'
  | 'REASONING_END'
  | 'REASONING_MESSAGE_CHUNK'
  | 'REASONING_MESSAGE_CONTENT'
  | 'REASONING_MESSAGE_END'
  | 'REASONING_MESSAGE_START'
  | 'REASONING_START'
  | 'RUN_ERROR'
  | 'RUN_FINISHED'
  | 'RUN_STARTED'
  | 'STATE_DELTA'
  | 'STATE_SNAPSHOT'
  | 'STEP_FINISHED'
  | 'STEP_STARTED'
  | 'TEXT_MESSAGE_CHUNK'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TEXT_MESSAGE_START'
  | 'THINKING_END'
  | 'THINKING_START'
  | 'THINKING_TEXT_MESSAGE_CONTENT'
  | 'THINKING_TEXT_MESSAGE_END'
  | 'THINKING_TEXT_MESSAGE_START'
  | 'TOOL_CALL_ARGS'
  | 'TOOL_CALL_END'
  | 'TOOL_CALL_RESULT'
  | 'TOOL_CALL_START';

export interface AGUISSEChunk {
  data?: string;
  event?: string;
  id?: string;
  retry?: string;
}

interface AGUIBaseStreamEvent {
  raw_event?: unknown;
  timestamp?: number | string;
  type: AGUIStreamEventType | (string & {});
}

export interface AGUIRunStartedEvent extends AGUIBaseStreamEvent {
  parent_run_id?: string;
  run_id: string;
  thread_id: string;
  type: 'RUN_STARTED';
}

export interface AGUIRunFinishedEvent extends AGUIBaseStreamEvent {
  run_id: string;
  thread_id: string;
  type: 'RUN_FINISHED';
}

export interface AGUIRunErrorEvent extends AGUIBaseStreamEvent {
  message: string;
  type: 'RUN_ERROR';
}

export interface AGUITextMessageStartEvent extends AGUIBaseStreamEvent {
  message_id: string;
  role?: 'assistant' | 'developer' | 'system' | 'user';
  type: 'TEXT_MESSAGE_START';
}

export interface AGUITextMessageContentEvent extends AGUIBaseStreamEvent {
  delta: string;
  message_id: string;
  type: 'TEXT_MESSAGE_CONTENT';
}

export interface AGUITextMessageChunkEvent extends AGUIBaseStreamEvent {
  delta?: string;
  message_id?: string;
  role?: 'assistant' | 'developer' | 'system' | 'user';
  type: 'TEXT_MESSAGE_CHUNK';
}

export interface AGUITextMessageEndEvent extends AGUIBaseStreamEvent {
  message_id: string;
  type: 'TEXT_MESSAGE_END';
}

export interface AGUIReasoningStartEvent extends AGUIBaseStreamEvent {
  message_id?: string;
  type: 'REASONING_START';
}

export interface AGUIReasoningEndEvent extends AGUIBaseStreamEvent {
  message_id?: string;
  type: 'REASONING_END';
}

export interface AGUIReasoningMessageStartEvent extends AGUIBaseStreamEvent {
  message_id: string;
  role?: 'reasoning';
  type: 'REASONING_MESSAGE_START';
}

export interface AGUIReasoningMessageContentEvent extends AGUIBaseStreamEvent {
  delta: string;
  message_id: string;
  type: 'REASONING_MESSAGE_CONTENT';
}

export interface AGUIReasoningMessageChunkEvent extends AGUIBaseStreamEvent {
  delta?: string;
  message_id?: string;
  type: 'REASONING_MESSAGE_CHUNK';
}

export interface AGUIReasoningMessageEndEvent extends AGUIBaseStreamEvent {
  message_id: string;
  type: 'REASONING_MESSAGE_END';
}

export interface AGUIReasoningEncryptedValueEvent extends AGUIBaseStreamEvent {
  encrypted_value: string;
  entity_id: string;
  subtype: 'message' | 'tool-call';
  type: 'REASONING_ENCRYPTED_VALUE';
}

export interface AGUIThinkingStartEvent extends AGUIBaseStreamEvent {
  message_id?: string;
  title?: string;
  type: 'THINKING_START';
}

export interface AGUIThinkingEndEvent extends AGUIBaseStreamEvent {
  message_id?: string;
  type: 'THINKING_END';
}

export interface AGUIThinkingTextMessageStartEvent extends AGUIBaseStreamEvent {
  message_id?: string;
  type: 'THINKING_TEXT_MESSAGE_START';
}

export interface AGUIThinkingTextMessageContentEvent extends AGUIBaseStreamEvent {
  delta: string;
  message_id?: string;
  type: 'THINKING_TEXT_MESSAGE_CONTENT';
}

export interface AGUIThinkingTextMessageEndEvent extends AGUIBaseStreamEvent {
  message_id?: string;
  type: 'THINKING_TEXT_MESSAGE_END';
}

export interface AGUIToolCallStartEvent extends AGUIBaseStreamEvent {
  parent_message_id?: string;
  tool_call_id: string;
  tool_call_name: string;
  type: 'TOOL_CALL_START';
}

export interface AGUIToolCallArgsEvent extends AGUIBaseStreamEvent {
  delta: string;
  tool_call_id: string;
  type: 'TOOL_CALL_ARGS';
}

export interface AGUIToolCallEndEvent extends AGUIBaseStreamEvent {
  tool_call_id: string;
  type: 'TOOL_CALL_END';
}

export interface AGUIToolCallResultEvent extends AGUIBaseStreamEvent {
  content: string;
  message_id: string;
  role?: 'tool';
  tool_call_id: string;
  type: 'TOOL_CALL_RESULT';
}

export interface AGUIMessagesSnapshotStreamEvent extends AGUIBaseStreamEvent {
  messages: AGUIConversationMessage[];
  type: 'MESSAGES_SNAPSHOT';
}

export interface AGUIActivitySnapshotEvent extends AGUIBaseStreamEvent {
  activity_type: string;
  content: Record<string, unknown>;
  message_id: string;
  replace?: boolean;
  type: 'ACTIVITY_SNAPSHOT';
}

export interface AGUIActivityDeltaEvent extends AGUIBaseStreamEvent {
  activity_type: string;
  message_id: string;
  patch: unknown[];
  type: 'ACTIVITY_DELTA';
}

export interface AGUIStateSnapshotEvent extends AGUIBaseStreamEvent {
  snapshot: unknown;
  type: 'STATE_SNAPSHOT';
}

export interface AGUIStateDeltaEvent extends AGUIBaseStreamEvent {
  delta: unknown[];
  type: 'STATE_DELTA';
}

export interface AGUIStepStartedEvent extends AGUIBaseStreamEvent {
  step_name: string;
  type: 'STEP_STARTED';
}

export interface AGUIStepFinishedEvent extends AGUIBaseStreamEvent {
  step_name: string;
  type: 'STEP_FINISHED';
}

export interface AGUIUnknownStreamEvent extends AGUIBaseStreamEvent {
  [key: string]: unknown;
}

export type AGUIStreamEvent =
  | AGUIActivityDeltaEvent
  | AGUIActivitySnapshotEvent
  | AGUIMessagesSnapshotStreamEvent
  | AGUIReasoningEncryptedValueEvent
  | AGUIReasoningEndEvent
  | AGUIReasoningMessageChunkEvent
  | AGUIReasoningMessageContentEvent
  | AGUIReasoningMessageEndEvent
  | AGUIReasoningMessageStartEvent
  | AGUIReasoningStartEvent
  | AGUIRunErrorEvent
  | AGUIRunFinishedEvent
  | AGUIRunStartedEvent
  | AGUIStateDeltaEvent
  | AGUIStateSnapshotEvent
  | AGUIStepFinishedEvent
  | AGUIStepStartedEvent
  | AGUITextMessageChunkEvent
  | AGUITextMessageContentEvent
  | AGUITextMessageEndEvent
  | AGUITextMessageStartEvent
  | AGUIThinkingEndEvent
  | AGUIThinkingStartEvent
  | AGUIThinkingTextMessageContentEvent
  | AGUIThinkingTextMessageEndEvent
  | AGUIThinkingTextMessageStartEvent
  | AGUIToolCallArgsEvent
  | AGUIToolCallEndEvent
  | AGUIToolCallResultEvent
  | AGUIToolCallStartEvent
  | AGUIUnknownStreamEvent;

export interface AIProviderQueryParams {
  cursor?: null | string;
  name?: null | string;
  status?: null | number;
  type?: null | number;
  size?: number;
}

export interface AIProviderParams {
  name: string;
  type: number;
  api_key: string;
  api_host: string;
  status: number;
  remark?: null | string;
}

export type AIProviderUpdateParams = AIProviderParams

export interface AIProviderResult extends AIProviderParams {
  id: number;
  created_time: string;
  updated_time?: null | string;
}

export interface AIProviderModelResult {
  id: string;
  object: string;
  created: number;
}

export interface AIProviderListResult {
  items: AIProviderResult[];
  has_more: boolean;
  next_cursor?: null | string;
}

export interface AIModelQueryParams {
  provider_id?: null | number;
  model_id?: null | string;
  status?: null | number;
  page?: number;
  size?: number;
}

export interface AIAllModelQueryParams {
  provider_id: number;
}

export interface AIModelParams {
  provider_id: number;
  model_id: string;
  status: number;
  remark?: null | string;
}

export interface AIBatchCreateModelsParams {
  items: AIModelParams[];
}

export interface AIModelResult extends AIModelParams {
  id: number;
  created_time: string;
  updated_time?: null | string;
}

export interface AIMcpQueryParams {
  name?: string;
  page?: number;
  size?: number;
  type?: number;
}

export interface AIMcpParams {
  name: string;
  type: number;
  description?: null | string;
  url?: null | string;
  headers?: null | string;
  command: string;
  args?: null | string[];
  env?: null | Recordable<any>;
  timeout?: null | number;
  read_timeout?: null | number;
}

export interface AIMcpResult extends AIMcpParams {
  id: number;
  created_time: string;
  updated_time?: null | string;
}

export interface AIQuickPhraseQueryParams {
  content?: null | string;
  page?: number;
  size?: number;
}

export interface AIQuickPhraseParams {
  title: string;
  content: string;
  sort?: number;
}

export interface AIQuickPhraseResult extends AIQuickPhraseParams {
  id: number;
  user_id: number;
  created_time: string;
  updated_time?: null | string;
}

export interface AIChatParams {
  mode: 'create' | 'edit' | 'regenerate';
  conversation_id?: null | string;
  edit_message_id?: null | number;
  regenerate_message_id?: null | number;
  generation_type?: AIChatGenerationType;
  provider_id: number;
  model_id: string;
  user_prompt?: null | string;
  max_tokens?: null | number;
  temperature?: null | number;
  top_p?: null | number;
  timeout?: null | number;
  parallel_tool_calls?: boolean | null;
  seed?: null | number;
  presence_penalty?: null | number;
  frequency_penalty?: null | number;
  logit_bias?: null | Recordable<number>;
  stop_sequences?: null | string[];
  extra_headers?: null | Recordable<string>;
  extra_body?: null | string;
  thinking?: AIChatThinkingType | boolean | null;
  enable_builtin_tools?: boolean;
  mcp_ids?: null | number[];
  web_search?: AIWebSearchType;
}

export interface AIChatTextMessageBlock {
  text: string;
  type: 'text';
}

export interface AIChatReasoningMessageBlock {
  text: string;
  type: 'reasoning';
}

export interface AIChatFileMessageBlock {
  file_type?: AIChatAttachmentType | null;
  mime_type?: null | string;
  name?: null | string;
  source_type?: AIChatAttachmentSourceType | null;
  type: 'file';
  url?: null | string;
}

export type AIChatEventBlockStatus =
  | 'error'
  | 'info'
  | 'running'
  | 'success'
  | 'warning';

export interface AIChatEventMessageBlock {
  data?: unknown;
  event_key: string;
  event_type: AGUIStreamEventType | (string & {});
  event_types?: string[];
  status?: AIChatEventBlockStatus;
  summary?: string;
  text?: string;
  title: string;
  type: 'event';
}

export type AIChatMessageBlock =
  | AIChatEventMessageBlock
  | AIChatFileMessageBlock
  | AIChatReasoningMessageBlock
  | AIChatTextMessageBlock;

export interface AIChatMessage {
  blocks: AIChatMessageBlock[];
  conversation_id?: null | string;
  created_time: string;
  message_id?: null | number;
  message_index?: number;
  message_type: AIMessageType;
  model_id?: null | string;
  provider_id?: null | number;
  role: AIMessageRoleType;
}

export interface AIChatConversationQueryParams {
  cursor?: null | string;
  size?: number;
}

export interface AIChatConversationItem {
  id: number;
  conversation_id: string;
  title: string;
  is_pinned: boolean;
  created_time: string;
  updated_time?: null | string;
}

export interface AIChatConversationListResult {
  items: AIChatConversationItem[];
  has_more: boolean;
  next_cursor?: null | string;
}

export interface AIChatMessageDetail extends AIChatMessage {
  message_index: number;
}

export interface AIChatConversationDetail {
  context_cleared_time?: null | string;
  context_start_message_id?: null | number;
  id: number;
  conversation_id: string;
  title: string;
  provider_id: number;
  model_id: string;
  is_pinned: boolean;
  message_count?: number;
  created_time: string;
  updated_time?: null | string;
  messages: AIChatMessageDetail[];
}

export interface AIChatConversationUpdateParams {
  title: string;
}

export interface AIChatConversationPinParams {
  is_pinned: boolean;
}

export interface AIChatClearContextResult {
  context_cleared_time?: null | string;
  context_start_message_id?: null | number;
}

export interface AIDeleteChatMessageResult {
  deleted_conversation: boolean;
  remaining_message_count: number;
}

export interface AIChatMessageUpdateParams {
  content: string;
}

export interface AIChatStreamOptions {
  onChunk: (chunk: AGUISSEChunk) => void;
  signal?: AbortSignal;
}

export type AIChatTransportMode =
  | 'create'
  | 'regenerate-from-message'
  | 'regenerate-from-response';

export interface AIChatTransportRequest {
  body: AIChatCompletionRequest | AIChatRegenerateRequest;
  conversation_id?: string;
  message_id?: number;
  mode: AIChatTransportMode;
}

export interface BuildChatCompletionRequestInput {
  conversation_id?: null | string;
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
    // Keep current page-level validation behavior.
  }

  return undefined;
}

function toForwardedProps(params: AIChatParams): AIChatForwardedPropsParam {
  return {
    enable_builtin_tools: params.enable_builtin_tools ?? true,
    extra_body: parseExtraBody(params.extra_body),
    extra_headers: params.extra_headers ?? undefined,
    frequency_penalty: params.frequency_penalty,
    generation_type: params.generation_type ?? 'text',
    logit_bias: params.logit_bias ?? undefined,
    max_tokens: params.max_tokens,
    mcp_ids: params.mcp_ids ?? undefined,
    model_id: params.model_id,
    parallel_tool_calls: params.parallel_tool_calls,
    presence_penalty: params.presence_penalty,
    provider_id: params.provider_id,
    seed: params.seed,
    stop_sequences: params.stop_sequences ?? undefined,
    temperature: params.temperature,
    thinking: params.thinking,
    timeout: params.timeout,
    top_p: params.top_p,
    web_search: params.web_search,
  };
}

export function buildChatCompletionRequest(
  input: BuildChatCompletionRequestInput,
): AIChatCompletionRequest {
  const promptText = input.promptText?.trim() ?? '';
  const message: AGUIUserMessage = {
    content: promptText,
    conversation_id: input.conversation_id ?? null,
    created_time: new Date().toISOString(),
    id: `user-draft-${Date.now()}`,
    message_type: 'normal',
    model_id: input.params.model_id,
    provider_id: input.params.provider_id,
    role: 'user',
  };

  return {
    forwarded_props: toForwardedProps(input.params),
    message,
    thread_id: input.conversation_id ?? undefined,
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

function getRecordValue(record: unknown, key: string) {
  return isRecord(record) ? record[key] : undefined;
}

function resolveAGUIMessageCreatedTime(
  message: AGUIConversationMessage,
  fallback: string,
) {
  const candidates = [
    message.created_time,
    message.raw_event && getRecordValue(message.raw_event, 'created_time'),
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function resolveAGUIConversationId(
  message: AGUIConversationMessage,
  detail: RawAIConversationDetail,
) {
  const candidates = [
    message.conversation_id,
    message.raw_event && getRecordValue(message.raw_event, 'conversation_id'),
    detail.conversation_id,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return null;
}

function resolveAGUIConversationMessageId(message: AGUIConversationMessage) {
  const candidates = [
    message.persisted_message_id,
    message.raw_event && getRecordValue(message.raw_event, 'persisted_message_id'),
    message.id,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && /^\d+$/u.test(value)) {
      return Number(value);
    }
  }

  return null;
}

function resolveAGUIConversationMessageIndex(
  message: AGUIConversationMessage,
  fallbackIndex: number,
) {
  const candidates = [
    message.message_index,
    message.raw_event && getRecordValue(message.raw_event, 'message_index'),
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && /^\d+$/u.test(value)) {
      return Number(value);
    }
  }

  return fallbackIndex;
}

function normalizeAGUIFileBlock(
  type: AIChatAttachmentType,
  source?: AGUIInputContentSource | null,
  name?: null | string,
  mimeType?: null | string,
): AIChatFileMessageBlock {
  const resolvedMimeType = mimeType ?? source?.mime_type ?? null;
  const sourceType =
    source?.type === 'data' ? 'base64' : (source?.type === 'url' ? 'url' : null);
  const url =
    source?.type === 'url'
      ? source.value
      : (source?.type === 'data'
        ? `data:${resolvedMimeType ?? 'application/octet-stream'};base64,${source.value}`
        : null);

  return {
    file_type: type,
    mime_type: resolvedMimeType,
    name: name ?? null,
    source_type: sourceType,
    type: 'file',
    url,
  };
}

function resolveAGUIInputContentName(
  item:
    | AGUIAudioInputContent
    | AGUIDocumentInputContent
    | AGUIImageInputContent
    | AGUIVideoInputContent,
) {
  const metadata = item.metadata;
  if (!isRecord(metadata)) {
    return null;
  }

  return typeof metadata.filename === 'string' ? metadata.filename : null;
}

function normalizeAGUIUserContentBlocks(
  content: AGUIUserMessage['content'],
): AIChatMessageBlock[] {
  if (typeof content === 'string') {
    return content.trim() ? [{ text: content, type: 'text' }] : [];
  }

  const blocks: AIChatMessageBlock[] = [];

  for (const item of content) {
    switch (item.type) {
      case 'audio': {
        blocks.push(
          normalizeAGUIFileBlock(
            'audio',
            item.source,
            resolveAGUIInputContentName(item),
          ),
        );
        break;
      }
      case 'binary': {
        const url = item.url ?? (item.data
            ? `data:${item.mime_type ?? 'application/octet-stream'};base64,${item.data}`
            : null);

        blocks.push({
          file_type: null,
          mime_type: item.mime_type ?? null,
          name: item.filename ?? null,
          source_type: item.data ? 'base64' : (item.url ? 'url' : null),
          type: 'file',
          url,
        });
        break;
      }
      case 'document': {
        blocks.push(
          normalizeAGUIFileBlock(
            'document',
            item.source,
            resolveAGUIInputContentName(item),
          ),
        );
        break;
      }
      case 'image': {
        blocks.push(
          normalizeAGUIFileBlock(
            'image',
            item.source,
            resolveAGUIInputContentName(item),
          ),
        );
        break;
      }
      case 'text': {
        if (item.text.trim()) {
          blocks.push({
            text: item.text,
            type: 'text',
          });
        }
        break;
      }
      case 'video': {
        blocks.push(
          normalizeAGUIFileBlock(
            'video',
            item.source,
            resolveAGUIInputContentName(item),
          ),
        );
        break;
      }
    }
  }

  return blocks;
}

function normalizeAGUIToolResultBlocks(content: string): AIChatMessageBlock[] {
  const text = content.trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const values = Array.isArray(parsed) ? parsed : [parsed];
    const blocks: AIChatMessageBlock[] = [];

    for (const value of values) {
      if (!isRecord(value)) {
        continue;
      }

      const url =
        typeof value.url === 'string'
          ? value.url
          : (typeof value.value === 'string'
            ? value.value
            : null);

      const mimeType =
        typeof value.mime_type === 'string'
          ? value.mime_type
          : null;

      if (!url && !mimeType) {
        continue;
      }

      let fileType: AIChatAttachmentType | null = null;
      if (typeof value.file_type === 'string') {
        fileType = value.file_type as AIChatAttachmentType;
      } else if (mimeType?.startsWith('audio/')) {
        fileType = 'audio';
      } else if (mimeType?.startsWith('image/')) {
        fileType = 'image';
      } else if (mimeType?.startsWith('video/')) {
        fileType = 'video';
      } else if (mimeType) {
        fileType = 'document';
      }

      blocks.push({
        file_type: fileType,
        mime_type: mimeType,
        name:
          typeof value.name === 'string'
            ? value.name
            : (typeof value.filename === 'string'
              ? value.filename
              : null),
        source_type: url ? 'url' : null,
        type: 'file',
        url,
      });
    }

    return blocks;
  } catch {
    return [];
  }
}

function normalizeAGUIActivityMessageBlocks(
  content: AGUIActivityMessage['content'],
): AIChatMessageBlock[] {
  if (!isRecord(content) || !('file' in content)) {
    return [];
  }

  const file = content.file;
  if (!isRecord(file) || typeof file.type !== 'string') {
    return [];
  }

  switch (file.type) {
    case 'audio':
    case 'document':
    case 'image':
    case 'video': {
      return [
        normalizeAGUIFileBlock(
          file.type,
          'source' in file ? (file.source as AGUIInputContentSource | null) : null,
          isRecord(file.metadata) && typeof file.metadata.filename === 'string'
            ? file.metadata.filename
            : null,
        ),
      ];
    }
    case 'binary': {
      const url =
        typeof file.url === 'string'
          ? file.url
          : (typeof file.data === 'string' && typeof file.mime_type === 'string'
            ? `data:${file.mime_type};base64,${file.data}`
            : null);

      return [
        {
          file_type: null,
          mime_type: typeof file.mime_type === 'string' ? file.mime_type : null,
          name: typeof file.filename === 'string' ? file.filename : null,
          source_type:
            typeof file.data === 'string'
              ? 'base64'
              : (typeof file.url === 'string'
                ? 'url'
                : null),
          type: 'file',
          url,
        },
      ];
    }
    default: {
      return [];
    }
  }
}

function resolveAGUIConversationModelId(
  message: AGUIConversationMessage,
  detail: RawAIConversationDetail,
) {
  const value =
    message.model_id ??
    getRecordValue(message.raw_event, 'model_id');
  return typeof value === 'string' && value.trim() ? value : detail.model_id;
}

function resolveAGUIConversationProviderId(
  message: AGUIConversationMessage,
  detail: RawAIConversationDetail,
) {
  const value =
    message.provider_id ??
    getRecordValue(message.raw_event, 'provider_id');
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : detail.provider_id;
}

function resolveAGUIConversationMessageType(message: AGUIConversationMessage) {
  const value =
    message.message_type ??
    getRecordValue(message.raw_event, 'message_type');
  return value === 'error' ? 'error' : 'normal';
}

function normalizeAGUIConversationMessage(
  message: AGUIConversationMessage,
  detail: RawAIConversationDetail,
  fallbackIndex: number,
): AIChatMessageDetail | null {
  const createdTime = resolveAGUIMessageCreatedTime(message, detail.created_time);
  const conversationId = resolveAGUIConversationId(message, detail);
  const messageId = resolveAGUIConversationMessageId(message);
  const messageIndex = resolveAGUIConversationMessageIndex(message, fallbackIndex);
  const modelId = resolveAGUIConversationModelId(message, detail);
  const providerId = resolveAGUIConversationProviderId(message, detail);
  let blocks: AIChatMessageBlock[] = [];
  let role: AIMessageRoleType = 'assistant';
  let messageType: AIMessageType = resolveAGUIConversationMessageType(message);

  switch (message.role) {
    case 'activity': {
      blocks = normalizeAGUIActivityMessageBlocks(message.content);
      break;
    }
    case 'assistant': {
      if (typeof message.content === 'string' && message.content.trim()) {
        blocks = [{ text: message.content, type: 'text' }];
      }
      break;
    }
    case 'developer':
    case 'system': {
      return null;
    }
    case 'reasoning': {
      role = 'assistant';
      blocks = message.content.trim()
        ? [{ text: message.content, type: 'reasoning' }]
        : [];
      break;
    }
    case 'tool': {
      role = 'assistant';
      blocks = normalizeAGUIToolResultBlocks(message.content);
      if (message.error) {
        messageType = 'error';
        if (blocks.length === 0) {
          blocks = [{ text: message.error, type: 'text' }];
        }
      }
      break;
    }
    case 'user': {
      role = 'user';
      blocks = normalizeAGUIUserContentBlocks(message.content);
      break;
    }
  }

  if (blocks.length === 0) {
    return null;
  }

  return {
    blocks,
    conversation_id: conversationId ?? null,
    created_time: createdTime,
    message_id: messageId,
    message_index: messageIndex,
    message_type: messageType,
    model_id: modelId ?? null,
    provider_id: providerId ?? null,
    role,
  };
}

export function normalizeConversationDetail(
  detail: RawAIConversationDetail,
): AIChatConversationDetail {
  const messages = detail.messages_snapshot.messages
    .map((message, index) =>
      normalizeAGUIConversationMessage(message, detail, index),
    )
    .filter((message): message is AIChatMessageDetail => message !== null);

  return {
    context_cleared_time: detail.context_cleared_time ?? null,
    context_start_message_id: detail.context_start_message_id ?? null,
    conversation_id: detail.conversation_id,
    created_time: detail.created_time,
    id: detail.id,
    is_pinned: detail.is_pinned ?? false,
    message_count: messages.length,
    messages,
    model_id: detail.model_id,
    provider_id: detail.provider_id,
    title: detail.title,
    updated_time: detail.updated_time ?? undefined,
  };
}

type AGUIStreamMessageState = {
  conversationId?: null | string;
  createdTime: string;
  role: AIChatMessage['role'];
};

type AGUIThinkingState = {
  conversationId?: null | string;
  createdTime: string;
  messageId?: string;
};

type AGUIToolCallState = {
  conversationId?: null | string;
  createdTime: string;
  parentMessageId?: string;
  toolCallId: string;
  toolCallName?: string;
};

export type AGUIStreamAccumulator = {
  currentRunId?: null | string;
  currentThreadId?: null | string;
  messages: Map<string, AGUIStreamMessageState>;
  stateSnapshot?: unknown;
  thinking?: AGUIThinkingState;
  toolCalls: Map<string, AGUIToolCallState>;
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
  return role === 'user' ? 'user' : 'assistant';
}

function resolveThreadId(event: AGUIStreamEvent) {
  return 'thread_id' in event && typeof event.thread_id === 'string'
    ? event.thread_id
    : undefined;
}

function resolveConversationId(
  event: AGUIStreamEvent,
  accumulator?: AGUIStreamAccumulator,
) {
  return resolveThreadId(event) ?? accumulator?.currentThreadId;
}

function resolveMessageId(event: AGUIStreamEvent) {
  return 'message_id' in event && typeof event.message_id === 'string'
    ? event.message_id
    : undefined;
}

function getDeltaFromEvent(event: AGUIStreamEvent) {
  return 'delta' in event && typeof event.delta === 'string' ? event.delta : '';
}

function getEventText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function uniqueEventTypes(...values: Array<Array<string | undefined> | string | undefined>) {
  const result: string[] = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && !result.includes(item)) {
          result.push(item);
        }
      }
      continue;
    }

    if (value && !result.includes(value)) {
      result.push(value);
    }
  }

  return result;
}

function normalizeAGUIVisualEventType(
  type: AGUIStreamEventType | (string & {}),
): AGUIStreamEventType | (string & {}) {
  switch (type) {
    case 'THINKING_END': {
      return 'REASONING_END';
    }
    case 'THINKING_START': {
      return 'REASONING_START';
    }
    case 'THINKING_TEXT_MESSAGE_CONTENT': {
      return 'REASONING_MESSAGE_CONTENT';
    }
    case 'THINKING_TEXT_MESSAGE_END': {
      return 'REASONING_MESSAGE_END';
    }
    case 'THINKING_TEXT_MESSAGE_START': {
      return 'REASONING_MESSAGE_START';
    }
    default: {
      return type;
    }
  }
}

function getAGUIVisualEventTypes(
  type: AGUIStreamEventType | (string & {}),
  extras?: string[],
) {
  const normalizedType = normalizeAGUIVisualEventType(type);
  return uniqueEventTypes(normalizedType, type, extras);
}

function createEventBlock(
  params: Omit<AIChatEventMessageBlock, 'event_types' | 'type'>,
): AIChatEventMessageBlock {
  const normalizedType = normalizeAGUIVisualEventType(params.event_type);
  return {
    ...params,
    event_type: normalizedType,
    event_types: getAGUIVisualEventTypes(params.event_type),
    type: 'event',
  };
}

function createOrGetMessageState(
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

function createOrGetThinkingState(
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

function createOrGetToolCallState(
  event: AGUIStreamEvent,
  accumulator: AGUIStreamAccumulator,
  toolCallId?: string,
) {
  const nextToolCallId =
    toolCallId ??
    ('tool_call_id' in event && typeof event.tool_call_id === 'string'
      ? event.tool_call_id
      : undefined);

  if (!nextToolCallId) {
    return undefined;
  }

  const previousState = accumulator.toolCalls.get(nextToolCallId);
  const state =
    previousState ??
    ({
      conversationId: resolveConversationId(event, accumulator) ?? null,
      createdTime: resolveTimestamp(event.timestamp),
      parentMessageId:
        'parent_message_id' in event && typeof event.parent_message_id === 'string'
          ? event.parent_message_id
          : undefined,
      toolCallId: nextToolCallId,
      toolCallName:
        'tool_call_name' in event && typeof event.tool_call_name === 'string'
          ? event.tool_call_name
          : undefined,
    } satisfies AGUIToolCallState);

  accumulator.toolCalls.set(nextToolCallId, {
    ...state,
    conversationId: state.conversationId ?? resolveConversationId(event, accumulator) ?? null,
    parentMessageId:
      state.parentMessageId ??
      ('parent_message_id' in event && typeof event.parent_message_id === 'string'
        ? event.parent_message_id
        : undefined),
    toolCallName:
      state.toolCallName ??
      ('tool_call_name' in event && typeof event.tool_call_name === 'string'
        ? event.tool_call_name
        : undefined),
  });

  return accumulator.toolCalls.get(nextToolCallId);
}

function clearThinkingState(
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

function createStreamMessage(
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
    currentRunId: null,
    currentThreadId: null,
    messages: new Map(),
    stateSnapshot: undefined,
    thinking: undefined,
    toolCalls: new Map(),
  };
}

function clearAGUIStreamAccumulator(accumulator: AGUIStreamAccumulator) {
  accumulator.currentRunId = null;
  accumulator.messages.clear();
  accumulator.stateSnapshot = undefined;
  accumulator.thinking = undefined;
  accumulator.toolCalls.clear();
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
    case 'ACTIVITY_DELTA': {
      const current = event as AGUIActivityDeltaEvent;
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: {
              activity_type: current.activity_type,
              message_id: current.message_id,
              patch: current.patch,
              snapshot: undefined,
            },
            event_key: `activity:${current.message_id}`,
            event_type: current.type,
            status: 'running',
            summary: `${current.activity_type} · ${current.patch.length} 条补丁`,
            title: '活动增量',
          }),
        ],
        resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'ACTIVITY_SNAPSHOT': {
      const current = event as AGUIActivitySnapshotEvent;
      const conversationId = resolveConversationId(event, accumulator) ?? null;
      const content = current.content as Recordable<unknown>;
      const blocks = normalizeAGUIActivityMessageBlocks(
        content,
      );
      const eventBlock = createEventBlock({
        data: content,
        event_key: `activity:${current.message_id}`,
        event_type: current.type,
        status: 'running',
        summary: current.activity_type,
        title: '活动快照',
      });

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [eventBlock, ...blocks],
        conversationId,
      );
    }
    case 'MESSAGES_SNAPSHOT': {
      const current = event as AGUIMessagesSnapshotStreamEvent;
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: current.messages,
            event_key: 'messages-snapshot',
            event_type: current.type,
            status: 'info',
            summary: `同步 ${current.messages.length} 条消息`,
            title: '消息快照',
          }),
        ],
        resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'REASONING_ENCRYPTED_VALUE': {
      const current = event as AGUIReasoningEncryptedValueEvent;
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: {
              entity_id: current.entity_id,
              subtype: current.subtype,
            },
            event_key: `reasoning-encrypted:${current.subtype}:${current.entity_id}`,
            event_type: current.type,
            status: 'warning',
            summary: `${current.subtype} · ${current.entity_id}`,
            text: current.encrypted_value,
            title: '加密推理',
          }),
        ],
        resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'REASONING_END':
    case 'THINKING_END': {
      const messageId = resolveMessageId(event) ?? accumulator.thinking?.messageId;
      const conversationId = accumulator.thinking?.conversationId ?? resolveConversationId(event, accumulator) ?? null;
      clearThinkingState(accumulator, resolveMessageId(event));

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: { message_id: messageId },
            event_key: `reasoning-phase:${messageId ?? 'current'}`,
            event_type: event.type,
            status: 'success',
            summary: messageId,
            title: '推理结束',
          }),
        ],
        conversationId,
      );
    }
    case 'REASONING_MESSAGE_CHUNK':
    case 'REASONING_MESSAGE_CONTENT':
    case 'THINKING_TEXT_MESSAGE_CONTENT': {
      const messageId = resolveMessageId(event);
      if (!messageId && !accumulator.thinking?.messageId) {
        return null;
      }
      const state = createOrGetThinkingState(
        event,
        accumulator,
        messageId ?? accumulator.thinking?.messageId,
      );
      const delta = getDeltaFromEvent(event);

      if (!delta) {
        return null;
      }

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          {
            text: delta,
            type: 'reasoning',
          },
          createEventBlock({
            data: { message_id: messageId ?? state.messageId },
            event_key: `reasoning-message:${messageId ?? state.messageId ?? 'current'}`,
            event_type: event.type,
            status: 'running',
            summary: messageId ?? state.messageId,
            text: delta,
            title: '推理内容',
          }),
        ],
        state.conversationId,
      );
    }
    case 'REASONING_MESSAGE_END':
    case 'THINKING_TEXT_MESSAGE_END': {
      const messageId = resolveMessageId(event) ?? accumulator.thinking?.messageId;
      const conversationId = accumulator.thinking?.conversationId ?? resolveConversationId(event, accumulator) ?? null;
      clearThinkingState(accumulator, resolveMessageId(event));

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: { message_id: messageId },
            event_key: `reasoning-message:${messageId ?? 'current'}`,
            event_type: event.type,
            status: 'success',
            summary: messageId,
            title: '推理消息完成',
          }),
        ],
        conversationId,
      );
    }
    case 'REASONING_MESSAGE_START': {
      const messageId = resolveMessageId(event);
      if (!messageId) {
        return null;
      }
      const state = createOrGetThinkingState(event, accumulator, messageId);
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          createEventBlock({
            data: { message_id: messageId },
            event_key: `reasoning-message:${messageId}`,
            event_type: event.type,
            status: 'running',
            summary: messageId,
            title: '推理消息开始',
          }),
        ],
        state.conversationId,
      );
    }
    case 'REASONING_START':
    case 'THINKING_START': {
      const state = createOrGetThinkingState(
        event,
        accumulator,
        resolveMessageId(event) ?? accumulator.thinking?.messageId,
      );
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          createEventBlock({
            data: { message_id: state.messageId },
            event_key: `reasoning-phase:${state.messageId ?? 'current'}`,
            event_type: event.type,
            status: 'running',
            summary: state.messageId,
            title: '推理开始',
          }),
        ],
        state.conversationId,
      );
    }
    case 'RUN_ERROR': {
      const conversationId = resolveConversationId(event, accumulator) ?? null;
      const runKey = accumulator.currentRunId ?? 'current';
      const errorMessage =
        ('message' in event && typeof event.message === 'string'
          ? event.message
          : '生成失败') || '生成失败';
      clearAGUIStreamAccumulator(accumulator);
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          { text: errorMessage, type: 'text' },
          createEventBlock({
            data: { message: errorMessage },
            event_key: `run:${runKey}`,
            event_type: event.type,
            status: 'error',
            summary: '运行过程中出现错误',
            text: errorMessage,
            title: '运行错误',
          }),
        ],
        conversationId,
        { message_type: 'error' },
      );
    }
    case 'RUN_FINISHED': {
      const current = event as AGUIRunFinishedEvent;
      const conversationId = resolveThreadId(event) ?? accumulator.currentThreadId ?? null;
      const runId = current.run_id ?? accumulator.currentRunId ?? 'current';
      clearAGUIStreamAccumulator(accumulator);
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: {
              run_id: current.run_id,
              thread_id: current.thread_id,
            },
            event_key: `run:${runId}`,
            event_type: current.type,
            status: 'success',
            summary: current.thread_id,
            title: '运行完成',
          }),
        ],
        conversationId,
      );
    }
    case 'RUN_STARTED': {
      const current = event as AGUIRunStartedEvent;
      clearAGUIStreamAccumulator(accumulator);
      accumulator.currentRunId = current.run_id;
      accumulator.currentThreadId = resolveThreadId(event) ?? null;
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: {
              parent_run_id: current.parent_run_id,
              run_id: current.run_id,
              thread_id: current.thread_id,
            },
            event_key: `run:${current.run_id}`,
            event_type: current.type,
            status: 'running',
            summary: current.thread_id,
            title: '运行开始',
          }),
        ],
        accumulator.currentThreadId,
      );
    }
    case 'STATE_DELTA': {
      const current = event as AGUIStateDeltaEvent;
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: {
              delta: current.delta,
              snapshot: accumulator.stateSnapshot,
            },
            event_key: 'state',
            event_type: current.type,
            status: 'info',
            summary: `收到 ${current.delta.length} 条状态补丁`,
            title: '状态增量',
          }),
        ],
        resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'STATE_SNAPSHOT': {
      const current = event as AGUIStateSnapshotEvent;
      accumulator.stateSnapshot = current.snapshot;

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: current.snapshot,
            event_key: 'state',
            event_type: current.type,
            status: 'info',
            summary: '状态快照已同步',
            title: '状态快照',
          }),
        ],
        resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'STEP_FINISHED': {
      const current = event as AGUIStepFinishedEvent;
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: { step_name: current.step_name },
            event_key: `step:${current.step_name}`,
            event_type: current.type,
            status: 'success',
            summary: current.step_name,
            title: '步骤完成',
          }),
        ],
        resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'STEP_STARTED': {
      const current = event as AGUIStepStartedEvent;
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: { step_name: current.step_name },
            event_key: `step:${current.step_name}`,
            event_type: current.type,
            status: 'running',
            summary: current.step_name,
            title: '步骤开始',
          }),
        ],
        resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'TEXT_MESSAGE_CHUNK': {
      const messageId = resolveMessageId(event);
      if (!messageId) {
        return null;
      }
      const role =
        'role' in event && typeof event.role === 'string'
          ? mapAGUIRole(event.role)
          : 'assistant';
      const state = createOrGetMessageState(
        messageId,
        event,
        accumulator,
        role,
      );
      const delta = getDeltaFromEvent(event);

      if (!delta) {
        return null;
      }

      return createStreamMessage(
        state.role,
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          { text: delta, type: 'text' },
          createEventBlock({
            data: { message_id: messageId, role: state.role },
            event_key: `text-message:${messageId}`,
            event_type: event.type,
            status: 'running',
            summary: messageId,
            text: delta,
            title: '文本流',
          }),
        ],
        state.conversationId,
      );
    }
    case 'TEXT_MESSAGE_CONTENT': {
      const messageId = resolveMessageId(event);
      if (!messageId) {
        return null;
      }
      const state = createOrGetMessageState(messageId, event, accumulator);

      return createStreamMessage(
        state.role,
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          { text: getDeltaFromEvent(event), type: 'text' },
          createEventBlock({
            data: { message_id: messageId, role: state.role },
            event_key: `text-message:${messageId}`,
            event_type: event.type,
            status: 'running',
            summary: messageId,
            text: getDeltaFromEvent(event),
            title: '文本内容',
          }),
        ],
        state.conversationId,
      );
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

      return createStreamMessage(
        state.role,
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          { text: finalContent, type: 'text' },
          createEventBlock({
            data: { message_id: messageId, role: state.role },
            event_key: `text-message:${messageId}`,
            event_type: event.type,
            status: 'success',
            summary: messageId,
            title: '文本完成',
          }),
        ],
        state.conversationId,
      );
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
        createdTime: resolveTimestamp(event.timestamp),
        role: mapAGUIRole(role),
      };
      accumulator.messages.set(messageId, state);
      return createStreamMessage(
        state.role,
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          createEventBlock({
            data: { message_id: messageId, role: state.role },
            event_key: `text-message:${messageId}`,
            event_type: event.type,
            status: 'running',
            summary: messageId,
            title: '文本开始',
          }),
        ],
        state.conversationId,
      );
    }
    case 'THINKING_TEXT_MESSAGE_START': {
      const state = createOrGetThinkingState(
        event,
        accumulator,
        resolveMessageId(event) ?? accumulator.thinking?.messageId,
      );
      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          createEventBlock({
            data: { message_id: state.messageId },
            event_key: `reasoning-message:${state.messageId ?? 'current'}`,
            event_type: event.type,
            status: 'running',
            summary: state.messageId,
            title: '推理消息开始',
          }),
        ],
        state.conversationId,
      );
    }
    case 'TOOL_CALL_ARGS': {
      const current = event as AGUIToolCallArgsEvent;
      const state = createOrGetToolCallState(event, accumulator, current.tool_call_id);
      if (!state) {
        return null;
      }

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          createEventBlock({
            data: {
              tool_call_id: current.tool_call_id,
              tool_call_name: state.toolCallName,
            },
            event_key: `tool-call:${current.tool_call_id}`,
            event_type: current.type,
            status: 'running',
            summary: state.toolCallName ?? current.tool_call_id,
            text: current.delta,
            title: '工具调用参数',
          }),
        ],
        state.conversationId,
      );
    }
    case 'TOOL_CALL_END': {
      const current = event as AGUIToolCallEndEvent;
      const state = createOrGetToolCallState(event, accumulator, current.tool_call_id);
      if (!state) {
        return null;
      }

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          createEventBlock({
            data: {
              tool_call_id: current.tool_call_id,
              tool_call_name: state.toolCallName,
            },
            event_key: `tool-call:${current.tool_call_id}`,
            event_type: current.type,
            status: 'success',
            summary: state.toolCallName ?? current.tool_call_id,
            title: '工具调用完成',
          }),
        ],
        state.conversationId,
      );
    }
    case 'TOOL_CALL_RESULT': {
      const current = event as AGUIToolCallResultEvent;
      const state = createOrGetToolCallState(event, accumulator, current.tool_call_id);
      const blocks = normalizeAGUIToolResultBlocks(
        typeof current.content === 'string'
          ? current.content
          : '',
      );

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp),
        [
          createEventBlock({
            data: {
              message_id: current.message_id,
              tool_call_id: current.tool_call_id,
              tool_call_name: state?.toolCallName,
            },
            event_key: `tool-call:${current.tool_call_id}`,
            event_type: current.type,
            status: 'success',
            summary: state?.toolCallName ?? current.tool_call_id,
            text: blocks.length === 0 ? getEventText(current.content) : undefined,
            title: '工具调用结果',
          }),
          ...blocks,
        ],
        state?.conversationId ?? resolveConversationId(event, accumulator) ?? null,
      );
    }
    case 'TOOL_CALL_START': {
      const current = event as AGUIToolCallStartEvent;
      const state = createOrGetToolCallState(event, accumulator, current.tool_call_id);
      if (!state) {
        return null;
      }

      return createStreamMessage(
        'assistant',
        resolveTimestamp(event.timestamp, state.createdTime),
        [
          createEventBlock({
            data: {
              parent_message_id: current.parent_message_id,
              tool_call_id: current.tool_call_id,
              tool_call_name: current.tool_call_name,
            },
            event_key: `tool-call:${current.tool_call_id}`,
            event_type: current.type,
            status: 'running',
            summary: current.tool_call_name,
            title: '工具调用开始',
          }),
        ],
        state.conversationId,
      );
    }
    default: {
      return null;
    }
  }
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function joinApiUrl(baseUrl: string, url: string) {
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(url, baseUrl).toString();
  }
  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

export async function readAIChatErrorMessage(response: Response) {
  const text = await response.text();

  try {
    const payload = JSON.parse(text);
    return (
      payload?.error_message ??
      payload?.error ??
      payload?.msg ??
      payload?.message ??
      text
    );
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

export function resolveAIChatTransportUrl(request: AIChatTransportRequest) {
  switch (request.mode) {
    case 'create': {
      return '/api/v1/chat/completions';
    }
    case 'regenerate-from-message': {
      return `/api/v1/conversations/${request.conversation_id}/messages/${request.message_id}/regenerate`;
    }
    case 'regenerate-from-response': {
      return `/api/v1/conversations/${request.conversation_id}/responses/${request.message_id}/regenerate`;
    }
  }
}

export function resolveAIChatApiUrl(url: string) {
  return joinApiUrl(apiURL, url);
}

export function getAIChatRequestHeaders() {
  const accessStore = useAccessStore();

  return {
    Accept: 'text/event-stream, application/json',
    'Accept-Language': preferences.app.locale,
    Authorization: accessStore.accessToken
      ? `Bearer ${accessStore.accessToken}`
      : '',
    'Content-Type': 'application/json;charset=utf-8',
  };
}

async function postAIChatSSE(
  request: AIChatTransportRequest,
  options: AIChatStreamOptions,
) {
  const response = await fetch(resolveAIChatApiUrl(resolveAIChatTransportUrl(request)), {
    body: JSON.stringify(request.body),
    headers: getAIChatRequestHeaders(),
    method: 'POST',
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readAIChatErrorMessage(response));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('AI stream is unavailable');
  }

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      reader.releaseLock?.();
      break;
    }

    const payload = decoder.decode(value, { stream: true });
    if (payload) {
      options.onChunk({
        data: payload,
      });
    }
  }
}

export async function getAIProviderDetailApi(pk: number) {
  return requestClient.get<AIProviderResult>(`/api/v1/providers/${pk}`);
}

export async function getAIProviderListApi(params?: AIProviderQueryParams) {
  return requestClient.get<AIProviderListResult>('/api/v1/providers', {
    params,
  });
}

export async function getAllAIProviderApi() {
  return requestClient.get<AIProviderResult[]>('/api/v1/providers/all');
}

export async function createAIProviderApi(data: AIProviderParams) {
  return requestClient.post('/api/v1/providers', data);
}

export async function updateAIProviderApi(pk: number, data: AIProviderUpdateParams) {
  return requestClient.put(`/api/v1/providers/${pk}`, data);
}

export async function deleteAIProviderApi(pks: number[]) {
  return requestClient.delete('/api/v1/providers', {
    data: { pks },
  });
}

export async function getAIProviderModelsApi(pk: number) {
  return requestClient.get<AIProviderModelResult[]>(
    `/api/v1/providers/${pk}/models`,
  );
}

export async function syncAIProviderModelsApi(pk: number) {
  return requestClient.post(`/api/v1/providers/${pk}/models/sync`);
}

export async function getAIModelDetailApi(pk: number) {
  return requestClient.get<AIModelResult>(`/api/v1/models/${pk}`);
}

export async function getAIModelListApi(params?: AIModelQueryParams) {
  return requestClient.get<PaginationResult<AIModelResult>>('/api/v1/models', {
    params,
  });
}

export async function getAllAIModelApi(params: AIAllModelQueryParams) {
  return requestClient.get<AIModelResult[]>('/api/v1/models/all', {
    params,
  });
}

export async function createAIModelApi(data: AIModelParams) {
  return requestClient.post('/api/v1/models', data);
}

export async function batchCreateAIModelApi(data: AIBatchCreateModelsParams) {
  return requestClient.post('/api/v1/models/batch', data);
}

export async function updateAIModelApi(pk: number, data: AIModelParams) {
  return requestClient.put(`/api/v1/models/${pk}`, data);
}

export async function deleteAIModelApi(pks: number[]) {
  return requestClient.delete('/api/v1/models', {
    data: { pks },
  });
}

export async function getAIMcpDetailApi(pk: number) {
  return requestClient.get<AIMcpResult>(`/api/v1/mcps/${pk}`);
}

export async function getAIMcpListApi(params: AIMcpQueryParams) {
  return requestClient.get<PaginationResult<AIMcpResult>>('/api/v1/mcps', {
    params,
  });
}

export async function getAllAIMcpApi() {
  return requestClient.get<AIMcpResult[]>('/api/v1/mcps/all');
}

export async function createAIMcpApi(data: AIMcpParams) {
  return requestClient.post('/api/v1/mcps', data);
}

export async function updateAIMcpApi(pk: number, data: AIMcpParams) {
  return requestClient.put(`/api/v1/mcps/${pk}`, data);
}

export async function deleteAIMcpApi(pk: number) {
  return requestClient.delete(`/api/v1/mcps/${pk}`);
}

export async function getRecentAIChatConversationsApi(
  params?: AIChatConversationQueryParams,
) {
  const data = await requestClient.get<{
    has_more: boolean;
    items: RawAIConversationListItem[];
    next_cursor?: null | string;
  }>('/api/v1/conversations', {
    params,
  });

  return normalizeConversationList(data.items, data.has_more, data.next_cursor);
}

export async function getAIChatConversationDetailApi(conversationId: string) {
  const data = await requestClient.get<RawAIConversationDetail>(
    `/api/v1/conversations/${conversationId}`,
  );

  return normalizeConversationDetail(data);
}

export async function updateAIChatConversationApi(
  conversationId: string,
  data: AIChatConversationUpdateParams,
) {
  return requestClient.put(`/api/v1/conversations/${conversationId}`, data);
}

export async function deleteAIChatConversationApi(conversationId: string) {
  return requestClient.delete(`/api/v1/conversations/${conversationId}`);
}

export async function pinAIChatConversationApi(
  conversationId: string,
  data: AIChatConversationPinParams,
) {
  return requestClient.put(`/api/v1/conversations/${conversationId}/pin`, data);
}

export async function clearAIChatConversationMessagesApi(
  conversationId: string,
) {
  return requestClient.delete(
    `/api/v1/conversations/${conversationId}/messages`,
  );
}

export async function clearAIChatConversationContextApi(
  conversationId: string,
) {
  return requestClient.post<AIChatClearContextResult>(
    `/api/v1/conversations/${conversationId}/clear-context`,
  );
}

export async function deleteAIChatMessageApi(
  conversationId: string,
  messageId: number,
) {
  const result = await requestClient.delete<
    AIDeleteChatMessageResult | null | string
  >(`/api/v1/conversations/${conversationId}/messages/${messageId}`);

  if (
    result &&
    typeof result === 'object' &&
    'deleted_conversation' in result &&
    'remaining_message_count' in result
  ) {
    return result as AIDeleteChatMessageResult;
  }

  return {
    deleted_conversation: false,
    remaining_message_count: 0,
  } satisfies AIDeleteChatMessageResult;
}

export async function updateAIChatMessageApi(
  conversationId: string,
  messageId: number,
  data: AIChatMessageUpdateParams,
) {
  return requestClient.put(
    `/api/v1/conversations/${conversationId}/messages/${messageId}`,
    data,
  );
}

export async function streamAIChatTransport(
  request: AIChatTransportRequest,
  options: AIChatStreamOptions,
) {
  return postAIChatSSE(request, options);
}

export async function streamAIChatApi(
  data: AIChatCompletionRequest,
  options: AIChatStreamOptions,
) {
  return streamAIChatTransport(
    {
      body: data,
      mode: 'create',
    },
    options,
  );
}

export async function regenerateAIChatFromMessageApi(
  conversationId: string,
  messageId: number,
  data: AIChatRegenerateRequest,
  options: AIChatStreamOptions,
) {
  return streamAIChatTransport(
    {
      body: data,
      conversation_id: conversationId,
      message_id: messageId,
      mode: 'regenerate-from-message',
    },
    options,
  );
}

export async function regenerateAIChatFromResponseApi(
  conversationId: string,
  messageId: number,
  data: AIChatRegenerateRequest,
  options: AIChatStreamOptions,
) {
  return streamAIChatTransport(
    {
      body: data,
      conversation_id: conversationId,
      message_id: messageId,
      mode: 'regenerate-from-response',
    },
    options,
  );
}

export async function getAllAIQuickPhraseApi() {
  return requestClient.get<AIQuickPhraseResult[]>('/api/v1/quick-phrases/all');
}

export async function getAIQuickPhraseDetailApi(pk: number) {
  return requestClient.get<AIQuickPhraseResult>(`/api/v1/quick-phrases/${pk}`);
}

export async function getAIQuickPhraseListApi(
  params?: AIQuickPhraseQueryParams,
) {
  return requestClient.get<PaginationResult<AIQuickPhraseResult>>(
    '/api/v1/quick-phrases',
    {
      params,
    },
  );
}

export async function createAIQuickPhraseApi(data: AIQuickPhraseParams) {
  return requestClient.post('/api/v1/quick-phrases', data);
}

export async function updateAIQuickPhraseApi(
  pk: number,
  data: AIQuickPhraseParams,
) {
  return requestClient.put(`/api/v1/quick-phrases/${pk}`, data);
}

export async function deleteAIQuickPhraseApi(pk: number) {
  return requestClient.delete(`/api/v1/quick-phrases/${pk}`);
}
