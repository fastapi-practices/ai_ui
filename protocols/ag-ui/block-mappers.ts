import type { InputContentSource } from '@ag-ui/core';

import type {
  AIChatAttachmentType,
  AIChatEventMessageBlock,
  AIChatFileMessageBlock,
} from '#/plugins/ai/types/message';

import {
  normalizeAIChatEventBlock,
  normalizeAIChatFileBlock,
  uniqueAIChatEventTypes,
} from '#/plugins/ai/runtime/message';

function buildAGUIDataUrl(
  data?: null | string,
  mimeType?: null | string,
  fallbackMimeType?: null | string,
) {
  if (typeof data !== 'string') {
    return null;
  }

  const resolvedMimeType = mimeType ?? fallbackMimeType;
  if (!resolvedMimeType) {
    return null;
  }

  return `data:${resolvedMimeType};base64,${data}`;
}

export const AGUI_SYSTEM_MESSAGE_EVENT_TYPE = 'SYSTEM_MESSAGE';
export const AGUI_DEVELOPER_MESSAGE_EVENT_TYPE = 'DEVELOPER_MESSAGE';

function normalizeAGUIVisualEventType(type: string) {
  switch (type) {
    case 'THINKING_END': {
      return 'REASONING_END';
    }
    case 'THINKING_START': {
      return 'REASONING_START';
    }
    case 'THINKING_TEXT_MESSAGE_CONTENT': {
      return 'REASONING_MESSAGE_CONTENT';
    }
    case 'THINKING_TEXT_MESSAGE_END': {
      return 'REASONING_MESSAGE_END';
    }
    case 'THINKING_TEXT_MESSAGE_START': {
      return 'REASONING_MESSAGE_START';
    }
    default: {
      return type;
    }
  }
}

function getAGUIEventTypes(
  type: string,
  extras?: string[],
) {
  const normalizedType = normalizeAGUIVisualEventType(type);
  return uniqueAIChatEventTypes(normalizedType, type, extras);
}

export function createAGUIEventBlock(params: {
  data?: unknown;
  eventKey: string;
  eventType: string;
  extraEventTypes?: string[];
  status?: AIChatEventMessageBlock['status'];
  summary?: string;
  text?: string;
  title: string;
}): AIChatEventMessageBlock {
  return normalizeAIChatEventBlock({
    data: params.data,
    event_key: params.eventKey,
    event_type: normalizeAGUIVisualEventType(params.eventType),
    event_types: getAGUIEventTypes(params.eventType, params.extraEventTypes),
    status: params.status,
    summary: params.summary,
    text: params.text,
    title: params.title,
    type: 'event',
  });
}

export function createAGUIInputSourceFileBlock(
  type: AIChatAttachmentType,
  source?: InputContentSource | null,
  name?: null | string,
  mimeType?: null | string,
): AIChatFileMessageBlock {
  const resolvedMimeType = mimeType ?? source?.mimeType ?? null;
  return normalizeAIChatFileBlock({
    file_type: type,
    mime_type: resolvedMimeType,
    name: name ?? null,
    source_type:
      source?.type === 'data' ? 'base64' : (source?.type === 'url' ? 'url' : null),
    type: 'file',
    url:
      source?.type === 'url'
        ? source.value
        : buildAGUIDataUrl(
            source?.type === 'data' ? source.value : null,
            resolvedMimeType,
            'application/octet-stream',
          ),
  });
}

export function createAGUIBinaryFileBlock(params: {
  data?: null | string;
  fileType?: AIChatAttachmentType | null;
  mimeType?: null | string;
  name?: null | string;
  url?: null | string;
  urlMimeTypeFallback?: null | string;
}): AIChatFileMessageBlock {
  return normalizeAIChatFileBlock({
    file_type: params.fileType ?? null,
    mime_type: params.mimeType ?? null,
    name: params.name ?? null,
    source_type:
      typeof params.data === 'string'
        ? 'base64'
        : (typeof params.url === 'string' ? 'url' : null),
    type: 'file',
    url:
      params.url ??
      buildAGUIDataUrl(
        params.data,
        params.mimeType,
        params.urlMimeTypeFallback,
      ),
  });
}
