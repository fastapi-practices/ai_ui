<script setup lang="ts">
import type {
  BubbleListProps,
  ConversationsProps,
  SenderProps,
  SuggestionItem,
} from '@antdv-next/x';

import type { VbenFormSchema } from '#/adapter/form';
import type {
  AIMcpResult,
  AIModelResult,
  AIProviderResult,
  AIQuickPhraseResult,
} from '#/plugins/ai/api';
import type {
  AIChatComposerParams,
  AIChatConversationResult,
} from '#/plugins/ai/api/chat';
import type { AIChatProviderRequest } from '#/plugins/ai/runtime/chat-request';
import type {
  AIChatProviderMessage,
  ChatMessageItem,
} from '#/plugins/ai/runtime/message';

import {
  computed,
  h,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { ColPage, confirm, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { usePreferences } from '@vben/preferences';

import {
  BubbleList,
  Suggestion,
  Welcome,
} from '@antdv-next/x';
import { useClipboard } from '@vueuse/core';
import {
  Button as AButton,
  Empty as AEmpty,
  Flex as AFlex,
  Spin as ASpin,
  message,
  Popover,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  getAllAIMcpApi,
  getAllAIModelApi,
  getAllAIProviderApi,
  getAllAIQuickPhraseApi,
} from '#/plugins/ai/api';
import {
  buildChatCompletionRequest,
  updateAIChatConversationApi,
  updateAIChatMessageApi,
} from '#/plugins/ai/api/chat';
import {
  createAIChatProtocolDriver,
  DEFAULT_AI_CHAT_PROTOCOL_NAME,
} from '#/plugins/ai/protocols';
import {
  buildTransientMessageItems,
  createProviderUserMessage,
  getMessageFileBlocks,
  getMessageTextContent,
  makeConversationTitle,
  mergeStreamMessage,
  parseDateLabel,
  parseJsonField,
  replaceMessageTextBlocks,
} from '#/plugins/ai/runtime/message';
import { useAIChatStream } from '#/plugins/ai/runtime/use-chat-stream';

import {
  buildConversationSidebarItems,
  createConversationSidebarMenu,
} from './adapters/conversation-items';
import {
  createChatBubbleListRole,
  renderChatMessageBubbleContent,
} from './adapters/message-bubble-role';
import ChatSender from './components/chat-sender.vue';
import ChatSettingsPanel from './components/chat-settings-panel.vue';
import ChatSidebar from './components/chat-sidebar.vue';
import { useChatSession } from './composables/use-chat-session';

type ThinkingPanelState = {
  autoOpened: boolean;
  expanded: boolean;
};

type ChatGenerationType = NonNullable<AIChatComposerParams['generation_type']>;
type ChatThinkingValue = AIChatComposerParams['thinking'];
type ChatWebSearchType = NonNullable<AIChatComposerParams['web_search']>;
interface ChatSessionScopedConfig {
  enableBuiltinTools: boolean;
  generationType: ChatGenerationType;
  modelId?: string;
  parallelToolCalls: boolean;
  providerId?: number;
  selectedMcpIds: number[];
  thinking: ChatThinkingValue;
  webSearch: ChatWebSearchType;
}

const DEFAULT_CHAT_SESSION_SCOPED_CONFIG: Omit<
  ChatSessionScopedConfig,
  'modelId' | 'providerId'
> = {
  enableBuiltinTools: true,
  generationType: 'text',
  parallelToolCalls: true,
  selectedMcpIds: [],
  thinking: undefined,
  webSearch: 'builtin',
};

const currentChatProtocol = createAIChatProtocolDriver(
  DEFAULT_AI_CHAT_PROTOCOL_NAME,
);
const currentChatProtocolName = currentChatProtocol.name;
const currentChatProtocolOptions = {
  protocolName: currentChatProtocolName,
} as const;

const { copy } = useClipboard({ legacy: true });
const { isDark } = usePreferences();
const prompt = ref('');
const draftConversationTitle = ref('新话题');
const selectedProviderId = ref<number>();
const selectedModelId = ref<string>();
const editingMessage = ref<ChatMessageItem>();
const editingMessageIntent = ref<'resend' | 'save'>('save');
const regeneratingMessageIndex = ref<number>();

const providers = ref<AIProviderResult[]>([]);
const models = ref<AIModelResult[]>([]);
const mcps = ref<AIMcpResult[]>([]);
const quickPhrases = ref<AIQuickPhraseResult[]>([]);

const messageContainerRef = ref<HTMLElement>();
const autoFollowMessageScroll = ref(true);
let suppressNextMessageScrollEvent = false;

const resourcesLoading = ref(false);
const quickPhraseLoading = ref(false);
const {
  abort: abortTransientRequest,
  chatProvider,
  isRequesting,
  messages: transientMessagesState,
  onRequest: onTransientRequest,
  setMessages: setTransientMessages,
  transientRequestError,
} = useAIChatStream({
  protocolName: currentChatProtocolOptions.protocolName,
});
const sending = computed(() => isRequesting.value);

const maxTokens = ref<number>();
const temperature = ref(1);
const topP = ref<number>();
const timeout = ref<number>();
const seed = ref<number>();
const presencePenalty = ref<number>();
const frequencyPenalty = ref<number>();
const generationType = ref<ChatGenerationType>('text');
const parallelToolCalls = ref(true);
const thinking = ref<ChatThinkingValue>(undefined);
const enableBuiltinTools = ref(true);
const selectedMcpIds = ref<number[]>([]);
const webSearch = ref<ChatWebSearchType>('builtin');
const stopSequences = ref('');
const extraHeaders = ref('');
const extraBody = ref('');
const logitBias = ref('');
const quickPhrasePopoverOpen = ref(false);
const conversationSessionConfigs = ref<Record<string, ChatSessionScopedConfig>>(
  {},
);
const thinkingPanelStates = ref<Record<string, ThinkingPanelState>>({});
const renameConversationFormData = ref<AIChatConversationResult>();
const {
  activeConversation,
  activeConversationId,
  activeConversationDetail,
  activeMessages,
  conversationSummaries,
  confirmClearConversationContext,
  confirmClearMessages,
  confirmRemoveConversation,
  createNewConversation,
  deleteMessageChain,
  detailLoading,
  fetchConversations,
  hasMoreConversations,
  initializeSession,
  loadConversationDetail,
  loadMoreConversations,
  selectConversation,
  setActiveConversationKey,
  sidebarLoading,
  sidebarMoreLoading,
  togglePinConversation,
  upsertConversationSummary,
} = useChatSession({
  autoFollowMessageScroll,
  closeRenameConversationModal: () => renameConversationModalApi.close(),
  confirmAction: (options) => confirm(options),
  draftConversationTitle,
  notifySuccess: (content) => {
    message.success(content);
  },
  protocolName: currentChatProtocolOptions.protocolName,
  renameConversationFormData,
  resetComposerState,
  clearTransientMessages: () => {
    setTransientMessages([]);
  },
  scrollToBottom,
  scrollToTop,
  selectedModelId,
  selectedProviderId,
  stopStreaming,
  transientRequestError,
});

const renameConversationSchema: VbenFormSchema[] = [
  {
    component: 'Input' as const,
    componentProps: {
      autofocus: true,
      placeholder: '请输入话题标题',
    },
    fieldName: 'title',
    label: '新话题',
    rules: 'required',
  },
];

const GENERATION_TYPE_OPTIONS: Array<{
  desc: string;
  label: string;
  value: ChatGenerationType;
}> = [
  {
    desc: '常规对话与文本生成',
    label: '文本',
    value: 'text',
  },
  {
    desc: '让模型直接生成图片结果',
    label: '图片',
    value: 'image',
  },
];

const WEB_SEARCH_OPTIONS: Array<{
  desc: string;
  label: string;
  value: ChatWebSearchType;
}> = [
  {
    desc: '优先使用模型内置搜索能力',
    label: '内置搜索',
    value: 'builtin',
  },
  {
    desc: '使用 Exa 作为搜索来源',
    label: 'Exa',
    value: 'exa',
  },
  {
    desc: '使用 Tavily 作为搜索来源',
    label: 'Tavily',
    value: 'tavily',
  },
  {
    desc: '使用 DuckDuckGo 作为搜索来源',
    label: 'DuckDuckGo',
    value: 'duckduckgo',
  },
];

const THINKING_OPTIONS: Array<{
  desc: string;
  key: string;
  label: string;
  value: ChatThinkingValue;
}> = [
  {
    desc: '沿用模型默认思考行为',
    key: 'default',
    label: '默认',
    value: undefined,
  },
  {
    desc: '显式关闭思考',
    key: 'off',
    label: '关闭',
    value: false,
  },
  {
    desc: '最轻量的思考强度',
    key: 'minimal',
    label: 'minimal',
    value: 'minimal',
  },
  {
    desc: '较低思考强度',
    key: 'low',
    label: 'low',
    value: 'low',
  },
  {
    desc: '平衡型思考强度',
    key: 'medium',
    label: 'medium',
    value: 'medium',
  },
  {
    desc: '较高思考强度',
    key: 'high',
    label: 'high',
    value: 'high',
  },
  {
    desc: '最高思考强度',
    key: 'xhigh',
    label: 'xhigh',
    value: 'xhigh',
  },
];

let currentModelFetchId = 0;
let hasInitialized = false;

function isMessageContainerNearBottom(threshold = 48) {
  const container = messageContainerRef.value;
  if (!container) {
    return true;
  }

  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    threshold
  );
}

function syncAutoFollowMessageScroll() {
  autoFollowMessageScroll.value = isMessageContainerNearBottom();
}

function handleMessageContainerScroll() {
  if (suppressNextMessageScrollEvent) {
    suppressNextMessageScrollEvent = false;
    return;
  }

  syncAutoFollowMessageScroll();
}

function scrollToBottom(force = false) {
  nextTick(() => {
    const container = messageContainerRef.value;
    if (!container || (!force && !autoFollowMessageScroll.value)) {
      return;
    }

    const syncScroll = () => {
      suppressNextMessageScrollEvent = true;
      container.scrollTop = container.scrollHeight;
    };

    syncScroll();
    requestAnimationFrame(() => {
      syncScroll();
      requestAnimationFrame(syncScroll);
    });
  });
}

function scrollToTop() {
  nextTick(() => {
    suppressNextMessageScrollEvent = true;
    messageContainerRef.value?.scrollTo({ top: 0 });
  });
}

function getThinkingPanelKey(message: ChatMessageItem) {
  return message.id;
}

function getThinkingContent(message: ChatMessageItem) {
  return getMessageTextContent(message, 'reasoning');
}

function hasThinkingContent(message: ChatMessageItem) {
  return Boolean(getThinkingContent(message).trim());
}

function isThinkingExpanded(message: ChatMessageItem) {
  return Boolean(
    thinkingPanelStates.value[getThinkingPanelKey(message)]?.expanded,
  );
}

function setThinkingExpanded(message: ChatMessageItem, expanded: boolean) {
  const key = getThinkingPanelKey(message);
  const current = thinkingPanelStates.value[key];
  thinkingPanelStates.value = {
    ...thinkingPanelStates.value,
    [key]: {
      autoOpened: current?.autoOpened ?? false,
      expanded,
    },
  };
}

function resetGenerationSettings() {
  maxTokens.value = undefined;
  temperature.value = 1;
  topP.value = undefined;
  timeout.value = undefined;
}

function resetBehaviorSettings() {
  seed.value = undefined;
  presencePenalty.value = undefined;
  frequencyPenalty.value = undefined;
}

function resetToolingSettings() {
  parallelToolCalls.value = true;
  enableBuiltinTools.value = true;
}

function resetPassthroughSettings() {
  stopSequences.value = '';
  extraHeaders.value = '';
  extraBody.value = '';
  logitBias.value = '';
}

function resetModelSettings() {
  resetGenerationSettings();
  resetBehaviorSettings();
  resetToolingSettings();
  resetPassthroughSettings();
}

function buildCurrentChatSessionScopedConfig(): ChatSessionScopedConfig {
  return {
    enableBuiltinTools: enableBuiltinTools.value,
    generationType: generationType.value,
    modelId: selectedModelId.value,
    parallelToolCalls: parallelToolCalls.value,
    providerId: selectedProviderId.value,
    selectedMcpIds: [...selectedMcpIds.value],
    thinking: thinking.value,
    webSearch: webSearch.value,
  };
}

function applyChatSessionScopedConfig(
  config: Partial<ChatSessionScopedConfig>,
  options: { preserveProviderModel?: boolean } = {},
) {
  if (!options.preserveProviderModel) {
    selectedProviderId.value = config.providerId;
    selectedModelId.value = config.modelId;
  }

  generationType.value =
    config.generationType ?? DEFAULT_CHAT_SESSION_SCOPED_CONFIG.generationType;
  parallelToolCalls.value =
    config.parallelToolCalls ??
    DEFAULT_CHAT_SESSION_SCOPED_CONFIG.parallelToolCalls;
  thinking.value =
    config.thinking ?? DEFAULT_CHAT_SESSION_SCOPED_CONFIG.thinking;
  enableBuiltinTools.value =
    config.enableBuiltinTools ??
    DEFAULT_CHAT_SESSION_SCOPED_CONFIG.enableBuiltinTools;
  selectedMcpIds.value = [...(config.selectedMcpIds ?? [])];
  webSearch.value =
    config.webSearch ?? DEFAULT_CHAT_SESSION_SCOPED_CONFIG.webSearch;
}

function rememberConversationSessionConfig(conversationId?: null | string) {
  if (!conversationId) {
    return;
  }

  conversationSessionConfigs.value = {
    ...conversationSessionConfigs.value,
    [conversationId]: buildCurrentChatSessionScopedConfig(),
  };
}

function resetComposerState(clearPrompt = false) {
  editingMessage.value = undefined;
  regeneratingMessageIndex.value = undefined;
  if (clearPrompt) {
    prompt.value = '';
  }
}

function stopStreaming() {
  abortTransientRequest();
}

watch(activeConversationId, (conversationId, previousConversationId) => {
  if (previousConversationId) {
    rememberConversationSessionConfig(previousConversationId);
  }

  if (!conversationId) {
    applyChatSessionScopedConfig(DEFAULT_CHAT_SESSION_SCOPED_CONFIG, {
      preserveProviderModel: true,
    });
    return;
  }

  const config = conversationSessionConfigs.value[conversationId];
  if (!config) {
    applyChatSessionScopedConfig(DEFAULT_CHAT_SESSION_SCOPED_CONFIG, {
      preserveProviderModel: true,
    });
    return;
  }

  applyChatSessionScopedConfig(config);
});

watch(activeConversationDetail, (detail) => {
  if (!detail) {
    return;
  }

  const config = conversationSessionConfigs.value[detail.conversation_id];
  if (!config) {
    return;
  }

  applyChatSessionScopedConfig(config);
});

async function fetchProviders() {
  resourcesLoading.value = true;
  try {
    providers.value = await getAllAIProviderApi();
  } finally {
    resourcesLoading.value = false;
  }
}

async function fetchMcps() {
  mcps.value = await getAllAIMcpApi();
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

async function handleQuickPhrasePopoverOpenChange(open: boolean) {
  quickPhrasePopoverOpen.value = open;
}

async function fetchModelsByProvider(providerId?: number) {
  const fetchId = ++currentModelFetchId;

  if (!providerId) {
    models.value = [];
    if (!activeConversationId.value) {
      selectedModelId.value = undefined;
    }
    return;
  }

  const data = await getAllAIModelApi({ provider_id: providerId });

  if (fetchId !== currentModelFetchId) {
    return;
  }

  models.value = data;

  if (!data.some((item) => item.model_id === selectedModelId.value)) {
    selectedModelId.value = undefined;
  }
}

async function fetchQuickPhrases() {
  quickPhraseLoading.value = true;
  try {
    quickPhrases.value = await getAllAIQuickPhraseApi();
  } finally {
    quickPhraseLoading.value = false;
  }
}

async function refreshChatResources() {
  await Promise.all([
    fetchProviders(),
    fetchModelsByProvider(selectedProviderId.value),
    fetchMcps(),
    fetchQuickPhrases(),
  ]);
}

function appendQuickPhrase(item: AIQuickPhraseResult) {
  prompt.value = prompt.value.trim()
    ? `${prompt.value.trim()}\n${item.content}`
    : item.content;
}

function beginEditMessage(
  item: ChatMessageItem,
  intent: 'resend' | 'save' = 'save',
) {
  if (
    item.role !== 'user' ||
    item.message_id === undefined ||
    item.message_id === null
  ) {
    return;
  }

  editingMessage.value = item;
  editingMessageIntent.value = intent;
  regeneratingMessageIndex.value = undefined;
}

function cancelEditMessage() {
  editingMessage.value = undefined;
  editingMessageIntent.value = 'save';
}

function isEditingMessage(item: ChatMessageItem) {
  return editingMessage.value?.id === item.id;
}

function updateMessageContent(target: ChatMessageItem, content: string) {
  activeMessages.value = activeMessages.value.map((item) =>
    item.id === target.id ? replaceMessageTextBlocks(item, content) : item,
  );
}

async function saveEditedMessage(content: string) {
  const trimmedContent = content.trim();
  const targetMessage = editingMessage.value;

  if (
    !targetMessage ||
    !targetMessage.conversation_id ||
    targetMessage.message_id === undefined ||
    targetMessage.message_id === null
  ) {
    return;
  }

  if (!trimmedContent) {
    message.warning('请输入消息内容');
    return;
  }

  await updateAIChatMessageApi(
    targetMessage.conversation_id,
    targetMessage.message_id,
    {
      content: trimmedContent,
    },
  );
  updateMessageContent(targetMessage, trimmedContent);
  cancelEditMessage();
  await loadConversationDetail(targetMessage.conversation_id);
  message.success('消息内容已保存');
}

async function resendEditedMessage(content: string) {
  const trimmedContent = content.trim();
  const targetMessage = editingMessage.value;

  if (
    !targetMessage ||
    targetMessage.message_id === undefined ||
    targetMessage.message_id === null
  ) {
    return;
  }

  if (!trimmedContent) {
    message.warning('请输入消息内容');
    return;
  }

  updateMessageContent(targetMessage, trimmedContent);
  if (targetMessage.conversation_id) {
    await updateAIChatMessageApi(
      targetMessage.conversation_id,
      targetMessage.message_id,
      {
        content: trimmedContent,
      },
    );
  }
  regeneratingMessageIndex.value = targetMessage.message_index;
  editingMessage.value = undefined;
  await submitChat(targetMessage.message_id, true, undefined, 'user');
}

async function regenerateUserMessage(item: ChatMessageItem) {
  if (
    item.role !== 'user' ||
    item.message_id === undefined ||
    item.message_id === null
  ) {
    return;
  }

  editingMessage.value = undefined;
  editingMessageIntent.value = 'save';
  regeneratingMessageIndex.value = item.message_index;
  await submitChat(item.message_id, true, undefined, 'user');
}

async function copyMessageContent(item: ChatMessageItem) {
  const sections = [
    getMessageTextContent(item, 'text'),
    getMessageTextContent(item, 'reasoning'),
    ...getMessageFileBlocks(item).map((block) =>
      [block.name, block.url].filter(Boolean).join(' - '),
    ),
  ].filter(Boolean);

  await copy(sections.join('\n\n'));
  message.success('消息内容已复制');
}

async function startRenameConversation(conversation?: AIChatConversationResult) {
  const targetConversation = conversation || activeConversation.value;
  if (!targetConversation) {
    return;
  }

  renameConversationModalApi.setData(targetConversation).open();
}

function resetRenameConversationState() {
  renameConversationFormData.value = undefined;
  renameConversationFormApi.resetForm();
}

async function submitRenameConversation() {
  const { valid } = await renameConversationFormApi.validate();
  if (!valid) {
    return;
  }

  const conversation = renameConversationFormData.value;
  const conversationId = conversation?.conversation_id;
  const { title: currentTitle = '' } =
    await renameConversationFormApi.getValues<{
      title?: string;
    }>();
  const title = currentTitle.trim();
  const updatedTime = new Date().toISOString();

  if (!conversationId || !conversation || !title) {
    message.error('请输入话题标题');
    return;
  }

  renameConversationModalApi.lock();
  try {
    await updateAIChatConversationApi(conversationId, { title });
    upsertConversationSummary({
      ...conversation,
      title,
      updated_time: updatedTime,
    });
    if (activeConversationDetail.value?.conversation_id === conversationId) {
      activeConversationDetail.value = {
        ...activeConversationDetail.value,
        title,
        updated_time: updatedTime,
      };
    }
    await renameConversationModalApi.close();
    message.success('话题标题已更新');
  } finally {
    renameConversationModalApi.unlock();
  }
}

async function regenerateMessage(item: ChatMessageItem) {
  if (
    item.role !== 'assistant' ||
    item.message_id === undefined ||
    item.message_id === null
  ) {
    return;
  }

  regeneratingMessageIndex.value = item.message_index;
  editingMessage.value = undefined;
  await submitChat(item.message_id, false, undefined, 'model');
}

async function submitChat(
  regenerateMessageId?: number,
  notifyInvalid = false,
  overridePromptText?: string,
  regenerateSource: 'model' | 'user' = 'model',
) {
  if (sending.value) {
    return;
  }

  if (!selectedProviderId.value || !selectedModelId.value) {
    if (notifyInvalid) {
      message.warning('请选择供应商和模型');
    }
    return;
  }

  const promptText =
    regenerateMessageId === undefined
      ? (overridePromptText ?? prompt.value).trim()
      : undefined;

  if (regenerateMessageId === undefined && !promptText) {
    if (notifyInvalid) {
      message.warning('请输入消息内容');
    }
    return;
  }

  const editingMessageIndex = editingMessage.value?.message_index;
  const editingMessageId = editingMessage.value?.message_id;
  const hasEditingMessageId =
    editingMessageId !== undefined && editingMessageId !== null;
  const submittedPromptText = promptText ?? '';

  if (editingMessage.value && !hasEditingMessageId) {
    message.warning('当前消息暂不可编辑，请刷新后重试');
    return;
  }
  let chatMode: AIChatComposerParams['mode'] = 'regenerate';
  if (regenerateMessageId === undefined) {
    chatMode = hasEditingMessageId ? 'edit' : 'create';
  }
  const submittedTitle =
    activeConversationId.value || !promptText
      ? draftConversationTitle.value
      : makeConversationTitle(promptText);

  let payload: AIChatComposerParams;
  try {
    payload = {
      conversation_id: activeConversationId.value,
      extra_body: extraBody.value.trim() || undefined,
      enable_builtin_tools: enableBuiltinTools.value,
      extra_headers: parseJsonField<Record<string, string>>(
        extraHeaders.value,
        '额外请求头',
        (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      ),
      frequency_penalty: frequencyPenalty.value,
      logit_bias: parseJsonField<Record<string, number>>(
        logitBias.value,
        'Logit Bias',
        (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      ),
      max_tokens: maxTokens.value,
      mcp_ids:
        selectedMcpIds.value.length > 0 ? selectedMcpIds.value : undefined,
      generation_type: generationType.value,
      model_id: selectedModelId.value,
      parallel_tool_calls: parallelToolCalls.value,
      presence_penalty: presencePenalty.value,
      provider_id: selectedProviderId.value,
      mode: chatMode,
      thinking: thinking.value,
      seed: seed.value,
      stop_sequences: parseJsonField<string[]>(
        stopSequences.value,
        '停止序列',
        Array.isArray,
      ),
      temperature: temperature.value,
      timeout: timeout.value,
      top_p: topP.value,
      web_search: webSearch.value,
      ...(chatMode === 'edit' && hasEditingMessageId
        ? {
            edit_message_id: editingMessageId,
            user_prompt: submittedPromptText,
          }
        : {}),
      ...(chatMode === 'create' ? { user_prompt: submittedPromptText } : {}),
      ...(chatMode === 'regenerate' && regenerateMessageId !== undefined
        ? { regenerate_message_id: regenerateMessageId }
        : {}),
    };
  } catch (error) {
    message.error((error as Error).message);
    return;
  }

  const targetConversationId = activeConversationId.value;
  if (regenerateMessageId !== undefined && !targetConversationId) {
    message.warning('当前会话不存在，无法重新生成');
    return;
  }
  const regenerateTargetMessageIndex = regeneratingMessageIndex.value;

  if (
    regenerateMessageId !== undefined &&
    regenerateTargetMessageIndex !== undefined
  ) {
    if (regenerateSource === 'user') {
      activeMessages.value = activeMessages.value.filter(
        (item) => item.message_index <= regenerateTargetMessageIndex,
      );
    } else {
      const regenerateTargetArrayIndex = activeMessages.value.findIndex(
        (item) =>
          item.role === 'assistant' &&
          item.message_index === regenerateTargetMessageIndex,
      );
      const preservedUserArrayIndex =
        regenerateTargetArrayIndex <= 0
          ? -1
          : ([...activeMessages.value.keys()]
              .slice(0, regenerateTargetArrayIndex)
              .toReversed()
              .find((index) => activeMessages.value[index]?.role === 'user') ??
            -1);

      activeMessages.value =
        preservedUserArrayIndex >= 0
          ? activeMessages.value.slice(0, preservedUserArrayIndex + 1)
          : [];
    }
  } else if (editingMessageIndex !== undefined) {
    activeMessages.value = activeMessages.value.filter(
      (item) => item.message_index < editingMessageIndex,
    );
  }

  if (!activeConversationId.value) {
    draftConversationTitle.value = submittedTitle;
  }
  autoFollowMessageScroll.value = true;
  const completionRequest = buildChatCompletionRequest({
    conversationId: targetConversationId,
    history: activeMessages.value,
    params: payload,
    promptText:
      regenerateMessageId === undefined ? submittedPromptText : undefined,
  }, {
    protocolName: currentChatProtocolOptions.protocolName,
  });

  transientRequestError.value = null;
  setTransientMessages([]);

  if (regenerateMessageId === undefined || regenerateSource === 'user') {
    prompt.value = '';
  }

  const requestParams: AIChatProviderRequest =
    regenerateMessageId === undefined
      ? {
          body: completionRequest,
          localMessages: submittedPromptText
            ? [createProviderUserMessage(submittedPromptText)]
            : [],
          mode: 'create',
        }
      : {
          body: {
            conversationId:
              completionRequest.conversationId ?? targetConversationId,
            forwardedProps: completionRequest.forwardedProps,
          },
          conversationId: targetConversationId,
          localMessages: [],
          messageId: regenerateMessageId,
          mode:
            regenerateSource === 'user'
              ? 'regenerate-from-message'
              : 'regenerate-from-response',
        };

  onTransientRequest(requestParams);
  await chatProvider.request.asyncHandler;

  let streamedConversationId = targetConversationId;
  for (
    let index = transientMessagesState.value.length - 1;
    index >= 0;
    index -= 1
  ) {
    const conversationId =
      transientMessagesState.value[index]?.message.conversation_id;
    if (conversationId) {
      streamedConversationId = conversationId;
      break;
    }
  }

  const requestError = transientRequestError.value;

  if (requestError) {
    message.error(requestError);

    if (
      regenerateMessageId === undefined &&
      editingMessageIndex === undefined &&
      !activeConversationId.value
    ) {
      prompt.value = submittedPromptText;
    }

    if (streamedConversationId) {
      rememberConversationSessionConfig(streamedConversationId);
      setActiveConversationKey(streamedConversationId);
      await fetchConversations(false);
      await loadConversationDetail(streamedConversationId);
    }

    setTransientMessages([]);
  } else {
    await fetchConversations(false);

    if (streamedConversationId) {
      rememberConversationSessionConfig(streamedConversationId);
      setActiveConversationKey(streamedConversationId);
      await loadConversationDetail(streamedConversationId);
    } else if (conversationSummaries.value[0]) {
      setActiveConversationKey(conversationSummaries.value[0].conversation_id);
      await loadConversationDetail(
        conversationSummaries.value[0].conversation_id,
      );
    }

    setTransientMessages([]);
  }

  editingMessage.value = undefined;
  editingMessageIntent.value = 'save';
  regeneratingMessageIndex.value = undefined;
}

const transientMessages = computed<ChatMessageItem[]>(() => {
  const fallbackIndex = activeMessages.value.length;
  const mergedTransientMessages: Array<{
    message: AIChatProviderMessage;
    status: 'abort' | 'error' | 'loading' | 'local' | 'success' | 'updating';
  }> = [];

  for (const info of transientMessagesState.value) {
    const lastItem = mergedTransientMessages.at(-1);

    if (
      info.message.role === 'assistant' &&
      lastItem?.message.role === 'assistant'
    ) {
      lastItem.message = mergeStreamMessage(lastItem.message, info.message);
      lastItem.status = info.status;
      continue;
    }

    mergedTransientMessages.push({
      message: info.message,
      status: info.status,
    });
  }

  return mergedTransientMessages.flatMap((info, index) => {
    return buildTransientMessageItems(
      info.message,
      fallbackIndex + index,
      info.status,
    );
  });
});

const displayMessages = computed<ChatMessageItem[]>(() => {
  return [...activeMessages.value, ...transientMessages.value];
});

const bubbleListItems = computed(() => {
  const items: BubbleListProps['items'] = [];

  for (const message of displayMessages.value) {
    const isEditing = isEditingMessage(message);

    items.push({
      content: isEditing
        ? getMessageTextContent(message)
        : renderChatMessageBubbleContent(message, {
            isDark: isDark.value,
            isThinkingExpanded,
            protocolDriver: currentChatProtocol,
            setThinkingExpanded,
          }),
      extraInfo: {
        message,
      },
      key: message.id,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      streaming: Boolean(message.role === 'assistant' && message.streaming),
    });

    if (contextDividerAfterMessageId.value === message.id) {
      items.push({
        content: '已清除上下文',
        dividerProps: {
          plain: true,
        },
        key: `${message.id}-context-divider`,
        role: 'divider',
      });
    }
  }

  return items;
});

const enabledProviders = computed(() => {
  return providers.value.filter((item) => Number(item.status) === 1);
});

const enabledModels = computed(() => {
  return models.value.filter((item) => Number(item.status) === 1);
});

const providerOptions = computed(() => {
  const options = enabledProviders.value.map((item) => ({
    label: item.name,
    value: item.id,
  }));

  if (
    selectedProviderId.value &&
    !options.some((item) => item.value === selectedProviderId.value)
  ) {
    options.unshift({
      label: `供应商 #${selectedProviderId.value}`,
      value: selectedProviderId.value,
    });
  }

  return options;
});

const modelOptions = computed(() => {
  const options = enabledModels.value.map((item) => ({
    label: item.model_id,
    value: item.model_id,
  }));

  if (
    selectedModelId.value &&
    !options.some((item) => item.value === selectedModelId.value)
  ) {
    options.unshift({
      label: selectedModelId.value,
      value: selectedModelId.value,
    });
  }

  return options;
});

const activeConversationTitle = computed(() => {
  return (
    activeConversationDetail.value?.title ||
    activeConversation.value?.title ||
    draftConversationTitle.value
  );
});

const activeConversationSubtitle = computed(() => {
  if (!activeConversation.value) {
    return '';
  }

  return `创建于 ${parseDateLabel(activeConversation.value.created_time)}`;
});

const contextDividerAfterMessageId = computed(() => {
  const detail = activeConversationDetail.value;

  if (!detail?.context_cleared_time || activeMessages.value.length === 0) {
    return undefined;
  }

  const clearedAt = new Date(detail.context_cleared_time).getTime();

  if (!Number.isNaN(clearedAt)) {
    let dividerIndex = -1;

    for (const [index, item] of activeMessages.value.entries()) {
      const messageTime = new Date(item.created_time).getTime();

      if (Number.isNaN(messageTime) || messageTime <= clearedAt) {
        dividerIndex = index;
      }
    }

    if (dividerIndex >= 0) {
      return activeMessages.value[dividerIndex]?.id;
    }
  }

  if (
    detail.context_start_message_id !== null &&
    detail.context_start_message_id !== undefined
  ) {
    const anchorIndex = activeMessages.value.findIndex(
      (item) => item.message_id === detail.context_start_message_id,
    );

    if (anchorIndex !== -1) {
      return activeMessages.value[anchorIndex]?.id;
    }
  }

  return activeMessages.value[activeMessages.value.length - 1]?.id;
});

const selectedProviderLabel = computed(() => {
  return (
    providerOptions.value.find(
      (item) => item.value === selectedProviderId.value,
    )?.label || '请选择供应商'
  );
});

const selectedModelLabel = computed(() => {
  return (
    modelOptions.value.find((item) => item.value === selectedModelId.value)
      ?.label || '请选择模型'
  );
});

const selectedProviderModelLabel = computed(() => {
  return `${selectedProviderLabel.value} / ${selectedModelLabel.value}`;
});

function hasGenerationSettingsChanged() {
  return Boolean(
    maxTokens.value !== undefined ||
    temperature.value !== 1 ||
    topP.value !== undefined ||
    timeout.value !== undefined,
  );
}

function hasBehaviorSettingsChanged() {
  return Boolean(
    seed.value !== undefined ||
    presencePenalty.value !== undefined ||
    frequencyPenalty.value !== undefined,
  );
}

function hasToolingSettingsChanged() {
  return Boolean(
    parallelToolCalls.value !== true || enableBuiltinTools.value !== true,
  );
}

function hasPassthroughSettingsChanged() {
  return Boolean(
    stopSequences.value.trim() ||
    extraHeaders.value.trim() ||
    extraBody.value.trim() ||
    logitBias.value.trim(),
  );
}

const hasAdvancedSettings = computed(() => {
  return Boolean(
    hasGenerationSettingsChanged() ||
    hasBehaviorSettingsChanged() ||
    hasToolingSettingsChanged() ||
    hasPassthroughSettingsChanged(),
  );
});

const canClearMessages = computed(() => {
  return Boolean(activeConversationId.value && activeMessages.value.length > 0);
});

const canCreateNewConversation = computed(() => {
  return activeMessages.value.length > 0;
});

const composerHint = computed(() => {
  if (editingMessage.value?.message_index !== undefined) {
    return `正在编辑第 ${editingMessage.value.message_index + 1} 条用户消息`;
  }
  if (regeneratingMessageIndex.value !== undefined) {
    return `正在重新生成第 ${regeneratingMessageIndex.value + 1} 条 AI 回复`;
  }
  return '';
});

const webSearchButtonLabel = computed(() => {
  const activeOption = WEB_SEARCH_OPTIONS.find(
    (item) => item.value === webSearch.value,
  );

  return activeOption?.label || '联网搜索';
});

const generationTypeButtonLabel = computed(() => {
  const activeOption = GENERATION_TYPE_OPTIONS.find(
    (item) => item.value === generationType.value,
  );

  return activeOption?.label || '文本';
});

const thinkingButtonLabel = computed(() => {
  const activeOption = THINKING_OPTIONS.find(
    (item) => item.value === thinking.value,
  );
  return activeOption?.label || '默认';
});

const senderAutoSize: NonNullable<SenderProps['autoSize']> = {
  maxRows: 6,
  minRows: 2,
};

const conversationItems = computed<ConversationsProps['items']>(() =>
  buildConversationSidebarItems(conversationSummaries.value),
);

const conversationCreation = computed<ConversationsProps['creation']>(() => ({
  disabled: sending.value || !canCreateNewConversation.value,
  onClick: createNewConversation,
}));

const conversationListMenu = computed<ConversationsProps['menu']>(() =>
  createConversationSidebarMenu({
    conversations: conversationSummaries.value,
    onDelete: confirmRemoveConversation,
    onPin: (conversation) => {
      void togglePinConversation(conversation);
    },
    onRename: (conversation) => {
      void startRenameConversation(conversation);
    },
  }),
);

function handleConversationActiveChange(value: number | string) {
  void selectConversation(String(value));
}

function handleQuickPhraseSelect(item: AIQuickPhraseResult) {
  appendQuickPhrase(item);
  quickPhrasePopoverOpen.value = false;
}

const suggestionItems = computed<SuggestionItem[]>(() => {
  return quickPhrases.value.map((item) => ({
    key: String(item.id),
    label: item.title,
    value: item.content,
  }));
});

function handleSuggestionSelect(value: string) {
  prompt.value = value;
}

function handleSenderSubmit(messageText: string) {
  void submitChat(undefined, true, messageText);
}

function handleSenderChange(value: string) {
  prompt.value = value;
}

function handleSenderChangeWithSuggestion(
  value: string,
  onTrigger: (info?: false | string) => void,
) {
  handleSenderChange(value);

  if (value === '/') {
    onTrigger('/');
    return;
  }

  if (!value) {
    onTrigger(false);
  }
}

function confirmDeleteMessage(item: ChatMessageItem) {
  confirm({
    content: `确认删除第 ${item.message_index + 1} 条消息吗？`,
    icon: 'warning',
  }).then(async () => {
    await deleteMessageChain(item);
  });
}

const bubbleListRole = computed<BubbleListProps['role']>(() =>
  createChatBubbleListRole({
    editingMessageIntent: editingMessageIntent.value,
    isDark: isDark.value,
    isEditingMessage,
    isThinkingExpanded,
    onBeginEditMessage: beginEditMessage,
    onCancelEditMessage: cancelEditMessage,
    onConfirmDeleteMessage: confirmDeleteMessage,
    onCopyMessage: copyMessageContent,
    onRegenerateMessage: regenerateMessage,
    onRegenerateUserMessage: regenerateUserMessage,
    onResendEditedMessage: resendEditedMessage,
    onSaveEditedMessage: saveEditedMessage,
    protocolDriver: currentChatProtocol,
    selectedModelId: selectedModelId.value,
    selectedModelLabel: selectedModelLabel.value,
    setThinkingExpanded,
  }),
);

function renderFooterIconButton(options: {
  disabled?: boolean;
  icon: string;
  onClick?: () => void;
  title: string;
}) {
  return h(AButton, {
    class: 'inline-flex size-8 items-center justify-center !px-0',
    disabled: options.disabled,
    htmlType: 'button',
    icon: h(IconifyIcon, {
      class: 'size-4',
      icon: options.icon,
    }),
    onClick: () => {
      options.onClick?.();
    },
    size: 'small',
    title: options.title,
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
                  settingsModalApi.open();
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

watch(
  selectedProviderId,
  async (providerId) => {
    await fetchModelsByProvider(providerId);
  },
  { immediate: true },
);

watch(
  displayMessages,
  (messages) => {
    const nextStates: Record<string, ThinkingPanelState> = {};

    for (const message of messages) {
      if (!hasThinkingContent(message)) {
        continue;
      }

      const key = getThinkingPanelKey(message);
      const previous = thinkingPanelStates.value[key];
      const shouldAutoExpand = Boolean(message.streaming);

      if (shouldAutoExpand) {
        nextStates[key] = {
          autoOpened: true,
          expanded: true,
        };
        continue;
      }

      if (previous?.autoOpened) {
        nextStates[key] = {
          autoOpened: false,
          expanded: false,
        };
        continue;
      }

      if (previous) {
        nextStates[key] = previous;
      }
    }

    thinkingPanelStates.value = nextStates;

    if (messages.length > 0 && autoFollowMessageScroll.value) {
      scrollToBottom();
    }
  },
  { immediate: true },
);

const [SettingsModal, settingsModalApi] = useVbenModal({
  class:
    'h-[min(78vh,760px)] w-[min(960px,92vw)] [overscroll-behavior:contain]',
  footer: true,
  onOpenChange(isOpen) {
    document.documentElement.style.overflow = isOpen ? 'hidden' : '';
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },
  title: '参数设置',
});

const [RenameConversationForm, renameConversationFormApi] = useVbenForm({
  layout: 'vertical',
  showDefaultActions: false,
  schema: renameConversationSchema,
});

const [RenameConversationModal, renameConversationModalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    await submitRenameConversation();
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = renameConversationModalApi.getData<AIChatConversationResult>();
      renameConversationFormApi.resetForm();
      if (data) {
        renameConversationFormData.value = data;
        renameConversationFormApi.setValues({
          title: data.title,
        });
      } else {
        renameConversationFormData.value = undefined;
      }
      return;
    }

    if (!isOpen) {
      resetRenameConversationState();
    }
  },
  title: '重命名话题',
});

onMounted(async () => {
  await fetchProviders();
  await fetchMcps();
  await fetchQuickPhrases();
  await initializeSession();

  hasInitialized = true;
});

onActivated(async () => {
  if (!hasInitialized) {
    return;
  }

  await refreshChatResources();
  await initializeSession();
});

onBeforeUnmount(() => {
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  abortTransientRequest();
});
</script>

<template>
  <ColPage
    auto-content-height
    content-class="h-full"
    :left-width="20"
    :right-width="80"
  >
    <template #left>
      <ChatSidebar
        :active-key="activeConversationId"
        :creation="conversationCreation"
        :has-more="hasMoreConversations"
        :items="conversationItems || []"
        :loading="sidebarLoading"
        :loading-more="sidebarMoreLoading"
        :menu="conversationListMenu"
        :on-active-change="handleConversationActiveChange"
        :on-load-more="loadMoreConversations"
      />
    </template>

    <section
      class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
    >
      <div class="border-b border-border px-5 py-4 md:px-6">
        <div class="flex flex-wrap items-start gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 items-center justify-between gap-4">
              <div class="inline-flex min-w-0 max-w-full items-center gap-2">
                <div
                  class="min-w-0 max-w-[220px] truncate text-[13px] font-semibold leading-7 text-foreground"
                  :title="activeConversationTitle"
                >
                  {{ activeConversationTitle }}
                </div>
                <IconifyIcon
                  class="size-3 shrink-0 text-muted-foreground"
                  icon="mdi:chevron-right"
                />
                <a-popover placement="bottomLeft" trigger="click">
                  <template #content>
                    <div class="w-[280px] space-y-3">
                      <div>
                        <div class="mb-2 text-xs font-medium text-foreground">
                          供应商
                        </div>
                        <a-select
                          v-model:value="selectedProviderId"
                          class="w-full"
                          :disabled="sending || resourcesLoading"
                          :options="providerOptions"
                          placeholder="请选择供应商"
                        />
                      </div>
                      <div>
                        <div class="mb-2 text-xs font-medium text-foreground">
                          模型
                        </div>
                        <a-select
                          v-model:value="selectedModelId"
                          class="w-full"
                          :disabled="
                            sending ||
                            resourcesLoading ||
                            modelOptions.length === 0
                          "
                          :options="modelOptions"
                          placeholder="请选择模型"
                        />
                      </div>
                    </div>
                  </template>
                  <button
                    class="inline-flex min-w-0 max-w-[360px] items-center gap-1 rounded-md px-1 py-1 text-[13px] leading-7 text-foreground transition-colors hover:bg-accent/55"
                    :disabled="sending || resourcesLoading"
                    type="button"
                  >
                    <span class="truncate">{{
                      selectedProviderModelLabel
                    }}</span>
                    <IconifyIcon
                      class="size-3.5 shrink-0 text-muted-foreground"
                      icon="mdi:chevron-down"
                    />
                  </button>
                </a-popover>
              </div>
              <div
                class="min-w-0 flex-1 truncate text-right text-xs leading-tight text-muted-foreground"
                :title="activeConversationSubtitle"
              >
                {{ activeConversationSubtitle }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref="messageContainerRef"
        class="flex-1 overflow-x-hidden overflow-y-auto bg-background/60 px-5 py-5 md:px-6 md:py-6"
        @scroll="handleMessageContainerScroll"
      >
        <div
          v-if="detailLoading"
          class="flex min-h-full items-center justify-center"
        >
          <ASpin />
        </div>
        <div
          v-else-if="displayMessages.length === 0"
          class="flex min-h-full items-center justify-center"
        >
          <div class="w-full max-w-[720px]">
            <Welcome
              :description="
                selectedProviderId && selectedModelId
                  ? `当前模型：${selectedProviderModelLabel}`
                  : '选择供应商和模型后开始对话'
              "
              title="你好，我是 FBA UI 智能助手"
            />
          </div>
        </div>
        <BubbleList
          v-else
          :items="bubbleListItems"
          :role="bubbleListRole"
          class="min-h-full"
        />
      </div>

      <Suggestion
        block
        :items="suggestionItems"
        @select="handleSuggestionSelect"
      >
        <template #default="{ onKeyDown, onTrigger }">
          <ChatSender
            :auto-size="senderAutoSize"
            :disabled="false"
            :footer="renderSenderFooter"
            :loading="sending"
            name="chat-message"
            :on-cancel="stopStreaming"
            :on-change="
              (value: string) =>
                handleSenderChangeWithSuggestion(String(value), onTrigger)
            "
            :on-key-down="onKeyDown"
            :on-submit="handleSenderSubmit"
            placeholder="在这里输入消息，按 Enter 发送"
            :suffix="false"
            :value="prompt"
          />
        </template>
      </Suggestion>
    </section>

    <SettingsModal
      content-class="h-full min-h-0 overflow-hidden p-0 [overscroll-behavior:contain]"
      footer-class="border-t border-border px-4 py-4 md:px-5"
      :show-cancel-button="false"
      :show-confirm-button="false"
    >
      <template #title>
        <span>参数设置</span>
      </template>
      <template #append-footer>
        <AButton danger type="primary" @click="resetModelSettings">
          重置
        </AButton>
      </template>
      <ChatSettingsPanel
        v-model:enable-builtin-tools="enableBuiltinTools"
        v-model:extra-body="extraBody"
        v-model:extra-headers="extraHeaders"
        v-model:frequency-penalty="frequencyPenalty"
        v-model:logit-bias="logitBias"
        v-model:max-tokens="maxTokens"
        v-model:parallel-tool-calls="parallelToolCalls"
        v-model:presence-penalty="presencePenalty"
        v-model:seed="seed"
        v-model:stop-sequences="stopSequences"
        v-model:temperature="temperature"
        v-model:timeout="timeout"
        v-model:top-p="topP"
      />
    </SettingsModal>

    <RenameConversationModal content-class="px-4 py-4 md:px-5 md:py-5">
      <RenameConversationForm />
    </RenameConversationModal>
  </ColPage>
</template>
