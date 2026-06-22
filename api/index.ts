import type { Recordable } from '@vben/types';

import type { AIActionResult } from './chat';

import type { PaginationResult } from '#/types';

import { requestClient } from '#/api/request';

interface AIProviderQueryParams {
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

export type AIProviderUpdateParams = AIProviderParams;

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
  name?: null | string;
  page?: number;
  size?: number;
  type?: null | number;
}

export interface AIMcpParams {
  name: string;
  type?: number;
  description?: null | string;
  url?: null | string;
  headers?: null | Recordable<unknown>;
  command: string;
  args?: null | string[];
  env?: null | Recordable<unknown>;
  timeout?: null | number;
  read_timeout?: null | number;
  tool_prefix?: null | string;
  include_instructions?: boolean;
}

export interface AIMcpResult extends AIMcpParams {
  id: number;
  created_time: string;
  updated_time?: null | string;
}

interface AIQuickPhraseQueryParams {
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
  return requestClient.post<AIActionResult>('/api/v1/providers', data);
}

export async function updateAIProviderApi(
  pk: number,
  data: AIProviderUpdateParams,
) {
  return requestClient.put<AIActionResult>(`/api/v1/providers/${pk}`, data);
}

export async function deleteAIProviderApi(pks: number[]) {
  return requestClient.delete<AIActionResult>('/api/v1/providers', {
    data: { pks },
  });
}

export async function getAIProviderModelsApi(pk: number) {
  return requestClient.get<AIProviderModelResult[]>(
    `/api/v1/providers/${pk}/models`,
  );
}

export async function syncAIProviderModelsApi(pk: number) {
  return requestClient.post<AIActionResult>(
    `/api/v1/providers/${pk}/models/sync`,
  );
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
  return requestClient.post<AIActionResult>('/api/v1/models', data);
}

export async function batchCreateAIModelApi(data: AIBatchCreateModelsParams) {
  return requestClient.post<AIActionResult>('/api/v1/models/batch', data);
}

export async function updateAIModelApi(pk: number, data: AIModelParams) {
  return requestClient.put<AIActionResult>(`/api/v1/models/${pk}`, data);
}

export async function deleteAIModelApi(pks: number[]) {
  return requestClient.delete<AIActionResult>('/api/v1/models', {
    data: { pks },
  });
}

export async function getAIMcpDetailApi(pk: number) {
  return requestClient.get<AIMcpResult>(`/api/v1/mcps/${pk}`);
}

export async function getAIMcpListApi(params?: AIMcpQueryParams) {
  return requestClient.get<PaginationResult<AIMcpResult>>('/api/v1/mcps', {
    params,
  });
}

export async function getAllAIMcpApi() {
  return requestClient.get<AIMcpResult[]>('/api/v1/mcps/all');
}

export async function createAIMcpApi(data: AIMcpParams) {
  return requestClient.post<AIActionResult>('/api/v1/mcps', data);
}

export async function updateAIMcpApi(pk: number, data: AIMcpParams) {
  return requestClient.put<AIActionResult>(`/api/v1/mcps/${pk}`, data);
}

export async function deleteAIMcpApi(pk: number) {
  return requestClient.delete<AIActionResult>(`/api/v1/mcps/${pk}`);
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
  return requestClient.post<AIActionResult>('/api/v1/quick-phrases', data);
}

export async function updateAIQuickPhraseApi(
  pk: number,
  data: AIQuickPhraseParams,
) {
  return requestClient.put<AIActionResult>(`/api/v1/quick-phrases/${pk}`, data);
}

export async function deleteAIQuickPhraseApi(pk: number) {
  return requestClient.delete<AIActionResult>(`/api/v1/quick-phrases/${pk}`);
}

// ---------------- Text2SQL ----------------

// 数据集
export interface AIText2SqlDatasetParams {
  description?: null | string;
  enabled?: number;
  name: string;
  sort?: number;
}

export type AIText2SqlDatasetUpdateParams = Partial<AIText2SqlDatasetParams>;

export interface AIText2SqlDatasetResult extends AIText2SqlDatasetParams {
  created_time: string;
  id: number;
  updated_time?: null | string;
}

export interface Text2SqlDatasetEnabled {
  description?: null | string;
  id: number;
  name: string;
}

export interface Text2SqlTableSelectable {
  table_comment?: null | string;
  table_name: string;
  selected: boolean;
}

export interface AIText2SqlTableParams {
  dataset_id: number;
  custom_desc?: null | string;
  enabled?: number;
  schema_name?: string;
  sort?: number;
  table_comment?: null | string;
  table_name: string;
}

export type AIText2SqlTableUpdateParams = Partial<AIText2SqlTableParams>;

export interface AIText2SqlTableResult extends AIText2SqlTableParams {
  created_time: string;
  id: number;
  updated_time?: null | string;
}

export interface AIText2SqlExampleParams {
  dataset_id: number;
  enabled?: number;
  note?: null | string;
  question: string;
  related_tables?: null | string;
  sql: string;
  sort?: number;
}

export type AIText2SqlExampleUpdateParams = Partial<AIText2SqlExampleParams>;

export interface AIText2SqlExampleResult extends AIText2SqlExampleParams {
  created_time: string;
  id: number;
  updated_time?: null | string;
}

export interface Text2SqlQueryParams {
  question: string;
}

export interface Text2SqlQueryResult {
  columns: string[];
  duration_ms: number;
  history_id?: null | number;
  row_count: number;
  rows: Recordable<unknown>[];
  sql: string;
  summary: string;
}

// 数据集
export async function getEnabledDatasetsApi() {
  return requestClient.get<Text2SqlDatasetEnabled[]>(
    '/api/v1/text2sql/datasets/enabled',
  );
}

export async function getDatasetListApi(params?: Recordable<unknown>) {
  return requestClient.get<PaginationResult<AIText2SqlDatasetResult>>(
    '/api/v1/text2sql/datasets',
    { params },
  );
}

export async function getAllDatasetsApi() {
  return requestClient.get<AIText2SqlDatasetResult[]>(
    '/api/v1/text2sql/datasets/all',
  );
}

export async function getDatasetApi(pk: number) {
  return requestClient.get<AIText2SqlDatasetResult>(
    `/api/v1/text2sql/datasets/${pk}`,
  );
}

export async function createDatasetApi(data: AIText2SqlDatasetParams) {
  return requestClient.post<AIActionResult>('/api/v1/text2sql/datasets', data);
}

export async function updateDatasetApi(
  pk: number,
  data: AIText2SqlDatasetUpdateParams,
) {
  return requestClient.put<AIActionResult>(
    `/api/v1/text2sql/datasets/${pk}`,
    data,
  );
}

export async function deleteDatasetApi(pk: number) {
  return requestClient.delete<AIActionResult>(`/api/v1/text2sql/datasets/${pk}`);
}

export async function getSelectableTablesApi(
  datasetId: number,
  tableSchema?: string,
) {
  return requestClient.get<Text2SqlTableSelectable[]>(
    '/api/v1/text2sql/tables',
    { params: { dataset_id: datasetId, table_schema: tableSchema } },
  );
}

export async function getTableColumnsApi(
  tableName: string,
  tableSchema?: string,
) {
  return requestClient.get<Recordable<unknown>[]>(
    `/api/v1/text2sql/tables/${tableName}/columns`,
    { params: { table_schema: tableSchema } },
  );
}

export async function getSelectedTableListApi(params?: Recordable<unknown>) {
  return requestClient.get<PaginationResult<AIText2SqlTableResult>>(
    '/api/v1/text2sql/selected-tables',
    { params },
  );
}

export async function getAllSelectedTablesApi() {
  return requestClient.get<AIText2SqlTableResult[]>(
    '/api/v1/text2sql/selected-tables/all',
  );
}

export async function getSelectedTableApi(pk: number) {
  return requestClient.get<AIText2SqlTableResult>(
    `/api/v1/text2sql/selected-tables/${pk}`,
  );
}

export async function createSelectedTableApi(data: AIText2SqlTableParams) {
  return requestClient.post<AIActionResult>(
    '/api/v1/text2sql/selected-tables',
    data,
  );
}

export async function updateSelectedTableApi(
  pk: number,
  data: AIText2SqlTableUpdateParams,
) {
  return requestClient.put<AIActionResult>(
    `/api/v1/text2sql/selected-tables/${pk}`,
    data,
  );
}

export async function deleteSelectedTableApi(pk: number) {
  return requestClient.delete<AIActionResult>(
    `/api/v1/text2sql/selected-tables/${pk}`,
  );
}

export async function getExampleListApi(params?: Recordable<unknown>) {
  return requestClient.get<PaginationResult<AIText2SqlExampleResult>>(
    '/api/v1/text2sql/examples',
    { params },
  );
}

export async function getAllExamplesApi() {
  return requestClient.get<AIText2SqlExampleResult[]>(
    '/api/v1/text2sql/examples/all',
  );
}

export async function createExampleApi(data: AIText2SqlExampleParams) {
  return requestClient.post<AIActionResult>('/api/v1/text2sql/examples', data);
}

export async function updateExampleApi(
  pk: number,
  data: AIText2SqlExampleUpdateParams,
) {
  return requestClient.put<AIActionResult>(
    `/api/v1/text2sql/examples/${pk}`,
    data,
  );
}

export async function deleteExampleApi(pk: number) {
  return requestClient.delete<AIActionResult>(`/api/v1/text2sql/examples/${pk}`);
}

export async function queryText2SqlApi(data: Text2SqlQueryParams) {
  return requestClient.post<Text2SqlQueryResult>(
    '/api/v1/text2sql/queries',
    data,
  );
}

export * from './chat';
