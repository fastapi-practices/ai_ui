<script setup lang="ts">
import type {
  AIText2SqlDatasetParams,
  AIText2SqlDatasetResult,
} from '../../api';

import { computed, onMounted, ref } from 'vue';

import { Page, confirm, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createDatasetApi,
  deleteDatasetApi,
  getDatasetListApi,
  updateDatasetApi,
} from '../../api';

import { datasetSchema } from './data';
import DatasetExamplesPane from './dataset-examples-pane.vue';
import DatasetTablesPane from './dataset-tables-pane.vue';

const datasets = ref<AIText2SqlDatasetResult[]>([]);
const selectedDatasetId = ref<number>();
const activeTab = ref<'examples' | 'tables'>('tables');

const selectedDataset = computed(() =>
  datasets.value.find((item) => item.id === selectedDatasetId.value),
);

async function loadDatasets() {
  const res = await getDatasetListApi({ page: 1, size: 200 });
  datasets.value = res.items;
  const stillExists = datasets.value.some(
    (item) => item.id === selectedDatasetId.value,
  );
  if (!stillExists) {
    selectedDatasetId.value = datasets.value[0]?.id;
  }
}

const [DatasetForm, datasetFormApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: datasetSchema,
});

const datasetFormData = ref<AIText2SqlDatasetResult>();
const datasetModalTitle = computed(() =>
  datasetFormData.value?.id
    ? $t('ai.text2sqlPage.dataset.editTitle')
    : $t('ai.text2sqlPage.dataset.createTitle'),
);

const [DatasetModal, datasetModalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await datasetFormApi.validate();
    if (!valid) {
      return;
    }
    datasetModalApi.lock();
    try {
      const data = await datasetFormApi.getValues<AIText2SqlDatasetParams>();
      const id = datasetFormData.value?.id;
      if (id) {
        await updateDatasetApi(id, data);
      } else {
        await createDatasetApi(data);
      }
      message.success($t('ai.text2sqlPage.dataset.saved'));
      await datasetModalApi.close();
      await loadDatasets();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      datasetModalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = datasetModalApi.getData<AIText2SqlDatasetResult>();
      datasetFormApi.resetForm();
      if (data) {
        datasetFormData.value = data;
        datasetFormApi.setValues(data);
      } else {
        datasetFormData.value = undefined;
      }
    }
  },
});

function openCreateDataset() {
  datasetModalApi.setData(null).open();
}

function openEditDataset(row: AIText2SqlDatasetResult) {
  datasetModalApi.setData({ ...row }).open();
}

function confirmDeleteDataset(row: AIText2SqlDatasetResult) {
  confirm({
    content: $t('ai.text2sqlPage.dataset.deleteConfirm', { name: row.name }),
    icon: 'warning',
  }).then(async () => {
    await deleteDatasetApi(row.id);
    message.success($t('ai.text2sqlPage.dataset.deleted'));
    await loadDatasets();
  });
}

onMounted(loadDatasets);
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full gap-3">
      <div
        class="flex w-72 shrink-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        <div
          class="flex items-center justify-between border-b border-border px-3 py-2.5"
        >
          <span class="text-sm font-semibold">{{ $t('ai.text2sqlPage.dataset.title') }}</span>
          <a-button size="small" type="primary" @click="openCreateDataset">
            {{ $t('ai.text2sqlPage.dataset.add') }}
          </a-button>
        </div>
        <div class="flex-1 overflow-y-auto p-2">
          <a-empty v-if="datasets.length === 0" :description="$t('ai.text2sqlPage.dataset.empty')" />
          <div
            v-for="d in datasets"
            :key="d.id"
            class="group mb-1.5 cursor-pointer rounded-[var(--radius)] border px-3 py-2 transition-colors"
            :class="
              d.id === selectedDatasetId
                ? 'border-primary/40 bg-primary/10'
                : 'border-transparent hover:bg-accent/40'
            "
            @click="selectedDatasetId = d.id"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-medium">{{ d.name }}</span>
                  <a-tag v-if="!d.enabled" color="default" class="!m-0 !text-xs">
                    {{ $t('ai.text2sqlPage.dataset.disabled') }}
                  </a-tag>
                </div>
                <div
                  v-if="d.description"
                  class="mt-0.5 truncate text-xs text-muted-foreground"
                >
                  {{ d.description }}
                </div>
              </div>
              <div
                class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                @click.stop
              >
                <a-button
                  size="small"
                  type="text"
                  @click="openEditDataset(d)"
                >
                  <IconifyIcon icon="mdi:pencil-outline" />
                </a-button>
                <a-button
                  size="small"
                  danger
                  type="text"
                  @click="confirmDeleteDataset(d)"
                >
                  <IconifyIcon icon="mdi:trash-can-outline" />
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        <div class="border-b border-border px-4 pt-3">
          <span class="text-sm font-semibold">
            {{ selectedDataset ? selectedDataset.name : $t('ai.text2sqlPage.dataset.pleaseSelect') }}
          </span>
        </div>
        <a-tabs v-model:activeKey="activeTab" class="flex-1 !px-3">
          <a-tab-pane key="tables" :tab="$t('ai.text2sqlPage.table.tab')" class="!pt-2">
            <DatasetTablesPane :dataset-id="selectedDatasetId" />
          </a-tab-pane>
          <a-tab-pane key="examples" :tab="$t('ai.text2sqlPage.example.tab')" class="!pt-2">
            <DatasetExamplesPane :dataset-id="selectedDatasetId" />
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>

    <DatasetModal :title="datasetModalTitle">
      <DatasetForm />
    </DatasetModal>
  </Page>
</template>

<style scoped>
/* antd Tabs 默认 .ant-tabs-content / .ant-tabs-tabpane 高度为 auto，
   会让内部 vxe-grid 的 height:'auto' 算不出可用高度（高度链在此断裂）。
   这里把高度链贯通到 tabpane，让每个 tab 内的 Grid 撑满。 */
:deep(.ant-tabs) {
  height: 100%;
}

:deep(.ant-tabs-content-holder) {
  flex: 1 1 0%;
  min-height: 0;
}

:deep(.ant-tabs-content) {
  height: 100%;
}

:deep(.ant-tabs-tabpane) {
  height: 100%;
}
</style>
