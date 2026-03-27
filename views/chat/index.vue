<script setup lang="ts">
import type { MenuItemType } from 'antdv-next';

import type { ChatMessageItem } from './data';

import type {
  AIChatConversationDetail,
  AIChatConversationItem,
  AIChatMessage,
  AIChatParams,
  AIMcpResult,
  AIModelResult,
  AIProviderResult,
  AIQuickPhraseResult,
} from '#/plugins/ai/api';

import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import {
  confirm,
  Page,
  useVbenModal,
  VbenButton,
} from '@vben/common-ui';
import {
  IconifyIcon,
  MaterialSymbolsDelete,
  MaterialSymbolsEdit,
  Pin,
  PinOff,
} from '@vben/icons';

import { useClipboard } from '@vueuse/core';
import { message } from 'antdv-next';

import {
  clearAIChatConversationMessagesApi,
  deleteAIChatConversationApi,
  deleteAIChatMessageApi,
  getAIChatConversationDetailApi,
  getAllAIMcpApi,
  getAllAIModelApi,
  getAllAIProviderApi,
  getAllAIQuickPhraseApi,
  getRecentAIChatConversationsApi,
  pinAIChatConversationApi,
  streamAIChatApi,
  updateAIChatConversationApi,
  updateAIChatMessageApi,
} from '#/plugins/ai/api';

import {
  buildMessageId,
  COMPOSER_DEFAULT_HEIGHT,
  COMPOSER_FALLBACK_MAX_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  EXTRA_BODY_PLACEHOLDER,
  EXTRA_HEADERS_PLACEHOLDER,
  LOGIT_BIAS_PLACEHOLDER,
  makeConversationTitle,
  mergeModelContent,
  MIN_MESSAGE_VIEWPORT_HEIGHT,
  normalizeMessage,
  parseDateLabel,
  parseJsonField,
  resolveChatMessageContent,
  STOP_SEQUENCES_PLACEHOLDER,
} from './data';
import AIChatMarkdown from './components/chat-markdown.vue';
import { createAIChatStreamAdapter } from './x-chat-adapter';

type ThinkingPanelState = {
  autoOpened: boolean;
  expanded: boolean;
};

type DisplayChatMessageItem =
  | {
      id: string;
      kind: 'message';
      message: ChatMessageItem;
      thinkingContent?: string;
      thinkingSourceId?: string;
      thinkingStreaming?: boolean;
      thinkingTimestamp?: string;
    }
  | {
      id: string;
      kind: 'pending-thinking';
      thinkingContent: string;
      thinkingSourceId: string;
      thinkingStreaming: boolean;
      thinkingTimestamp?: string;
    };

const { copy } = useClipboard({ legacy: true });
const prompt = ref('');
const streamError = ref('');
const draftConversationTitle = ref('新话题');
const selectedProviderId = ref<number>();
const selectedModelId = ref<string>();
const activeConversationId = ref<string>();
const editingMessage = ref<ChatMessageItem>();
const editingMessageDraft = ref('');
const regeneratingMessageIndex = ref<number>();
const isRenamingConversation = ref(false);
const renameTitle = ref('');

const providers = ref<AIProviderResult[]>([]);
const models = ref<AIModelResult[]>([]);
const mcps = ref<AIMcpResult[]>([]);
const quickPhrases = ref<AIQuickPhraseResult[]>([]);
const conversations = ref<AIChatConversationItem[]>([]);
const activeMessages = ref<ChatMessageItem[]>([]);

const messageContainerRef = ref<HTMLElement>();

const resourcesLoading = ref(false);
const quickPhraseLoading = ref(false);
const sidebarLoading = ref(false);
const sidebarMoreLoading = ref(false);
const detailLoading = ref(false);
const sending = ref(false);

const hasMoreConversations = ref(false);
const conversationBeforeCursor = ref<string>();

const maxTokens = ref<number>();
const temperature = ref(1);
const topP = ref<number>();
const timeout = ref<number>();
const seed = ref<number>();
const presencePenalty = ref<number>();
const frequencyPenalty = ref<number>();
const parallelToolCalls = ref(true);
const includeThinking = ref(true);
const reasoningEffort = ref('');
const enableBuiltinTools = ref(true);
const selectedMcpIds = ref<number[]>([]);
const outputMode = ref<'native' | 'prompted' | 'text' | 'tool'>('text');
const webSearch = ref<'builtin' | 'duckduckgo' | 'tavily'>('builtin');
const outputSchema = ref('');
const outputSchemaName = ref('');
const outputSchemaDescription = ref('');
const stopSequences = ref('');
const extraHeaders = ref('');
const extraBody = ref('');
const logitBias = ref('');
const composerHeight = ref(56);
const isComposerResizing = ref(false);
const isComposerExpanded = ref(false);
const composerExpandedBackupHeight = ref(56);
const messageViewportHeight = ref(0);
const quickPhrasePopoverOpen = ref(false);
const thinkingPanelStates = ref<Record<string, ThinkingPanelState>>({});

const WEB_SEARCH_OPTIONS: Array<{
  desc: string;
  label: string;
  value: 'builtin' | 'duckduckgo' | 'tavily';
}> = [
  {
    desc: '优先使用模型内置搜索能力',
    label: '内置搜索',
    value: 'builtin',
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

const REASONING_EFFORT_OPTIONS: Array<{
  desc: string;
  label: string;
  value: '' | 'high' | 'low' | 'medium' | 'minimal' | 'none' | 'xhigh';
}> = [
  {
    desc: '使用模型默认推理强度',
    label: '默认',
    value: '',
  },
  {
    desc: '关闭额外推理',
    label: 'none',
    value: 'none',
  },
  {
    desc: '极低推理强度，响应更快',
    label: 'minimal',
    value: 'minimal',
  },
  {
    desc: '较低推理强度',
    label: 'low',
    value: 'low',
  },
  {
    desc: '平衡速度与推理质量',
    label: 'medium',
    value: 'medium',
  },
  {
    desc: '较高推理强度',
    label: 'high',
    value: 'high',
  },
  {
    desc: '最高推理强度，可能更慢',
    label: 'xhigh',
    value: 'xhigh',
  },
];

let currentModelFetchId = 0;
let currentConversationFetchId = 0;
let currentStreamId = 0;
let currentQuickPhrasePopoverRequestId = 0;
let abortController: AbortController | undefined;
let composerResizeStartY = 0;
let composerResizeStartHeight = COMPOSER_MIN_HEIGHT;
let composerLayoutObserver: ResizeObserver | undefined;

function upsertConversation(summary: AIChatConversationItem) {
  const index = conversations.value.findIndex(
    (item) => item.conversation_id === summary.conversation_id,
  );

  if (index === -1) {
    conversations.value.unshift(summary);
  } else {
    conversations.value[index] = summary;
  }
}

function removeConversationSummary(conversationId: string) {
  conversations.value = conversations.value.filter(
    (item) => item.conversation_id !== conversationId,
  );
}

function scrollToBottom() {
  nextTick(() => {
    const container = messageContainerRef.value;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  });
}

function scrollToTop() {
  nextTick(() => {
    messageContainerRef.value?.scrollTo({ top: 0 });
  });
}

function mergeThinkingContent(previous: string, incoming: string) {
  if (!previous) {
    return incoming;
  }
  if (!incoming) {
    return previous;
  }
  if (incoming.startsWith(previous)) {
    return incoming;
  }
  return `${previous}\n\n${incoming}`;
}

function getThinkingPanelKey(item: DisplayChatMessageItem) {
  return item.thinkingSourceId ?? item.id;
}

function isThinkingExpanded(item: DisplayChatMessageItem) {
  return Boolean(thinkingPanelStates.value[getThinkingPanelKey(item)]?.expanded);
}

function toggleThinkingPanel(item: DisplayChatMessageItem) {
  const key = getThinkingPanelKey(item);
  const current = thinkingPanelStates.value[key];
  thinkingPanelStates.value = {
    ...thinkingPanelStates.value,
    [key]: {
      autoOpened: false,
      expanded: !current?.expanded,
    },
  };
}

function getThinkingToggleLabel(item: DisplayChatMessageItem) {
  const expanded = isThinkingExpanded(item);
  if (item.thinkingStreaming) {
    return expanded ? '正在思考，收起思维链' : '正在思考';
  }
  return expanded ? '已思考，收起思维链' : '已思考，查看思维链';
}

function resetAdvancedSettings() {
  maxTokens.value = undefined;
  temperature.value = 1;
  topP.value = undefined;
  timeout.value = undefined;
  seed.value = undefined;
  presencePenalty.value = undefined;
  frequencyPenalty.value = undefined;
  parallelToolCalls.value = true;
  includeThinking.value = true;
  reasoningEffort.value = '';
  enableBuiltinTools.value = true;
  selectedMcpIds.value = [];
  outputMode.value = 'text';
  webSearch.value = 'builtin';
  outputSchema.value = '';
  outputSchemaName.value = '';
  outputSchemaDescription.value = '';
  stopSequences.value = '';
  extraHeaders.value = '';
  extraBody.value = '';
  logitBias.value = '';
}

function resetComposerState(clearPrompt = false) {
  editingMessage.value = undefined;
  regeneratingMessageIndex.value = undefined;
  if (clearPrompt) {
    prompt.value = '';
  }
}

function createNewConversation() {
  stopStreaming();
  currentConversationFetchId++;
  activeConversationId.value = undefined;
  activeMessages.value = [];
  draftConversationTitle.value = '新话题';
  detailLoading.value = false;
  streamError.value = '';
  isRenamingConversation.value = false;
  renameTitle.value = '';
  resetComposerState(true);
  scrollToTop();
}

function syncConversationSummaryFromDetail(detail: AIChatConversationDetail) {
  const existingConversation = conversations.value.find(
    (item) => item.conversation_id === detail.conversation_id,
  );
  upsertConversation({
    conversation_id: detail.conversation_id,
    created_time: detail.created_time,
    id: detail.id,
    is_pinned: existingConversation?.is_pinned ?? false,
    title: detail.title,
    updated_time: detail.updated_time,
  });
}

function finalizeStreamingMessages() {
  activeMessages.value = activeMessages.value.map((item) => ({
    ...item,
    streaming: false,
  }));
}

function insertOptimisticUserMessage(content: string) {
  const hasStreamingUser = activeMessages.value.some(
    (item) => item.role === 'user' && item.streaming,
  );
  if (hasStreamingUser) {
    return;
  }

  activeMessages.value.push({
    content,
    conversation_id: activeConversationId.value ?? null,
    error_message: null,
    id: buildMessageId(`streaming-user-${Date.now()}`),
    is_error: false,
    message_id: null,
    message_index: activeMessages.value.length,
    role: 'user',
    structured_data: null,
    streaming: true,
    timestamp: new Date().toISOString(),
  });
}

function insertStreamingModelSkeleton() {
  const hasStreamingModel = activeMessages.value.some(
    (item) => item.role === 'model' && item.streaming,
  );
  if (hasStreamingModel) {
    return;
  }

  activeMessages.value.push({
    content: '',
    conversation_id: activeConversationId.value ?? null,
    error_message: null,
    id: `streaming-model-${Date.now()}`,
    is_error: false,
    message_id: null,
    message_index: activeMessages.value.length,
    role: 'model',
    structured_data: null,
    streaming: true,
    timestamp: new Date().toISOString(),
  });
}

function stopStreaming() {
  abortController?.abort();
  abortController = undefined;
  sending.value = false;
  finalizeStreamingMessages();
}

function findStreamingMessage(data: AIChatMessage) {
  for (let index = activeMessages.value.length - 1; index >= 0; index -= 1) {
    const item = activeMessages.value[index];
    if (!item) {
      continue;
    }

    if (data.message_id !== undefined && data.message_id !== null) {
      if (item.message_id === data.message_id) {
        return item;
      }
      continue;
    }

    if (
      item.role === data.role &&
      (data.message_index === undefined ||
        data.message_index === item.message_index)
    ) {
      return item;
    }
  }

  return undefined;
}

function applyStreamMessage(data: AIChatMessage) {
  const messageContent = resolveChatMessageContent(data);
  const existingConversation = activeConversationId.value
    ? conversations.value.find(
        (item) => item.conversation_id === activeConversationId.value,
      )
    : undefined;

  if (data.conversation_id && !activeConversationId.value) {
    activeConversationId.value = data.conversation_id;
    upsertConversation({
      conversation_id: data.conversation_id,
      created_time: data.timestamp,
      id: 0,
      is_pinned: false,
      title: draftConversationTitle.value,
      updated_time: data.timestamp,
    });
  }

  const existingMessage = findStreamingMessage(data);

  if (data.role === 'user') {
    if (existingMessage) {
      existingMessage.content = messageContent;
      existingMessage.conversation_id =
        data.conversation_id ?? existingMessage.conversation_id;
      existingMessage.error_message =
        data.error_message ?? existingMessage.error_message;
      existingMessage.is_error = data.is_error ?? existingMessage.is_error;
      existingMessage.message_id = data.message_id ?? existingMessage.message_id;
      existingMessage.message_index =
        data.message_index ?? existingMessage.message_index;
      existingMessage.structured_data =
        data.structured_data ?? existingMessage.structured_data;
      existingMessage.timestamp = data.timestamp;
      existingMessage.streaming = true;
    } else {
      activeMessages.value.push(
        normalizeMessage(
          data,
          activeMessages.value.length,
          activeConversationId.value,
        ),
      );
    }
  } else {
    if (existingMessage && existingMessage.role === data.role) {
      const lastMessage = existingMessage;
      lastMessage.content = mergeModelContent(
        lastMessage.content,
        messageContent,
      );
      lastMessage.conversation_id =
        data.conversation_id ?? lastMessage.conversation_id;
      lastMessage.error_message = data.error_message ?? lastMessage.error_message;
      lastMessage.is_error = data.is_error ?? lastMessage.is_error;
      lastMessage.message_id = data.message_id ?? lastMessage.message_id;
      lastMessage.message_index =
        data.message_index ?? lastMessage.message_index;
      lastMessage.structured_data =
        data.structured_data ?? lastMessage.structured_data;
      lastMessage.timestamp = data.timestamp;
      lastMessage.streaming = true;
    } else {
      activeMessages.value.push({
        ...normalizeMessage(
          data,
          activeMessages.value.length,
          activeConversationId.value,
        ),
        streaming: true,
      });
    }
  }

  if (activeConversationId.value) {
    upsertConversation({
      conversation_id: activeConversationId.value,
      created_time: existingConversation?.created_time || data.timestamp,
      id: existingConversation?.id || 0,
      is_pinned: existingConversation?.is_pinned || false,
      title: existingConversation?.title || draftConversationTitle.value,
      updated_time: data.timestamp,
    });
  }

  scrollToBottom();
}

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
  if (!open) {
    currentQuickPhrasePopoverRequestId++;
    quickPhrasePopoverOpen.value = false;
    return;
  }

  const requestId = ++currentQuickPhrasePopoverRequestId;
  await fetchQuickPhrases();

  if (requestId !== currentQuickPhrasePopoverRequestId) {
    return;
  }

  quickPhrasePopoverOpen.value = true;
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
    const data = await getAllAIQuickPhraseApi();
    quickPhrases.value = data;
  } finally {
    quickPhraseLoading.value = false;
  }
}

async function fetchConversations(append = false) {
  if (append) {
    sidebarMoreLoading.value = true;
  } else {
    sidebarLoading.value = true;
  }

  try {
    const data = await getRecentAIChatConversationsApi({
      cursor: append ? conversationBeforeCursor.value : undefined,
      size: 20,
    });

    if (append) {
      const existingIds = new Set(
        conversations.value.map((item) => item.conversation_id),
      );
      conversations.value = [
        ...conversations.value,
        ...data.items.filter((item) => !existingIds.has(item.conversation_id)),
      ];
    } else {
      conversations.value = data.items;
    }

    hasMoreConversations.value = data.has_more;
    conversationBeforeCursor.value = data.next_cursor || undefined;
  } finally {
    if (append) {
      sidebarMoreLoading.value = false;
    } else {
      sidebarLoading.value = false;
    }
  }
}

async function loadConversationDetail(conversationId: string) {
  const fetchId = ++currentConversationFetchId;
  detailLoading.value = true;

  try {
    const detail = await getAIChatConversationDetailApi(conversationId);

    if (
      fetchId !== currentConversationFetchId ||
      activeConversationId.value !== conversationId
    ) {
      return;
    }

    syncConversationSummaryFromDetail(detail);
    activeMessages.value = detail.messages.map((item, index) =>
      normalizeMessage(item, index, activeConversationId.value),
    );
    selectedProviderId.value = detail.provider_id;
    selectedModelId.value = detail.model_id;
    draftConversationTitle.value = detail.title;
    scrollToBottom();
  } finally {
    if (fetchId === currentConversationFetchId) {
      detailLoading.value = false;
    }
  }
}

async function selectConversation(conversationId: string) {
  if (
    conversationId === activeConversationId.value &&
    activeMessages.value.length > 0 &&
    !detailLoading.value
  ) {
    return;
  }

  stopStreaming();
  streamError.value = '';
  isRenamingConversation.value = false;
  renameTitle.value = '';
  resetComposerState(true);
  activeConversationId.value = conversationId;
  await loadConversationDetail(conversationId);
}

async function loadMoreConversations() {
  if (!hasMoreConversations.value || sidebarMoreLoading.value) {
    return;
  }
  await fetchConversations(true);
}

function appendQuickPhrase(item: AIQuickPhraseResult) {
  prompt.value = prompt.value.trim()
    ? `${prompt.value.trim()}\n${item.content}`
    : item.content;
}

function beginEditMessage(item: ChatMessageItem) {
  if (
    item.role !== 'user' ||
    item.message_id === undefined ||
    item.message_id === null
  ) {
    return;
  }

  editingMessage.value = item;
  editingMessageDraft.value = item.content;
  regeneratingMessageIndex.value = undefined;
}

function cancelEditMessage() {
  editingMessage.value = undefined;
  editingMessageDraft.value = '';
}

function isEditingMessage(item: ChatMessageItem) {
  return editingMessage.value?.id === item.id;
}

function updateMessageContent(target: ChatMessageItem, content: string) {
  activeMessages.value = activeMessages.value.map((item) =>
    item.id === target.id
      ? {
          ...item,
          content,
        }
      : item,
  );
}

async function saveEditedMessage() {
  const trimmedContent = editingMessageDraft.value.trim();
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

  await updateAIChatMessageApi(targetMessage.conversation_id, targetMessage.message_id, {
    content: trimmedContent,
  });
  updateMessageContent(targetMessage, trimmedContent);
  cancelEditMessage();
  await loadConversationDetail(targetMessage.conversation_id);
  message.success('消息内容已保存');
}

async function resendEditedMessage() {
  const trimmedContent = editingMessageDraft.value.trim();
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
  editingMessage.value = {
    ...targetMessage,
    content: trimmedContent,
  };
  if (targetMessage.conversation_id) {
    await updateAIChatMessageApi(targetMessage.conversation_id, targetMessage.message_id, {
      content: trimmedContent,
    });
  }
  await submitChat(undefined, true, trimmedContent);
}

async function regenerateUserMessage(item: ChatMessageItem) {
  if (
    item.role !== 'user' ||
    item.message_id === undefined ||
    item.message_id === null
  ) {
    return;
  }

  editingMessage.value = item;
  editingMessageDraft.value = item.content;
  regeneratingMessageIndex.value = undefined;
  await submitChat(undefined, true, item.content);
}

async function copyMessageContent(item: ChatMessageItem) {
  await copy(item.content);
  message.success('消息内容已复制');
}

async function startRenameConversation(conversation?: AIChatConversationItem) {
  const targetConversation = conversation || activeConversation.value;
  if (!targetConversation) {
    return;
  }

  if (targetConversation.conversation_id !== activeConversationId.value) {
    await selectConversation(targetConversation.conversation_id);
  }

  renameTitle.value = targetConversation.title;
  isRenamingConversation.value = true;
}

function cancelRenameConversation() {
  isRenamingConversation.value = false;
  renameTitle.value = '';
}

async function submitRenameConversation() {
  const conversationId = activeConversationId.value;
  const conversation = activeConversation.value;
  const title = renameTitle.value.trim();

  if (!conversationId || !conversation || !title) {
    message.error('请输入话题标题');
    return;
  }

  await updateAIChatConversationApi(conversationId, { title });
  upsertConversation({
    ...conversation,
    title,
  });
  draftConversationTitle.value = title;
  isRenamingConversation.value = false;
  renameTitle.value = '';
  message.success('话题标题已更新');
}

async function togglePinConversation(conversation?: AIChatConversationItem) {
  const targetConversation = conversation || activeConversation.value;
  if (!targetConversation) {
    return;
  }

  await pinAIChatConversationApi(targetConversation.conversation_id, {
    is_pinned: !targetConversation.is_pinned,
  });
  await fetchConversations(false);
  message.success(targetConversation.is_pinned ? '已取消置顶' : '已置顶话题');
}

async function removeConversation(conversationId: string) {
  stopStreaming();
  await deleteAIChatConversationApi(conversationId);
  removeConversationSummary(conversationId);

  if (activeConversationId.value === conversationId) {
    const nextConversation = conversations.value.find(
      (item) => item.conversation_id !== conversationId,
    );

    if (nextConversation) {
      activeConversationId.value = nextConversation.conversation_id;
      await loadConversationDetail(nextConversation.conversation_id);
    } else {
      createNewConversation();
    }
  }

  message.success('聊天历史已删除');
}

function confirmRemoveConversation(conversation: AIChatConversationItem) {
  confirm({
    content: `确认删除“${conversation.title}”吗？`,
    icon: 'warning',
  }).then(async () => {
    await removeConversation(conversation.conversation_id);
  });
}

function getConversationMenuItems(
  conversation: AIChatConversationItem,
): MenuItemType[] {
  return [
    {
      icon: h(MaterialSymbolsEdit, { class: 'size-4' }),
      key: 'rename',
      label: '重命名',
    },
    {
      icon: h(conversation.is_pinned ? PinOff : Pin, { class: 'size-4' }),
      key: 'pin',
      label: conversation.is_pinned ? '取消置顶' : '置顶',
    },
    {
      type: 'divider',
    },
    {
      danger: true,
      icon: h(MaterialSymbolsDelete, { class: 'size-4' }),
      key: 'delete',
      label: '删除',
    },
  ] satisfies MenuItemType[];
}

function handleConversationMenuClick(
  key: string,
  conversation: AIChatConversationItem,
) {
  switch (key) {
    case 'delete': {
      confirmRemoveConversation(conversation);
      break;
    }
    case 'pin': {
      void togglePinConversation(conversation);
      break;
    }
    case 'rename': {
      void startRenameConversation(conversation);
      break;
    }
  }
}

async function clearMessages() {
  stopStreaming();
  const conversation = activeConversation.value;

  if (!activeConversationId.value) {
    activeMessages.value = [];
    streamError.value = '';
    return;
  }

  await clearAIChatConversationMessagesApi(activeConversationId.value);
  activeMessages.value = [];
  if (conversation) {
    upsertConversation({
      ...conversation,
      updated_time: new Date().toISOString(),
    });
  }
  streamError.value = '';
  message.success('当前话题消息已清空');
}

async function deleteMessageChain(item: ChatMessageItem) {
  if (
    !activeConversationId.value ||
    item.message_id === undefined ||
    item.message_id === null
  ) {
    return;
  }

  stopStreaming();

  const result = await deleteAIChatMessageApi(
    activeConversationId.value,
    item.message_id,
  );

  if (result.deleted_conversation) {
    const deletedConversationId = activeConversationId.value;
    removeConversationSummary(deletedConversationId);
    const nextConversation = conversations.value.find(
      (conversation) => conversation.conversation_id !== deletedConversationId,
    );

    if (nextConversation) {
      activeConversationId.value = nextConversation.conversation_id;
      await loadConversationDetail(nextConversation.conversation_id);
    } else {
      createNewConversation();
    }
  } else {
    await fetchConversations(false);
    await loadConversationDetail(activeConversationId.value);
  }

  message.success('聊天消息已删除');
}

async function regenerateMessage(item: ChatMessageItem) {
  if (
    item.role !== 'model' ||
    item.message_id === undefined ||
    item.message_id === null
  ) {
    return;
  }

  regeneratingMessageIndex.value = item.message_index;
  editingMessage.value = undefined;
  await submitChat(item.message_id);
}

async function submitChat(
  regenerateMessageId?: number,
  notifyInvalid = false,
  overridePromptText?: string,
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
  if (editingMessage.value && editingMessageId == null) {
    message.warning('当前消息暂不可编辑，请刷新后重试');
    return;
  }
  const chatMode: AIChatParams['mode'] =
    regenerateMessageId != null
      ? 'regenerate'
      : editingMessageId != null
        ? 'edit'
        : 'create';
  const submittedTitle =
    activeConversationId.value || !promptText
      ? draftConversationTitle.value
      : makeConversationTitle(promptText);

  let payload: AIChatParams;
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
      mcp_ids: selectedMcpIds.value.length > 0 ? selectedMcpIds.value : undefined,
      model_id: selectedModelId.value,
      output_mode: outputMode.value,
      output_schema: parseJsonField<Record<string, unknown>>(
        outputSchema.value,
        '输出 Schema',
        (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      ),
      output_schema_description: outputSchemaDescription.value.trim() || undefined,
      output_schema_name: outputSchemaName.value.trim() || undefined,
      parallel_tool_calls: parallelToolCalls.value,
      presence_penalty: presencePenalty.value,
      provider_id: selectedProviderId.value,
      include_thinking: includeThinking.value,
      mode: chatMode,
      reasoning_effort: reasoningEffort.value.trim() || undefined,
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
      ...(chatMode === 'edit'
        ? { edit_message_id: editingMessageId, user_prompt: promptText! }
        : {}),
      ...(chatMode === 'create' ? { user_prompt: promptText! } : {}),
      ...(chatMode === 'regenerate'
        ? { regenerate_message_id: regenerateMessageId! }
        : {}),
    };
  } catch (error) {
    message.error((error as Error).message);
    return;
  }

  if (editingMessageIndex !== undefined) {
    activeMessages.value = activeMessages.value.filter(
      (item) => item.message_index < editingMessageIndex,
    );
  } else if (regeneratingMessageIndex.value !== undefined) {
    activeMessages.value = activeMessages.value.filter(
      (item) => item.message_index < regeneratingMessageIndex.value!,
    );
  }

  if (!activeConversationId.value) {
    draftConversationTitle.value = submittedTitle;
  }

  const streamId = ++currentStreamId;
  abortController?.abort();
  abortController = new AbortController();
  sending.value = true;
  streamError.value = '';
  if (regenerateMessageId === undefined) {
    prompt.value = '';
  }
  if (regenerateMessageId === undefined && editingMessageId == null && promptText) {
    insertOptimisticUserMessage(promptText);
  }
  insertStreamingModelSkeleton();

  let streamedConversationId = activeConversationId.value;
  const streamAdapter = createAIChatStreamAdapter({
    onMessage: (data) => {
      if (data.conversation_id) {
        streamedConversationId = data.conversation_id;
      }
      applyStreamMessage(data);
    },
  });

  try {
    await streamAIChatApi(payload, {
      signal: abortController.signal,
      onMessage: (chunk) => {
        if (streamId !== currentStreamId) {
          return;
        }

        streamAdapter.consumeChunk(chunk);
      },
    });
    await streamAdapter.flush();

    finalizeStreamingMessages();
    await fetchConversations(false);

    if (streamedConversationId) {
      activeConversationId.value = streamedConversationId;
      await loadConversationDetail(streamedConversationId);
    } else if (conversations.value[0]) {
      activeConversationId.value = conversations.value[0].conversation_id;
      await loadConversationDetail(
        conversations.value[0].conversation_id,
      );
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      streamError.value = (error as Error).message;
      message.error(streamError.value);

      if (
        regenerateMessageId === undefined &&
        editingMessageIndex === undefined &&
        !activeConversationId.value
      ) {
        prompt.value = promptText || '';
      }
    }

    finalizeStreamingMessages();

    if (streamedConversationId) {
      activeConversationId.value = streamedConversationId;
      await fetchConversations(false);
      await loadConversationDetail(streamedConversationId);
    }
  } finally {
    await streamAdapter.cancel();
    if (streamId === currentStreamId) {
      abortController = undefined;
      sending.value = false;
      editingMessage.value = undefined;
      editingMessageDraft.value = '';
      regeneratingMessageIndex.value = undefined;
    }
  }
}

function handlePromptKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitChat(undefined, true);
  }
}

function getComposerMaxHeight() {
  const messageHeight =
    messageViewportHeight.value || messageContainerRef.value?.clientHeight || 0;

  if (!messageHeight) {
    return COMPOSER_FALLBACK_MAX_HEIGHT;
  }

  const expandableHeight = Math.max(
    0,
    messageHeight - MIN_MESSAGE_VIEWPORT_HEIGHT,
  );

  return Math.max(COMPOSER_MIN_HEIGHT, composerHeight.value + expandableHeight);
}

function setComposerHeight(nextHeight: number) {
  composerHeight.value = Math.min(
    getComposerMaxHeight(),
    Math.max(COMPOSER_MIN_HEIGHT, nextHeight),
  );
}

function syncComposerLayout() {
  messageViewportHeight.value = messageContainerRef.value?.clientHeight || 0;

  const nextHeight = Math.min(composerHeight.value, getComposerMaxHeight());
  if (nextHeight !== composerHeight.value) {
    composerHeight.value = nextHeight;
  }
}

function setupComposerLayoutObserver() {
  syncComposerLayout();

  if (typeof ResizeObserver === 'undefined' || !messageContainerRef.value) {
    window.addEventListener('resize', syncComposerLayout);
    return;
  }

  composerLayoutObserver = new ResizeObserver(() => {
    syncComposerLayout();
  });
  composerLayoutObserver.observe(messageContainerRef.value);
  window.addEventListener('resize', syncComposerLayout);
}

function teardownComposerLayoutObserver() {
  composerLayoutObserver?.disconnect();
  composerLayoutObserver = undefined;
  window.removeEventListener('resize', syncComposerLayout);
}

function handleComposerResizeMove(event: MouseEvent) {
  if (!isComposerResizing.value) {
    return;
  }

  const nextHeight =
    composerResizeStartHeight - (event.clientY - composerResizeStartY);

  setComposerHeight(nextHeight);
  isComposerExpanded.value = false;
}

function stopComposerResize() {
  if (!isComposerResizing.value) {
    return;
  }

  isComposerResizing.value = false;
  document.body.style.userSelect = '';
  document.documentElement.style.cursor = '';
  window.removeEventListener('mousemove', handleComposerResizeMove);
  window.removeEventListener('mouseup', stopComposerResize);
}

function startComposerResize(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  composerResizeStartY = event.clientY;
  composerResizeStartHeight = composerHeight.value;
  isComposerResizing.value = true;
  document.body.style.userSelect = 'none';
  document.documentElement.style.cursor = 'ns-resize';
  window.addEventListener('mousemove', handleComposerResizeMove);
  window.addEventListener('mouseup', stopComposerResize);
}

function toggleComposerExpanded() {
  if (isComposerExpanded.value) {
    setComposerHeight(composerExpandedBackupHeight.value);
    isComposerExpanded.value = false;
    return;
  }

  composerExpandedBackupHeight.value = composerHeight.value;
  setComposerHeight(getComposerMaxHeight());
  isComposerExpanded.value = true;
}

const activeConversation = computed(() => {
  return conversations.value.find(
    (item) => item.conversation_id === activeConversationId.value,
  );
});

const displayMessages = computed<DisplayChatMessageItem[]>(() => {
  const items: DisplayChatMessageItem[] = [];
  let pendingThinking:
    | {
        content: string;
        sourceId: string;
        streaming: boolean;
        timestamp?: string;
      }
    | undefined;

  const flushPendingThinking = () => {
    if (!pendingThinking) {
      return;
    }
    items.push({
      id: `thinking-${pendingThinking.sourceId}`,
      kind: 'pending-thinking',
      thinkingContent: pendingThinking.content,
      thinkingSourceId: pendingThinking.sourceId,
      thinkingStreaming: pendingThinking.streaming,
      thinkingTimestamp: pendingThinking.timestamp,
    });
    pendingThinking = undefined;
  };

  for (const message of activeMessages.value) {
    if (message.role === 'thinking') {
      const previousItem = items[items.length - 1];
      if (
        previousItem?.kind === 'message' &&
        previousItem.message.role === 'model' &&
        previousItem.message.streaming &&
        previousItem.message.message_index === message.message_index
      ) {
        previousItem.thinkingContent = previousItem.thinkingContent
          ? mergeThinkingContent(previousItem.thinkingContent, message.content)
          : message.content;
        previousItem.thinkingSourceId ??= message.id;
        previousItem.thinkingStreaming =
          previousItem.thinkingStreaming || Boolean(message.streaming);
        previousItem.thinkingTimestamp =
          message.timestamp || previousItem.thinkingTimestamp;
        continue;
      }

      pendingThinking = pendingThinking
        ? {
            content: mergeThinkingContent(
              pendingThinking.content,
              message.content,
            ),
            sourceId: pendingThinking.sourceId,
            streaming: pendingThinking.streaming || Boolean(message.streaming),
            timestamp: message.timestamp || pendingThinking.timestamp,
          }
        : {
            content: message.content,
            sourceId: message.id,
            streaming: Boolean(message.streaming),
            timestamp: message.timestamp,
          };
      continue;
    }

    if (message.role === 'model') {
      items.push({
        id: message.id,
        kind: 'message',
        message,
        thinkingContent: pendingThinking?.content,
        thinkingSourceId: pendingThinking?.sourceId,
        thinkingStreaming: pendingThinking?.streaming,
        thinkingTimestamp: pendingThinking?.timestamp,
      });
      pendingThinking = undefined;
      continue;
    }

    flushPendingThinking();
    items.push({
      id: message.id,
      kind: 'message',
      message,
    });
  }

  flushPendingThinking();

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
  return activeConversation.value?.title || draftConversationTitle.value;
});

const activeConversationSubtitle = computed(() => {
  if (!activeConversation.value) {
    return '发送首条消息后自动创建会话';
  }

  const labels = [`创建于 ${parseDateLabel(activeConversation.value.created_time)}`];
  if (activeConversation.value.is_pinned) {
    labels.unshift('已置顶');
  }
  return labels.join(' · ');
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

const hasAdvancedSettings = computed(() => {
  return Boolean(
    maxTokens.value !== undefined ||
    temperature.value !== 1 ||
    topP.value !== undefined ||
    timeout.value !== undefined ||
    seed.value !== undefined ||
    presencePenalty.value !== undefined ||
    frequencyPenalty.value !== undefined ||
    parallelToolCalls.value !== true ||
    includeThinking.value !== true ||
    reasoningEffort.value.trim() ||
    enableBuiltinTools.value !== true ||
    selectedMcpIds.value.length > 0 ||
    outputMode.value !== 'text' ||
    webSearch.value !== 'builtin' ||
    outputSchema.value.trim() ||
    outputSchemaName.value.trim() ||
    outputSchemaDescription.value.trim() ||
    stopSequences.value.trim() ||
    extraHeaders.value.trim() ||
    extraBody.value.trim() ||
    logitBias.value.trim(),
  );
});

const canClearMessages = computed(() => {
  return Boolean(activeConversationId.value && activeMessages.value.length > 0);
});

const canCreateNewConversation = computed(() => {
  return prompt.value.trim().length > 0;
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

watch(
  selectedProviderId,
  async (providerId) => {
    await fetchModelsByProvider(providerId);
  },
  { immediate: true },
);

watch(
  displayMessages,
  (items) => {
    const nextStates: Record<string, ThinkingPanelState> = {};

    for (const item of items) {
      if (
        !('thinkingContent' in item) ||
        !item.thinkingContent ||
        !item.thinkingSourceId
      ) {
        continue;
      }

      const key = getThinkingPanelKey(item);
      const previous = thinkingPanelStates.value[key];
      const shouldAutoExpand = Boolean(item.thinkingStreaming);

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
  },
  { immediate: true },
);

const [SettingsModal, settingsModalApi] = useVbenModal({
  class: 'w-5/12',
  footer: false,
  title: '参数设置',
});

onMounted(async () => {
  composerHeight.value = COMPOSER_DEFAULT_HEIGHT;
  await nextTick();
  setupComposerLayoutObserver();

  await fetchProviders();
  await fetchMcps();
  await fetchConversations(false);

  if (conversations.value[0]) {
    activeConversationId.value = conversations.value[0].conversation_id;
    await loadConversationDetail(conversations.value[0].conversation_id);
  } else {
    createNewConversation();
  }
});

onBeforeUnmount(() => {
  stopComposerResize();
  teardownComposerLayoutObserver();
  abortController?.abort();
});
</script>

<template>
  <Page auto-content-height content-class="h-full">
    <div class="grid h-full gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside
        class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        <div class="border-b border-border px-4 py-4">
          <div>
            <div class="text-sm font-semibold text-foreground">话题历史</div>
            <div class="mt-1 text-xs text-muted-foreground">
              最近会话、置顶与历史上下文
            </div>
          </div>
        </div>

        <div
          class="flex-1 overflow-y-auto p-3"
          :class="
            conversations.length === 0
              ? 'flex items-center justify-center'
              : 'space-y-3'
          "
        >
          <a-spin
            v-if="sidebarLoading && conversations.length === 0"
            class="block py-10"
          />
          <a-empty
            v-else-if="conversations.length === 0"
            description="暂无聊天历史"
            :image="null"
          />
          <template v-else>
            <a-dropdown
              v-for="conversation in conversations"
              :key="conversation.conversation_id"
              :menu="{
                items: getConversationMenuItems(conversation),
                onClick: ({ key }) =>
                  handleConversationMenuClick(String(key), conversation),
              }"
              :trigger="['contextmenu']"
            >
              <div
                class="group relative rounded-xl border transition-all duration-200"
                :class="
                  conversation.conversation_id === activeConversationId
                    ? 'border-primary/45 bg-primary/10 shadow-[0_10px_30px_-18px_hsl(var(--primary)/0.55)] ring-1 ring-primary/15'
                    : 'border-transparent bg-background hover:border-border hover:bg-accent/35'
                "
              >
                <button
                  class="absolute top-2.5 right-2.5 z-10 inline-flex size-7 items-center justify-center text-muted-foreground opacity-0 transition-colors hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                  :title="`删除 ${conversation.title}`"
                  type="button"
                  @click.stop="confirmRemoveConversation(conversation)"
                >
                  <IconifyIcon class="size-3.5" icon="mdi:close" />
                </button>
                <button
                  class="min-w-0 w-full p-3 pr-11 text-left"
                  type="button"
                  @click="selectConversation(conversation.conversation_id)"
                >
                  <span class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium text-foreground">
                      {{ conversation.title }}
                    </span>
                    <span
                      v-if="conversation.is_pinned"
                      class="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      置顶
                    </span>
                  </span>
                  <span
                    class="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"
                  >
                    <span>{{
                      parseDateLabel(conversation.updated_time || conversation.created_time)
                    }}</span>
                  </span>
                </button>
              </div>
            </a-dropdown>
            <VbenButton
              v-if="hasMoreConversations"
              block
              size="sm"
              variant="outline"
              :loading="sidebarMoreLoading"
              @click="loadMoreConversations"
            >
              加载更多
            </VbenButton>
          </template>
        </div>
      </aside>

      <section
        class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        <div class="border-b border-border px-5 py-4 md:px-6">
          <div class="flex flex-wrap items-start gap-3">
            <div class="min-w-0 flex-1">
              <template v-if="isRenamingConversation && activeConversationId">
                <div class="flex flex-wrap items-center gap-2">
                  <a-input
                    v-model:value="renameTitle"
                    class="max-w-[360px]"
                    placeholder="请输入话题标题"
                    @press-enter="submitRenameConversation"
                  />
                  <VbenButton size="sm" @click="submitRenameConversation">
                    保存
                  </VbenButton>
                  <VbenButton
                    size="sm"
                    variant="outline"
                    @click="cancelRenameConversation"
                  >
                    取消
                  </VbenButton>
                </div>
              </template>
              <template v-else>
                <div class="flex min-w-0 items-center justify-between gap-4">
                  <div class="inline-flex min-w-0 max-w-full items-center gap-2">
                    <div
                      class="min-w-0 max-w-[220px] truncate text-[13px] font-semibold leading-7 text-foreground"
                      :title="activeConversationTitle"
                    >
                      {{ activeConversationTitle }}
                    </div>
                    <span
                      v-if="activeConversation?.is_pinned"
                      class="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      置顶
                    </span>
                    <span class="shrink-0 text-xs leading-none text-muted-foreground"
                      >&gt;</span
                    >
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
                        <span class="truncate">{{ selectedProviderModelLabel }}</span>
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
              </template>
            </div>

            <VbenButton
              v-if="sending"
              danger
              size="sm"
              variant="outline"
              @click="stopStreaming"
            >
              停止
            </VbenButton>
          </div>
        </div>

        <div
          ref="messageContainerRef"
          class="flex-1 overflow-y-auto bg-background/60 px-5 py-5 md:px-6 md:py-6"
        >
          <a-alert
            v-if="streamError"
            class="mb-4"
            :message="streamError"
            show-icon
            type="error"
          />
          <a-spin v-if="detailLoading" class="block py-20" />
          <div
            v-else-if="displayMessages.length === 0"
            class="flex min-h-full items-center justify-center"
          >
            <a-empty description="选择模型后开始对话，历史会自动保存" />
          </div>
          <template v-else>
            <div
              v-for="item in displayMessages"
              :key="item.id"
              class="ai-message mb-3.5 flex"
              :class="
                item.kind === 'message' && item.message.role === 'user'
                  ? 'justify-end'
                  : 'justify-start'
              "
            >
              <div
                class="flex max-w-[92%] flex-col animate-[ai-message-enter_0.24s_ease-out] md:max-w-[84%]"
                :class="
                  item.kind === 'message' && item.message.role === 'user'
                    ? 'items-end'
                    : 'items-start'
                "
              >
                <div
                  class="mb-1.5 inline-flex items-center gap-2 px-1"
                  :class="
                    item.kind === 'message' && item.message.role === 'user'
                      ? 'justify-end'
                      : 'justify-start'
                  "
                >
                  <span
                    class="inline-flex h-[22px] min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-[0.02em]"
                    :class="
                      item.kind === 'message' && item.message.role === 'user'
                        ? 'border border-primary/20 bg-primary/12 text-primary'
                        : 'border border-border bg-background text-muted-foreground'
                    "
                  >
                    {{
                      item.kind === 'message' && item.message.role === 'user'
                        ? '你'
                        : 'AI'
                    }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {{
                      parseDateLabel(
                        item.kind === 'message'
                          ? item.message.timestamp
                          : item.thinkingTimestamp,
                      )
                    }}
                  </span>
                </div>

                <div
                  class="relative overflow-hidden border px-4 py-2.5 text-sm leading-[1.65] text-foreground shadow-[0_10px_24px_-18px_rgb(15_23_42/0.42),0_1px_2px_0_rgb(15_23_42/0.06)] transition-all duration-200 hover:shadow-[0_18px_36px_-24px_rgb(15_23_42/0.38),0_4px_10px_0_rgb(15_23_42/0.06)]"
                  :class="
                    item.kind === 'message' && item.message.is_error
                      ? 'rounded-[12px] border-destructive/25 bg-[linear-gradient(180deg,hsl(var(--destructive)/0.1),hsl(var(--destructive)/0.04))]'
                      : item.kind === 'message' && item.message.role === 'user'
                      ? 'rounded-[12px] border-primary/20 bg-[linear-gradient(180deg,hsl(var(--primary)/0.14),hsl(var(--primary)/0.08))]'
                      : 'rounded-[12px] border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.35),transparent_34%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))]'
                  "
                >
                  <div
                    v-if="item.kind === 'pending-thinking' || item.thinkingContent"
                    class="ai-thinking-panel mb-3"
                    :class="{ 'ai-thinking-panel--open': isThinkingExpanded(item) }"
                  >
                    <button
                      class="ai-thinking-panel__toggle"
                      type="button"
                      @click="toggleThinkingPanel(item)"
                    >
                      <span class="inline-flex items-center gap-2">
                        <span
                          class="size-2 rounded-full bg-amber-500"
                          :class="{
                            'animate-[ai-status-pulse_1.4s_ease-out_infinite]':
                              item.thinkingStreaming,
                          }"
                        ></span>
                        <span>{{ getThinkingToggleLabel(item) }}</span>
                      </span>
                      <IconifyIcon
                        class="size-4 transition-transform"
                        :class="{ 'rotate-180': isThinkingExpanded(item) }"
                        icon="mdi:chevron-down"
                      />
                    </button>
                    <div
                      v-if="isThinkingExpanded(item)"
                      class="ai-thinking-panel__content ai-markdown"
                    >
                      <div
                        v-if="item.thinkingStreaming"
                        class="whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground"
                      >
                        {{ item.thinkingContent || '' }}
                      </div>
                      <AIChatMarkdown
                        v-else
                        custom-id="ai-chat-thinking"
                        :content="item.thinkingContent || ''"
                      />
                    </div>
                  </div>
                  <textarea
                    v-if="item.kind === 'message' && isEditingMessage(item.message)"
                    v-model="editingMessageDraft"
                    :disabled="sending"
                    class="block min-h-[88px] w-[min(520px,70vw)] resize-none overflow-y-auto border-0 bg-transparent p-0 leading-[1.7] text-inherit outline-none placeholder:text-muted-foreground/70"
                    placeholder="请输入消息内容"
                    rows="3"
                    spellcheck="false"
                  ></textarea>
                  <div
                    v-else-if="
                      item.kind === 'message' && item.message.role === 'user'
                    "
                    class="whitespace-pre-wrap"
                  >
                    {{ item.message.content }}
                  </div>
                  <div
                    v-else-if="
                      item.kind === 'message' &&
                      item.message.role === 'model' &&
                      item.message.streaming &&
                      !item.message.content &&
                      !item.message.structured_data &&
                      !item.message.is_error
                    "
                    class="flex min-h-10 items-center"
                  >
                    <div class="flex w-[180px] items-center gap-2">
                      <span class="h-2 flex-1 animate-pulse rounded-full bg-foreground/10"></span>
                      <span class="h-2 w-16 animate-pulse rounded-full bg-foreground/10"></span>
                    </div>
                  </div>
                  <div
                    v-else-if="
                      item.kind === 'message' &&
                      item.message.role === 'model' &&
                      item.message.streaming
                    "
                    class="whitespace-pre-wrap leading-[1.7]"
                  >
                    {{ item.message.content }}
                  </div>
                  <div v-else-if="item.kind === 'message'" class="ai-markdown">
                    <AIChatMarkdown
                      custom-id="ai-chat"
                      :content="item.message.content"
                    />
                  </div>
                  <div
                    v-if="
                      item.kind === 'message' &&
                      item.message.is_error &&
                      (
                        (item.message.error_message &&
                          item.message.error_message !== item.message.content) ||
                        item.message.conversation_id
                      )
                    "
                    class="mt-3 text-xs leading-6 whitespace-pre-wrap text-destructive/90"
                  >
                    <template
                      v-if="
                        item.kind === 'message' &&
                        item.message.error_message &&
                        item.message.error_message !== item.message.content
                      "
                    >
                      {{ item.message.error_message }}
                    </template>
                    <div
                      v-if="item.kind === 'message' && item.message.conversation_id"
                      class="mt-1"
                    >
                      对话 ID: {{ item.message.conversation_id }}
                    </div>
                  </div>
                </div>

                <div
                  v-if="
                    item.kind === 'message' &&
                    !item.message.streaming &&
                    activeConversationId &&
                    item.message.message_index !== undefined
                  "
                  class="ai-message__actions mt-1 flex min-h-[28px] items-center gap-1 px-1"
                  :class="
                    item.message.role === 'user' ? 'justify-end' : 'justify-start'
                  "
                >
                  <template v-if="isEditingMessage(item.message)">
                    <button
                      class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                      :disabled="sending"
                      title="取消"
                      type="button"
                      @click="cancelEditMessage"
                    >
                      <IconifyIcon class="size-3.5" icon="mdi:close" />
                    </button>
                    <button
                      class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                      :disabled="sending"
                      title="保存"
                      type="button"
                      @click="saveEditedMessage"
                    >
                      <IconifyIcon class="size-3.5" icon="mdi:content-save-outline" />
                    </button>
                    <button
                      v-if="item.message.role === 'user'"
                      class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                      :disabled="sending"
                      title="重新发送"
                      type="button"
                      @click="resendEditedMessage"
                    >
                      <IconifyIcon class="size-3.5" icon="mdi:send-outline" />
                    </button>
                  </template>
                  <button
                    v-if="item.message.role === 'user' && !isEditingMessage(item.message)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="复制"
                    type="button"
                    @click="copyMessageContent(item.message)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:content-copy" />
                  </button>
                  <button
                    v-if="item.message.role === 'model' && !isEditingMessage(item.message)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="复制"
                    type="button"
                    @click="copyMessageContent(item.message)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:content-copy" />
                  </button>
                  <button
                    v-if="item.message.role === 'user' && !isEditingMessage(item.message)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    :disabled="sending"
                    title="重新生成"
                    type="button"
                    @click="regenerateUserMessage(item.message)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:refresh" />
                  </button>
                  <button
                    v-if="item.message.role === 'user' && !isEditingMessage(item.message)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="编辑重发"
                    type="button"
                    @click="beginEditMessage(item.message)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:pencil-outline" />
                  </button>
                  <button
                    v-if="item.message.role === 'model' && !isEditingMessage(item.message)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="重新生成"
                    type="button"
                    @click="regenerateMessage(item.message)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:refresh" />
                  </button>
                  <a-popconfirm
                    v-if="!isEditingMessage(item.message)"
                    title="删除该消息及其后续历史？"
                    :description="`第 ${item.message.message_index + 1} 条消息`"
                    @confirm="deleteMessageChain(item.message)"
                  >
                    <button
                      class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                      title="删除后续"
                      type="button"
                    >
                      <IconifyIcon class="size-3.5" icon="mdi:delete-outline" />
                    </button>
                  </a-popconfirm>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="bg-card px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-4">
          <div
            class="ai-composer"
            :style="{ '--ai-composer-textarea-height': `${composerHeight}px` }"
          >
            <div
              class="ai-composer__resize-handle"
              :class="{
                'ai-composer__resize-handle--dragging': isComposerResizing,
              }"
              @mousedown.prevent.stop="startComposerResize"
            >
              <span class="ai-composer__resize-grip"></span>
            </div>

            <div class="ai-composer__shell">
              <textarea
                v-model="prompt"
                :disabled="sending"
                class="ai-composer__textarea"
                placeholder="在这里输入消息，按 Enter 发送"
                :style="{ height: `${composerHeight}px` }"
                spellcheck="false"
                @keydown="handlePromptKeydown"
              ></textarea>
              <div class="ai-composer__footer">
                <div class="ai-composer__tools">
                  <button
                    class="ai-composer__tool"
                    :disabled="sending || !canCreateNewConversation"
                    title="新建话题"
                    type="button"
                    @click="createNewConversation"
                  >
                    <IconifyIcon
                      class="size-4"
                      icon="mdi:message-plus-outline"
                    />
                  </button>

                  <button
                    class="ai-composer__tool"
                    disabled
                    title="上传文件或文档（暂未开放）"
                    type="button"
                  >
                    <IconifyIcon
                      class="size-4"
                      icon="mdi:file-document-plus-outline"
                    />
                  </button>

                  <a-popover placement="topLeft" trigger="click">
                    <template #content>
                      <div class="w-[320px] space-y-3">
                        <div class="text-xs font-medium text-foreground">
                          思考链
                        </div>
                        <div class="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
                          <div class="min-w-0 text-sm font-medium text-foreground">
                            返回思考链
                          </div>
                          <a-switch
                            v-model:checked="includeThinking"
                            size="small"
                          />
                        </div>
                        <div class="space-y-2">
                          <div class="text-xs font-medium text-foreground">
                            推理强度
                          </div>
                          <button
                            v-for="item in REASONING_EFFORT_OPTIONS"
                            :key="item.label"
                            class="flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors"
                            :class="
                              reasoningEffort === item.value
                                ? 'border-primary/35 bg-primary/10'
                                : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30'
                            "
                            type="button"
                            @click="reasoningEffort = item.value"
                          >
                            <span
                              class="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]"
                              :class="
                                reasoningEffort === item.value
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-transparent'
                              "
                            >
                              ✓
                            </span>
                            <span class="min-w-0 flex-1">
                              <span class="block text-xs font-medium text-foreground">
                                {{ item.label }}
                              </span>
                              <span class="mt-1 block text-[11px] text-muted-foreground/75">
                                {{ item.desc }}
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>
                    </template>
                    <button
                      class="ai-composer__tool"
                      :class="{
                        'ai-composer__tool--active':
                          includeThinking || !!reasoningEffort,
                      }"
                      :disabled="sending"
                      :title="
                        includeThinking
                          ? reasoningEffort
                            ? `思考链：${reasoningEffort}`
                            : '已启用思考链'
                          : '思考链'
                      "
                      type="button"
                    >
                      <IconifyIcon
                        class="size-4"
                        icon="mdi:head-lightbulb-outline"
                      />
                    </button>
                  </a-popover>

                  <a-popover placement="topLeft" trigger="click">
                    <template #content>
                      <div class="w-[280px] space-y-2">
                        <div class="text-xs font-medium text-foreground">
                          网络搜索
                        </div>
                        <button
                          v-for="item in WEB_SEARCH_OPTIONS"
                          :key="item.value"
                          class="flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors"
                          :class="
                            webSearch === item.value
                              ? 'border-primary/35 bg-primary/10'
                              : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30'
                          "
                          type="button"
                          @click="webSearch = item.value"
                        >
                          <span
                            class="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]"
                            :class="
                              webSearch === item.value
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-transparent'
                            "
                          >
                            ✓
                          </span>
                          <span class="min-w-0 flex-1">
                            <span class="block text-xs font-medium text-foreground">
                              {{ item.label }}
                            </span>
                            <span class="mt-1 block text-[11px] text-muted-foreground/75">
                              {{ item.desc }}
                            </span>
                          </span>
                        </button>
                      </div>
                    </template>
                    <button
                      class="ai-composer__tool"
                      :class="{ 'ai-composer__tool--active': webSearch !== 'builtin' }"
                      :disabled="sending"
                      :title="
                        webSearch === 'builtin'
                          ? '网络搜索'
                          : `网络搜索：${webSearch}`
                      "
                      type="button"
                    >
                      <IconifyIcon class="size-4" icon="mdi:web" />
                    </button>
                  </a-popover>

                  <a-popover placement="topLeft" trigger="click">
                    <template #content>
                      <div class="w-[320px] space-y-3">
                        <div class="text-xs font-medium text-foreground">
                          MCP
                        </div>
                        <div
                          v-if="mcps.length > 0"
                          class="flex max-h-[220px] flex-col gap-2 overflow-y-auto"
                        >
                          <button
                            v-for="item in mcps"
                            :key="item.id"
                            class="flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors"
                            :class="
                              isMcpSelected(item.id)
                                ? 'border-primary/35 bg-primary/10'
                                : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30'
                            "
                            :title="item.description || item.name"
                            type="button"
                            @click="toggleMcpSelection(item.id)"
                          >
                            <span
                              class="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]"
                              :class="
                                isMcpSelected(item.id)
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-transparent'
                              "
                            >
                              ✓
                            </span>
                            <span class="min-w-0 flex-1">
                              <span class="block text-xs font-medium text-foreground">
                                {{ item.name }}
                              </span>
                              <span
                                class="mt-1 block truncate text-[11px] text-muted-foreground/75"
                              >
                                {{
                                  item.description ||
                                  item.command ||
                                  item.url ||
                                  `MCP #${item.id}`
                                }}
                              </span>
                            </span>
                          </button>
                        </div>
                        <a-empty v-else :image="null" description="暂无可用 MCP" />
                      </div>
                    </template>
                    <button
                      class="ai-composer__tool"
                      :class="{
                        'ai-composer__tool--active': selectedMcpIds.length > 0,
                      }"
                      :disabled="sending"
                      :title="
                        selectedMcpIds.length > 0
                          ? `已选择 ${selectedMcpIds.length} 个 MCP`
                          : '选择 MCP'
                      "
                      type="button"
                    >
                      <IconifyIcon
                        class="size-4"
                        icon="simple-icons:modelcontextprotocol"
                      />
                    </button>
                  </a-popover>

                  <a-popover
                    :align="{ overflow: { adjustX: false, adjustY: true } }"
                    :open="quickPhrasePopoverOpen"
                    placement="topLeft"
                    trigger="click"
                    @open-change="handleQuickPhrasePopoverOpenChange"
                  >
                    <template #content>
                      <div class="w-[320px]">
                        <div class="mb-2 text-xs font-medium text-foreground">
                          快捷短语
                        </div>
                        <a-spin v-if="quickPhraseLoading" size="small" />
                        <div
                          v-else-if="quickPhrases.length > 0"
                          class="flex max-h-[220px] flex-col gap-2 overflow-y-auto"
                        >
                          <button
                            v-for="item in quickPhrases"
                            :key="item.id"
                            class="flex w-full items-start gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-accent/30"
                            :title="item.content"
                            type="button"
                            @click="appendQuickPhrase(item)"
                          >
                            <span class="shrink-0 text-xs font-medium text-foreground">
                              {{ item.title }}
                            </span>
                            <span class="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/75">
                              {{ item.content }}
                            </span>
                          </button>
                        </div>
                        <a-empty
                          v-else
                          :image="null"
                          description="暂无快捷短语"
                        />
                      </div>
                    </template>
                    <button
                      class="ai-composer__tool"
                      :disabled="sending"
                      title="快捷短语"
                      type="button"
                    >
                      <IconifyIcon
                        class="size-4"
                        icon="mdi:lightning-bolt-outline"
                      />
                    </button>
                  </a-popover>

                  <button
                    class="ai-composer__tool"
                    :class="{
                      'ai-composer__tool--active': hasAdvancedSettings,
                    }"
                    :disabled="sending"
                    title="参数设置"
                    type="button"
                    @click="settingsModalApi.open()"
                  >
                    <IconifyIcon class="size-4" icon="mdi:cog-outline" />
                  </button>

                  <button
                    class="ai-composer__tool"
                    :disabled="!canClearMessages"
                    title="清空消息"
                    type="button"
                    @click="clearMessages"
                  >
                    <IconifyIcon class="size-4" icon="mdi:eraser-variant" />
                  </button>

                  <button
                    class="ai-composer__tool"
                    :class="{ 'ai-composer__tool--active': isComposerExpanded }"
                    title="展开输入框"
                    type="button"
                    @click="toggleComposerExpanded"
                  >
                    <IconifyIcon
                      class="size-4"
                      :icon="
                        isComposerExpanded
                          ? 'mdi:fullscreen-exit'
                          : 'mdi:fullscreen'
                      "
                    />
                  </button>
                </div>

                <div class="ai-composer__meta">
                  <span v-if="composerHint" class="ai-composer__hint">{{
                    composerHint
                  }}</span>
                  <span class="ai-composer__shortcut">Enter 发送</span>
                  <span class="ai-composer__shortcut">Shift + Enter 换行</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <SettingsModal content-class="px-4 py-4 md:px-5 md:py-5">
      <div class="space-y-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-foreground">
              当前话题参数
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              仅作用于当前会话，修改后立即生效
            </div>
          </div>
          <VbenButton
            size="sm"
            variant="outline"
            @click="resetAdvancedSettings"
          >
            重置
          </VbenButton>
        </div>

        <section class="rounded-2xl border border-border bg-background/80 p-4 md:p-5">
          <div class="mb-4 text-sm font-semibold text-foreground">生成控制</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Temperature</span>
                  <a-tooltip placement="right" title="控制回答的发散程度，越低越稳定，越高越灵活。取值范围 0 到 2。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number
                v-model:value="temperature"
                class="w-full"
                :max="2"
                :min="0"
                :step="0.1"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Top P</span>
                  <a-tooltip placement="right" title="控制候选词范围，通常与 Temperature 二选一微调即可。取值范围 0 到 1。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number
                v-model:value="topP"
                class="w-full"
                :max="1"
                :min="0"
                :step="0.1"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Max Tokens</span>
                  <a-tooltip placement="right" title="限制单次回答长度，可选；不填时由模型自行决定。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number
                v-model:value="maxTokens"
                class="w-full"
                :min="1"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Timeout</span>
                  <a-tooltip placement="right" title="超过这个时间还没返回结果时，请求会被视为超时，单位为秒。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number
                v-model:value="timeout"
                class="w-full"
                :min="0"
                :step="1"
              />
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-border bg-background/80 p-4 md:p-5">
          <div class="mb-4 text-sm font-semibold text-foreground">行为控制</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Seed</span>
                  <a-tooltip placement="right" title="固定随机种子后，更容易复现相似结果；该项可选。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number v-model:value="seed" class="w-full" />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Presence Penalty</span>
                  <a-tooltip placement="right" title="提高后更鼓励模型引入新内容，减少重复话题。取值范围 -2 到 2。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number
                v-model:value="presencePenalty"
                class="w-full"
                :max="2"
                :min="-2"
                :step="0.1"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Frequency Penalty</span>
                  <a-tooltip placement="right" title="提高后更少重复相同措辞，适合压制啰嗦输出。取值范围 -2 到 2。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number
                v-model:value="frequencyPenalty"
                class="w-full"
                :max="2"
                :min="-2"
                :step="0.1"
              />
            </div>
            <div class="md:col-span-2">
              <div class="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-4 py-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">启用内置工具</div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    允许模型调用系统内置工具
                  </div>
                </div>
                <a-switch v-model:checked="enableBuiltinTools" size="small" />
              </div>
            </div>
            <div class="md:col-span-2">
              <div class="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-4 py-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">并行工具调用</div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    允许模型同时发起多个工具调用
                  </div>
                </div>
                <a-switch v-model:checked="parallelToolCalls" size="small" />
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-border bg-background/80 p-4 md:p-5">
          <div class="mb-4 text-sm font-semibold text-foreground">结构化输出</div>
          <div class="grid gap-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Output Mode</span>
                  <a-tooltip placement="right" title="选择返回内容的输出方式。可选 text、tool、native、prompted，默认 text 最通用。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-select
                v-model:value="outputMode"
                class="w-full"
                :options="[
                  { label: 'text', value: 'text' },
                  { label: 'tool', value: 'tool' },
                  { label: 'native', value: 'native' },
                  { label: 'prompted', value: 'prompted' },
                ]"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Output Schema Name</span>
                  <a-tooltip placement="right" title="给结构化输出起一个名字，便于区分不同格式；该项可选。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input
                v-model:value="outputSchemaName"
                placeholder="结构化输出名称"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Output Schema Description</span>
                  <a-tooltip placement="right" title="简要说明这份结构化输出想表达什么；该项可选。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-input
                v-model:value="outputSchemaDescription"
                placeholder="结构化输出说明"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Output Schema</span>
                  <a-tooltip placement="right" title="需要结构化返回时填写 JSON Schema，不需要可留空。这里填写的是 JSON Schema 对象。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="outputSchema"
                :auto-size="{ minRows: 3, maxRows: 8 }"
                placeholder="{&quot;type&quot;:&quot;object&quot;,&quot;properties&quot;:{&quot;answer&quot;:{&quot;type&quot;:&quot;string&quot;}}}"
              />
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-border bg-background/80 p-4 md:p-5">
          <div class="mb-4 text-sm font-semibold text-foreground">请求透传</div>
          <div class="grid gap-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">停止序列</span>
                  <a-tooltip placement="right" title="当生成到这些内容时立即停止，适合截断特定格式。这里填写的是 JSON 数组。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="stopSequences"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                :placeholder="STOP_SEQUENCES_PLACEHOLDER"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Extra Headers</span>
                  <a-tooltip placement="right" title="额外附加到模型请求中的请求头，通常用于特殊网关。这里填写的是 JSON 对象。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="extraHeaders"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                :placeholder="EXTRA_HEADERS_PLACEHOLDER"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Extra Body</span>
                  <a-tooltip placement="right" title="透传额外请求体字段，适合补充模型专属参数。这里填写的是 JSON 内容。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="extraBody"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :placeholder="EXTRA_BODY_PLACEHOLDER"
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Logit Bias</span>
                  <a-tooltip placement="right" title="用来提高或压低特定 token 的出现概率，适合高级控制。这里填写的是 JSON 对象。">
                    <IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="logitBias"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                :placeholder="LOGIT_BIAS_PLACEHOLDER"
              />
            </div>
          </div>
        </section>
      </div>
    </SettingsModal>
  </Page>
</template>

<style scoped>
.ai-markdown :deep(*) {
  color: inherit;
}

.ai-markdown :deep(p) {
  margin: 0;
}

.ai-markdown :deep(p + p),
.ai-markdown :deep(ul + p),
.ai-markdown :deep(ol + p),
.ai-markdown :deep(p + ul),
.ai-markdown :deep(p + ol),
.ai-markdown :deep(pre + p),
.ai-markdown :deep(p + pre),
.ai-markdown :deep(blockquote + p),
.ai-markdown :deep(p + blockquote) {
  margin-top: 10px;
}

.ai-markdown :deep(pre) {
  padding: 12px 14px;
  overflow-x: auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
}

.ai-markdown :deep(blockquote) {
  padding-left: 12px;
  margin: 10px 0 0;
  color: hsl(var(--muted-foreground));
  border-left: 3px solid hsl(var(--border));
}

.ai-markdown :deep(code):not(pre code) {
  padding: 2px 6px;
  background: hsl(var(--background));
  border-radius: 6px;
}

.ai-markdown :deep(ul),
.ai-markdown :deep(ol) {
  padding-left: 20px;
  margin: 10px 0 0;
}

.ai-markdown :deep(li + li) {
  margin-top: 4px;
}

.ai-composer {
  position: relative;
}

.ai-composer__shell {
  overflow: hidden;
  background:
    radial-gradient(
      circle at top left,
      hsl(var(--accent) / 18%),
      transparent 30%
    ),
    linear-gradient(180deg, hsl(var(--background)), hsl(var(--card)));
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  box-shadow:
    0 18px 40px -32px rgb(15 23 42 / 45%),
    0 2px 10px 0 rgb(15 23 42 / 8%);
}

.ai-composer__resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  touch-action: none;
  cursor: ns-resize;
  transform: translateY(-50%);
}

.ai-composer__resize-grip {
  width: 28px;
  height: 4px;
  background: hsl(var(--border));
  border-radius: 9999px;
  box-shadow: 0 0 0 4px hsl(var(--card));
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.ai-composer__resize-handle:hover .ai-composer__resize-grip,
.ai-composer__resize-handle--dragging .ai-composer__resize-grip {
  background: hsl(var(--primary));
  transform: scaleX(1.08);
}

.ai-composer__textarea {
  display: block;
  width: 100%;
  min-height: 56px;
  max-height: none;
  padding: 18px 20px 6px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.7;
  color: hsl(var(--foreground));
  appearance: none;
  resize: none;
  outline: none;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.ai-composer__textarea::placeholder {
  color: hsl(var(--muted-foreground) / 68%);
}

.ai-composer__textarea::-webkit-resizer,
.ai-composer__textarea::-webkit-scrollbar-corner {
  display: none;
}

.ai-composer__footer {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 6px 12px 10px;
}

.ai-composer__tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.ai-composer__tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: 0;
  border-radius: 9999px;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.ai-composer__tool:hover:not(:disabled) {
  color: hsl(var(--foreground));
  background: hsl(var(--accent) / 65%);
}

.ai-composer__tool:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ai-composer__tool--active {
  color: hsl(var(--primary));
}

.ai-message__actions {
  visibility: hidden;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-2px);
  transition:
    opacity 0.18s ease,
    visibility 0.18s ease,
    transform 0.18s ease;
}

.ai-message:hover .ai-message__actions,
.ai-message:focus-within .ai-message__actions {
  visibility: visible;
  pointer-events: auto;
  opacity: 1;
  transform: translateY(0);
}

.ai-thinking-panel {
  border: 1px solid rgb(245 158 11 / 0.2);
  background:
    linear-gradient(180deg, rgb(245 158 11 / 0.08), rgb(245 158 11 / 0.03)),
    hsl(var(--background));
  border-radius: 12px;
}

.ai-thinking-panel--open {
  background:
    linear-gradient(180deg, rgb(245 158 11 / 0.12), rgb(245 158 11 / 0.04)),
    hsl(var(--background));
}

.ai-thinking-panel__toggle {
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  color: rgb(180 83 9);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
  transition: background-color 0.18s ease;
}

.ai-thinking-panel__toggle:hover {
  background: rgb(245 158 11 / 0.06);
}

.ai-thinking-panel__content {
  border-top: 1px solid rgb(245 158 11 / 0.14);
  padding: 12px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.ai-composer__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  font-size: 12px;
  line-height: 1;
  color: hsl(var(--muted-foreground));
}

.ai-composer__hint,
.ai-composer__shortcut {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.ai-composer__hint {
  max-width: 100%;
}

@keyframes ai-message-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ai-status-pulse {
  0% {
    box-shadow: 0 0 0 0 hsl(var(--primary) / 28%);
  }

  70% {
    box-shadow: 0 0 0 8px hsl(var(--primary) / 0%);
  }

  100% {
    box-shadow: 0 0 0 0 hsl(var(--primary) / 0%);
  }
}

@media (max-width: 767px) {
  .ai-composer__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .ai-composer__meta {
    justify-content: flex-start;
  }
}
</style>
