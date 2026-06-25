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
import { $t } from '@vben/locales';

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
  submitButtonOptions: { content: $t('common.query') },
  schema: [
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
        message.success({ content: $t('ai.text2sqlPage.example.deleted'), key: 'action_process_msg' });
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
const modalTitle = computed(() =>
  formData.value?.id
    ? $t('ai.text2sqlPage.example.editTitle')
    : $t('ai.text2sqlPage.example.createTitle'),
);

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    if (!props.datasetId) {
      message.warning($t('ai.text2sqlPage.example.pleaseSelectDataset'));
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
      message.success($t('ai.text2sqlPage.example.saved'));
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
        {{ $t('ai.text2sqlPage.example.add') }}
      </VbenButton>
    </template>
  </Grid>
  <Modal content-class="px-4 py-4 md:px-5 md:py-5" :title="modalTitle">
    <Form />
  </Modal>
</template>
