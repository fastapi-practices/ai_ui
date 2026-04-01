<script setup lang="ts">
import type { AIProviderParams, AIProviderResult } from '#/plugins/ai/api';

import { computed, onMounted, ref } from 'vue';

import { useVbenModal, VbenButton } from '@vben/common-ui';
import {
  MaterialSymbolsAdd,
  MaterialSymbolsDelete,
  MaterialSymbolsEdit,
} from '@vben/icons';
import { $t } from '@vben/locales';

import { Empty as AEmpty, message, Spin as ASpin, Tag as ATag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createAIProviderApi,
  deleteAIProviderApi,
  getAllAIProviderApi,
  updateAIProviderApi,
} from '#/plugins/ai/api';

import {
  getProviderTypeLabel,
  pickActiveProviderId,
  providerSchema,
} from '../data';

const props = defineProps<{
  activeProviderId?: number;
}>();

const emit = defineEmits<{
  'providers-change': [providers: AIProviderResult[]];
  select: [providerId: number];
}>();

const providers = ref<AIProviderResult[]>([]);
const loading = ref(false);
const formData = ref<AIProviderResult>();

const modalTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['供应商'])
    : $t('ui.actionTitle.create', ['供应商']);
});

function syncProviders(nextProviders: AIProviderResult[], preferredId?: number) {
  providers.value = nextProviders;
  emit('providers-change', nextProviders);

  const nextId = pickActiveProviderId(
    nextProviders,
    preferredId ?? props.activeProviderId,
  );

  if (nextId !== undefined) {
    emit('select', nextId);
  }
}

async function refreshProviders(preferredId?: number) {
  loading.value = true;
  try {
    const data = await getAllAIProviderApi();
    syncProviders(data, preferredId);
  } finally {
    loading.value = false;
  }
}

async function handleDelete(provider: AIProviderResult) {
  const fallbackId = providers.value.find((item) => item.id !== provider.id)?.id;

  await deleteAIProviderApi([provider.id]);
  message.success({
    content: $t('ui.actionMessage.deleteSuccess', [provider.name]),
    key: 'action_process_msg',
  });

  await refreshProviders(fallbackId);
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: providerSchema,
});

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();
    const values = await formApi.getValues<AIProviderParams>();
    const editingId = formData.value?.id;

    try {
      if (editingId) {
        await updateAIProviderApi(editingId, values);
        message.success($t('ui.actionMessage.operationSuccess'));
        await modalApi.close();
        await refreshProviders(editingId);
      } else {
        const createdProvider = await createAIProviderApi(values);
        syncProviders([createdProvider, ...providers.value], createdProvider.id);
        message.success($t('ui.actionMessage.operationSuccess'));
        await modalApi.close();
      }
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    const data = modalApi.getData<AIProviderResult>();
    formApi.resetForm();

    if (data) {
      formData.value = data;
      formApi.setValues(data);
    } else {
      formData.value = undefined;
    }
  },
});

onMounted(async () => {
  await refreshProviders();
});
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
  >
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <div class="text-sm font-medium text-foreground">供应商</div>
        <div class="text-xs text-muted-foreground">选择供应商后查看右侧模型</div>
      </div>
      <VbenButton size="sm" @click="() => modalApi.setData(null).open()">
        <MaterialSymbolsAdd class="size-4" />
        新增
      </VbenButton>
    </div>

    <div class="flex flex-1 min-h-0 flex-col p-3">
      <div
        v-if="loading && providers.length === 0"
        class="flex flex-1 items-center justify-center"
      >
        <ASpin />
      </div>

      <div
        v-else-if="providers.length === 0"
        class="flex flex-1 items-center justify-center"
      >
        <AEmpty description="暂无供应商" />
      </div>

      <div v-else class="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <button
          v-for="item in providers"
          :key="item.id"
          class="w-full rounded-lg border px-3 py-3 text-left transition-colors"
          :class="
            item.id === activeProviderId
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background hover:border-primary/40'
          "
          type="button"
          @click="emit('select', item.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-foreground">
                {{ item.name }}
              </div>
              <div class="mt-1 truncate text-xs text-muted-foreground">
                {{ item.api_host }}
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button
                class="inline-flex rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                type="button"
                @click.stop="modalApi.setData(item).open()"
              >
                <MaterialSymbolsEdit class="size-4" />
              </button>
              <a-popconfirm
                :title="`确认删除“${item.name}”吗？`"
                @confirm="handleDelete(item)"
              >
                <button
                  class="inline-flex rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                  type="button"
                  @click.stop
                >
                  <MaterialSymbolsDelete class="size-4" />
                </button>
              </a-popconfirm>
            </div>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <ATag>{{ getProviderTypeLabel(item.type) }}</ATag>
            <ATag :color="item.status === 1 ? 'success' : 'default'">
              {{ item.status === 1 ? '启用' : '停用' }}
            </ATag>
          </div>
        </button>
      </div>
    </div>

    <Modal :title="modalTitle">
      <Form />
    </Modal>
  </div>
</template>
