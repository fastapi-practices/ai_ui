import type { Ref } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';
import type { AIModelResult, AIProviderResult } from '#/plugins/ai/api';
import type { PaginationResult } from '#/types';

import { h } from 'vue';

import { $t } from '@vben/locales';

import { getAIProviderListApi } from '#/plugins/ai/api';
import { DictEnum, getDictOptions } from '#/utils/dict';

async function providerSelectApi() {
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

export const queryModelSchema: VbenFormSchema[] = [
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
  },
  {
    component: 'Input',
    fieldName: 'model_id',
    label: '模型 ID',
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
