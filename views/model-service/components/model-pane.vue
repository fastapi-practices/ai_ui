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
import type { PaginationResult } from '#/types';

import { computed, ref } from 'vue';

import { useVbenModal, VbenButton } from '@vben/common-ui';
import { MaterialSymbolsAdd } from '@vben/icons';
import { $t } from '@vben/locales';

import { Empty as AEmpty, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAIModelApi,
  deleteAIModelApi,
  getAIModelListApi,
  syncAIProviderModelsApi,
  updateAIModelApi,
} from '#/plugins/ai/api';

import {
  createModelSchema,
  queryModelSchema,
  SYNCABLE_PROVIDER_TYPES,
  useModelColumns,
} from '../data';

const props = defineProps<{
  provider?: AIProviderResult;
  providerNameMap: Map<number, string>;
}>();

const EMPTY_PAGINATION: PaginationResult<AIModelResult> = {
  items: [],
  links: null,
  page: 1,
  size: 10,
  total: 0,
  total_pages: 0,
};

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
  columns: useModelColumns(
    computed(() => props.providerNameMap),
    onActionClick,
  ),
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        if (!props.provider) {
          return {
            ...EMPTY_PAGINATION,
            page: page.currentPage,
            size: page.pageSize,
          };
        }

        return await getAIModelListApi({
          ...formValues,
          provider_id: props.provider.id,
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

async function syncModels() {
  if (!props.provider || !SYNCABLE_PROVIDER_TYPES.has(props.provider.type)) {
    return;
  }

  await syncAIProviderModelsApi(props.provider.id);
  message.success($t('ui.actionMessage.operationSuccess'));
  onRefresh();
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: createModelSchema(),
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
    if (!props.provider) {
      return;
    }

    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();
    const values =
      await formApi.getValues<Omit<AIModelParams, 'provider_id'>>();
    const payload: AIModelParams = {
      ...values,
      provider_id: props.provider.id,
    };

    try {
      await (formData.value?.id
        ? updateAIModelApi(formData.value.id, payload)
        : createAIModelApi(payload));
      message.success($t('ui.actionMessage.operationSuccess'));
      await modalApi.close();
      onRefresh();
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<AIModelResult>();
    formApi.resetForm();

    if (data) {
      formData.value = data;
      formApi.setValues(data);
    } else {
      formData.value = undefined;
    }
  },
});
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
  >
    <div
      v-if="!provider"
      class="flex min-h-[320px] flex-1 items-center justify-center"
    >
      <AEmpty description="请先新增并选择供应商" />
    </div>

    <template v-else>
      <Grid>
        <template #toolbar-actions>
          <VbenButton @click="() => modalApi.setData(null).open()">
            <MaterialSymbolsAdd class="size-5" />
            新增模型
          </VbenButton>
          <VbenButton
            class="ml-2"
            v-if="SYNCABLE_PROVIDER_TYPES.has(provider.type)"
            variant="outline"
            @click="syncModels"
          >
            同步模型
          </VbenButton>
        </template>
      </Grid>
      <Modal :title="modalTitle">
        <Form />
      </Modal>
    </template>
  </div>
</template>
