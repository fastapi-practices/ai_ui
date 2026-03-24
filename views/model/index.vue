<script setup lang="ts">
import type { VbenFormProps } from '#/adapter/form';
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type {
  AIModelParams,
  AIModelResult,
  AIProviderResult,
} from '#/plugins/ai/api';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenModal, VbenButton } from '@vben/common-ui';
import { MaterialSymbolsAdd } from '@vben/icons';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAIModelApi,
  deleteAIModelApi,
  getAIModelListApi,
  getAIProviderListApi,
  updateAIModelApi,
} from '#/plugins/ai/api';

import { modelSchema, queryModelSchema, useModelColumns } from './data';

const providers = ref<AIProviderResult[]>([]);
const providerNameMap = ref(new Map<number, string>());

async function fetchProviders() {
  const data = await getAIProviderListApi();
  providers.value = data.items;
  providerNameMap.value = new Map(
    data.items.map((item) => [item.id, item.name]),
  );
}

const formOptions: VbenFormProps = {
  collapsed: true,
  showCollapseButton: true,
  submitButtonOptions: {
    content: $t('common.form.query'),
  },
  schema: queryModelSchema,
};

const gridOptions: VxeTableGridOptions<AIModelResult> = {
  rowConfig: {
    keyField: 'id',
  },
  checkboxConfig: {
    highlight: true,
  },
  height: 'auto',
  exportConfig: {},
  printConfig: {},
  toolbarConfig: {
    custom: true,
    refresh: true,
    refreshOptions: {
      code: 'query',
    },
    zoom: true,
  },
  columns: useModelColumns(providerNameMap, onActionClick),
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await getAIModelListApi({
          ...formValues,
          page: page.currentPage,
          size: page.pageSize,
        });
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions,
  gridOptions,
});

function onRefresh() {
  gridApi.query();
}

function onActionClick({ code, row }: OnActionClickParams<AIModelResult>) {
  switch (code) {
    case 'delete': {
      deleteAIModelApi([row.id]).then(() => {
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.model_id]),
          key: 'action_process_msg',
        });
        onRefresh();
      });
      break;
    }
    case 'edit': {
      modalApi.setData(row).open();
      break;
    }
  }
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: modelSchema,
});

const formData = ref<AIModelResult>();

const modalTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['模型'])
    : $t('ui.actionTitle.create', ['模型']);
});

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();
    const data = await formApi.getValues<AIModelParams>();

    try {
      await (formData.value?.id
        ? updateAIModelApi(formData.value.id, data)
        : createAIModelApi(data));
      message.success($t('ui.actionMessage.operationSuccess'));
      await modalApi.close();
      await fetchProviders();
      onRefresh();
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<AIModelResult>();
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

onMounted(async () => {
  await fetchProviders();
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <VbenButton @click="() => modalApi.setData(null).open()">
          <MaterialSymbolsAdd class="size-5" />
          新增模型
        </VbenButton>
      </template>
    </Grid>
    <Modal :title="modalTitle">
      <Form />
    </Modal>
  </Page>
</template>
