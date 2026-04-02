import type { Recordable } from '@vben/types';

export interface AIChatForwardedPropsParam {
  enable_builtin_tools?: boolean;
  extra_body?: null | Recordable<unknown>;
  extra_headers?: null | Recordable<string>;
  frequency_penalty?: null | number;
  generation_type?: 'image' | 'text';
  include_thinking?: boolean;
  logit_bias?: null | Recordable<number>;
  max_tokens?: null | number;
  mcp_ids?: null | number[];
  model_id: string;
  parallel_tool_calls?: boolean | null;
  presence_penalty?: null | number;
  provider_id: number;
  reasoning_effort?:
    | 'high'
    | 'low'
    | 'medium'
    | 'minimal'
    | 'none'
    | 'xhigh'
    | null;
  seed?: null | number;
  stop_sequences?: null | string[];
  temperature?: null | number;
  timeout?: null | number;
  top_p?: null | number;
  web_search?: 'builtin' | 'duckduckgo' | 'tavily';
}

export interface AGUITextInputContent {
  text: string;
  type: 'text';
}

export interface AGUIBinaryInputContent {
  data?: null | string;
  filename?: null | string;
  id?: null | string;
  mimeType: string;
  type: 'binary';
  url?: null | string;
}

export interface AGUIFunctionCall {
  arguments: string;
  name: string;
}

export interface AGUIToolCall {
  function: AGUIFunctionCall;
  id: string;
  type?: 'function';
}

export interface AGUIUserMessage {
  content: Array<AGUIBinaryInputContent | AGUITextInputContent> | string;
  id: string;
  name?: null | string;
  role: 'user';
}

export interface AGUIAssistantMessage {
  content?: null | string;
  id: string;
  name?: null | string;
  role: 'assistant';
  toolCalls?: AGUIToolCall[] | null;
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
  toolCallId: string;
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
  activityType: string;
  content: Recordable<unknown>;
  id: string;
  role: 'activity';
}

export type AGUIMessage =
  | AGUIActivityMessage
  | AGUIAssistantMessage
  | AGUIDeveloperMessage
  | AGUIReasoningMessage
  | AGUISystemMessage
  | AGUIToolMessage
  | AGUIUserMessage;

export interface AIChatCompletionRequest {
  forwarded_props: AIChatForwardedPropsParam;
  messages: AGUIMessage[];
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

export interface RawAIMessageAttachmentDetail {
  mime_type: string;
  name?: null | string;
  source_type: 'base64' | 'url';
  type: 'audio' | 'document' | 'image' | 'video';
  url: string;
}

export interface RawAIConversationDetailMessage {
  attachments?: RawAIMessageAttachmentDetail[];
  content: string;
  conversation_id?: null | string;
  message_id?: null | number;
  message_index: number;
  role: 'model' | 'thinking' | 'user';
  timestamp: string;
}

export interface RawAIConversationDetail {
  context_cleared_time?: null | string;
  context_start_message_id?: null | number;
  conversation_id: string;
  created_time: string;
  id: number;
  is_pinned?: boolean;
  messages: RawAIConversationDetailMessage[];
  model_id: string;
  provider_id: number;
  title: string;
  updated_time?: null | string;
}

export interface AIChatRegenerateRequest {
  forwarded_props: AIChatForwardedPropsParam;
  thread_id?: null | string;
}

export type AGUIStreamEventType =
  | 'RUN_ERROR'
  | 'RUN_FINISHED'
  | 'RUN_STARTED'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TEXT_MESSAGE_START'
  | 'THINKING_END'
  | 'THINKING_START'
  | 'THINKING_TEXT_MESSAGE_CONTENT'
  | 'THINKING_TEXT_MESSAGE_END'
  | 'THINKING_TEXT_MESSAGE_START';

export interface AGUISSEChunk {
  data?: string;
  event?: string;
  id?: string;
  retry?: string;
}

interface AGUIBaseStreamEvent {
  rawEvent?: unknown;
  timestamp?: number | string;
  type: AGUIStreamEventType | (string & {});
}

export interface AGUIRunStartedEvent extends AGUIBaseStreamEvent {
  runId: string;
  threadId: string;
  type: 'RUN_STARTED';
}

export interface AGUIRunFinishedEvent extends AGUIBaseStreamEvent {
  runId: string;
  threadId: string;
  type: 'RUN_FINISHED';
}

export interface AGUIRunErrorEvent extends AGUIBaseStreamEvent {
  message: string;
  type: 'RUN_ERROR';
}

export interface AGUITextMessageStartEvent extends AGUIBaseStreamEvent {
  messageId: string;
  role?: 'assistant' | 'developer' | 'system' | 'user';
  type: 'TEXT_MESSAGE_START';
}

export interface AGUITextMessageContentEvent extends AGUIBaseStreamEvent {
  delta: string;
  messageId: string;
  type: 'TEXT_MESSAGE_CONTENT';
}

export interface AGUITextMessageEndEvent extends AGUIBaseStreamEvent {
  messageId: string;
  type: 'TEXT_MESSAGE_END';
}

export interface AGUIThinkingStartEvent extends AGUIBaseStreamEvent {
  title?: string;
  type: 'THINKING_START';
}

export interface AGUIThinkingEndEvent extends AGUIBaseStreamEvent {
  type: 'THINKING_END';
}

export interface AGUIThinkingTextMessageContentEvent extends AGUIBaseStreamEvent {
  delta: string;
  type: 'THINKING_TEXT_MESSAGE_CONTENT';
}

export interface AGUIUnknownStreamEvent extends AGUIBaseStreamEvent {
  [key: string]: unknown;
}

export type AGUIStreamEvent =
  | AGUIRunErrorEvent
  | AGUIRunFinishedEvent
  | AGUIRunStartedEvent
  | AGUITextMessageContentEvent
  | AGUITextMessageEndEvent
  | AGUITextMessageStartEvent
  | AGUIThinkingEndEvent
  | AGUIThinkingStartEvent
  | AGUIThinkingTextMessageContentEvent
  | AGUIUnknownStreamEvent;
