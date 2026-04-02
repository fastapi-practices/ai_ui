import type { Recordable } from '@vben/types';

import type {
  AIChatCompletionRequest,
  AIChatRegenerateRequest,
  AGUISSEChunk,
  RawAIConversationDetail,
  RawAIConversationListItem,
} from './contracts';

import type { PaginationResult } from '#/types';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

import {
  buildChatCompletionRequest,
  normalizeConversationDetail,
  normalizeConversationList,
} from './chat-compat';

export type {
  AGUIActivityMessage,
  AGUIAssistantMessage,
  AGUIBinaryInputContent,
  AGUIDeveloperMessage,
  AGUIFunctionCall,
  AGUIMessage,
  AGUIReasoningMessage,
  AGUISSEChunk,
  AGUISystemMessage,
  AGUITextInputContent,
  AGUIToolCall,
  AGUIToolMessage,
  AGUIUserMessage,
  AIChatCompletionRequest,
  AIChatForwardedPropsParam,
  AIChatRegenerateRequest,
  RawAIConversationDetail,
  RawAIConversationListItem,
} from './contracts';
export { buildChatCompletionRequest };

export interface AIProviderQueryParams {
  name?: null | string;
  status?: null | number;
  type?: null | number;
  page?: number;
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

export interface AIChatParams {
  mode: 'create' | 'edit' | 'regenerate';
  conversation_id?: null | string;
  edit_message_id?: null | number;
  regenerate_message_id?: null | number;
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
  include_thinking?: boolean;
  reasoning_effort?: null | string;
  enable_builtin_tools?: boolean;
  mcp_ids?: null | number[];
  web_search?: 'builtin' | 'duckduckgo' | 'tavily';
}

export interface AIChatMessage {
  message_id?: null | number;
  conversation_id?: null | string;
  message_index?: number;
  role: 'model' | 'thinking' | 'user';
  timestamp: string;
  content: string;
  is_error?: boolean;
  error_message?: null | string;
  structured_data?: null | string;
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

export interface AIDeleteChatMessageResult {
  deleted_conversation: boolean;
  remaining_message_count: number;
}

export interface AIChatMessageUpdateParams {
  content: string;
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
  conversationId?: string;
  messageId?: number;
  mode: AIChatTransportMode;
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
      return `/api/v1/conversations/${request.conversationId}/messages/${request.messageId}/regenerate`;
    }
    case 'regenerate-from-response': {
      return `/api/v1/conversations/${request.conversationId}/responses/${request.messageId}/regenerate`;
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

export async function getAIProviderDetailApi(pk: number) {
  return requestClient.get<AIProviderResult>(`/api/v1/providers/${pk}`);
}

export async function getAIProviderListApi(params?: AIProviderQueryParams) {
  return requestClient.get<PaginationResult<AIProviderResult>>(
    '/api/v1/providers',
    {
      params,
    },
  );
}

export async function getAllAIProviderApi() {
  return requestClient.get<AIProviderResult[]>('/api/v1/providers/all');
}

export async function createAIProviderApi(data: AIProviderParams) {
  return requestClient.post<AIProviderResult>('/api/v1/providers', data);
}

export async function updateAIProviderApi(pk: number, data: AIProviderParams) {
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
  return requestClient.get(`/api/v1/providers/${pk}/models/sync`);
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
      conversationId,
      messageId,
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
      conversationId,
      messageId,
      mode: 'regenerate-from-response',
    },
    options,
  );
}
