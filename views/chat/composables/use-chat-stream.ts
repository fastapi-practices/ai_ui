import type { AIChatProviderMessage } from '../data';

import { ref } from 'vue';

import { useXChat } from '@antdv-next/x-sdk';

import { createProviderSeedMessage } from '../data';
import { AIChatProvider } from '../provider/chat-provider';
import type { AIChatProviderRequest } from '../provider/chat-request';

export function useChatStream() {
  const chatProvider = new AIChatProvider();
  const transientRequestError = ref<null | string>(null);
  const chat = useXChat<
    AIChatProviderMessage,
    AIChatProviderMessage,
    AIChatProviderRequest
  >({
    provider: chatProvider,
    requestFallback: (_requestParams, { error, messageInfo }) => {
      if (error.name !== 'AbortError') {
        transientRequestError.value = error.message;
      }

      const currentMessage = messageInfo?.message ?? createProviderSeedMessage();
      return {
        ...currentMessage,
        content:
          currentMessage.content ||
          (error.name === 'AbortError'
            ? '已停止生成'
            : error.message || '生成失败'),
        error_message: error.name === 'AbortError' ? null : error.message,
        is_error: error.name !== 'AbortError',
        timestamp: currentMessage.timestamp || new Date().toISOString(),
      };
    },
    requestPlaceholder: () => createProviderSeedMessage(),
  });

  function abort() {
    if (!chatProvider.request.isRequesting) {
      return;
    }

    chat.abort();
  }

  return {
    ...chat,
    abort,
    chatProvider,
    transientRequestError,
  };
}
