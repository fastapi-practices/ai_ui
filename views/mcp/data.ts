import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';
import type { AIMcpResult } from '#/plugins/ai/api';

import { $t } from '@vben/locales';

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

export function parseArgsInput(value: null | string | undefined) {
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

export function parseEnvInput(value: null | string | undefined, label: string) {
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
