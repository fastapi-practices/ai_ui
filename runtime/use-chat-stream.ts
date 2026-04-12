import type { AIChatProtocolName } from '../protocols';
import type { AIChatProviderRequest } from './chat-request';
import type { AIChatProviderMessage } from './message';

import { ref } from 'vue';

import { useXChat } from '@antdv-next/x-sdk';

import { createAIChatProtocol } from '../protocols';
import { AIChatProvider } from './chat-provider';
import { createProviderSeedMessage } from './message';

export interface UseAIChatStreamOptions {
  protocolName?: AIChatProtocolName;
}

export function useAIChatStream(options: UseAIChatStreamOptions = {}) {
  return useChatStream(
    new AIChatProvider({
      protocol: createAIChatProtocol(options.protocolName),
    }),
  );
}

export function useChatStream(chatProvider: AIChatProvider) {
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

      const currentMessage =
        messageInfo?.message ?? createProviderSeedMessage();
      const fallbackText =
        error.name === 'AbortError'
          ? '已停止生成'
          : error.message || '生成失败';
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
