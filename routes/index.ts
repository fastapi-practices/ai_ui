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
    component: () => import('#/plugins/ai/views/chat/index.vue'),
    meta: {
      title: $t('ai.chat'),
      icon: 'ri:chat-ai-line',
    },
  },
  {
    name: 'PluginAIModelService',
    path: '/plugins/ai/model-service',
    component: () => import('#/plugins/ai/views/model-service/index.vue'),
    meta: {
      title: $t('ai.model'),
      icon: 'carbon:model-alt',
    },
  },
  {
    name: 'PluginAIMcp',
    path: '/plugins/ai/mcp',
    component: () => import('#/plugins/ai/views/mcp/index.vue'),
    meta: {
      title: $t('ai.mcp'),
      icon: 'simple-icons:modelcontextprotocol',
    },
  },
  {
    name: 'PluginAIQuickPhrase',
    path: '/plugins/ai/quick-phrase',
    component: () => import('#/plugins/ai/views/quick-phrase/index.vue'),
    meta: {
      title: $t('ai.quick_phrase'),
      icon: 'mdi:lightning-bolt-outline',
    },
  },
  {
    name: 'PluginAIText2Sql',
    path: '/plugins/ai/text2sql',
    component: () => import('#/plugins/ai/views/text2sql/index.vue'),
    meta: {
      title: $t('ai.text2sql'),
      icon: 'mdi:database-search-outline',
    },
  },
];

export default routes;
