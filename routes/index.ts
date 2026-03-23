import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    name: 'PluginAI',
    path: '/plugins/ai',
    redirect: '/plugins/ai/chat',
    meta: {
      title: $t('ai.menu'),
      icon: 'tabler:robot',
    },
  },
  {
    name: 'PluginAIChat',
    path: '/plugins/ai/chat',
    component: () => import('#/plugins/ai/views/chat.vue'),
    meta: {
      title: $t('ai.chat'),
      icon: 'ri:chat-ai-line',
    },
  },
  {
    name: 'PluginAIProvider',
    path: '/plugins/ai/provider',
    component: () => import('#/plugins/ai/views/provider.vue'),
    meta: {
      title: $t('ai.provider'),
      icon: 'mdi:hub-outline',
    },
  },
  {
    name: 'PluginAIModel',
    path: '/plugins/ai/model',
    component: () => import('#/plugins/ai/views/model.vue'),
    meta: {
      title: $t('ai.model'),
      icon: 'carbon:model-alt',
    },
  },
  {
    name: 'PluginAIMcp',
    path: '/plugins/ai/mcp',
    component: () => import('#/plugins/ai/views/mcp.vue'),
    meta: {
      title: $t('ai.mcp'),
      icon: 'simple-icons:modelcontextprotocol',
    },
  },
  {
    name: 'PluginAIQuickPhrase',
    path: '/plugins/ai/quick-phrase',
    component: () => import('#/plugins/ai/views/quick-phrase.vue'),
    meta: {
      title: $t('ai.quick_phrase'),
      icon: 'mdi:lightning-bolt-outline',
    },
  },
];

export default routes;
