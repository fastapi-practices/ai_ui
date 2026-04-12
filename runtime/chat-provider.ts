import type { XRequestOptions } from '@antdv-next/x-sdk';

import type {
  AIChatProtocol,
  AIChatProtocolChunk,
} from '../protocols/types';
import type { AIChatProviderRequest } from './chat-request';
import type { AIChatProviderMessage } from './message';

import { AbstractChatProvider } from '@antdv-next/x-sdk';

import { createAIChatRequest } from './chat-request';

type ProviderTransformMessage = {
  chunk: AIChatProtocolChunk;
  chunks: AIChatProtocolChunk[];
  originMessage?: AIChatProviderMessage;
  responseHeaders: Headers;
  status: string;
};

export interface AIChatProviderOptions<TState = unknown> {
  protocol: AIChatProtocol<AIChatProtocolChunk, AIChatProviderMessage, TState>;
}

export class AIChatProvider extends AbstractChatProvider<
  AIChatProviderMessage,
  AIChatProviderRequest,
  AIChatProtocolChunk
> {
  private protocol: AIChatProtocol<AIChatProtocolChunk, AIChatProviderMessage>;
  private protocolState: unknown;

  constructor(options: AIChatProviderOptions) {
    super({
      request: createAIChatRequest(),
    });
    this.protocol = options.protocol;
    this.protocolState = options.protocol.createState();
  }

  transformLocalMessage(requestParams: Partial<AIChatProviderRequest>) {
    return requestParams.localMessages ?? [];
  }

  transformMessage(
    info: ProviderTransformMessage,
  ): AIChatProviderMessage {
    return this.protocol.transformMessage({
      ...info,
      state: this.protocolState,
    });
  }

  transformParams(
    requestParams: Partial<AIChatProviderRequest>,
    _options: XRequestOptions<
      AIChatProviderRequest,
      AIChatProtocolChunk,
      AIChatProviderMessage
    >,
  ) {
    this.protocolState = this.protocol.resetState(this.protocolState);
    return requestParams as AIChatProviderRequest;
  }
}
