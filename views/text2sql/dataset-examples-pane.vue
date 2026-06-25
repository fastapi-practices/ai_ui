<script setup lang="ts">
import type { VbenFormProps } from '@vben/common-ui';
import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AIText2SqlExampleParams,
  AIText2SqlExampleResult,
} from '../../api';

import { computed, ref, watch } from 'vue';

import { VbenButton, useVbenModal } from '@vben/common-ui';
import { MaterialSymbolsAdd } from '@vben/icons';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createExampleApi,
  deleteExampleApi,
  getExampleListApi,
  updateExampleApi,
} from '../../api';

import { exampleSchema, useExampleColumns } from './data';

const props = defineProps<{ datasetId?: number }>();

const formOptions: VbenFormProps = {
  collapsed: true,
  showCollapseButton: true,
  submitButtonOptions: { content: '查询' },
  schema: [
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
  ],
};

const gridOptions: VxeTableGridOptions<AIText2SqlExampleResult> = {
  rowConfig: { keyField: 'id' },
  height: 'auto',
  toolbarConfig: {
    custom: true,
    refresh: true,
    refreshOptions: { code: 'query' },
    zoom: true,
  },
  columns: useExampleColumns(onActionClick),
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        if (!props.datasetId) {
          return { items: [], total: 0 };
        }
        return await getExampleListApi({
          dataset_id: props.datasetId,
          page: page.currentPage,
          size: page.pageSize,
          ...formValues,
        });
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid({ formOptions, gridOptions });

watch(
  () => props.datasetId,
  () => {
    gridApi.query();
  },
  { immediate: true },
);

function onRefresh() {
  gridApi.query();
}

function onActionClick({ code, row }: OnActionClickParams<AIText2SqlExampleResult>) {
  switch (code) {
    case 'delete': {
      deleteExampleApi(row.id).then(() => {
        message.success({ content: '已删除', key: 'action_process_msg' });
        onRefresh();
      });
      break;
    }
    case 'edit': {
      modalApi.setData({ ...row }).open();
      break;
    }
  }
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: exampleSchema,
});

const formData = ref<AIText2SqlExampleResult>();
const modalTitle = computed(() => (formData.value?.id ? '编辑样例' : '新增样例'));

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    if (!props.datasetId) {
      message.warning('请先选择数据集');
      return;
    }
    modalApi.lock();
    try {
      const data = await formApi.getValues<AIText2SqlExampleParams>();
      const payload: AIText2SqlExampleParams = { ...data, dataset_id: props.datasetId };
      const id = formData.value?.id;
      if (id) {
        await updateExampleApi(id, payload);
      } else {
        await createExampleApi(payload);
      }
      message.success('已保存');
      await modalApi.close();
      onRefresh();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<AIText2SqlExampleResult>();
      formApi.resetForm();
      if (data) {
        formData.value = data;
        formApi.setValues(data);
      } else {
        formData.value = undefined;
      }
    }
  },
});
</script>

<template>
  <Grid>
    <template #toolbar-actions>
      <VbenButton
        :disabled="!props.datasetId"
        @click="() => modalApi.setData(null).open()"
      >
        <MaterialSymbolsAdd class="size-5" />
        新增样例
      </VbenButton>
    </template>
  </Grid>
  <Modal content-class="px-4 py-4 md:px-5 md:py-5" :title="modalTitle">
    <Form />
  </Modal>
</template>
