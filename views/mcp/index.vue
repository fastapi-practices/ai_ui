<script setup lang="ts">
import type { VbenFormProps } from '@vben/common-ui';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { AIMcpParams, AIMcpResult } from '#/plugins/ai/api';

import { computed, ref } from 'vue';

import { Page, useVbenModal, VbenButton } from '@vben/common-ui';
import { MaterialSymbolsAdd } from '@vben/icons';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createAIMcpApi,
  deleteAIMcpApi,
  getAIMcpListApi,
  updateAIMcpApi,
} from '#/plugins/ai/api';

import {
  formatArgsInput,
  formatEnvInput,
  mcpSchema,
  parseArgsInput,
  parseEnvInput,
  queryMcpSchema,
  useMcpColumns,
} from './data';

const formOptions: VbenFormProps = {
  collapsed: true,
  showCollapseButton: true,
  submitButtonOptions: {
    content: $t('common.form.query'),
  },
  schema: queryMcpSchema,
};

const gridOptions: VxeTableGridOptions<AIMcpResult> = {
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
  columns: useMcpColumns(onActionClick),
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await getAIMcpListApi({
          page: page.currentPage,
          size: page.pageSize,
          ...formValues,
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

function onActionClick({ code, row }: OnActionClickParams<AIMcpResult>) {
  switch (code) {
    case 'delete': {
      deleteAIMcpApi(row.id).then(() => {
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.name]),
          key: 'action_process_msg',
        });
        onRefresh();
      });
      break;
    }
    case 'edit': {
      modalApi
        .setData({
          ...row,
          args: formatArgsInput(row.args),
          env: formatEnvInput(row.env),
        })
        .open();
      break;
    }
  }
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: mcpSchema,
});

type AIMcpFormValues = Omit<AIMcpParams, 'args' | 'env'> & {
  args?: null | string;
  env?: null | string;
  id?: number;
};

const formData = ref<AIMcpFormValues>();

const modalTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['MCP'])
    : $t('ui.actionTitle.create', ['MCP']);
});

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();

    try {
      const data = await formApi.getValues<AIMcpFormValues>();
      const payload: AIMcpParams = {
        command: data.command.trim(),
        description: data.description?.trim() || undefined,
        env: parseEnvInput(data.env, '环境变量'),
        args: parseArgsInput(data.args),
        headers: data.headers?.trim() || undefined,
        name: data.name,
        read_timeout: data.read_timeout,
        timeout: data.timeout,
        type: data.type,
        url: data.url?.trim() || undefined,
      };

      await (formData.value?.id
        ? updateAIMcpApi(formData.value.id, payload)
        : createAIMcpApi(payload));
      message.success($t('ui.actionMessage.operationSuccess'));
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
      const data = modalApi.getData<AIMcpFormValues>();
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
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <VbenButton @click="() => modalApi.setData(null).open()">
          <MaterialSymbolsAdd class="size-5" />
          新增 MCP
        </VbenButton>
      </template>
    </Grid>
    <Modal :title="modalTitle">
      <Form />
    </Modal>
  </Page>
</template>
