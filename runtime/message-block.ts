import type {
  AIChatEventMessageBlock,
  AIChatFileMessageBlock,
  AIChatMessageBlock,
  AIChatReasoningMessageBlock,
  AIChatTextMessageBlock,
} from './message-types';

export function uniqueAIChatEventTypes(
  ...values: Array<Array<null | string | undefined> | null | string | undefined>
) {
  const result: string[] = [];

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && !result.includes(item)) {
          result.push(item);
        }
      }
      continue;
    }

    if (value && !result.includes(value)) {
      result.push(value);
    }
  }

  return result;
}

export function normalizeAIChatEventBlock(
  block: AIChatEventMessageBlock,
): AIChatEventMessageBlock {
  return {
    data: block.data,
    event_key: block.event_key,
    event_type: block.event_type,
    event_types: uniqueAIChatEventTypes(block.event_types ?? [], block.event_type),
    status: block.status ?? 'info',
    summary: block.summary ?? '',
    text: block.text ?? '',
    title: block.title,
    type: 'event',
  };
}

export function normalizeAIChatFileBlock(
  block: AIChatFileMessageBlock,
): AIChatFileMessageBlock {
  return {
    file_type: block.file_type ?? null,
    mime_type: block.mime_type ?? null,
    name: block.name ?? null,
    source_type: block.source_type ?? null,
    type: 'file',
    url: block.url ?? null,
  };
}

export function normalizeAIChatTextLikeBlock<
  T extends AIChatReasoningMessageBlock | AIChatTextMessageBlock,
>(block: T): T {
  return {
    text: block.text ?? '',
    type: block.type,
  } as T;
}

export function normalizeAIChatMessageBlock(
  block: AIChatMessageBlock,
): AIChatMessageBlock {
  if (block.type === 'event') {
    return normalizeAIChatEventBlock(block);
  }

  if (block.type === 'file') {
    return normalizeAIChatFileBlock(block);
  }

  return normalizeAIChatTextLikeBlock(block);
}
