import type { Ref } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';
import type { AIMcpResult, AIModelResult, AIProviderResult } from '#/plugins/ai/api';
import type { PaginationResult } from '#/types';

import { h } from 'vue';

import { $t } from '@vben/locales';

import { getAIProviderListApi } from '#/plugins/ai/api';
import { DictEnum, getDictOptions } from '#/utils/dict';

export const PROVIDER_TYPE_OPTIONS = [
  { label: 'OpenAI', value: 0 },
  { label: 'Anthropic', value: 1 },
  { label: 'Google', value: 2 },
  { label: 'xAI', value: 3 },
  { label: 'OpenRouter', value: 4 },
];

export const PROVIDER_TYPE_TAG_OPTIONS = [
  { color: 'processing', label: 'OpenAI', value: 0 },
  { color: 'purple', label: 'Anthropic', value: 1 },
  { color: 'success', label: 'Google', value: 2 },
  { color: 'warning', label: 'xAI', value: 3 },
  { color: 'geekblue', label: 'OpenRouter', value: 4 },
];

export const SYNCABLE_PROVIDER_TYPES = new Set([0, 3, 4]);

export const MCP_TYPE_OPTIONS = [
  { label: 'stdio', value: 0 },
  { label: 'sse', value: 1 },
  { label: 'streamable_http', value: 2 },
];

export const MCP_TYPE_TAG_OPTIONS = [
  { color: 'default', label: 'stdio', value: 0 },
  { color: 'processing', label: 'sse', value: 1 },
  { color: 'success', label: 'streamable_http', value: 2 },
];

export function useProviderColumns(
  onActionClick?: OnActionClickFn<AIProviderResult>,
): VxeGridProps['columns'] {
  return [
    {
      field: 'seq',
      title: $t('common.table.id'),
      type: 'seq',
      width: 50,
    },
    { field: 'name', title: '供应商名称' },
    {
      field: 'type',
      title: '供应商类型',
      cellRender: {
        name: 'CellTag',
        options: PROVIDER_TYPE_TAG_OPTIONS,
      },
      width: 130,
    },
    {
      field: 'api_host',
      title: 'API Host',
      align: 'left',
    },
    {
      field: 'status',
      title: '状态',
      cellRender: {
        name: 'CellTag',
      },
      width: 100,
    },
    {
      field: 'remark',
      title: $t('common.table.mark'),
      align: 'left',
    },
    {
      field: 'created_time',
      title: $t('common.table.created_time'),
      width: 168,
    },
    {
      field: 'operation',
      title: $t('common.table.operation'),
      align: 'center',
      fixed: 'right',
      width: 250,
      cellRender: {
        attrs: {
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'models',
            text: '查看模型',
            show: (row: AIProviderResult) =>
              SYNCABLE_PROVIDER_TYPES.has(row.type),
          },
          {
            code: 'sync',
            text: '同步模型',
            show: (row: AIProviderResult) =>
              SYNCABLE_PROVIDER_TYPES.has(row.type),
          },
          'edit',
          'delete',
        ],
      },
    },
  ];
}

export const providerSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    label: '供应商名称',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: {
      class: 'w-full',
      options: PROVIDER_TYPE_OPTIONS,
    },
    defaultValue: 0,
    fieldName: 'type',
    label: '供应商类型',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'api_host',
    label: 'API Host',
    rules: 'required',
  },
  {
    component: 'InputPassword',
    fieldName: 'api_key',
    label: 'API Key',
    rules: 'required',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: getDictOptions(DictEnum.SYS_STATUS),
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'status',
    label: '状态',
    rules: 'required',
  },
  {
    component: 'Textarea',
    fieldName: 'remark',
    label: '备注',
  },
];

export async function providerSelectApi() {
  return await getAIProviderListApi();
}

export function useModelColumns(
  providerNameMap: Ref<Map<number, string>>,
  onActionClick?: OnActionClickFn<AIModelResult>,
): VxeGridProps['columns'] {
  return [
    {
      field: 'seq',
      title: $t('common.table.id'),
      type: 'seq',
      width: 50,
    },
    {
      field: 'provider_id',
      title: '供应商',
      slots: {
        default: ({ row }: { row: AIModelResult }) => {
          return h(
            'span',
            providerNameMap.value.get(row.provider_id) ||
              `ID ${row.provider_id}`,
          );
        },
      },
      width: 140,
    },
    { field: 'model_id', title: '模型 ID', align: 'left' },
    {
      field: 'status',
      title: '状态',
      cellRender: {
        name: 'CellTag',
      },
      width: 100,
    },
    {
      field: 'remark',
      title: $t('common.table.mark'),
      align: 'left',
    },
    {
      field: 'created_time',
      title: $t('common.table.created_time'),
      width: 168,
    },
    {
      field: 'operation',
      title: $t('common.table.operation'),
      align: 'center',
      fixed: 'right',
      width: 140,
      cellRender: {
        attrs: {
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
    },
  ];
}

export const modelSchema: VbenFormSchema[] = [
  {
    component: 'ApiSelect',
    componentProps: {
      allowClear: true,
      api: providerSelectApi,
      afterFetch: (data: PaginationResult<AIProviderResult>) => {
        return data.items.map((item) => ({
          label: item.name,
          value: item.id,
        }));
      },
      class: 'w-full',
    },
    fieldName: 'provider_id',
    label: '供应商',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'model_id',
    label: '模型 ID',
    rules: 'required',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: getDictOptions(DictEnum.SYS_STATUS),
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'status',
    label: '状态',
    rules: 'required',
  },
  {
    component: 'Textarea',
    fieldName: 'remark',
    label: '备注',
  },
];

export const queryMcpSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    label: 'MCP 名称',
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: MCP_TYPE_OPTIONS,
    },
    fieldName: 'type',
    label: 'MCP 类型',
  },
];

export function useMcpColumns(
  onActionClick?: OnActionClickFn<AIMcpResult>,
): VxeGridProps['columns'] {
  return [
    {
      field: 'seq',
      title: $t('common.table.id'),
      type: 'seq',
      width: 50,
    },
    { field: 'name', title: 'MCP 名称', width: 160 },
    {
      field: 'type',
      title: 'MCP 类型',
      cellRender: {
        name: 'CellTag',
        options: MCP_TYPE_TAG_OPTIONS,
      },
      width: 140,
    },
    { field: 'description', title: '描述', align: 'left' },
    { field: 'url', title: '端点链接', align: 'left' },
    { field: 'command', title: '命令', align: 'left' },
    { field: 'timeout', title: '初始化超时(s)', width: 120 },
    { field: 'read_timeout', title: '读取超时(s)', width: 120 },
    {
      field: 'operation',
      title: $t('common.table.operation'),
      align: 'center',
      fixed: 'right',
      width: 140,
      cellRender: {
        attrs: {
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
    },
  ];
}

export const mcpSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    label: 'MCP 名称',
    rules: 'required',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: MCP_TYPE_OPTIONS,
      optionType: 'button',
    },
    defaultValue: 0,
    fieldName: 'type',
    label: 'MCP 类型',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'url',
    label: '端点链接',
    dependencies: {
      show: (values) => values?.type !== 0,
      triggerFields: ['type'],
    },
  },
  {
    component: 'Input',
    fieldName: 'command',
    label: '启动命令',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { minRows: 3, maxRows: 8 },
    },
    fieldName: 'headers',
    label: '请求头',
    dependencies: {
      show: (values) => values?.type !== 0,
      triggerFields: ['type'],
    },
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { minRows: 4, maxRows: 10 },
      placeholder: '--config\n--verbose',
    },
    fieldName: 'args',
    help: '每行一个参数',
    label: '命令参数',
    dependencies: {
      show: (values) => values?.type === 0,
      triggerFields: ['type'],
    },
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { minRows: 4, maxRows: 10 },
      placeholder: 'OPENAI_API_KEY=sk-xxx\nOPENAI_BASE_URL=https://example.com',
    },
    fieldName: 'env',
    help: '格式为 KEY=VALUE，每行一个',
    label: '环境变量',
    dependencies: {
      show: (values) => values?.type === 0,
      triggerFields: ['type'],
    },
  },
  {
    component: 'InputNumber',
    componentProps: {
      class: 'w-full',
      min: 0,
      step: 0.5,
    },
    defaultValue: 5,
    fieldName: 'timeout',
    label: '初始化超时(s)',
  },
  {
    component: 'InputNumber',
    componentProps: {
      class: 'w-full',
      min: 0,
      step: 1,
    },
    defaultValue: 300,
    fieldName: 'read_timeout',
    label: '读取超时(s)',
  },
  {
    component: 'Textarea',
    fieldName: 'description',
    label: '描述',
  },
];

export function formatArgsInput(value?: null | string[]) {
  if (!value || value.length === 0) {
    return '';
  }

  return value.join('\n');
}

export function parseArgsInput(
  value: null | string | undefined,
) {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }

  return text
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatEnvInput(value?: null | Record<string, any>) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }

  return Object.entries(value)
    .map(([key, itemValue]) => `${key}=${itemValue ?? ''}`)
    .join('\n');
}

export function parseEnvInput(
  value: null | string | undefined,
  label: string,
) {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }

  const result: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      throw new Error(`${label} 必须是 KEY=VALUE 格式，每行一个`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const envValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      throw new Error(`${label} 的 KEY 不能为空`);
    }

    result[key] = envValue;
  }

  return result;
}
