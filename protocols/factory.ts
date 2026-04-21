import type { SourcesProps } from '@antdv-next/x';

import type {
  AIChatCompletionParams,
  AIChatConversationDetail,
  AIChatConversationDetailResult,
  BuildChatCompletionRequestInput,
} from '../api/chat';
import type {
  AIChatProviderMessage,
  ChatMessageItem,
} from '../runtime/message';
import type { AIChatEventMessageBlock } from '../types/message';

import { createAGUIProtocolDriver } from './ag-ui';

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

export interface AIChatProtocolEventPresentationSection {
  items?: NonNullable<SourcesProps['items']>;
  kind: 'raw-payload' | 'sources' | 'text';
  language?: string;
  secondary?: boolean;
  text?: string;
}

export interface AIChatProtocolEventPresentationResult {
  description?: string;
  hasOnlySources: boolean;
  isSearchEvent: boolean;
  sections: AIChatProtocolEventPresentationSection[];
  showRawPayloadByDefault: boolean;
  title?: string;
}

export interface AIChatProtocolDriver {
  buildEventPresentation(
    block: AIChatEventMessageBlock,
  ): AIChatProtocolEventPresentationResult;
  buildChatCompletionRequest(
    input: BuildChatCompletionRequestInput,
    forwardedProps: AIChatCompletionParams['forwardedProps'],
  ): AIChatCompletionParams;
  createRuntimeProtocol(): AIChatProtocol<
    AIChatProtocolChunk,
    AIChatProviderMessage
  >;
  name: AIChatProtocolName;
  normalizeConversationDetail(
    detail: AIChatConversationDetailResult,
  ): AIChatConversationDetail;
  shouldRenderEventTextAsCode(
    text: string,
    eventType: AIChatEventMessageBlock['event_type'],
  ): boolean;
  shouldSuppressEventBlock(
    message: ChatMessageItem,
    block: AIChatEventMessageBlock,
  ): boolean;
}

const AI_CHAT_PROTOCOL_DRIVER_FACTORIES: Record<
  AIChatProtocolName,
  () => AIChatProtocolDriver
> = {
  [AG_UI_AI_CHAT_PROTOCOL_NAME]: createAGUIProtocolDriver,
};

const driverCache = new Map<AIChatProtocolName, AIChatProtocolDriver>();

export const DEFAULT_AI_CHAT_PROTOCOL_NAME: AIChatProtocolName =
  AG_UI_AI_CHAT_PROTOCOL_NAME;

export function createAIChatProtocolDriver(
  name: AIChatProtocolName = DEFAULT_AI_CHAT_PROTOCOL_NAME,
): AIChatProtocolDriver {
  const cached = driverCache.get(name);
  if (cached) {
    return cached;
  }

  const factory = AI_CHAT_PROTOCOL_DRIVER_FACTORIES[name];

  if (!factory) {
    throw new Error(`Unsupported AI chat protocol: ${name}`);
  }

  const driver = factory();
  driverCache.set(name, driver);
  return driver;
}

export function createAIChatProtocol(
  name: AIChatProtocolName = DEFAULT_AI_CHAT_PROTOCOL_NAME,
): AIChatProtocol<AIChatProtocolChunk, AIChatProviderMessage> {
  return createAIChatProtocolDriver(name).createRuntimeProtocol();
}

export function buildAIChatCompletionRequest(
  input: BuildChatCompletionRequestInput,
  forwardedProps: AIChatCompletionParams['forwardedProps'],
  name: AIChatProtocolName = DEFAULT_AI_CHAT_PROTOCOL_NAME,
): AIChatCompletionParams {
  return createAIChatProtocolDriver(name).buildChatCompletionRequest(
    input,
    forwardedProps,
  );
}

export function normalizeAIChatConversationDetail(
  detail: AIChatConversationDetailResult,
  name: AIChatProtocolName = DEFAULT_AI_CHAT_PROTOCOL_NAME,
): AIChatConversationDetail {
  return createAIChatProtocolDriver(name).normalizeConversationDetail(detail);
}
