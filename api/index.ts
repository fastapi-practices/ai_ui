import type { Recordable } from '@vben/types';

import type { PaginationResult } from '#/types';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

export interface AIProviderQueryParams {
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
  owned_by: string;
}

export interface AIModelQueryParams {
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
  provider_id: number;
  model_id: string;
  user_prompt: string;
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
  extra_body?: null | Recordable<any>;
}

export interface AIChatMessage {
  role: 'model' | 'user';
  timestamp: string;
  content: string;
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
    return payload?.error ?? payload?.msg ?? payload?.message ?? text;
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

export async function streamAIChatApi(
  data: AIChatParams,
  options: AIChatStreamOptions,
) {
  const accessStore = useAccessStore();
  const response = await fetch(joinApiUrl(apiURL, '/api/v1/chat/completions'), {
    method: 'POST',
    headers: {
      Accept: 'application/x-ndjson',
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
