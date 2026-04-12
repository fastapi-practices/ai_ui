<script setup lang="ts">
import { nextTick, onMounted, onUpdated, ref } from 'vue';

import { Sender } from '@antdv-next/x';

const rootRef = ref<HTMLElement>();

function syncSenderTextareaAttrs() {
  const textarea = rootRef.value?.querySelector('textarea');
  if (!textarea) {
    return;
  }

  textarea.setAttribute('id', 'chat-message-input');
  textarea.setAttribute('name', 'chat-message');
}

async function updateSenderTextareaAttrs() {
  await nextTick();
  syncSenderTextareaAttrs();
}

onMounted(() => {
  void updateSenderTextareaAttrs();
});

onUpdated(() => {
  void updateSenderTextareaAttrs();
});
</script>

<template>
  <div ref="rootRef" class="bg-card px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-4">
    <div class="relative">
      <Sender v-bind="$attrs" />
    </div>
  </div>
</template>
