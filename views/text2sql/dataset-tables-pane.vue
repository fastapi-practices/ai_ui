<script setup lang="ts">
import type { VbenFormProps } from '@vben/common-ui';
import type { OnActionClickParams, VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  AIText2SqlTableParams,
  AIText2SqlTableResult,
} from '#/plugins/ai/api';

import { ref, watch } from 'vue';

import { VbenButton, useVbenModal } from '@vben/common-ui';
import { MaterialSymbolsAdd } from '@vben/icons';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createSelectedTableApi,
  deleteSelectedTableApi,
  getSelectableTablesApi,
  getSelectedTableListApi,
  updateSelectedTableApi,
} from '#/plugins/ai/api';

import { selectedTableSchema, useSelectedTableColumns } from './data';

const props = defineProps<{ datasetId?: number }>();

const formOptions: VbenFormProps = {
  collapsed: true,
  showCollapseButton: true,
  submitButtonOptions: { content: '查询' },
  schema: [
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
  ],
};

const gridOptions: VxeTableGridOptions<AIText2SqlTableResult> = {
  rowConfig: { keyField: 'id' },
  height: 'auto',
  toolbarConfig: {
    custom: true,
    refresh: true,
    refreshOptions: { code: 'query' },
    zoom: true,
  },
  columns: useSelectedTableColumns(onActionClick),
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        if (!props.datasetId) {
          return { items: [], total: 0 };
        }
        return await getSelectedTableListApi({
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

function onActionClick({ code, row }: OnActionClickParams<AIText2SqlTableResult>) {
  switch (code) {
    case 'delete': {
      deleteSelectedTableApi(row.id).then(() => {
        message.success({ content: '已取消挑选', key: 'action_process_msg' });
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
  schema: selectedTableSchema,
});

const formData = ref<AIText2SqlTableResult>();

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    const id = formData.value?.id;
    if (!id) {
      return;
    }
    modalApi.lock();
    try {
      const data = await formApi.getValues<AIText2SqlTableResult>();
      await updateSelectedTableApi(id, {
        custom_desc: data.custom_desc,
        enabled: data.enabled,
        sort: data.sort,
      });
      message.success('已更新');
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
      const data = modalApi.getData<AIText2SqlTableResult>();
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

// 挑选表
const pickTable = ref<string>();
const pickCustomDesc = ref('');
const pickOptions = ref<{ label: string; value: string }[]>([]);

const [PickModal, pickModalApi] = useVbenModal({
  class: 'w-1/3',
  destroyOnClose: true,
  async onConfirm() {
    if (!props.datasetId) {
      message.warning('请先选择数据集');
      return;
    }
    if (!pickTable.value) {
      message.warning('请选择要挑选的表');
      return;
    }
    pickModalApi.lock();
    try {
      const payload: AIText2SqlTableParams = {
        dataset_id: props.datasetId,
        enabled: 1,
        schema_name: 'fba',
        sort: 0,
        table_name: pickTable.value,
        custom_desc: pickCustomDesc.value.trim() || undefined,
      };
      await createSelectedTableApi(payload);
      message.success('已挑选');
      await pickModalApi.close();
      onRefresh();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      pickModalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (isOpen && props.datasetId) {
      pickTable.value = undefined;
      pickCustomDesc.value = '';
      try {
        const all = await getSelectableTablesApi(props.datasetId);
        pickOptions.value = all
          .filter((table) => !table.selected)
          .map((table) => ({
            label: table.table_comment
              ? `${table.table_name}（${table.table_comment}）`
              : table.table_name,
            value: table.table_name,
          }));
        if (pickOptions.value.length === 0) {
          message.info('已挑选全部可用的表');
        }
      } catch {
        pickOptions.value = [];
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
        @click="() => pickModalApi.setData(null).open()"
      >
        <MaterialSymbolsAdd class="size-5" />
        挑选表
      </VbenButton>
    </template>
  </Grid>
  <Modal content-class="px-4 py-4 md:px-5 md:py-5" title="编辑已选表">
    <Form />
  </Modal>
  <PickModal content-class="px-4 py-4 md:px-5 md:py-5" title="挑选表">
    <div class="flex flex-col gap-4">
      <a-alert type="info" show-icon>
        <template #message>仅可选择尚未挑选的表，表名来自 fba 库反查</template>
      </a-alert>
      <a-select
        v-model:value="pickTable"
        :options="pickOptions"
        show-search
        placeholder="选择未挑选的表"
      />
      <a-textarea
        v-model:value="pickCustomDesc"
        :auto-size="{ minRows: 3, maxRows: 6 }"
        placeholder="自定义描述（可选，补充业务语义以提升生成精度）"
      />
    </div>
  </PickModal>
</template>
