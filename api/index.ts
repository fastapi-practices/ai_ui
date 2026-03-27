import type { Recordable } from '@vben/types';

import type { PaginationResult } from '#/types';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

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
  output_mode?: 'native' | 'prompted' | 'text' | 'tool';
  output_schema?: null | Recordable<any>;
  output_schema_name?: null | string;
  output_schema_description?: null | string;
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
  onMessage: (chunk: string) => void;
  signal?: AbortSignal;
}

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function joinApiUrl(baseUrl: string, url: string) {
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(url, baseUrl).toString();
  }
  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

async function readErrorMessage(response: Response) {
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
  return requestClient.post('/api/v1/providers', data);
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
  return requestClient.get<AIChatConversationListResult>(
    '/api/v1/chat/conversations',
    {
      params,
    },
  );
}

export async function getAIChatConversationDetailApi(conversationId: string) {
  return requestClient.get<AIChatConversationDetail>(
    `/api/v1/chat/conversations/${conversationId}`,
  );
}

export async function updateAIChatConversationApi(
  conversationId: string,
  data: AIChatConversationUpdateParams,
) {
  return requestClient.put(
    `/api/v1/chat/conversations/${conversationId}`,
    data,
  );
}

export async function deleteAIChatConversationApi(conversationId: string) {
  return requestClient.delete(`/api/v1/chat/conversations/${conversationId}`);
}

export async function pinAIChatConversationApi(
  conversationId: string,
  data: AIChatConversationPinParams,
) {
  return requestClient.put(
    `/api/v1/chat/conversations/${conversationId}/pin`,
    data,
  );
}

export async function clearAIChatConversationMessagesApi(
  conversationId: string,
) {
  return requestClient.delete(
    `/api/v1/chat/conversations/${conversationId}/messages`,
  );
}

export async function deleteAIChatMessageApi(
  conversationId: string,
  messageId: number,
) {
  return requestClient.delete<AIDeleteChatMessageResult>(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}`,
  );
}

export async function updateAIChatMessageApi(
  conversationId: string,
  messageId: number,
  data: AIChatMessageUpdateParams,
) {
  return requestClient.put(
    `/api/v1/chat/conversations/${conversationId}/messages/${messageId}`,
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

export async function streamAIChatApi(
  data: AIChatParams,
  options: AIChatStreamOptions,
) {
  const accessStore = useAccessStore();
  const response = await fetch(joinApiUrl(apiURL, '/api/v1/chat/completions'), {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream, application/json',
      Authorization: accessStore.accessToken
        ? `Bearer ${accessStore.accessToken}`
        : '',
      'Accept-Language': preferences.app.locale,
      'Content-Type': 'application/json;charset=utf-8',
    },
    body: JSON.stringify(data),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('AI stream is unavailable');
  }

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const rest = decoder.decode(new Uint8Array(0), { stream: false });
      if (rest) {
        options.onMessage(rest);
      }
      reader.releaseLock?.();
      break;
    }

    options.onMessage(decoder.decode(value, { stream: true }));
  }
}
