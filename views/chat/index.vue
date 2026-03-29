<script setup lang="ts">
import type {
  ActionsProps,
  BubbleProps,
  ConversationsProps,
  PromptsClickInfo,
  PromptsProps,
  SenderProps,
} from '@antdv-next/x';
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
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { confirm, Page, useVbenModal, VbenButton } from '@vben/common-ui';
import {
  IconifyIcon,
  MaterialSymbolsDelete,
  MaterialSymbolsEdit,
  Pin,
  PinOff,
} from '@vben/icons';
import { usePreferences } from '@vben/preferences';

import {
  Actions,
  Bubble,
  CodeHighlighter,
  Conversations,
  Mermaid,
  Prompts,
  Sender,
  Think,
  Welcome,
} from '@antdv-next/x';
import { XMarkdown } from '@antdv-next/x-markdown';
import { useClipboard } from '@vueuse/core';
import {
  Avatar as AAvatar,
  Button as AButton,
  Empty as AEmpty,
  Flex as AFlex,
  Spin as ASpin,
  Switch as ASwitch,
  message,
  Popover,
} from 'antdv-next';

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
  consumeBufferedSSEMessages,
  makeConversationTitle,
  mergeModelContent,
  normalizeMessage,
  parseDateLabel,
  parseJsonField,
  resolveChatMessageContent,
} from './data';

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
const { isDark } = usePreferences();
const prompt = ref('');
const streamError = ref('');
const draftConversationTitle = ref('新话题');
const selectedProviderId = ref<number>();
const selectedModelId = ref<string>();
const activeConversationId = ref<string>();
const editingMessage = ref<ChatMessageItem>();
const editingMessageIntent = ref<'resend' | 'save'>('save');
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
  return Boolean(
    thinkingPanelStates.value[getThinkingPanelKey(item)]?.expanded,
  );
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
      existingMessage.message_id =
        data.message_id ?? existingMessage.message_id;
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
      lastMessage.error_message =
        data.error_message ?? lastMessage.error_message;
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
    quickPhrases.value = await getAllAIQuickPhraseApi();
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
    item.id === target.id
      ? {
          ...item,
          content,
        }
      : item,
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
  const nextEditingMessage: ChatMessageItem = {
    ...targetMessage,
    content: trimmedContent,
  };
  editingMessage.value = nextEditingMessage;
  if (targetMessage.conversation_id) {
    await updateAIChatMessageApi(
      targetMessage.conversation_id,
      targetMessage.message_id,
      {
        content: trimmedContent,
      },
    );
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
  editingMessageIntent.value = 'resend';
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
    regenerateMessageId == null
      ? editingMessageId == null
        ? 'create'
        : 'edit'
      : 'regenerate';
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
      mcp_ids:
        selectedMcpIds.value.length > 0 ? selectedMcpIds.value : undefined,
      model_id: selectedModelId.value,
      output_mode: outputMode.value,
      output_schema: parseJsonField<Record<string, unknown>>(
        outputSchema.value,
        '输出 Schema',
        (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      ),
      output_schema_description:
        outputSchemaDescription.value.trim() || undefined,
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
  if (
    regenerateMessageId === undefined &&
    editingMessageId == null &&
    promptText
  ) {
    insertOptimisticUserMessage(promptText);
  }
  insertStreamingModelSkeleton();

  let streamedConversationId = activeConversationId.value;
  let streamBuffer = '';
  const handleStreamMessage = (data: AIChatMessage) => {
    if (data.conversation_id) {
      streamedConversationId = data.conversation_id;
    }
    applyStreamMessage(data);
  };

  try {
    await streamAIChatApi(payload, {
      signal: abortController.signal,
      onMessage: (chunk) => {
        if (streamId !== currentStreamId) {
          return;
        }

        streamBuffer = consumeBufferedSSEMessages(
          `${streamBuffer}${chunk}`,
          handleStreamMessage,
        );
      },
    });
    streamBuffer = consumeBufferedSSEMessages(
      `${streamBuffer}\n\n`,
      handleStreamMessage,
    );

    finalizeStreamingMessages();
    await fetchConversations(false);

    if (streamedConversationId) {
      activeConversationId.value = streamedConversationId;
      await loadConversationDetail(streamedConversationId);
    } else if (conversations.value[0]) {
      activeConversationId.value = conversations.value[0].conversation_id;
      await loadConversationDetail(conversations.value[0].conversation_id);
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
    if (streamId === currentStreamId) {
      abortController = undefined;
      sending.value = false;
      editingMessage.value = undefined;
      editingMessageIntent.value = 'save';
      regeneratingMessageIndex.value = undefined;
    }
  }
}

const activeConversation = computed(() => {
  return conversations.value.find(
    (item) => item.conversation_id === activeConversationId.value,
  );
});

const displayMessages = computed<DisplayChatMessageItem[]>(() => {
  const items: DisplayChatMessageItem[] = [];
  let pendingThinking:
    | undefined
    | {
        content: string;
        sourceId: string;
        streaming: boolean;
        timestamp?: string;
      };

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

  const labels = [
    `创建于 ${parseDateLabel(activeConversation.value.created_time)}`,
  ];
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

const senderAutoSize: NonNullable<SenderProps['autoSize']> = {
  maxRows: 6,
  minRows: 2,
};

function renderCodeBlock(content: string, language = 'text') {
  return h(CodeHighlighter, {
    content,
    language,
    showThemeToggle: false,
    theme: isDark.value ? 'dark' : 'light',
  });
}

function renderMermaidBlock(content: string) {
  return h(Mermaid, {
    codeHighlighterProps: {
      showThemeToggle: false,
      theme: isDark.value ? 'dark' : 'light',
    },
    content,
  });
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

const MarkdownContent = defineComponent({
  name: 'ChatMarkdownContent',
  props: {
    content: {
      default: '',
      type: String,
    },
    streaming: {
      default: false,
      type: Boolean,
    },
  },
  setup(props) {
    const MarkdownPre = defineComponent({
      name: 'ChatMarkdownPre',
      setup(_, { slots }) {
        return () => slots.default?.() || null;
      },
    });

    const MarkdownCode = defineComponent({
      name: 'ChatMarkdownCode',
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        return () => {
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
              slots.default?.(),
            );
          }

          if (language === 'mermaid') {
            return renderMermaidBlock(content);
          }

          return renderCodeBlock(content, language);
        };
      },
    });

    return () =>
      h(XMarkdown, {
        className: isDark.value ? 'x-markdown-dark' : 'x-markdown-light',
        components: {
          code: MarkdownCode,
          pre: MarkdownPre,
        },
        config: {
          breaks: true,
          gfm: true,
        },
        content: props.content,
        openLinksInNewTab: true,
        streaming: props.streaming
          ? {
              hasNextChunk: true,
            }
          : undefined,
      });
  },
});

function renderConversationLabel(conversation: AIChatConversationItem) {
  return h('div', { class: 'min-w-0 pr-8' }, [
    h('div', { class: 'flex min-w-0 items-center gap-1.5' }, [
      h(
        'span',
        {
          class: 'min-w-0 flex-1 truncate text-[13px] font-medium leading-5',
          title: conversation.title,
        },
        conversation.title,
      ),
      conversation.is_pinned
        ? h(Pin, {
            class: 'size-3.5 shrink-0 text-muted-foreground',
          })
        : null,
    ]),
    h('div', { class: 'mt-0.5 text-[11px] leading-4 text-muted-foreground' }, [
      parseDateLabel(conversation.updated_time || conversation.created_time),
      conversation.is_pinned
        ? h(
            'span',
            { class: 'ml-2 align-middle text-[10px] text-muted-foreground' },
            '已置顶',
          )
        : null,
    ]),
  ]);
}

const conversationItems = computed<ConversationsProps['items']>(() => {
  return conversations.value.map((conversation) => ({
    key: conversation.conversation_id,
    label: renderConversationLabel(conversation),
  }));
});

const conversationCreation = computed<ConversationsProps['creation']>(() => ({
  disabled: sending.value || !canCreateNewConversation.value,
  onClick: createNewConversation,
}));

function getConversationListMenu(value: { key?: string; type?: string }) {
  if (!value || 'type' in value) {
    return { items: [] };
  }

  const conversation = conversations.value.find(
    (item) => item.conversation_id === value.key,
  );
  if (!conversation) {
    return { items: [] };
  }

  return {
    items: getConversationMenuItems(conversation),
    onClick: (info: { domEvent: Event; key: number | string }) => {
      info.domEvent.stopPropagation();
      handleConversationMenuClick(String(info.key), conversation);
    },
  };
}

function handleConversationActiveChange(value: number | string) {
  void selectConversation(String(value));
}

const quickPhrasePromptItems = computed<NonNullable<PromptsProps['items']>>(
  () => {
    return quickPhrases.value.map((item) => ({
      description: item.content,
      key: item.id,
      label: item.title,
    }));
  },
);

function handleQuickPhrasePromptClick(info: PromptsClickInfo) {
  const target = quickPhrases.value.find(
    (item) => String(item.id) === String(info.data.key),
  );

  if (!target) {
    return;
  }

  appendQuickPhrase(target);
  quickPhrasePopoverOpen.value = false;
}

function handleSenderSubmit(messageText: string) {
  void submitChat(undefined, true, messageText);
}

function handleSenderChange(value: string) {
  prompt.value = value;
}

function getMessageMarkdownContent(
  message: ChatMessageItem,
  content: BubbleProps['content'],
) {
  if (message.structured_data && !message.content) {
    return `\`\`\`json\n${JSON.stringify(message.structured_data, null, 2)}\n\`\`\``;
  }

  return String(content ?? '');
}

function getMessageContentRender(
  message: ChatMessageItem,
): BubbleProps['contentRender'] {
  return (content) => {
    const text = getMessageMarkdownContent(message, content);

    return h(MarkdownContent, {
      content: text,
      streaming: Boolean(message.streaming),
    });
  };
}

function renderMessageHeader(message: ChatMessageItem) {
  return h('div', { class: 'mb-1.5 text-xs text-muted-foreground' }, [
    getMessageDisplayName(message),
    ' · ',
    parseDateLabel(message.timestamp),
  ]);
}

function getMessageDisplayName(message: ChatMessageItem) {
  if (message.role === 'user') {
    return '你';
  }

  return selectedModelId.value ? selectedModelLabel.value : 'AI 助手';
}

function renderMessageAvatar(message: ChatMessageItem): BubbleProps['avatar'] {
  return h(AAvatar, undefined, () => (message.role === 'user' ? '你' : 'AI'));
}

function confirmDeleteMessageChain(item: ChatMessageItem) {
  confirm({
    content: `确认删除第 ${item.message_index + 1} 条消息及其后续历史吗？`,
    icon: 'warning',
  }).then(async () => {
    await deleteMessageChain(item);
  });
}

function getMessageActionItems(
  message: ChatMessageItem,
): ActionsProps['items'] {
  const items: ActionsProps['items'] = [
    {
      icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:content-copy' }),
      key: 'copy',
      label: '复制',
      onItemClick: () => copyMessageContent(message),
    },
  ];

  if (message.role === 'user') {
    items.push(
      {
        icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:refresh' }),
        key: 'regenerate',
        label: '重新生成',
        onItemClick: () => regenerateUserMessage(message),
      },
      {
        icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:pencil-outline' }),
        key: 'edit',
        label: '编辑保存',
        onItemClick: () => beginEditMessage(message, 'save'),
      },
      {
        icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:send-outline' }),
        key: 'edit-resend',
        label: '编辑重发',
        onItemClick: () => beginEditMessage(message, 'resend'),
      },
    );
  }

  if (message.role === 'model') {
    items.push({
      icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:refresh' }),
      key: 'retry',
      label: '重新生成',
      onItemClick: () => regenerateMessage(message),
    });
  }

  items.push({
    danger: true,
    icon: h(IconifyIcon, { class: 'size-3.5', icon: 'mdi:delete-outline' }),
    key: 'delete',
    label: '删除后续',
    onItemClick: () => confirmDeleteMessageChain(message),
  });

  return items;
}

function renderMessageFooter(message: ChatMessageItem) {
  return h(Actions, {
    fadeIn: true,
    items: getMessageActionItems(message),
  });
}

function renderMessageExtra(message: ChatMessageItem) {
  if (
    !message.is_error ||
    (!message.conversation_id &&
      (!message.error_message || message.error_message === message.content))
  ) {
    return undefined;
  }

  const children = [];

  if (message.error_message && message.error_message !== message.content) {
    children.push(message.error_message);
  }

  if (message.conversation_id) {
    children.push(
      h('div', { class: children.length > 0 ? 'mt-1' : undefined }, [
        '对话 ID: ',
        message.conversation_id,
      ]),
    );
  }

  return h(
    'div',
    { class: 'text-xs leading-6 whitespace-pre-wrap text-destructive/90' },
    children,
  );
}

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
      {
        class:
          'flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3',
      },
      [
        h(
          'div',
          { class: 'min-w-0 text-sm font-medium text-foreground' },
          '返回思考链',
        ),
        h(ASwitch, {
          checked: includeThinking.value,
          size: 'small',
          'onUpdate:checked': (value) => {
            includeThinking.value = Boolean(value);
          },
        }),
      ],
    ),
    h(
      'div',
      { class: 'space-y-2' },
      REASONING_EFFORT_OPTIONS.map((item) =>
        h(
          'button',
          {
            key: item.label,
            class: [
              'flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
              reasoningEffort.value === item.value
                ? 'border-primary/35 bg-primary/10'
                : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30',
            ],
            onClick: () => {
              reasoningEffort.value = item.value;
            },
            type: 'button',
          },
          [
            h(
              'span',
              {
                class: [
                  'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
                  reasoningEffort.value === item.value
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

function renderWebSearchPopoverContent() {
  return h('div', { class: 'w-[280px] space-y-2' }, [
    h('div', { class: 'text-xs font-medium text-foreground' }, '网络搜索'),
    ...WEB_SEARCH_OPTIONS.map((item) =>
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
                'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
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
  ]);
}

function renderMcpPopoverContent() {
  if (mcps.value.length === 0) {
    return h(AEmpty, {
      description: '暂无可用 MCP',
      image: null,
    });
  }

  return h('div', { class: 'w-[320px] space-y-3' }, [
    h('div', { class: 'text-xs font-medium text-foreground' }, 'MCP'),
    h(
      'div',
      { class: 'flex max-h-[220px] flex-col gap-2 overflow-y-auto' },
      mcps.value.map((item) =>
        h(
          'button',
          {
            key: item.id,
            class: [
              'flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
              isMcpSelected(item.id)
                ? 'border-primary/35 bg-primary/10'
                : 'border-border bg-background hover:border-primary/30 hover:bg-accent/30',
            ],
            onClick: () => {
              toggleMcpSelection(item.id);
            },
            title: item.description || item.name,
            type: 'button',
          },
          [
            h(
              'span',
              {
                class: [
                  'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
                  isMcpSelected(item.id)
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
                item.name,
              ),
              h(
                'span',
                {
                  class:
                    'mt-1 block truncate text-[11px] text-muted-foreground/75',
                },
                item.description ||
                  item.command ||
                  item.url ||
                  `MCP #${item.id}`,
              ),
            ]),
          ],
        ),
      ),
    ),
  ]);
}

function renderQuickPhrasePopoverContent() {
  return h('div', { class: 'w-[320px]' }, [
    h('div', { class: 'mb-2 text-xs font-medium text-foreground' }, '快捷短语'),
    quickPhraseLoading.value
      ? h(ASpin, { size: 'small' })
      : quickPhrasePromptItems.value.length > 0
        ? h('div', { class: 'max-h-[260px] overflow-y-auto' }, [
            h(Prompts, {
              items: quickPhrasePromptItems.value,
              onItemClick: handleQuickPhrasePromptClick,
              title: '点击插入到输入框',
              vertical: true,
            }),
          ])
        : h(AEmpty, {
            description: '暂无快捷短语',
            image: null,
          }),
  ]);
}

const renderSenderFooter: NonNullable<SenderProps['footer']> = (_, info) => {
  const { LoadingButton, SendButton } = info.components;

  return h(
    AFlex,
    {
      align: 'center',
      gap: 'small',
      justify: 'space-between',
      vertical: false,
      wrap: 'wrap',
    },
    [
      h(
        AFlex,
        {
          align: 'center',
          gap: 'middle',
          wrap: 'wrap',
        },
        [
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
              content: () => renderThinkingPopoverContent(),
              default: () =>
                renderFooterIconButton({
                  disabled: sending.value,
                  icon: 'mdi:head-lightbulb-outline',
                  title: includeThinking.value
                    ? reasoningEffort.value
                      ? `思考链：${reasoningEffort.value}`
                      : '思考链已开启'
                    : '思考链',
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
            { placement: 'topLeft', trigger: 'click' },
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
              void clearMessages();
            },
            title: '清空消息',
          }),
        ],
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
        [
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
      ),
    ],
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
  abortController?.abort();
});
</script>

<template>
  <Page auto-content-height content-class="h-full">
    <div class="grid h-full gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside
        class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        <div class="flex-1 overflow-y-auto p-3">
          <ASpin
            v-if="sidebarLoading && conversations.length === 0"
            class="block py-10"
          />
          <template v-else>
            <Conversations
              :active-key="activeConversationId"
              :creation="conversationCreation"
              :items="conversationItems"
              :menu="getConversationListMenu"
              :on-active-change="handleConversationActiveChange"
            />
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
                  <div
                    class="inline-flex min-w-0 max-w-full items-center gap-2"
                  >
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
                    <span
                      class="shrink-0 text-xs leading-none text-muted-foreground"
                      >&gt;</span
                    >
                    <a-popover placement="bottomLeft" trigger="click">
                      <template #content>
                        <div class="w-[280px] space-y-3">
                          <div>
                            <div
                              class="mb-2 text-xs font-medium text-foreground"
                            >
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
                            <div
                              class="mb-2 text-xs font-medium text-foreground"
                            >
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
          <a-alert v-if="streamError" class="mb-4" show-icon type="error">
            <template #message>
              <div class="whitespace-pre-wrap">{{ streamError }}</div>
            </template>
          </a-alert>
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
                    ? `当前模型：${selectedProviderModelLabel}，发送首条消息后自动创建会话`
                    : '选择模型后开始对话，历史会自动保存'
                "
                title="开始新的对话"
              />
            </div>
          </div>
          <template v-else>
            <div
              v-for="item in displayMessages"
              :key="item.id"
              class="mb-3.5 flex"
              :class="
                item.kind === 'message' && item.message.role === 'user'
                  ? 'justify-end'
                  : 'justify-start'
              "
            >
              <div
                class="flex max-w-[92%] flex-col md:max-w-[84%]"
                :class="
                  item.kind === 'message' && item.message.role === 'user'
                    ? 'items-end'
                    : 'items-start'
                "
              >
                <div
                  v-if="
                    item.kind === 'pending-thinking' || item.thinkingContent
                  "
                  class="mb-3 w-full"
                >
                  <Think
                    :blink="item.thinkingStreaming"
                    :expanded="isThinkingExpanded(item)"
                    :loading="item.thinkingStreaming"
                    :title="getThinkingToggleLabel(item)"
                    @update:expanded="toggleThinkingPanel(item)"
                  >
                    <MarkdownContent
                      :content="item.thinkingContent || ''"
                      :streaming="Boolean(item.thinkingStreaming)"
                    />
                  </Think>
                </div>

                <template v-if="item.kind === 'message'">
                  <Bubble
                    :avatar="renderMessageAvatar(item.message)"
                    :content="item.message.content"
                    :content-render="getMessageContentRender(item.message)"
                    :editable="
                      isEditingMessage(item.message)
                        ? {
                            cancelText: '取消',
                            editing: true,
                            okText:
                              editingMessageIntent === 'resend'
                                ? '重发'
                                : '保存',
                          }
                        : false
                    "
                    :extra="renderMessageExtra(item.message)"
                    :footer="renderMessageFooter(item.message)"
                    :footer-placement="
                      item.message.role === 'user' ? 'outer-end' : 'outer-start'
                    "
                    :header="renderMessageHeader(item.message)"
                    :loading="
                      item.message.role === 'model' &&
                      item.message.streaming &&
                      !item.message.content &&
                      !item.message.structured_data &&
                      !item.message.is_error
                    "
                    :placement="item.message.role === 'user' ? 'end' : 'start'"
                    :streaming="
                      item.message.role === 'model' && item.message.streaming
                    "
                    :on-edit-cancel="cancelEditMessage"
                    :on-edit-confirm="
                      (value) =>
                        editingMessageIntent === 'resend'
                          ? resendEditedMessage(String(value))
                          : saveEditedMessage(String(value))
                    "
                  />
                </template>
              </div>
            </div>
          </template>
        </div>

        <div class="bg-card px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-4">
          <div class="relative">
            <Sender
              :auto-size="senderAutoSize"
              :disabled="sending"
              :footer="renderSenderFooter"
              :loading="sending"
              :on-cancel="stopStreaming"
              :on-change="handleSenderChange"
              :on-submit="handleSenderSubmit"
              placeholder="在这里输入消息，按 Enter 发送"
              :suffix="false"
              :value="prompt"
            />
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

        <section
          class="rounded-2xl border border-border bg-background/80 p-4 md:p-5"
        >
          <div class="mb-4 text-sm font-semibold text-foreground">生成控制</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground"
                    >Temperature</span
                  >
                  <a-tooltip
                    placement="right"
                    title="控制回答的发散程度，越低越稳定，越高越灵活。取值范围 0 到 2。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
                  <a-tooltip
                    placement="right"
                    title="控制候选词范围，通常与 Temperature 二选一微调即可。取值范围 0 到 1。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
                  <span class="text-sm font-medium text-foreground"
                    >Max Tokens</span
                  >
                  <a-tooltip
                    placement="right"
                    title="限制单次回答长度，可选；不填时由模型自行决定。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
                  <span class="text-sm font-medium text-foreground"
                    >Timeout</span
                  >
                  <a-tooltip
                    placement="right"
                    title="超过这个时间还没返回结果时，请求会被视为超时，单位为秒。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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

        <section
          class="rounded-2xl border border-border bg-background/80 p-4 md:p-5"
        >
          <div class="mb-4 text-sm font-semibold text-foreground">行为控制</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground">Seed</span>
                  <a-tooltip
                    placement="right"
                    title="固定随机种子后，更容易复现相似结果；该项可选。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
                  </a-tooltip>
                </span>
              </div>
              <a-input-number v-model:value="seed" class="w-full" />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground"
                    >Presence Penalty</span
                  >
                  <a-tooltip
                    placement="right"
                    title="提高后更鼓励模型引入新内容，减少重复话题。取值范围 -2 到 2。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
                  <span class="text-sm font-medium text-foreground"
                    >Frequency Penalty</span
                  >
                  <a-tooltip
                    placement="right"
                    title="提高后更少重复相同措辞，适合压制啰嗦输出。取值范围 -2 到 2。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
              <div
                class="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-4 py-3"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">
                    启用内置工具
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    允许模型调用系统内置工具
                  </div>
                </div>
                <ASwitch v-model:checked="enableBuiltinTools" size="small" />
              </div>
            </div>
            <div class="md:col-span-2">
              <div
                class="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-4 py-3"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">
                    并行工具调用
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    允许模型同时发起多个工具调用
                  </div>
                </div>
                <ASwitch v-model:checked="parallelToolCalls" size="small" />
              </div>
            </div>
          </div>
        </section>

        <section
          class="rounded-2xl border border-border bg-background/80 p-4 md:p-5"
        >
          <div class="mb-4 text-sm font-semibold text-foreground">
            结构化输出
          </div>
          <div class="grid gap-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground"
                    >Output Mode</span
                  >
                  <a-tooltip
                    placement="right"
                    title="选择返回内容的输出方式。可选 text、tool、native、prompted，默认 text 最通用。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
                  <span class="text-sm font-medium text-foreground"
                    >Output Schema Name</span
                  >
                  <a-tooltip
                    placement="right"
                    title="给结构化输出起一个名字，便于区分不同格式；该项可选。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
                  <span class="text-sm font-medium text-foreground"
                    >Output Schema Description</span
                  >
                  <a-tooltip
                    placement="right"
                    title="简要说明这份结构化输出想表达什么；该项可选。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
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
                  <span class="text-sm font-medium text-foreground"
                    >Output Schema</span
                  >
                  <a-tooltip
                    placement="right"
                    title="需要结构化返回时填写 JSON Schema，不需要可留空。这里填写的是 JSON Schema 对象。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="outputSchema"
                :auto-size="{ minRows: 3, maxRows: 8 }"
                placeholder='{"type":"object","properties":{"answer":{"type":"string"}}}'
              />
            </div>
          </div>
        </section>

        <section
          class="rounded-2xl border border-border bg-background/80 p-4 md:p-5"
        >
          <div class="mb-4 text-sm font-semibold text-foreground">请求透传</div>
          <div class="grid gap-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground"
                    >停止序列</span
                  >
                  <a-tooltip
                    placement="right"
                    title="当生成到这些内容时立即停止，适合截断特定格式。这里填写的是 JSON 数组。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="stopSequences"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                placeholder='["</thinking>"]'
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground"
                    >Extra Headers</span
                  >
                  <a-tooltip
                    placement="right"
                    title="额外附加到模型请求中的请求头，通常用于特殊网关。这里填写的是 JSON 对象。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="extraHeaders"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                placeholder='{"x-trace-id":"chat-demo"}'
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground"
                    >Extra Body</span
                  >
                  <a-tooltip
                    placement="right"
                    title="透传额外请求体字段，适合补充模型专属参数。这里填写的是 JSON 内容。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="extraBody"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                placeholder='{"reasoning":{"effort":"medium"}}'
              />
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <span class="inline-flex min-w-0 items-center gap-1.5">
                  <span class="text-sm font-medium text-foreground"
                    >Logit Bias</span
                  >
                  <a-tooltip
                    placement="right"
                    title="用来提高或压低特定 token 的出现概率，适合高级控制。这里填写的是 JSON 对象。"
                  >
                    <IconifyIcon
                      class="text-muted-foreground"
                      icon="mdi:help-circle-outline"
                    />
                  </a-tooltip>
                </span>
              </div>
              <a-textarea
                v-model:value="logitBias"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                placeholder='{"198":-100}'
              />
            </div>
          </div>
        </section>
      </div>
    </SettingsModal>
  </Page>
</template>
