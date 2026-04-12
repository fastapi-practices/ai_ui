import type { SourcesProps, ThoughtChainItemType } from '@antdv-next/x';

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
import type { AIChatEventMessageBlock } from '../runtime/message-types';
import type {
  AIChatProtocol,
  AIChatProtocolChunk,
  AIChatProtocolName,
} from './types';

import { createAGUIProtocolDriver } from './ag-ui';
import {
  AG_UI_AI_CHAT_PROTOCOL_NAME,
  AI_CHAT_PROTOCOL_NAMES,
} from './types';

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

export type AIChatProtocolThoughtChainStatus = ThoughtChainItemType['status'];

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
  getThoughtChainStatus(
    status?: AIChatEventMessageBlock['status'],
  ): AIChatProtocolThoughtChainStatus | undefined;
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

export function listAIChatProtocolNames(): AIChatProtocolName[] {
  return [...AI_CHAT_PROTOCOL_NAMES];
}
