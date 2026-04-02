<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

import { nextTick, onMounted, ref } from 'vue';

import { Sender } from '@antdv-next/x';

type SenderInstance = ComponentPublicInstance<{
  nativeElement?: HTMLElement;
}>;

const senderRef = ref<null | SenderInstance>(null);

async function syncTextareaAccessibilityAttrs() {
  await nextTick();

  const rootElement =
    senderRef.value?.nativeElement ?? (senderRef.value?.$el as HTMLElement);
  const textareaElement = rootElement?.querySelector('textarea');

  if (!(textareaElement instanceof HTMLTextAreaElement)) {
    return;
  }

  if (!textareaElement.name) {
    textareaElement.name = 'ai-chat-message';
  }

  if (!textareaElement.id) {
    textareaElement.id = 'ai-chat-message';
  }
}

onMounted(() => {
  void syncTextareaAccessibilityAttrs();
});
</script>

<template>
  <div class="bg-card px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-4">
    <div class="relative">
      <Sender ref="senderRef" v-bind="$attrs" />
    </div>
  </div>
</template>
