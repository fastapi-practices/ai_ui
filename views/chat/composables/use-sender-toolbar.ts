import type { SenderProps } from '@antdv-next/x';

import type { Ref } from 'vue';

import type {
  AIChatComposerParams,
  AIMcpResult,
  AIQuickPhraseResult,
} from '#/plugins/ai/api';

import { h, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button as AButton,
  Empty as AEmpty,
  Flex as AFlex,
  Spin as ASpin,
} from 'antdv-next';
import { Popover } from 'antdv-next';

import { getAllAIQuickPhraseApi } from '#/plugins/ai/api';

export interface UseSenderToolbarOptions {
  activeConversationId: Ref<string>;
  canClearMessages: Ref<boolean>;
  canCreateNewConversation: Ref<boolean>;
  composerHint: Ref<string>;
  confirmClearConversationContext: () => void;
  confirmClearMessages: () => void;
  createNewConversation: () => void;
  enableBuiltinTools: Ref<boolean>;
  generationType: Ref<string>;
  generationTypeButtonLabel: Ref<string>;
  GENERATION_TYPE_OPTIONS: Array<{
    desc: string;
    label: string;
    value: string;
  }>;
  hasAdvancedSettings: Ref<boolean>;
  mcps: Ref<AIMcpResult[]>;
  onOpenSettings: () => void;
  prompt: Ref<string>;
  selectedMcpIds: Ref<number[]>;
  selectedModelId: Ref<string | undefined>;
  selectedProviderId: Ref<number | undefined>;
  sending: Ref<boolean>;
  thinking: Ref<AIChatComposerParams['thinking']>;
  thinkingButtonLabel: Ref<string>;
  THINKING_OPTIONS: Array<{
    desc: string;
    key: string;
    label: string;
    value: AIChatComposerParams['thinking'];
  }>;
  webSearch: Ref<string>;
  webSearchButtonLabel: Ref<string>;
  WEB_SEARCH_OPTIONS: Array<{ desc: string; label: string; value: string }>;
}

export function useSenderToolbar(options: UseSenderToolbarOptions) {
  const {
    canClearMessages,
    canCreateNewConversation,
    composerHint,
    confirmClearConversationContext,
    confirmClearMessages,
    createNewConversation,
    generationType,
    generationTypeButtonLabel,
    GENERATION_TYPE_OPTIONS,
    hasAdvancedSettings,
    mcps,
    onOpenSettings,
    prompt,
    selectedMcpIds,
    selectedModelId,
    selectedProviderId,
    sending,
    thinking,
    thinkingButtonLabel,
    THINKING_OPTIONS,
    webSearch,
    webSearchButtonLabel,
    WEB_SEARCH_OPTIONS,
    activeConversationId,
  } = options;

  const quickPhrasePopoverOpen = ref(false);
  const quickPhrases = ref<AIQuickPhraseResult[]>([]);
  const quickPhraseLoading = ref(false);

  async function fetchQuickPhrases() {
    quickPhraseLoading.value = true;
    try {
      quickPhrases.value = await getAllAIQuickPhraseApi();
    } finally {
      quickPhraseLoading.value = false;
    }
  }

  function appendQuickPhrase(item: AIQuickPhraseResult) {
    prompt.value = prompt.value.trim()
      ? `${prompt.value.trim()}\n${item.content}`
      : item.content;
  }

  function handleQuickPhraseSelect(item: AIQuickPhraseResult) {
    appendQuickPhrase(item);
    quickPhrasePopoverOpen.value = false;
  }

  function handleQuickPhrasePopoverOpenChange(open: boolean) {
    quickPhrasePopoverOpen.value = open;
  }

  function isMcpSelected(mcpId: number) {
    return selectedMcpIds.value.includes(mcpId);
  }

  function toggleMcpSelection(mcpId: number) {
    if (isMcpSelected(mcpId)) {
      selectedMcpIds.value = selectedMcpIds.value.filter((id) => id !== mcpId);
      return;
    }
    selectedMcpIds.value = [...selectedMcpIds.value, mcpId];
  }

  function renderFooterIconButton(opts: {
    disabled?: boolean;
    icon: string;
    onClick?: () => void;
    title: string;
  }) {
    return h(AButton, {
      class: 'inline-flex size-8 items-center justify-center !px-0',
      disabled: opts.disabled,
      htmlType: 'button',
      icon: h(IconifyIcon, {
        class: 'size-4',
        icon: opts.icon,
      }),
      onClick: () => {
        opts.onClick?.();
      },
      size: 'small',
      title: opts.title,
      type: 'text',
    });
  }

  function renderThinkingPopoverContent() {
    return h('div', { class: 'w-[320px] space-y-3' }, [
      h('div', { class: 'text-xs font-medium text-foreground' }, '思考链'),
      h(
        'div',
        { class: 'space-y-2' },
        THINKING_OPTIONS.map((item) =>
          h(
            'button',
            {
              key: item.key,
              class: [
                'flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                thinking.value === item.value
                  ? 'border-primary/35 bg-primary/10'
                  : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30',
              ],
              onClick: () => {
                thinking.value = item.value;
              },
              type: 'button',
            },
            [
              h(
                'span',
                {
                  class: [
                    'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
                    thinking.value === item.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-transparent',
                  ],
                },
                '✓',
              ),
              h('span', { class: 'min-w-0 flex-1' }, [
                h(
                  'span',
                  { class: 'block text-xs font-medium text-foreground' },
                  item.label,
                ),
                h(
                  'span',
                  { class: 'mt-1 block text-[11px] text-muted-foreground/75' },
                  item.desc,
                ),
              ]),
            ],
          ),
        ),
      ),
    ]);
  }

  function renderGenerationPopoverContent() {
    return h('div', { class: 'w-[320px] space-y-3' }, [
      h('div', { class: 'text-xs font-medium text-foreground' }, '生成类型'),
      h(
        'div',
        { class: 'space-y-2' },
        GENERATION_TYPE_OPTIONS.map((item) =>
          h(
            'button',
            {
              key: item.value,
              class: [
                'flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                generationType.value === item.value
                  ? 'border-primary/35 bg-primary/10'
                  : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30',
              ],
              onClick: () => {
                generationType.value = item.value;
              },
              type: 'button',
            },
            [
              h(
                'span',
                {
                  class: [
                    'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none',
                    generationType.value === item.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-transparent',
                  ],
                },
                '✓',
              ),
              h('span', { class: 'min-w-0 flex-1' }, [
                h(
                  'span',
                  {
                    class:
                      'block truncate text-xs font-medium leading-4 text-foreground',
                  },
                  item.label,
                ),
                h(
                  'span',
                  {
                    class:
                      'mt-1 block truncate text-[11px] leading-4 text-muted-foreground/75',
                  },
                  item.desc,
                ),
              ]),
            ],
          ),
        ),
      ),
    ]);
  }

  function renderWebSearchPopoverContent() {
    return h('div', { class: 'w-[320px] space-y-3' }, [
      h('div', { class: 'text-xs font-medium text-foreground' }, '网络搜索'),
      h(
        'div',
        { class: 'space-y-2' },
        WEB_SEARCH_OPTIONS.map((item) =>
          h(
            'button',
            {
              key: item.value,
              class: [
                'flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                webSearch.value === item.value
                  ? 'border-primary/35 bg-primary/10'
                  : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30',
              ],
              onClick: () => {
                webSearch.value = item.value;
              },
              type: 'button',
            },
            [
              h(
                'span',
                {
                  class: [
                    'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none',
                    webSearch.value === item.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-transparent',
                  ],
                },
                '✓',
              ),
              h('span', { class: 'min-w-0 flex-1' }, [
                h(
                  'span',
                  {
                    class:
                      'block truncate text-xs font-medium leading-4 text-foreground',
                  },
                  item.label,
                ),
                h(
                  'span',
                  {
                    class:
                      'mt-1 block truncate text-[11px] leading-4 text-muted-foreground/75',
                  },
                  item.desc,
                ),
              ]),
            ],
          ),
        ),
      ),
    ]);
  }

  function renderMcpPopoverContent() {
    return h('div', { class: 'w-[360px] space-y-3' }, [
      h('div', { class: 'text-xs font-medium text-foreground' }, 'MCP'),
      mcps.value.length === 0
        ? h(AEmpty, {
            description: '暂无可用 MCP',
            image: null,
          })
        : h(
            'div',
            {
              class:
                'flex max-h-[260px] min-h-[120px] flex-col gap-2 overflow-y-auto',
            },
            mcps.value.map((item) =>
              h(
                'button',
                {
                  key: item.id,
                  class: [
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                    isMcpSelected(item.id)
                      ? 'border-primary/30 bg-primary/8 text-foreground'
                      : 'border-border bg-background hover:border-primary/20 hover:bg-accent/30',
                  ],
                  onClick: () => {
                    toggleMcpSelection(item.id);
                  },
                  title:
                    `${item.name} ${item.description || item.command || item.url || `MCP #${item.id}`}`.trim(),
                  type: 'button',
                },
                [
                  h(
                    'span',
                    {
                      class:
                        'min-w-0 shrink-0 truncate text-xs font-medium text-foreground',
                    },
                    item.name,
                  ),
                  h(
                    'span',
                    {
                      class:
                        'min-w-0 flex-1 truncate text-[11px] text-muted-foreground/75',
                    },
                    item.description ||
                      item.command ||
                      item.url ||
                      `MCP #${item.id}`,
                  ),
                  h(
                    'span',
                    {
                      class: [
                        'inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none',
                        isMcpSelected(item.id)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-transparent',
                      ],
                    },
                    '✓',
                  ),
                ],
              ),
            ),
          ),
    ]);
  }

  function renderQuickPhrasePopoverContent() {
    let quickPhraseContent;
    if (quickPhraseLoading.value) {
      quickPhraseContent = h(
        'div',
        {
          class:
            'flex min-h-[120px] items-center justify-center text-muted-foreground',
        },
        [h(ASpin, { size: 'small' })],
      );
    } else if (quickPhrases.value.length === 0) {
      quickPhraseContent = h(AEmpty, {
        description: '暂无快捷短语',
        image: null,
      });
    } else {
      quickPhraseContent = h(
        'div',
        {
          class:
            'flex max-h-[260px] min-h-[120px] flex-col gap-2 overflow-y-auto',
        },
        quickPhrases.value.map((item) =>
          h(
            'button',
            {
              key: item.id,
              class:
                'flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/20 hover:bg-accent/30',
              onClick: () => {
                handleQuickPhraseSelect(item);
              },
              title: `${item.title} ${item.content}`.trim(),
              type: 'button',
            },
            [
              h(
                'span',
                {
                  class:
                    'min-w-0 shrink-0 truncate text-xs font-medium text-foreground',
                },
                item.title,
              ),
              h(
                'span',
                {
                  class:
                    'min-w-0 flex-1 truncate text-[11px] text-muted-foreground/75',
                },
                item.content,
              ),
            ],
          ),
        ),
      );
    }

    return h('div', { class: 'w-[360px] space-y-3' }, [
      h('div', { class: 'text-xs font-medium text-foreground' }, '快捷短语'),
      quickPhraseContent,
    ]);
  }

  const renderSenderFooter: NonNullable<SenderProps['footer']> = (_, info) => {
    const { LoadingButton, SendButton } = info.components;
    const thinkingButtonTitle = `思考：${thinkingButtonLabel.value}`;

    return h(
      AFlex,
      {
        align: 'center',
        gap: 'small',
        justify: 'space-between',
        vertical: false,
        wrap: 'wrap',
      },
      {
        default: () => [
          h(
            AFlex,
            {
              align: 'center',
              gap: 'middle',
              wrap: 'wrap',
            },
            {
              default: () => [
                renderFooterIconButton({
                  disabled: sending.value || !canCreateNewConversation.value,
                  icon: 'mdi:message-plus-outline',
                  onClick: createNewConversation,
                  title: '新建话题',
                }),
                h(
                  Popover,
                  { placement: 'topLeft', trigger: 'click' },
                  {
                    content: () => renderGenerationPopoverContent(),
                    default: () =>
                      renderFooterIconButton({
                        disabled: sending.value,
                        icon:
                          generationType.value === 'image'
                            ? 'mdi:image'
                            : 'mdi:image-outline',
                        title: `生成类型：${generationTypeButtonLabel.value}`,
                      }),
                  },
                ),
                h(
                  Popover,
                  { placement: 'topLeft', trigger: 'click' },
                  {
                    content: () => renderThinkingPopoverContent(),
                    default: () =>
                      renderFooterIconButton({
                        disabled: sending.value,
                        icon: 'mdi:head-lightbulb-outline',
                        title: thinkingButtonTitle,
                      }),
                  },
                ),
                h(
                  Popover,
                  { placement: 'topLeft', trigger: 'click' },
                  {
                    content: () => renderWebSearchPopoverContent(),
                    default: () =>
                      renderFooterIconButton({
                        disabled: sending.value,
                        icon: 'mdi:web',
                        title: `联网搜索：${webSearchButtonLabel.value}`,
                      }),
                  },
                ),
                h(
                  Popover,
                  {
                    align: { overflow: { adjustX: false, adjustY: true } },
                    placement: 'topLeft',
                    trigger: 'click',
                  },
                  {
                    content: () => renderMcpPopoverContent(),
                    default: () =>
                      renderFooterIconButton({
                        disabled: sending.value,
                        icon: 'simple-icons:modelcontextprotocol',
                        title:
                          selectedMcpIds.value.length > 0
                            ? `已选择 ${selectedMcpIds.value.length} 个 MCP`
                            : '选择 MCP',
                      }),
                  },
                ),
                h(
                  Popover,
                  {
                    align: { overflow: { adjustX: false, adjustY: true } },
                    onOpenChange: handleQuickPhrasePopoverOpenChange,
                    open: quickPhrasePopoverOpen.value,
                    placement: 'topLeft',
                    trigger: 'click',
                  },
                  {
                    content: () => renderQuickPhrasePopoverContent(),
                    default: () =>
                      renderFooterIconButton({
                        disabled: sending.value,
                        icon: 'mdi:lightning-bolt-outline',
                        title: '快捷短语',
                      }),
                  },
                ),
                renderFooterIconButton({
                  disabled: sending.value,
                  icon: 'mdi:cog-outline',
                  onClick: () => {
                    onOpenSettings();
                  },
                  title: hasAdvancedSettings.value
                    ? '参数设置（已调整）'
                    : '参数设置',
                }),
                renderFooterIconButton({
                  disabled: !canClearMessages.value,
                  icon: 'mdi:eraser-variant',
                  onClick: () => {
                    confirmClearMessages();
                  },
                  title: '清空消息',
                }),
                renderFooterIconButton({
                  disabled: sending.value || !activeConversationId.value,
                  icon: 'mdi:broom',
                  onClick: () => {
                    confirmClearConversationContext();
                  },
                  title: '清除上下文',
                }),
              ],
            },
          ),
          h(
            AFlex,
            {
              align: 'center',
              class: 'w-full md:w-auto',
              gap: 'small',
              justify: 'flex-end',
              wrap: 'wrap',
            },
            {
              default: () => [
                composerHint.value
                  ? h(
                      'span',
                      {
                        class:
                          'inline-flex max-w-full whitespace-pre-wrap text-left text-xs leading-5 text-muted-foreground',
                      },
                      composerHint.value,
                    )
                  : null,
                sending.value
                  ? h(LoadingButton, {
                      type: 'default',
                    })
                  : h(SendButton, {
                      class:
                        'inline-flex size-8 items-center justify-center !rounded-md !px-0',
                      disabled:
                        !selectedProviderId.value ||
                        !selectedModelId.value ||
                        !prompt.value.trim(),
                      icon: h(IconifyIcon, {
                        class: 'size-4',
                        icon: 'mdi:send',
                      }),
                      shape: 'default',
                      type: 'text',
                    }),
              ],
            },
          ),
        ],
      },
    );
  };

  return {
    fetchQuickPhrases,
    handleQuickPhrasePopoverOpenChange,
    quickPhrasePopoverOpen,
    quickPhrases,
    renderSenderFooter,
  };
}
