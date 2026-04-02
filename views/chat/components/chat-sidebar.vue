<script setup lang="ts">
import type { ConversationsProps } from '@antdv-next/x';

import { Conversations } from '@antdv-next/x';
import { Spin as ASpin } from 'antdv-next';

import { VbenButton } from '@vben/common-ui';

defineProps<{
  activeKey?: string;
  creation: ConversationsProps['creation'];
  hasMore: boolean;
  items: NonNullable<ConversationsProps['items']>;
  loading: boolean;
  loadingMore: boolean;
  menu: ConversationsProps['menu'];
  onActiveChange: NonNullable<ConversationsProps['onActiveChange']>;
  onLoadMore: () => void;
}>();
</script>

<template>
  <aside
    class="mr-2 flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
  >
    <div class="flex-1 overflow-y-auto p-3">
      <ASpin v-if="loading && items.length === 0" class="block py-10" />
      <template v-else>
        <Conversations
          :active-key="activeKey"
          :creation="creation"
          :items="items"
          :menu="menu"
          :on-active-change="onActiveChange"
        />
        <VbenButton
          v-if="hasMore"
          block
          size="sm"
          variant="outline"
          :loading="loadingMore"
          @click="onLoadMore"
        >
          加载更多
        </VbenButton>
      </template>
    </div>
  </aside>
</template>
