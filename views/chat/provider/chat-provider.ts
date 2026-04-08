import type { XRequestOptions } from '@antdv-next/x-sdk';

import type { AIChatProviderMessage } from '../data';
import type { AIChatProviderRequest } from './chat-request';

import type { AGUISSEChunk } from '#/plugins/ai/api';

import { AbstractChatProvider } from '@antdv-next/x-sdk';

import {
  createAGUIStreamAccumulator,
  parseAGUIStreamEventFromChunk,
  toAIChatMessageFromAGUIEvent,
} from '#/plugins/ai/api';

import {
  createProviderSeedMessage,
  providerMessageToChatMessage,
} from '../data';
import { createAIChatRequest } from './chat-request';

type ProviderTransformMessage = {
  chunk: AGUISSEChunk;
  chunks: AGUISSEChunk[];
  originMessage?: AIChatProviderMessage;
  responseHeaders: Headers;
  status: string;
};

export class AIChatProvider extends AbstractChatProvider<
  AIChatProviderMessage,
  AIChatProviderRequest,
  AGUISSEChunk
> {
  private accumulator = createAGUIStreamAccumulator();

  constructor() {
    super({
      request: createAIChatRequest(),
    });
  }

  transformLocalMessage(requestParams: Partial<AIChatProviderRequest>) {
    return requestParams.localMessages ?? [];
  }

  transformMessage(
    info: ProviderTransformMessage,
  ): AIChatProviderMessage {
    const { chunk, originMessage } = info;

    if (!chunk?.data) {
      return originMessage ?? createProviderSeedMessage();
    }

    const event = parseAGUIStreamEventFromChunk(chunk);
    if (!event) {
      return originMessage ?? createProviderSeedMessage();
    }

    const nextMessage = toAIChatMessageFromAGUIEvent(event, this.accumulator);
    if (!nextMessage) {
      return originMessage ?? createProviderSeedMessage();
    }

    return providerMessageToChatMessage(originMessage, nextMessage);
  }

  transformParams(
    requestParams: Partial<AIChatProviderRequest>,
    _options: XRequestOptions<
      AIChatProviderRequest,
      AGUISSEChunk,
      AIChatProviderMessage
    >,
  ) {
    this.accumulator = createAGUIStreamAccumulator();
    return requestParams as AIChatProviderRequest;
  }
}
