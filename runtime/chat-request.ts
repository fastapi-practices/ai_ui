import type { AIChatProtocolChunk } from '../protocols/types';
import type { AIChatProviderMessage } from './message';

import type {
  AIChatCompletionParams,
  AIChatRegenerateParams,
  AIChatTransportMode,
} from '#/plugins/ai/api/chat';

import { XRequest } from '@antdv-next/x-sdk';

import {
  getAIChatRequestHeaders,
  readAIChatErrorMessage,
  resolveAIChatApiUrl,
  resolveAIChatTransportUrl,
} from '#/plugins/ai/api/chat';

export interface AIChatProviderRequest {
  body: AIChatCompletionParams | AIChatRegenerateParams;
  conversationId?: string;
  localMessages?: AIChatProviderMessage[];
  messageId?: number;
  mode: AIChatTransportMode;
}

export interface CreateAIChatRequestOptions {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function createAIChatRequest(options: CreateAIChatRequestOptions = {}) {
  return XRequest<AIChatProviderRequest, AIChatProtocolChunk, AIChatProviderMessage>(
    '__ai_chat_transport__',
    {
      callbacks: {
        onError: (error) => {
          options.onError?.(error);
        },
        onSuccess: () => {
          options.onSuccess?.();
        },
      },
      fetch: async (_baseUrl, requestOptions) => {
        const params = requestOptions.params;
        if (!params?.body || !params.mode) {
          throw new Error('AI chat request params are required');
        }

        const response = await fetch(
          resolveAIChatApiUrl(resolveAIChatTransportUrl(params as AIChatProviderRequest)),
          {
            ...requestOptions,
            body: JSON.stringify(params.body),
            headers: getAIChatRequestHeaders(),
          },
        );

        if (!response.ok) {
          throw new Error(await readAIChatErrorMessage(response));
        }

        if (!response.body) {
          throw new Error('AI stream is unavailable');
        }

        return response;
      },
      manual: true,
      method: 'POST',
    },
  );
}
