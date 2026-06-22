import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';
import type {
  AIText2SqlDatasetResult,
  AIText2SqlExampleResult,
  AIText2SqlTableResult,
} from '#/plugins/ai/api';

import { $t } from '@vben/locales';

// ---------------- 数据集 ----------------

export function useDatasetColumns(
  onActionClick?: OnActionClickFn<AIText2SqlDatasetResult>,
): VxeGridProps['columns'] {
  return [
    { field: 'seq', title: $t('common.table.id'), type: 'seq', width: 50 },
    { field: 'name', title: '数据集名称', minWidth: 160 },
    { field: 'description', title: '描述', align: 'left' },
    {
      field: 'enabled',
      title: '启用',
      width: 80,
      formatter({ cellValue }) {
        return cellValue ? '是' : '否';
      },
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

export const datasetQuerySchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'name', label: '名称' },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
    fieldName: 'enabled',
    label: '状态',
  },
];

export const datasetSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    label: '数据集名称',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { minRows: 2, maxRows: 4 } },
    fieldName: 'description',
    label: '描述',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'enabled',
    label: '状态',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'sort',
    label: '排序',
  },
];

// ---------------- 已选数据表（数据源） ----------------

export function useSelectedTableColumns(
  onActionClick?: OnActionClickFn<AIText2SqlTableResult>,
): VxeGridProps['columns'] {
  return [
    { field: 'seq', title: $t('common.table.id'), type: 'seq', width: 50 },
    { field: 'table_name', title: '表名', width: 180 },
    { field: 'schema_name', title: '库', width: 100 },
    { field: 'table_comment', title: '表注释', align: 'left' },
    { field: 'custom_desc', title: '自定义描述', align: 'left' },
    {
      field: 'enabled',
      title: '启用',
      width: 80,
      formatter({ cellValue }) {
        return cellValue ? '是' : '否';
      },
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

export const selectedTableQuerySchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'table_name', label: '表名' },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
    fieldName: 'enabled',
    label: '状态',
  },
];

export const selectedTableSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    componentProps: { disabled: true },
    fieldName: 'table_name',
    label: '表名',
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { minRows: 3, maxRows: 6 },
      placeholder: '补充业务语义，提升生成精度',
    },
    fieldName: 'custom_desc',
    help: '补充业务语义，提升生成精度',
    label: '自定义描述',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'enabled',
    label: '状态',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'sort',
    label: '排序',
  },
];

// ---------------- Few-shot 样例 ----------------

export function useExampleColumns(
  onActionClick?: OnActionClickFn<AIText2SqlExampleResult>,
): VxeGridProps['columns'] {
  return [
    { field: 'seq', title: $t('common.table.id'), type: 'seq', width: 50 },
    { field: 'question', title: '问题', align: 'left', minWidth: 200 },
    { field: 'sql', title: '示范 SQL', align: 'left', minWidth: 240 },
    { field: 'related_tables', title: '相关表', width: 160 },
    { field: 'note', title: '备注', align: 'left' },
    {
      field: 'enabled',
      title: '启用',
      width: 80,
      formatter({ cellValue }) {
        return cellValue ? '是' : '否';
      },
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

export const exampleQuerySchema: VbenFormSchema[] = [
  { component: 'Input', fieldName: 'question', label: '问题' },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
    },
    fieldName: 'enabled',
    label: '状态',
  },
];

export const exampleSchema: VbenFormSchema[] = [
  {
    component: 'Textarea',
    componentProps: { autoSize: { minRows: 2, maxRows: 4 } },
    fieldName: 'question',
    label: '自然语言问题',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { minRows: 3, maxRows: 8 } },
    fieldName: 'sql',
    label: '示范 SQL',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: { placeholder: 'users,orders' },
    fieldName: 'related_tables',
    help: '相关表名，逗号分隔，用于召回',
    label: '相关表',
  },
  { component: 'Textarea', fieldName: 'note', label: '备注' },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: '启用', value: 1 },
        { label: '停用', value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'enabled',
    label: '状态',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'sort',
    label: '排序',
  },
];
