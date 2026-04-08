import type { AIChatProviderMessage } from '../data';
import type { AIChatProviderRequest } from '../provider/chat-request';

import { ref } from 'vue';

import { useXChat } from '@antdv-next/x-sdk';

import { createProviderSeedMessage } from '../data';
import { AIChatProvider } from '../provider/chat-provider';

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
      const fallbackText =
        error.name === 'AbortError' ? '已停止生成' : error.message || '生成失败';
      const hasContent = currentMessage.blocks.some((block) => {
        if (block.type === 'file') {
          return Boolean(block.url || block.name);
        }
        return Boolean(block.text?.trim());
      });

      return {
        ...currentMessage,
        blocks: hasContent
          ? currentMessage.blocks
          : [
              {
                text: fallbackText,
                type: 'text',
              },
            ],
        created_time: currentMessage.created_time || new Date().toISOString(),
        message_type: error.name === 'AbortError' ? 'normal' : 'error',
        role: currentMessage.role || 'assistant',
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
