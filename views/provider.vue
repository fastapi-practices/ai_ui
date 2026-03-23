<script setup lang="ts">
import type { VbenFormProps } from '#/adapter/form';
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type {
  AIProviderModelResult,
  AIProviderParams,
  AIProviderResult,
} from '#/plugins/ai/api';

import { computed, ref } from 'vue';

import { Page, useVbenModal, VbenButton } from '@vben/common-ui';
import { MaterialSymbolsAdd } from '@vben/icons';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAIProviderApi,
  deleteAIProviderApi,
  getAIProviderListApi,
  getAIProviderModelsApi,
  syncAIProviderModelsApi,
  updateAIProviderApi,
} from '#/plugins/ai/api';

import {
  providerSchema,
  queryProviderSchema,
  SYNCABLE_PROVIDER_TYPES,
  useProviderColumns,
} from './data';

const providerModels = ref<AIProviderModelResult[]>([]);
const providerModelsLoading = ref(false);
const providerModelsTitle = ref('供应商模型');

const formOptions: VbenFormProps = {
  collapsed: true,
  showCollapseButton: true,
  submitButtonOptions: {
    content: $t('common.form.query'),
  },
  schema: queryProviderSchema,
};

const gridOptions: VxeTableGridOptions<AIProviderResult> = {
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
  columns: useProviderColumns(onActionClick),
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await getAIProviderListApi({
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

async function openProviderModels(row: AIProviderResult) {
  providerModelsTitle.value = `${row.name} · 模型列表`;
  providerModelsLoading.value = true;
  providerModels.value = [];
  providerModelsModalApi.open();

  try {
    providerModels.value = await getAIProviderModelsApi(row.id);
  } finally {
    providerModelsLoading.value = false;
  }
}

async function syncProviderModels(row: AIProviderResult) {
  await syncAIProviderModelsApi(row.id);
  message.success($t('ui.actionMessage.operationSuccess'));
}

function onActionClick({ code, row }: OnActionClickParams<AIProviderResult>) {
  switch (code) {
    case 'delete': {
      deleteAIProviderApi([row.id]).then(() => {
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.name]),
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
    case 'models': {
      if (SYNCABLE_PROVIDER_TYPES.has(row.type)) {
        openProviderModels(row);
      }
      break;
    }
    case 'sync': {
      if (SYNCABLE_PROVIDER_TYPES.has(row.type)) {
        syncProviderModels(row);
      }
      break;
    }
  }
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: providerSchema,
});

const formData = ref<AIProviderResult>();

const modalTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['供应商'])
    : $t('ui.actionTitle.create', ['供应商']);
});

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();
    const data = await formApi.getValues<AIProviderParams>();

    try {
      await (formData.value?.id
        ? updateAIProviderApi(formData.value.id, data)
        : createAIProviderApi(data));
      message.success($t('ui.actionMessage.operationSuccess'));
      await modalApi.close();
      onRefresh();
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<AIProviderResult>();
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

const [ProviderModelsModal, providerModelsModalApi] = useVbenModal({
  class: 'w-6/12',
  footer: false,
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <VbenButton @click="() => modalApi.setData(null).open()">
          <MaterialSymbolsAdd class="size-5" />
          新增供应商
        </VbenButton>
      </template>
    </Grid>
    <Modal :title="modalTitle">
      <Form />
    </Modal>
    <ProviderModelsModal :title="providerModelsTitle">
      <a-spin class="block min-h-40" :spinning="providerModelsLoading">
        <a-empty
          v-if="!providerModelsLoading && providerModels.length === 0"
          description="暂无模型"
        />
        <div v-else class="space-y-3">
          <div
            v-for="item in providerModels"
            :key="item.id"
            class="rounded-lg border border-border bg-background px-4 py-3"
          >
            <div class="text-sm font-medium text-foreground">
              {{ item.id }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              {{ item.owned_by }} · {{ item.object }}
            </div>
          </div>
        </div>
      </a-spin>
    </ProviderModelsModal>
  </Page>
</template>
