<script setup lang="ts">
import { XMarkdown } from '@antdv-next/x-markdown';

import '@antdv-next/x-markdown/themes/light.css';

defineOptions({ name: 'AIChatMarkdown' });

withDefaults(
  defineProps<{
    content?: string;
    customId?: string;
  }>(),
  {
    content: '',
    customId: 'ai-chat',
  },
);
</script>

<template>
  <div class="ai-markdown">
    <XMarkdown :content="content || ''" :class-name="customId" />
  </div>
</template>
