import type { SourcesProps } from '@antdv-next/x';

import type { ChatMessageItem } from '#/plugins/ai/runtime/message';
import type { AIChatEventMessageBlock } from '#/plugins/ai/runtime/message-types';

import {
  getMessageTextContent,
} from '#/plugins/ai/runtime/message';

const TEXT_MESSAGE_EVENT_TYPES = new Set([
  'TEXT_MESSAGE_CHUNK',
  'TEXT_MESSAGE_CONTENT',
  'TEXT_MESSAGE_END',
  'TEXT_MESSAGE_START',
]);

const REASONING_EVENT_TYPES = new Set([
  'REASONING_END',
  'REASONING_MESSAGE_CHUNK',
  'REASONING_MESSAGE_CONTENT',
  'REASONING_MESSAGE_END',
  'REASONING_MESSAGE_START',
  'REASONING_START',
  'THINKING_END',
  'THINKING_START',
  'THINKING_TEXT_MESSAGE_CONTENT',
  'THINKING_TEXT_MESSAGE_END',
  'THINKING_TEXT_MESSAGE_START',
]);

export interface AGUIEventPresentationSection {
  items?: NonNullable<SourcesProps['items']>;
  kind: 'raw-payload' | 'sources' | 'text';
  language?: string;
  secondary?: boolean;
  text?: string;
}

export interface AGUIEventPresentationResult {
  description?: string;
  hasOnlySources: boolean;
  isSearchEvent: boolean;
  sections: AGUIEventPresentationSection[];
  showRawPayloadByDefault: boolean;
  title?: string;
}

function formatEventData(value: unknown) {
  if (value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function shouldRenderAGUIEventTextAsCode(
  text: string,
  eventType: AIChatEventMessageBlock['event_type'],
) {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('{') ||
    normalized.startsWith('[') ||
    normalized.startsWith('eyJ') ||
    normalized.includes('":') ||
    normalized.includes('","') ||
    eventType === 'REASONING_ENCRYPTED_VALUE' ||
    eventType === 'TOOL_CALL_ARGS'
  );
}

function isExternalUrl(value: string) {
  return /^https?:\/\//iu.test(value.trim());
}

function extractSourceItems(
  value: unknown,
  items: NonNullable<SourcesProps['items']>,
  seen: Set<string>,
  depth = 0,
) {
  if (depth > 3 || items.length >= 8 || value === null || value === undefined) {
    return;
  }

  if (typeof value === 'string') {
    const url = value.trim();
    if (!isExternalUrl(url) || seen.has(url)) {
      return;
    }
    seen.add(url);
    items.push({
      key: url,
      title: url,
      url,
    });
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractSourceItems(item, items, seen, depth + 1);
      if (items.length >= 8) {
        break;
      }
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  const candidateUrl =
    (typeof record.url === 'string' && record.url) ||
    (typeof record.sourceUrl === 'string' && record.sourceUrl) ||
    (typeof record.link === 'string' && record.link);

  if (candidateUrl && isExternalUrl(candidateUrl) && !seen.has(candidateUrl)) {
    seen.add(candidateUrl);
    items.push({
      description:
        typeof record.description === 'string'
          ? record.description
          : (typeof record.snippet === 'string'
            ? record.snippet
            : undefined),
      key: candidateUrl,
      title:
        (typeof record.title === 'string' && record.title) ||
        (typeof record.label === 'string' && record.label) ||
        (typeof record.name === 'string' && record.name) ||
        candidateUrl,
      url: candidateUrl,
    });
  }

  for (const nested of Object.values(record)) {
    extractSourceItems(nested, items, seen, depth + 1);
    if (items.length >= 8) {
      break;
    }
  }
}

function getEventSourceItems(
  data: unknown,
): NonNullable<SourcesProps['items']> {
  const items: NonNullable<SourcesProps['items']> = [];
  extractSourceItems(data, items, new Set<string>());
  return items;
}

function getEventDataRecord(block: AIChatEventMessageBlock) {
  return block.data && typeof block.data === 'object'
    ? (block.data as Record<string, unknown>)
    : undefined;
}

function getEventDataString(
  block: AIChatEventMessageBlock,
  ...keys: string[]
) {
  const record = getEventDataRecord(block);
  for (const key of keys) {
    if (typeof record?.[key] === 'string') {
      return record[key];
    }
  }

  return undefined;
}

function formatEventName(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.replaceAll(/[_-]+/gu, ' ').replaceAll(/\s+/gu, ' ').trim();
}

function isSearchLikeEvent(
  block: AIChatEventMessageBlock,
  sourceItems: NonNullable<SourcesProps['items']>,
) {
  if (sourceItems.length > 0) {
    return true;
  }

  const searchText = [block.title, block.summary, block.event_type]
    .join(' ')
    .toLowerCase();
  return (
    searchText.includes('search') ||
    searchText.includes('source') ||
    searchText.includes('搜索') ||
    searchText.includes('来源')
  );
}

interface EventDisplayContext {
  activityType?: string;
  block: AIChatEventMessageBlock;
  stepName?: string;
  toolName?: string;
}

type DisplayTextFn = (ctx: EventDisplayContext) => string | undefined;

interface EventDisplayMeta {
  description: DisplayTextFn | string;
  title: DisplayTextFn | string;
}

const EVENT_DISPLAY_META: Record<string, EventDisplayMeta> = {
  ACTIVITY_DELTA: {
    description: (ctx) => ctx.activityType ? `${ctx.activityType} 正在更新` : ctx.block.summary || '活动更新中',
    title: (ctx) => ctx.activityType ? `活动更新 · ${ctx.activityType}` : '活动更新',
  },
  ACTIVITY_SNAPSHOT: {
    description: (ctx) => ctx.activityType ? `${ctx.activityType} 已同步` : ctx.block.summary || '活动内容已同步',
    title: (ctx) => ctx.activityType ? `活动快照 · ${ctx.activityType}` : '活动快照',
  },
  MESSAGES_SNAPSHOT: {
    description: (ctx) => ctx.block.summary || '已同步历史消息',
    title: '同步历史消息',
  },
  REASONING_ENCRYPTED_VALUE: {
    description: '部分内容受保护，无法直接展示',
    title: '受保护内容',
  },
  REASONING_END: { description: '思考阶段结束', title: '思考完成' },
  REASONING_MESSAGE_CHUNK: { description: '思考内容持续生成中', title: '思考中' },
  REASONING_MESSAGE_CONTENT: { description: '思考内容持续生成中', title: '思考中' },
  REASONING_MESSAGE_END: { description: '思考阶段结束', title: '思考完成' },
  REASONING_MESSAGE_START: { description: '准备输出思考片段', title: '展开思考' },
  REASONING_START: { description: '模型开始内部思考', title: '开始思考' },
  RUN_ERROR: {
    description: (ctx) => ctx.block.text?.trim() || ctx.block.summary || '运行过程中出现错误',
    title: '生成失败',
  },
  RUN_FINISHED: { description: '本轮回复已结束', title: '生成完成' },
  RUN_STARTED: { description: '正在准备本轮回复', title: '开始生成' },
  STATE_DELTA: {
    description: (ctx) => ctx.block.summary || '状态发生变化',
    title: '更新状态',
  },
  STATE_SNAPSHOT: { description: '已同步最新状态', title: '同步状态' },
  STEP_FINISHED: {
    description: (ctx) => ctx.stepName ? `${ctx.stepName} 已完成` : '执行完成',
    title: (ctx) => ctx.stepName ? `步骤完成 · ${ctx.stepName}` : '步骤完成',
  },
  STEP_STARTED: {
    description: (ctx) => ctx.stepName ? `进入 ${ctx.stepName}` : '开始执行',
    title: (ctx) => ctx.stepName ? `执行步骤 · ${ctx.stepName}` : '执行步骤',
  },
  TEXT_MESSAGE_CHUNK: { description: '回复内容持续生成中', title: '输出回复' },
  TEXT_MESSAGE_CONTENT: { description: '回复内容持续生成中', title: '输出回复' },
  TEXT_MESSAGE_END: { description: '回复内容生成完成', title: '回复完成' },
  TEXT_MESSAGE_START: { description: '准备输出内容', title: '开始输出回复' },
  THINKING_END: { description: '思考阶段结束', title: '思考完成' },
  THINKING_START: { description: '模型开始内部思考', title: '开始思考' },
  THINKING_TEXT_MESSAGE_CONTENT: { description: '思考内容持续生成中', title: '思考中' },
  THINKING_TEXT_MESSAGE_END: { description: '思考阶段结束', title: '思考完成' },
  THINKING_TEXT_MESSAGE_START: { description: '准备输出思考片段', title: '展开思考' },
  TOOL_CALL_ARGS: {
    description: (ctx) => ctx.toolName ? `${ctx.toolName} 参数生成中` : '正在构建工具参数',
    title: (ctx) => ctx.toolName ? `工具输入 · ${ctx.toolName}` : '工具输入',
  },
  TOOL_CALL_END: {
    description: (ctx) => ctx.toolName ? `${ctx.toolName} 已结束` : '工具执行结束',
    title: (ctx) => ctx.toolName ? `工具完成 · ${ctx.toolName}` : '工具完成',
  },
  TOOL_CALL_RESULT: {
    description: (ctx) => ctx.toolName ? `${ctx.toolName} 已返回结果` : '工具结果已返回',
    title: (ctx) => ctx.toolName ? `工具结果 · ${ctx.toolName}` : '工具结果',
  },
  TOOL_CALL_START: {
    description: (ctx) => ctx.toolName ? `${ctx.toolName} 已发起` : '工具开始执行',
    title: (ctx) => ctx.toolName ? `调用工具 · ${ctx.toolName}` : '调用工具',
  },
};

function resolveDisplayText(
  value: DisplayTextFn | string | undefined,
  ctx: EventDisplayContext,
): string | undefined {
  if (typeof value === 'function') {
    return value(ctx);
  }
  return value;
}

function getEventDisplay(
  block: AIChatEventMessageBlock,
  sourceItems: NonNullable<SourcesProps['items']>,
) {
  const toolName = formatEventName(getEventDataString(block, 'toolCallName'));
  const stepName = formatEventName(getEventDataString(block, 'stepName'));
  const activityType = formatEventName(getEventDataString(block, 'activityType'));
  const ctx: EventDisplayContext = { activityType, block, stepName, toolName };

  if (sourceItems.length > 0) {
    return {
      description: sourceItems.length > 1
        ? `找到 ${sourceItems.length} 个来源`
        : '找到 1 个来源',
      title: '联网搜索',
    };
  }

  const meta = EVENT_DISPLAY_META[block.event_type];
  if (meta) {
    return {
      description: resolveDisplayText(meta.description, ctx),
      title: resolveDisplayText(meta.title, ctx),
    };
  }

  const summaryTitle = block.summary?.trim();
  if (summaryTitle && !toolName && !stepName && !activityType) {
    return { description: block.summary, title: summaryTitle };
  }

  return {
    description: block.summary || undefined,
    title: block.title || block.summary || block.event_type,
  };
}

function shouldHideEventPayload(
  block: AIChatEventMessageBlock,
  sourceItems: NonNullable<SourcesProps['items']>,
) {
  if (sourceItems.length === 0) {
    return false;
  }

  return (
    block.event_type === 'TOOL_CALL_RESULT' ||
    block.event_type === 'ACTIVITY_SNAPSHOT' ||
    block.event_type === 'MESSAGES_SNAPSHOT'
  );
}

function shouldHideEventText(
  block: AIChatEventMessageBlock,
  sourceItems: NonNullable<SourcesProps['items']>,
) {
  if (sourceItems.length === 0 || !block.text?.trim()) {
    return false;
  }

  return shouldRenderAGUIEventTextAsCode(block.text, block.event_type);
}

export function buildAGUIEventPresentation(
  block: AIChatEventMessageBlock,
): AGUIEventPresentationResult {
  const sourceItems = getEventSourceItems(block.data);
  const isSearchEvent = isSearchLikeEvent(block, sourceItems);
  const formattedPayload = formatEventData(block.data);
  const textSection: AGUIEventPresentationSection | null =
    !shouldHideEventText(block, sourceItems) && block.text?.trim()
      ? {
          kind: 'text',
          text: block.text.trim(),
        }
      : null;
  const sourceSection: AGUIEventPresentationSection | null =
    sourceItems.length > 0
      ? {
          items: sourceItems,
          kind: 'sources',
        }
      : null;
  const rawPayloadAllowed =
    !shouldHideEventPayload(block, sourceItems) && Boolean(formattedPayload);
  const showRawPayloadByDefault =
    rawPayloadAllowed &&
    !textSection &&
    !sourceSection &&
    !block.summary?.trim() &&
    !block.title?.trim();
  const rawPayloadSection: AGUIEventPresentationSection | null = rawPayloadAllowed
    ? {
        kind: 'raw-payload',
        language: 'json',
        secondary: !showRawPayloadByDefault,
        text: formattedPayload,
      }
    : null;
  const orderedSections: Array<AGUIEventPresentationSection | null> = isSearchEvent
    ? [sourceSection, textSection, rawPayloadSection]
    : [textSection, sourceSection, rawPayloadSection];

  const display = getEventDisplay(block, sourceItems);

  return {
    description: display.description,
    hasOnlySources: Boolean(
      sourceSection && !textSection && !rawPayloadSection,
    ),
    isSearchEvent,
    sections: orderedSections.filter(
      (section): section is AGUIEventPresentationSection => section !== null,
    ),
    showRawPayloadByDefault,
    title: display.title,
  };
}

export function shouldSuppressAGUIEventBlock(
  message: ChatMessageItem,
  block: AIChatEventMessageBlock,
) {
  const eventType = block.event_type;
  const hasMainText = Boolean(getMessageTextContent(message, 'text').trim());
  const hasReasoning = Boolean(
    getMessageTextContent(message, 'reasoning').trim(),
  );

  if (hasMainText && TEXT_MESSAGE_EVENT_TYPES.has(eventType)) {
    return true;
  }

  if (hasReasoning && REASONING_EVENT_TYPES.has(eventType)) {
    return true;
  }

  return false;
}
