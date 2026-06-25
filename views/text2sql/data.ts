import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeGridProps } from '#/adapter/vxe-table';
import type {
  AIText2SqlDatasetResult,
  AIText2SqlExampleResult,
  AIText2SqlTableResult,
} from '../../api';

import { $t } from '@vben/locales';

// ---------------- 数据集 ----------------

export function useDatasetColumns(
  onActionClick?: OnActionClickFn<AIText2SqlDatasetResult>,
): VxeGridProps['columns'] {
  return [
    { field: 'seq', title: $t('common.table.id'), type: 'seq', width: 50 },
    { field: 'name', title: $t('ai.text2sqlPage.dataset.name'), minWidth: 160 },
    { field: 'description', title: $t('ai.text2sqlPage.dataset.description'), align: 'left' },
    {
      field: 'enabled',
      title: $t('ai.text2sqlPage.dataset.status'),
      width: 80,
      formatter({ cellValue }) {
        return cellValue ? $t('common.yes') : $t('common.no');
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
  { component: 'Input', fieldName: 'name', label: $t('ai.text2sqlPage.dataset.nameQuery') },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: $t('ai.text2sqlPage.dataset.enabled'), value: 1 },
        { label: $t('ai.text2sqlPage.dataset.disabledOption'), value: 0 },
      ],
    },
    fieldName: 'enabled',
    label: $t('ai.text2sqlPage.dataset.status'),
  },
];

export const datasetSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'name',
    label: $t('ai.text2sqlPage.dataset.name'),
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { minRows: 2, maxRows: 4 } },
    fieldName: 'description',
    label: $t('ai.text2sqlPage.dataset.description'),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: $t('ai.text2sqlPage.dataset.enabled'), value: 1 },
        { label: $t('ai.text2sqlPage.dataset.disabledOption'), value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'enabled',
    label: $t('ai.text2sqlPage.dataset.status'),
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'sort',
    label: $t('ai.text2sqlPage.dataset.sort'),
  },
];

// ---------------- 已选数据表（数据源） ----------------

export function useSelectedTableColumns(
  onActionClick?: OnActionClickFn<AIText2SqlTableResult>,
): VxeGridProps['columns'] {
  return [
    { field: 'seq', title: $t('common.table.id'), type: 'seq', width: 50 },
    { field: 'table_name', title: $t('ai.text2sqlPage.table.name'), width: 180 },
    { field: 'schema_name', title: $t('ai.text2sqlPage.table.schema'), width: 100 },
    { field: 'table_comment', title: $t('ai.text2sqlPage.table.comment'), align: 'left' },
    { field: 'custom_desc', title: $t('ai.text2sqlPage.table.customDesc'), align: 'left' },
    {
      field: 'enabled',
      title: $t('ai.text2sqlPage.table.status'),
      width: 80,
      formatter({ cellValue }) {
        return cellValue ? $t('common.yes') : $t('common.no');
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
  { component: 'Input', fieldName: 'table_name', label: $t('ai.text2sqlPage.table.name') },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: $t('ai.text2sqlPage.table.enabled'), value: 1 },
        { label: $t('ai.text2sqlPage.table.disabledOption'), value: 0 },
      ],
    },
    fieldName: 'enabled',
    label: $t('ai.text2sqlPage.table.status'),
  },
];

export const selectedTableSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    componentProps: { disabled: true },
    fieldName: 'table_name',
    label: $t('ai.text2sqlPage.table.name'),
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { minRows: 3, maxRows: 6 },
      placeholder: $t('ai.text2sqlPage.table.customDescPlaceholder'),
    },
    fieldName: 'custom_desc',
    help: $t('ai.text2sqlPage.table.customDescHelp'),
    label: $t('ai.text2sqlPage.table.customDesc'),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: $t('ai.text2sqlPage.table.enabled'), value: 1 },
        { label: $t('ai.text2sqlPage.table.disabledOption'), value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'enabled',
    label: $t('ai.text2sqlPage.table.status'),
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'sort',
    label: $t('ai.text2sqlPage.table.sort'),
  },
];

// ---------------- Few-shot 样例 ----------------

export function useExampleColumns(
  onActionClick?: OnActionClickFn<AIText2SqlExampleResult>,
): VxeGridProps['columns'] {
  return [
    { field: 'seq', title: $t('common.table.id'), type: 'seq', width: 50 },
    { field: 'question', title: $t('ai.text2sqlPage.example.question'), align: 'left', minWidth: 200 },
    { field: 'sql', title: $t('ai.text2sqlPage.example.sql'), align: 'left', minWidth: 240 },
    { field: 'related_tables', title: $t('ai.text2sqlPage.example.relatedTables'), width: 160 },
    { field: 'note', title: $t('ai.text2sqlPage.example.note'), align: 'left' },
    {
      field: 'enabled',
      title: $t('ai.text2sqlPage.example.status'),
      width: 80,
      formatter({ cellValue }) {
        return cellValue ? $t('common.yes') : $t('common.no');
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
  { component: 'Input', fieldName: 'question', label: $t('ai.text2sqlPage.example.question') },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      options: [
        { label: $t('ai.text2sqlPage.example.enabled'), value: 1 },
        { label: $t('ai.text2sqlPage.example.disabledOption'), value: 0 },
      ],
    },
    fieldName: 'enabled',
    label: $t('ai.text2sqlPage.example.status'),
  },
];

export const exampleSchema: VbenFormSchema[] = [
  {
    component: 'Textarea',
    componentProps: { autoSize: { minRows: 2, maxRows: 4 } },
    fieldName: 'question',
    label: $t('ai.text2sqlPage.example.naturalLanguageQuestion'),
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { minRows: 3, maxRows: 8 } },
    fieldName: 'sql',
    label: $t('ai.text2sqlPage.example.sql'),
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: { placeholder: $t('ai.text2sqlPage.example.relatedTablesPlaceholder') },
    fieldName: 'related_tables',
    help: $t('ai.text2sqlPage.example.relatedTablesHelp'),
    label: $t('ai.text2sqlPage.example.relatedTables'),
  },
  { component: 'Textarea', fieldName: 'note', label: $t('ai.text2sqlPage.example.note') },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: $t('ai.text2sqlPage.example.enabled'), value: 1 },
        { label: $t('ai.text2sqlPage.example.disabledOption'), value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'enabled',
    label: $t('ai.text2sqlPage.example.status'),
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'sort',
    label: $t('ai.text2sqlPage.example.sort'),
  },
];
