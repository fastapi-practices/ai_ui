import type {
  ActionsProps,
  BubbleItemType,
  BubbleListProps,
  BubbleProps,
  FileCardProps,
  ThoughtChainItemType,
} from '@antdv-next/x';

import type { FunctionalComponent, VNodeArrayChildren, VNodeChild } from 'vue';

import type { AIChatProtocolDriver } from '#/plugins/ai/protocols';
import type { ChatMessageItem } from '#/plugins/ai/runtime/message';
import type {
  AIChatEventMessageBlock,
  AIChatFileMessageBlock,
} from '#/plugins/ai/runtime/message-types';

import { h } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Actions,
  CodeHighlighter,
  FileCardList,
  Mermaid,
  Sources,
  Think,
  ThoughtChain,
} from '@antdv-next/x';
import { XMarkdown } from '@antdv-next/x-markdown';
import { Avatar as AAvatar } from 'antdv-next';

import {
  getMessageEventBlocks,
  getMessageFileBlocks,
  getMessageTextContent,
  parseDateLabel,
} from '#/plugins/ai/runtime/message';

export interface CreateChatBubbleListRoleOptions {
  editingMessageIntent: 'resend' | 'save';
  isDark: boolean;
  isEditingMessage: (message: ChatMessageItem) => boolean;
  isThinkingExpanded: (message: ChatMessageItem) => boolean;
  onBeginEditMessage: (
    message: ChatMessageItem,
    intent: 'resend' | 'save',
  ) => void;
  onCancelEditMessage: () => void;
  onConfirmDeleteMessage: (message: ChatMessageItem) => void;
  onCopyMessage: (message: ChatMessageItem) => void;
  onRegenerateMessage: (message: ChatMessageItem) => void;
  onRegenerateUserMessage: (message: ChatMessageItem) => void;
  onResendEditedMessage: (content: string) => void;
  onSaveEditedMessage: (content: string) => void;
  protocolDriver: AIChatProtocolDriver;
  selectedModelLabel?: string;
  selectedModelId?: null | string;
  setThinkingExpanded: (message: ChatMessageItem, expanded: boolean) => void;
}

const MARKDOWN_STREAM_FALLBACK_COMPONENT = 'incomplete-markdown-fragment';
const THOUGHT_CHAIN_BOOTSTRAP_EVENT_TYPES = new Set([
  'REASONING_MESSAGE_START',
  'REASONING_START',
  'RUN_STARTED',
  'STEP_STARTED',
  'TEXT_MESSAGE_START',
  'THINKING_START',
  'THINKING_TEXT_MESSAGE_START',
]);

function getBubbleListMessage(item: BubbleItemType) {
  const message = item.extraInfo?.message;
  return message && typeof message === 'object'
    ? (message as ChatMessageItem)
    : undefined;
}

function extractMarkdownSlotText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractMarkdownSlotText(item)).join('');
  }

  if (value && typeof value === 'object' && 'children' in value) {
    return extractMarkdownSlotText((value as { children?: unknown }).children);
  }

  return '';
}

function decodeIncompleteMarkdownRaw(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getThinkingContent(message: ChatMessageItem) {
  return getMessageTextContent(message, 'reasoning');
}

function getThinkingToggleLabel(message: ChatMessageItem) {
  if (message.streaming) {
    return '思考中';
  }
  return '思考完成';
}

function getVisibleEventBlocks(
  message: ChatMessageItem,
  protocolDriver: AIChatProtocolDriver,
) {
  return getMessageEventBlocks(message).filter(
    (block) => !protocolDriver.shouldSuppressEventBlock(message, block),
  );
}

function getMessageDisplayName(
  message: ChatMessageItem,
  selectedModelId?: string,
  selectedModelLabel?: string,
) {
  if (message.role === 'user') {
    return '你';
  }

  return message.model_id || (selectedModelId ? selectedModelLabel : 'AI 助手');
}

function getMessageBubbleClasses(
  message: ChatMessageItem,
): BubbleProps['classes'] | undefined {
  const baseClasses = {
    body: 'min-w-0 max-w-full',
    content: 'max-w-full overflow-hidden',
    root: 'min-w-0 max-w-[calc(100%-16px)] md:max-w-[82%] xl:max-w-[76%]',
  };

  if (message.message_type !== 'error') {
    return baseClasses;
  }

  return {
    ...baseClasses,
    content: `${baseClasses.content} !border !border-destructive/20 !bg-destructive/6 !text-destructive !shadow-none`,
  };
}

function hasMeaningfulVisibleEventContent(
  message: ChatMessageItem,
  protocolDriver: AIChatProtocolDriver,
) {
  return getVisibleEventBlocks(message, protocolDriver).some(
    (block) => !THOUGHT_CHAIN_BOOTSTRAP_EVENT_TYPES.has(block.event_type),
  );
}

function isMessageBubbleLoading(
  message: ChatMessageItem,
  protocolDriver: AIChatProtocolDriver,
) {
  if (message.role !== 'assistant' || !message.streaming) {
    return false;
  }

  if (getThinkingContent(message).trim()) {
    return false;
  }

  if (getMessageTextContent(message, 'text').trim()) {
    return false;
  }

  if (getMessageFileBlocks(message).length > 0) {
    return false;
  }

  return !hasMeaningfulVisibleEventContent(message, protocolDriver);
}

function formatJsonCodeBlock(content: string) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function renderCodeBlock(content: string, language = 'text', isDark = false) {
  return h('div', { class: 'min-w-0 w-full max-w-full overflow-hidden' }, [
    h(CodeHighlighter, {
      class: 'min-w-0 w-full max-w-full',
      classes: {
        code: 'min-w-0 max-w-full',
        content: 'min-w-0 max-w-full',
        root: 'min-w-0 w-full max-w-full',
      },
      content,
      language,
      showThemeToggle: false,
      styles: {
        code: {
          flex: '1 1 0%',
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'auto',
        },
        content: {
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'auto',
        },
        root: {
          maxWidth: '100%',
          minWidth: 0,
          width: '100%',
        },
      },
      theme: isDark ? 'dark' : 'light',
    }),
  ]);
}

function renderMermaidBlock(content: string, isDark = false) {
  return h('div', { class: 'max-w-full overflow-x-auto' }, [
    h(Mermaid, {
      codeHighlighterProps: {
        showThemeToggle: false,
        theme: isDark ? 'dark' : 'light',
      },
      content,
    }),
  ]);
}

function createMarkdownContentRenderer(isDark = false) {
  const MarkdownPre: FunctionalComponent = (_, { slots }) => {
    return h(
      'div',
      { class: 'max-w-full overflow-x-auto' },
      (slots.default?.() as undefined | VNodeArrayChildren) ?? undefined,
    );
  };

  const IncompleteMarkdownFragment: FunctionalComponent = (_, { attrs }) => {
    const content = decodeIncompleteMarkdownRaw(attrs['data-raw']);
    if (!content) {
      return null;
    }

    return h(
      'span',
      {
        class: 'whitespace-pre-wrap break-words text-foreground/80',
      },
      content,
    );
  };

  const MarkdownCode: FunctionalComponent = (_, { attrs, slots }) => {
    const content = extractMarkdownSlotText(slots.default?.());
    const language = String(attrs['data-lang'] ?? 'text').toLowerCase();
    const isBlock = attrs['data-block'] === 'true';

    if (!isBlock) {
      return h(
        'code',
        {
          class:
            'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground',
        },
        slots.default?.() as undefined | VNodeArrayChildren,
      );
    }

    if (language === 'mermaid') {
      return renderMermaidBlock(content, isDark);
    }

    return renderCodeBlock(content, language, isDark);
  };

  return function MarkdownContent(props: {
    content?: string;
    streaming?: boolean;
  }) {
    return h(XMarkdown, {
      className: [
        isDark ? 'x-markdown-dark' : 'x-markdown-light',
        'min-w-0 max-w-full break-words',
      ].join(' '),
      components: {
        [MARKDOWN_STREAM_FALLBACK_COMPONENT]: IncompleteMarkdownFragment,
        code: MarkdownCode,
        pre: MarkdownPre,
      },
      config: {
        breaks: true,
        gfm: true,
      },
      content: props.content ?? '',
      openLinksInNewTab: true,
      ...(props.streaming
        ? {
            streaming: {
              enableAnimation: false,
              hasNextChunk: true,
              incompleteMarkdownComponentMap: {
                emphasis: MARKDOWN_STREAM_FALLBACK_COMPONENT,
                html: MARKDOWN_STREAM_FALLBACK_COMPONENT,
                image: MARKDOWN_STREAM_FALLBACK_COMPONENT,
                'inline-code': MARKDOWN_STREAM_FALLBACK_COMPONENT,
                link: MARKDOWN_STREAM_FALLBACK_COMPONENT,
                list: MARKDOWN_STREAM_FALLBACK_COMPONENT,
                table: MARKDOWN_STREAM_FALLBACK_COMPONENT,
              },
              tail: true,
            },
          }
        : {}),
    });
  };
}

function getFileTypeLabel(file: AIChatFileMessageBlock) {
  return [file.file_type || 'file', file.mime_type, file.source_type]
    .filter(Boolean)
    .join(' · ');
}

function isImageFile(file: AIChatFileMessageBlock) {
  return (
    file.file_type === 'image' ||
    file.mime_type?.startsWith('image/') ||
    /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/iu.test(file.url || file.name || '')
  );
}

function isAudioFile(file: AIChatFileMessageBlock) {
  return file.file_type === 'audio' || file.mime_type?.startsWith('audio/');
}

function isVideoFile(file: AIChatFileMessageBlock) {
  return file.file_type === 'video' || file.mime_type?.startsWith('video/');
}

function openExternalLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function getFileCardType(
  file: AIChatFileMessageBlock,
): NonNullable<FileCardProps['type']> {
  if (isImageFile(file)) {
    return 'image';
  }
  if (isAudioFile(file)) {
    return 'audio';
  }
  if (isVideoFile(file)) {
    return 'video';
  }
  return 'file';
}

function toMessageFileCard(
  message: ChatMessageItem,
  file: AIChatFileMessageBlock,
  index: number,
): FileCardProps {
  const title = file.name || file.url || '附件';
  const meta = getFileTypeLabel(file);
  const type = getFileCardType(file);
  const fileUrl = typeof file.url === 'string' ? file.url : undefined;

  return {
    audioProps:
      type === 'audio' ? { controls: true, preload: 'metadata' } : undefined,
    description: meta || undefined,
    imageProps: type === 'image' ? { preview: true } : undefined,
    key: `${message.id}-file-${index}`,
    name: title,
    onClick: fileUrl ? () => openExternalLink(fileUrl) : undefined,
    size: 'small',
    src: fileUrl && type !== 'file' ? fileUrl : undefined,
    type,
    videoProps:
      type === 'video' ? { controls: true, preload: 'metadata' } : undefined,
  };
}

function renderMessageFiles(
  message: ChatMessageItem,
  files: AIChatFileMessageBlock[],
) {
  if (files.length === 0) {
    return null;
  }

  return h('div', { key: `${message.id}-files`, class: 'max-w-full' }, [
    h(FileCardList, {
      items: files.map((file, index) =>
        toMessageFileCard(message, file, index),
      ),
      overflow: 'wrap',
      size: 'small',
    }),
  ]);
}

function renderEventText(params: {
  eventType: AIChatEventMessageBlock['event_type'];
  isDark: boolean;
  message: ChatMessageItem;
  protocolDriver: AIChatProtocolDriver;
  text: string;
}) {
  if (!params.text.trim()) {
    return null;
  }

  if (
    params.protocolDriver.shouldRenderEventTextAsCode(
      params.text,
      params.eventType,
    )
  ) {
    return renderCodeBlock(
      formatJsonCodeBlock(params.text),
      'json',
      params.isDark,
    );
  }

  const MarkdownContent = createMarkdownContentRenderer(params.isDark);
  return h(MarkdownContent, {
    content: params.text,
    streaming: Boolean(params.message.streaming),
  });
}

function renderEventContent(params: {
  block: AIChatEventMessageBlock;
  isDark: boolean;
  message: ChatMessageItem;
  protocolDriver: AIChatProtocolDriver;
}) {
  const detail = params.protocolDriver.buildEventPresentation(params.block);
  const sections = detail.sections
    .map((section) => {
      switch (section.kind) {
        case 'raw-payload': {
          if (!section.text || section.secondary) {
            return null;
          }

          return renderCodeBlock(
            section.text,
            section.language || 'json',
            params.isDark,
          );
        }
        case 'sources': {
          return section.items && section.items.length > 0
            ? h(Sources, {
                defaultExpanded: section.items.length <= 3,
                items: section.items,
                title: `来源 ${section.items.length}`,
              })
            : null;
        }
        case 'text': {
          return section.text
            ? renderEventText({
                eventType: params.block.event_type,
                isDark: params.isDark,
                message: params.message,
                protocolDriver: params.protocolDriver,
                text: section.text,
              })
            : null;
        }
        default: {
          return null;
        }
      }
    })
    .filter(Boolean);

  if (sections.length === 0) {
    return undefined;
  }

  if (sections.length === 1) {
    return sections[0];
  }

  return h('div', { class: 'space-y-3' }, sections);
}

function getMessageEventThoughtChainStatus(
  message: ChatMessageItem,
  block: AIChatEventMessageBlock,
  protocolDriver: AIChatProtocolDriver,
) {
  const status = protocolDriver.getThoughtChainStatus(block.status);

  if (status) {
    return status;
  }

  if (message.streaming) {
    return 'loading';
  }

  if (block.status === 'info') {
    return 'success';
  }

  return undefined;
}

function buildMessageEventThoughtChainItem(params: {
  block: AIChatEventMessageBlock;
  index: number;
  isDark: boolean;
  message: ChatMessageItem;
  protocolDriver: AIChatProtocolDriver;
}) {
  const key = `${params.message.id}-event-${params.block.event_key}-${params.index}`;
  const detail = params.protocolDriver.buildEventPresentation(params.block);
  const content = renderEventContent({
    block: params.block,
    isDark: params.isDark,
    message: params.message,
    protocolDriver: params.protocolDriver,
  });
  const status = getMessageEventThoughtChainStatus(
    params.message,
    params.block,
    params.protocolDriver,
  );

  return {
    defaultExpanded: Boolean(
      content && (detail.hasOnlySources || detail.showRawPayloadByDefault),
    ),
    item: {
      blink: Boolean(params.message.streaming && status === 'loading'),
      collapsible: Boolean(content),
      content,
      description: detail.description,
      key,
      status,
      title: detail.title,
    } satisfies ThoughtChainItemType,
  };
}

function renderMessageEvents(params: {
  events: AIChatEventMessageBlock[];
  isDark: boolean;
  message: ChatMessageItem;
  protocolDriver: AIChatProtocolDriver;
}) {
  if (params.events.length === 0) {
    return null;
  }

  const itemInfos = params.events.map((block, index) =>
    buildMessageEventThoughtChainItem({
      block,
      index,
      isDark: params.isDark,
      message: params.message,
      protocolDriver: params.protocolDriver,
    }),
  );
  const items = itemInfos.map(({ item }) => item);

  return h(
    Think,
    {
      defaultExpanded: Boolean(params.message.streaming),
      key: `${params.message.id}-events-${params.message.streaming ? 'streaming' : 'done'}`,
      loading: Boolean(params.message.streaming),
      title: params.message.streaming ? '执行轨迹生成中' : '执行轨迹',
    },
    () =>
      h(ThoughtChain, {
        class: [
          'min-w-0 w-full max-w-full',
          '[&_.antd-thought-chain-node]:min-w-0',
          '[&_.antd-thought-chain-node]:w-full',
          '[&_.antd-thought-chain-node]:max-w-full',
          '[&_.antd-thought-chain-node-box]:min-w-0',
          '[&_.antd-thought-chain-node-box]:max-w-full',
          '[&_.antd-thought-chain-node-box]:flex-1',
          '[&_.antd-thought-chain-node-header]:min-w-0',
          '[&_.antd-thought-chain-node-header]:max-w-full',
          '[&_.antd-thought-chain-node-title]:min-w-0',
          '[&_.antd-thought-chain-node-title]:max-w-full',
          '[&_.antd-thought-chain-node-content]:min-w-0',
          '[&_.antd-thought-chain-node-content]:w-full',
          '[&_.antd-thought-chain-node-content]:max-w-full',
          '[&_.antd-thought-chain-node-content-box]:min-w-0',
          '[&_.antd-thought-chain-node-content-box]:w-full',
          '[&_.antd-thought-chain-node-content-box]:max-w-full',
          '[&_.antd-thought-chain-node-content-box]:overflow-hidden',
          '[&_.antd-code-highlighter]:min-w-0',
          '[&_.antd-code-highlighter]:w-full',
          '[&_.antd-code-highlighter]:max-w-full',
          '[&_.antd-code-highlighter-content]:min-w-0',
          '[&_.antd-code-highlighter-content]:max-w-full',
          '[&_.antd-code-highlighter-content]:overflow-auto',
          '[&_.antd-code-highlighter-code]:min-w-0',
          '[&_.antd-code-highlighter-code]:max-w-full',
          '[&_.antd-code-highlighter-code]:overflow-auto',
          '[&_.antd-code-highlighter-code>pre]:max-w-full',
          '[&_.antd-code-highlighter-code>pre]:overflow-auto',
        ].join(' '),
        classes: {
          item: 'min-w-0 w-full max-w-full',
          itemContent: 'min-w-0 max-w-full',
          itemFooter: 'min-w-0 max-w-full',
          itemHeader: 'min-w-0 max-w-full',
          root: 'min-w-0 w-full max-w-full',
        },
        defaultExpandedKeys: itemInfos
          .filter(({ defaultExpanded }) => defaultExpanded)
          .map(({ item }) => item.key)
          .filter(Boolean),
        items,
        line: params.events.length > 1 ? 'dashed' : false,
        styles: {
          item: {
            maxWidth: '100%',
            minWidth: 0,
            width: '100%',
          },
          itemContent: {
            maxWidth: '100%',
            minWidth: 0,
            width: '100%',
          },
          itemFooter: {
            maxWidth: '100%',
            minWidth: 0,
          },
          itemHeader: {
            maxWidth: '100%',
            minWidth: 0,
          },
          root: {
            maxWidth: '100%',
            minWidth: 0,
            width: '100%',
          },
        },
      }),
  );
}

export function renderChatMessageBubbleContent(
  message: ChatMessageItem,
  options: Pick<
    CreateChatBubbleListRoleOptions,
    'isDark' | 'isThinkingExpanded' | 'protocolDriver' | 'setThinkingExpanded'
  >,
): VNodeChild {
  const MarkdownContent = createMarkdownContentRenderer(options.isDark);
  const reasoningText = getThinkingContent(message);
  const text = getMessageTextContent(message, 'text');
  const events = getVisibleEventBlocks(message, options.protocolDriver);
  const files = getMessageFileBlocks(message);

  if (message.message_type === 'error') {
    return h('div', { class: 'min-w-0 max-w-full space-y-2' }, [
      h(
        'div',
        {
          class:
            'text-sm leading-6 whitespace-pre-wrap break-words text-destructive',
        },
        text || '生成失败',
      ),
      message.conversation_id
        ? h(
            'div',
            {
              class:
                'border-t border-destructive/20 pt-2 text-xs leading-5 whitespace-pre-wrap break-all text-destructive/80',
            },
            ['对话 ID: ', message.conversation_id],
          )
        : null,
      events.length > 0
        ? h('div', { class: 'border-t border-destructive/15 pt-3' }, [
            renderMessageEvents({
              events,
              isDark: options.isDark,
              message,
              protocolDriver: options.protocolDriver,
            }),
          ])
        : null,
    ]);
  }

  return h(
    'div',
    { class: 'min-w-0 max-w-full space-y-3' },
    [
      reasoningText
        ? h(
            Think,
            {
              blink: Boolean(message.streaming),
              expanded: options.isThinkingExpanded(message),
              loading: Boolean(message.streaming),
              title: getThinkingToggleLabel(message),
              'onUpdate:expanded': (expanded: boolean) => {
                options.setThinkingExpanded(message, expanded);
              },
            },
            () =>
              h(MarkdownContent, {
                content: reasoningText,
                streaming: Boolean(message.streaming),
              }),
          )
        : null,
      events.length > 0
        ? h(
            'div',
            {
              class: [
                'min-w-0 max-w-full',
                reasoningText ? 'border-t border-border/60' : '',
              ],
            },
            [
              renderMessageEvents({
                events,
                isDark: options.isDark,
                message,
                protocolDriver: options.protocolDriver,
              }),
            ],
          )
        : null,
      text
        ? h(MarkdownContent, {
            content: text,
            streaming: Boolean(message.streaming),
          })
        : null,
      renderMessageFiles(message, files),
    ].filter(Boolean),
  );
}

function renderMessageHeader(
  message: ChatMessageItem,
  selectedModelId?: string,
  selectedModelLabel?: string,
) {
  return h(
    'div',
    {
      class: [
        'mb-1.5 text-xs text-muted-foreground',
        message.role === 'user' ? 'text-right' : 'text-left',
      ],
    },
    h('div', undefined, [
      getMessageDisplayName(message, selectedModelId, selectedModelLabel),
      ' · ',
      parseDateLabel(message.created_time),
    ]),
  );
}

function renderMessageAvatar(message: ChatMessageItem): BubbleProps['avatar'] {
  return h(AAvatar, undefined, () => (message.role === 'user' ? '你' : 'AI'));
}

function getMessageActionItems(
  message: ChatMessageItem,
  options: Pick<
    CreateChatBubbleListRoleOptions,
    | 'onBeginEditMessage'
    | 'onConfirmDeleteMessage'
    | 'onCopyMessage'
    | 'onRegenerateMessage'
    | 'onRegenerateUserMessage'
  >,
): ActionsProps['items'] {
  const items: ActionsProps['items'] = [
    {
      icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:content-copy' }),
      key: 'copy',
      label: '复制',
      onItemClick: () => options.onCopyMessage(message),
    },
  ];

  if (message.role === 'user') {
    items.push(
      {
        icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:refresh' }),
        key: 'regenerate',
        label: '重新生成',
        onItemClick: () => options.onRegenerateUserMessage(message),
      },
      {
        icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:pencil-outline' }),
        key: 'edit',
        label: '编辑保存',
        onItemClick: () => options.onBeginEditMessage(message, 'save'),
      },
      {
        icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:send-outline' }),
        key: 'edit-resend',
        label: '编辑重发',
        onItemClick: () => options.onBeginEditMessage(message, 'resend'),
      },
    );
  }

  if (message.role === 'assistant') {
    items.push({
      icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:refresh' }),
      key: 'retry',
      label: '重新生成',
      onItemClick: () => options.onRegenerateMessage(message),
    });
  }

  items.push({
    danger: true,
    icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:delete-outline' }),
    key: 'delete',
    label: '删除消息',
    onItemClick: () => options.onConfirmDeleteMessage(message),
  });

  return items;
}

function renderMessageFooter(
  message: ChatMessageItem,
  options: Pick<
    CreateChatBubbleListRoleOptions,
    | 'onBeginEditMessage'
    | 'onConfirmDeleteMessage'
    | 'onCopyMessage'
    | 'onRegenerateMessage'
    | 'onRegenerateUserMessage'
  >,
) {
  return h(Actions, {
    fadeIn: true,
    items: getMessageActionItems(message, options),
  });
}

export function createChatBubbleListRole(
  options: CreateChatBubbleListRoleOptions,
): BubbleListProps['role'] {
  return {
    assistant: (item) => {
      const message = getBubbleListMessage(item);
      if (!message) {
        return {
          class: 'mb-3.5',
          placement: 'start',
        };
      }

      return {
        avatar: renderMessageAvatar(message),
        class: 'mb-3.5',
        classes: getMessageBubbleClasses(message),
        editable: false,
        footer: renderMessageFooter(message, options),
        footerPlacement: 'outer-start',
        header: renderMessageHeader(
          message,
          options.selectedModelId ?? undefined,
          options.selectedModelLabel,
        ),
        loading: isMessageBubbleLoading(message, options.protocolDriver),
        placement: 'start',
      };
    },
    divider: {
      class: 'mb-3.5 w-full',
    },
    user: (item) => {
      const message = getBubbleListMessage(item);
      if (!message) {
        return {
          class: 'mb-3.5',
          placement: 'end',
        };
      }

      return {
        avatar: renderMessageAvatar(message),
        class: 'mb-3.5',
        classes: getMessageBubbleClasses(message),
        editable: options.isEditingMessage(message)
          ? {
              cancelText: '取消',
              editing: true,
              okText:
                options.editingMessageIntent === 'resend' ? '重发' : '保存',
            }
          : false,
        footer: renderMessageFooter(message, options),
        footerPlacement: 'outer-end',
        header: renderMessageHeader(message),
        loading: isMessageBubbleLoading(message, options.protocolDriver),
        onEditCancel: options.onCancelEditMessage,
        onEditConfirm: (value) =>
          options.editingMessageIntent === 'resend'
            ? options.onResendEditedMessage(String(value))
            : options.onSaveEditedMessage(String(value)),
        placement: 'end',
      };
    },
  };
}
