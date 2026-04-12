import type { AIChatProviderMessage } from '../runtime/message';

export const AG_UI_AI_CHAT_PROTOCOL_NAME = 'ag-ui';

export const AI_CHAT_PROTOCOL_NAMES = [AG_UI_AI_CHAT_PROTOCOL_NAME] as const;

export type AIChatProtocolName = (typeof AI_CHAT_PROTOCOL_NAMES)[number];

export interface AIChatProtocolChunk {
  data?: string;
  event?: string;
  id?: string;
  retry?: string;
}

export interface AIChatProtocolTransformContext<
  TChunk = AIChatProtocolChunk,
  TMessage = AIChatProviderMessage,
  TState = unknown,
> {
  chunk: TChunk;
  chunks: TChunk[];
  originMessage?: TMessage;
  responseHeaders: Headers;
  state: TState;
  status: string;
}

export interface AIChatProtocol<
  TChunk = AIChatProtocolChunk,
  TMessage = AIChatProviderMessage,
  TState = unknown,
> {
  createState(): TState;
  name: AIChatProtocolName;
  resetState(state: TState): TState;
  transformMessage(
    context: AIChatProtocolTransformContext<TChunk, TMessage, TState>,
  ): TMessage;
}
