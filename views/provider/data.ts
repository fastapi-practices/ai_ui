import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';
import type { AIProviderResult } from '#/plugins/ai/api';

import { $t } from '@vben/locales';

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

export const queryProviderSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    label: '供应商名称',
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: PROVIDER_TYPE_OPTIONS,
    },
    fieldName: 'type',
    label: '供应商类型',
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: getDictOptions(DictEnum.SYS_STATUS),
    },
    fieldName: 'status',
    label: '状态',
  },
];
