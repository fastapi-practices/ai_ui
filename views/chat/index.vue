<script setup lang="ts">
import type { ActionsProps, BubbleProps, ConversationsProps, SenderProps } from "@antdv-next/x";
import type { MenuItemType } from "antdv-next";

import type { FunctionalComponent, VNodeArrayChildren } from "vue";

import type { AIChatProviderMessage, ChatMessageItem } from "./data";
import type { AIChatProviderRequest } from "./provider/chat-request";

import type {
  AIChatConversationDetail,
  AIChatConversationItem,
  AIChatParams,
  AIMcpResult,
  AIModelResult,
  AIProviderResult,
  AIQuickPhraseResult,
} from "#/plugins/ai/api";

import { computed, h, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { ColPage, confirm, useVbenModal, VbenButton } from "@vben/common-ui";
import { IconifyIcon, MaterialSymbolsDelete, MaterialSymbolsEdit, Pin, PinOff } from "@vben/icons";
import { usePreferences } from "@vben/preferences";

import { Actions, Bubble, CodeHighlighter, Mermaid, Think, Welcome } from "@antdv-next/x";
import { XMarkdown } from "@antdv-next/x-markdown";
import { useClipboard } from "@vueuse/core";
import {
  Avatar as AAvatar,
  Button as AButton,
  Empty as AEmpty,
  Flex as AFlex,
  Spin as ASpin,
  Switch as ASwitch,
  message,
  Popover,
} from "antdv-next";

import {
  buildChatCompletionRequest,
  clearAIChatConversationContextApi,
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
  updateAIChatConversationApi,
  updateAIChatMessageApi,
} from "#/plugins/ai/api";

import ChatSender from "./components/chat-sender.vue";
import ChatSidebar from "./components/chat-sidebar.vue";
import { useChatStream } from "./composables/use-chat-stream";
import {
  buildTransientMessageItems,
  createProviderUserMessage,
  getEditableMessageText,
  getMessageFileBlocks,
  getMessageTextContent,
  hasRenderableMessageContent,
  makeConversationTitle,
  mergeAdjacentAssistantMessages,
  mergeStreamMessage,
  normalizeMessage,
  parseDateLabel,
  parseJsonField,
  replaceMessageTextBlocks,
} from "./data";

type ThinkingPanelState = {
  autoOpened: boolean;
  expanded: boolean;
};

type ChatGenerationType = NonNullable<AIChatParams["generation_type"]>;
type ChatThinkingValue = AIChatParams["thinking"];
type ChatWebSearchType = NonNullable<AIChatParams["web_search"]>;

const { copy } = useClipboard({ legacy: true });
const { isDark } = usePreferences();
const prompt = ref("");
const draftConversationTitle = ref("新话题");
const selectedProviderId = ref<number>();
const selectedModelId = ref<string>();
const activeConversationId = ref<string>();
const editingMessage = ref<ChatMessageItem>();
const editingMessageIntent = ref<"resend" | "save">("save");
const regeneratingMessageIndex = ref<number>();
const isRenamingConversation = ref(false);
const renameTitle = ref("");
const stopSequencesPlaceholder = '["</thinking>"]';
const extraHeadersPlaceholder = '{"x-trace-id":"chat-demo"}';
const extraBodyPlaceholder = '{"metadata":{"scene":"chat"}}';
const logitBiasPlaceholder = '{"198":-100}';
const settingsFieldClass = "space-y-2 px-1 py-1";
const settingsSectionClass =
  "space-y-4 rounded-2xl border border-border/70 bg-muted/10 px-4 py-4 md:px-5";
const settingsSectionTitleClass =
  "px-1 text-xs font-medium tracking-[0.08em] text-muted-foreground";
const settingsSwitchRowClass = "flex items-center justify-between gap-4 px-1 py-2";
const settingsWideFieldClass = `${settingsFieldClass} md:col-span-2`;

const providers = ref<AIProviderResult[]>([]);
const models = ref<AIModelResult[]>([]);
const mcps = ref<AIMcpResult[]>([]);
const quickPhrases = ref<AIQuickPhraseResult[]>([]);
const conversations = ref<AIChatConversationItem[]>([]);
const activeMessages = ref<ChatMessageItem[]>([]);
const activeConversationDetail = ref<AIChatConversationDetail>();

const messageContainerRef = ref<HTMLElement>();
const autoFollowMessageScroll = ref(true);
let suppressNextMessageScrollEvent = false;

const resourcesLoading = ref(false);
const quickPhraseLoading = ref(false);
const sidebarLoading = ref(false);
const sidebarMoreLoading = ref(false);
const detailLoading = ref(false);
const {
  abort: abortTransientRequest,
  chatProvider,
  isRequesting,
  messages: transientMessagesState,
  onRequest: onTransientRequest,
  setMessages: setTransientMessages,
  transientRequestError,
} = useChatStream();
const sending = computed(() => isRequesting.value);

const hasMoreConversations = ref(false);
const conversationBeforeCursor = ref<string>();

const maxTokens = ref<number>();
const temperature = ref(1);
const topP = ref<number>();
const timeout = ref<number>();
const seed = ref<number>();
const presencePenalty = ref<number>();
const frequencyPenalty = ref<number>();
const generationType = ref<ChatGenerationType>("text");
const parallelToolCalls = ref(true);
const thinking = ref<ChatThinkingValue>(undefined);
const enableBuiltinTools = ref(true);
const selectedMcpIds = ref<number[]>([]);
const webSearch = ref<ChatWebSearchType>("builtin");
const stopSequences = ref("");
const extraHeaders = ref("");
const extraBody = ref("");
const logitBias = ref("");
const quickPhrasePopoverOpen = ref(false);
const thinkingPanelStates = ref<Record<string, ThinkingPanelState>>({});

const GENERATION_TYPE_OPTIONS: Array<{
  desc: string;
  label: string;
  value: ChatGenerationType;
}> = [
  {
    desc: "常规对话与文本生成",
    label: "文本",
    value: "text",
  },
  {
    desc: "让模型直接生成图片结果",
    label: "图片",
    value: "image",
  },
];

const WEB_SEARCH_OPTIONS: Array<{
  desc: string;
  label: string;
  value: ChatWebSearchType;
}> = [
  {
    desc: "优先使用模型内置搜索能力",
    label: "内置搜索",
    value: "builtin",
  },
  {
    desc: "使用 Exa 作为搜索来源",
    label: "Exa",
    value: "exa",
  },
  {
    desc: "使用 Tavily 作为搜索来源",
    label: "Tavily",
    value: "tavily",
  },
  {
    desc: "使用 DuckDuckGo 作为搜索来源",
    label: "DuckDuckGo",
    value: "duckduckgo",
  },
];

const THINKING_OPTIONS: Array<{
  desc: string;
  key: string;
  label: string;
  value: ChatThinkingValue;
}> = [
  {
    desc: "沿用模型默认思考行为",
    key: "default",
    label: "默认",
    value: undefined,
  },
  {
    desc: "显式关闭思考",
    key: "off",
    label: "关闭",
    value: false,
  },
  {
    desc: "最轻量的思考强度",
    key: "minimal",
    label: "minimal",
    value: "minimal",
  },
  {
    desc: "较低思考强度",
    key: "low",
    label: "low",
    value: "low",
  },
  {
    desc: "平衡型思考强度",
    key: "medium",
    label: "medium",
    value: "medium",
  },
  {
    desc: "较高思考强度",
    key: "high",
    label: "high",
    value: "high",
  },
  {
    desc: "最高思考强度",
    key: "xhigh",
    label: "xhigh",
    value: "xhigh",
  },
];

let currentModelFetchId = 0;
let currentConversationFetchId = 0;
let hasInitialized = false;

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

function isMessageContainerNearBottom(threshold = 48) {
  const container = messageContainerRef.value;
  if (!container) {
    return true;
  }

  return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
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
  return getMessageTextContent(message, "reasoning");
}

function hasThinkingContent(message: ChatMessageItem) {
  return Boolean(getThinkingContent(message).trim());
}

function isThinkingExpanded(message: ChatMessageItem) {
  return Boolean(thinkingPanelStates.value[getThinkingPanelKey(message)]?.expanded);
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

function getThinkingToggleLabel(message: ChatMessageItem) {
  if (message.streaming) {
    return "思考中";
  }
  return "思考完成";
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
  stopSequences.value = "";
  extraHeaders.value = "";
  extraBody.value = "";
  logitBias.value = "";
}

function resetModelSettings() {
  resetGenerationSettings();
  resetBehaviorSettings();
  resetToolingSettings();
  resetPassthroughSettings();
}

function resetComposerState(clearPrompt = false) {
  editingMessage.value = undefined;
  regeneratingMessageIndex.value = undefined;
  if (clearPrompt) {
    prompt.value = "";
  }
}

function createNewConversation() {
  stopStreaming();
  currentConversationFetchId++;
  activeConversationId.value = undefined;
  activeConversationDetail.value = undefined;
  activeMessages.value = [];
  setTransientMessages([]);
  draftConversationTitle.value = "新话题";
  detailLoading.value = false;
  isRenamingConversation.value = false;
  renameTitle.value = "";
  resetComposerState(true);
  autoFollowMessageScroll.value = true;
  scrollToTop();
}

function syncConversationSummaryFromDetail(detail: AIChatConversationDetail) {
  upsertConversation({
    conversation_id: detail.conversation_id,
    created_time: detail.created_time,
    id: detail.id,
    is_pinned: detail.is_pinned,
    title: detail.title,
    updated_time: detail.updated_time,
  });
}

function stopStreaming() {
  abortTransientRequest();
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
      const existingIds = new Set(conversations.value.map((item) => item.conversation_id));
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
  let shouldScrollToBottom = false;

  try {
    const detail = await getAIChatConversationDetailApi(conversationId);

    if (fetchId !== currentConversationFetchId || activeConversationId.value !== conversationId) {
      return;
    }

    syncConversationSummaryFromDetail(detail);
    activeConversationDetail.value = detail;
    activeMessages.value = mergeAdjacentAssistantMessages(
      detail.messages.map((item, index) =>
        normalizeMessage(item, index, activeConversationId.value),
      ),
    );
    setTransientMessages([]);
    transientRequestError.value = null;
    selectedProviderId.value = detail.provider_id;
    selectedModelId.value = detail.model_id;
    draftConversationTitle.value = detail.title;
    autoFollowMessageScroll.value = true;
    shouldScrollToBottom = true;
  } finally {
    if (fetchId === currentConversationFetchId) {
      detailLoading.value = false;
      if (shouldScrollToBottom) {
        scrollToBottom();
      }
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
  setTransientMessages([]);
  isRenamingConversation.value = false;
  renameTitle.value = "";
  resetComposerState(true);
  activeConversationId.value = conversationId;
  activeConversationDetail.value = undefined;
  await loadConversationDetail(conversationId);
}

async function loadMoreConversations() {
  if (!hasMoreConversations.value || sidebarMoreLoading.value) {
    return;
  }
  await fetchConversations(true);
}

function appendQuickPhrase(item: AIQuickPhraseResult) {
  prompt.value = prompt.value.trim() ? `${prompt.value.trim()}\n${item.content}` : item.content;
}

function beginEditMessage(item: ChatMessageItem, intent: "resend" | "save" = "save") {
  if (item.role !== "user" || item.message_id === undefined || item.message_id === null) {
    return;
  }

  editingMessage.value = item;
  editingMessageIntent.value = intent;
  regeneratingMessageIndex.value = undefined;
}

function cancelEditMessage() {
  editingMessage.value = undefined;
  editingMessageIntent.value = "save";
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
    message.warning("请输入消息内容");
    return;
  }

  await updateAIChatMessageApi(targetMessage.conversation_id, targetMessage.message_id, {
    content: trimmedContent,
  });
  updateMessageContent(targetMessage, trimmedContent);
  cancelEditMessage();
  await loadConversationDetail(targetMessage.conversation_id);
  message.success("消息内容已保存");
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
    message.warning("请输入消息内容");
    return;
  }

  updateMessageContent(targetMessage, trimmedContent);
  if (targetMessage.conversation_id) {
    await updateAIChatMessageApi(targetMessage.conversation_id, targetMessage.message_id, {
      content: trimmedContent,
    });
  }
  regeneratingMessageIndex.value = targetMessage.message_index;
  editingMessage.value = undefined;
  await submitChat(targetMessage.message_id, true, undefined, "user");
}

async function regenerateUserMessage(item: ChatMessageItem) {
  if (item.role !== "user" || item.message_id === undefined || item.message_id === null) {
    return;
  }

  editingMessage.value = undefined;
  editingMessageIntent.value = "save";
  regeneratingMessageIndex.value = item.message_index;
  await submitChat(item.message_id, true, undefined, "user");
}

async function copyMessageContent(item: ChatMessageItem) {
  const sections = [
    getMessageTextContent(item, "text"),
    getMessageTextContent(item, "reasoning"),
    ...getMessageFileBlocks(item).map((block) =>
      [block.name, block.url].filter(Boolean).join(" - "),
    ),
  ].filter(Boolean);

  await copy(sections.join("\n\n"));
  message.success("消息内容已复制");
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
  renameTitle.value = "";
}

async function submitRenameConversation() {
  const conversationId = activeConversationId.value;
  const conversation = activeConversation.value;
  const title = renameTitle.value.trim();

  if (!conversationId || !conversation || !title) {
    message.error("请输入话题标题");
    return;
  }

  await updateAIChatConversationApi(conversationId, { title });
  upsertConversation({
    ...conversation,
    title,
  });
  draftConversationTitle.value = title;
  isRenamingConversation.value = false;
  renameTitle.value = "";
  message.success("话题标题已更新");
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
  message.success(targetConversation.is_pinned ? "已取消置顶" : "已置顶话题");
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

  message.success("聊天历史已删除");
}

function confirmRemoveConversation(conversation: AIChatConversationItem) {
  confirm({
    content: `确认删除“${conversation.title}”吗？`,
    icon: "warning",
  }).then(async () => {
    await removeConversation(conversation.conversation_id);
  });
}

function getConversationMenuItems(conversation: AIChatConversationItem): MenuItemType[] {
  return [
    {
      icon: h(MaterialSymbolsEdit, { class: "size-4" }),
      key: "rename",
      label: "重命名",
    },
    {
      icon: h(conversation.is_pinned ? PinOff : Pin, { class: "size-4" }),
      key: "pin",
      label: conversation.is_pinned ? "取消置顶" : "置顶",
    },
    {
      type: "divider",
    },
    {
      danger: true,
      icon: h(MaterialSymbolsDelete, { class: "size-4" }),
      key: "delete",
      label: "删除",
    },
  ] satisfies MenuItemType[];
}

function handleConversationMenuClick(key: string, conversation: AIChatConversationItem) {
  switch (key) {
    case "delete": {
      confirmRemoveConversation(conversation);
      break;
    }
    case "pin": {
      void togglePinConversation(conversation);
      break;
    }
    case "rename": {
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
    return;
  }

  await clearAIChatConversationMessagesApi(activeConversationId.value);
  activeMessages.value = [];
  if (activeConversationDetail.value) {
    activeConversationDetail.value = {
      ...activeConversationDetail.value,
      message_count: 0,
      messages: [],
    };
  }
  if (conversation) {
    upsertConversation({
      ...conversation,
      updated_time: new Date().toISOString(),
    });
  }
  message.success("当前话题消息已清空");
}

function confirmClearMessages() {
  confirm({
    content: "确认清空当前话题下的全部消息吗？该操作不可恢复",
    icon: "warning",
  }).then(async () => {
    await clearMessages();
  });
}

async function clearConversationContext() {
  if (!activeConversationId.value) {
    return;
  }

  const result = await clearAIChatConversationContextApi(activeConversationId.value);
  activeConversationDetail.value = {
    ...(activeConversationDetail.value ?? {
      conversation_id: activeConversationId.value,
      created_time: new Date().toISOString(),
      id: 0,
      is_pinned: false,
      messages: [],
      model_id: selectedModelId.value ?? "",
      provider_id: selectedProviderId.value ?? 0,
      title: draftConversationTitle.value,
    }),
    context_cleared_time: result.context_cleared_time ?? null,
    context_start_message_id: result.context_start_message_id ?? null,
  };
  message.success("对话上下文已清除");
}

async function deleteMessageChain(item: ChatMessageItem) {
  if (!activeConversationId.value || item.message_id === undefined || item.message_id === null) {
    return;
  }

  stopStreaming();

  const result = await deleteAIChatMessageApi(activeConversationId.value, item.message_id);

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
    const currentConversationId = activeConversationId.value;
    const stillExists = currentConversationId
      ? conversations.value.some(
          (conversation) => conversation.conversation_id === currentConversationId,
        )
      : false;

    if (currentConversationId && stillExists) {
      await loadConversationDetail(currentConversationId);
    } else if (conversations.value[0]) {
      activeConversationId.value = conversations.value[0].conversation_id;
      await loadConversationDetail(conversations.value[0].conversation_id);
    } else {
      createNewConversation();
    }
  }

  message.success("聊天消息已删除");
}

async function regenerateMessage(item: ChatMessageItem) {
  if (item.role !== "assistant" || item.message_id === undefined || item.message_id === null) {
    return;
  }

  regeneratingMessageIndex.value = item.message_index;
  editingMessage.value = undefined;
  await submitChat(item.message_id, false, undefined, "model");
}

async function submitChat(
  regenerateMessageId?: number,
  notifyInvalid = false,
  overridePromptText?: string,
  regenerateSource: "model" | "user" = "model",
) {
  if (sending.value) {
    return;
  }

  if (!selectedProviderId.value || !selectedModelId.value) {
    if (notifyInvalid) {
      message.warning("请选择供应商和模型");
    }
    return;
  }

  const promptText =
    regenerateMessageId === undefined ? (overridePromptText ?? prompt.value).trim() : undefined;

  if (regenerateMessageId === undefined && !promptText) {
    if (notifyInvalid) {
      message.warning("请输入消息内容");
    }
    return;
  }

  const editingMessageIndex = editingMessage.value?.message_index;
  const editingMessageId = editingMessage.value?.message_id;
  const hasEditingMessageId = editingMessageId !== undefined && editingMessageId !== null;
  const submittedPromptText = promptText ?? "";

  if (editingMessage.value && !hasEditingMessageId) {
    message.warning("当前消息暂不可编辑，请刷新后重试");
    return;
  }
  let chatMode: AIChatParams["mode"] = "regenerate";
  if (regenerateMessageId === undefined) {
    chatMode = hasEditingMessageId ? "edit" : "create";
  }
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
        "额外请求头",
        (value) => value !== null && typeof value === "object" && !Array.isArray(value),
      ),
      frequency_penalty: frequencyPenalty.value,
      logit_bias: parseJsonField<Record<string, number>>(
        logitBias.value,
        "Logit Bias",
        (value) => value !== null && typeof value === "object" && !Array.isArray(value),
      ),
      max_tokens: maxTokens.value,
      mcp_ids: selectedMcpIds.value.length > 0 ? selectedMcpIds.value : undefined,
      generation_type: generationType.value,
      model_id: selectedModelId.value,
      parallel_tool_calls: parallelToolCalls.value,
      presence_penalty: presencePenalty.value,
      provider_id: selectedProviderId.value,
      mode: chatMode,
      thinking: thinking.value,
      seed: seed.value,
      stop_sequences: parseJsonField<string[]>(stopSequences.value, "停止序列", Array.isArray),
      temperature: temperature.value,
      timeout: timeout.value,
      top_p: topP.value,
      web_search: webSearch.value,
      ...(chatMode === "edit" && hasEditingMessageId
        ? {
            edit_message_id: editingMessageId,
            user_prompt: submittedPromptText,
          }
        : {}),
      ...(chatMode === "create" ? { user_prompt: submittedPromptText } : {}),
      ...(chatMode === "regenerate" && regenerateMessageId !== undefined
        ? { regenerate_message_id: regenerateMessageId }
        : {}),
    };
  } catch (error) {
    message.error((error as Error).message);
    return;
  }

  const targetConversationId = activeConversationId.value;
  if (regenerateMessageId !== undefined && !targetConversationId) {
    message.warning("当前会话不存在，无法重新生成");
    return;
  }
  const regenerateTargetMessageIndex = regeneratingMessageIndex.value;

  if (regenerateMessageId !== undefined && regenerateTargetMessageIndex !== undefined) {
    if (regenerateSource === "user") {
      activeMessages.value = activeMessages.value.filter(
        (item) => item.message_index <= regenerateTargetMessageIndex,
      );
    } else {
      const regenerateTargetArrayIndex = activeMessages.value.findIndex(
        (item) => item.role === "assistant" && item.message_index === regenerateTargetMessageIndex,
      );
      const preservedUserArrayIndex =
        regenerateTargetArrayIndex <= 0
          ? -1
          : ([...activeMessages.value.keys()]
              .slice(0, regenerateTargetArrayIndex)
              .toReversed()
              .find((index) => activeMessages.value[index]?.role === "user") ?? -1);

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
    conversation_id: targetConversationId,
    history: activeMessages.value,
    params: payload,
    promptText: regenerateMessageId === undefined ? submittedPromptText : undefined,
  });

  transientRequestError.value = null;
  setTransientMessages([]);

  if (regenerateMessageId === undefined || regenerateSource === "user") {
    prompt.value = "";
  }

  const requestParams: AIChatProviderRequest =
    regenerateMessageId === undefined
      ? {
          body: completionRequest,
          localMessages: submittedPromptText
            ? [createProviderUserMessage(submittedPromptText)]
            : [],
          mode: "create",
        }
      : {
          body: {
            forwarded_props: completionRequest.forwarded_props,
            thread_id: completionRequest.thread_id ?? targetConversationId,
          },
          conversation_id: targetConversationId,
          localMessages: [],
          message_id: regenerateMessageId,
          mode:
            regenerateSource === "user" ? "regenerate-from-message" : "regenerate-from-response",
        };

  onTransientRequest(requestParams);
  await chatProvider.request.asyncHandler;

  let streamedConversationId = targetConversationId;
  for (let index = transientMessagesState.value.length - 1; index >= 0; index -= 1) {
    const conversationId = transientMessagesState.value[index]?.message.conversation_id;
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
      activeConversationId.value = streamedConversationId;
      await fetchConversations(false);
      await loadConversationDetail(streamedConversationId);
    }

    setTransientMessages([]);
  } else {
    await fetchConversations(false);

    if (streamedConversationId) {
      activeConversationId.value = streamedConversationId;
      await loadConversationDetail(streamedConversationId);
    } else if (conversations.value[0]) {
      activeConversationId.value = conversations.value[0].conversation_id;
      await loadConversationDetail(conversations.value[0].conversation_id);
    }

    setTransientMessages([]);
  }

  editingMessage.value = undefined;
  editingMessageIntent.value = "save";
  regeneratingMessageIndex.value = undefined;
}

const activeConversation = computed(() => {
  return conversations.value.find((item) => item.conversation_id === activeConversationId.value);
});

const transientMessages = computed<ChatMessageItem[]>(() => {
  const fallbackIndex = activeMessages.value.length;
  const mergedTransientMessages: Array<{
    message: AIChatProviderMessage;
    status: "abort" | "error" | "loading" | "local" | "success" | "updating";
  }> = [];

  for (const info of transientMessagesState.value) {
    const lastItem = mergedTransientMessages.at(-1);

    if (info.message.role === "assistant" && lastItem?.message.role === "assistant") {
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
    return buildTransientMessageItems(info.message, fallbackIndex + index, info.status);
  });
});

const displayMessages = computed<ChatMessageItem[]>(() => {
  return [...activeMessages.value, ...transientMessages.value];
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

  if (selectedModelId.value && !options.some((item) => item.value === selectedModelId.value)) {
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
    return "发送首条消息后自动创建会话";
  }

  const labels = [`创建于 ${parseDateLabel(activeConversation.value.created_time)}`];
  if (activeConversation.value.is_pinned) {
    labels.unshift("已置顶");
  }
  return labels.join(" · ");
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

  if (detail.context_start_message_id !== null && detail.context_start_message_id !== undefined) {
    const anchorIndex = activeMessages.value.findIndex(
      (item) => item.message_id === detail.context_start_message_id,
    );

    if (anchorIndex >= 0) {
      return activeMessages.value[anchorIndex]?.id;
    }
  }

  return activeMessages.value[activeMessages.value.length - 1]?.id;
});

const selectedProviderLabel = computed(() => {
  return (
    providerOptions.value.find((item) => item.value === selectedProviderId.value)?.label ||
    "请选择供应商"
  );
});

const selectedModelLabel = computed(() => {
  return (
    modelOptions.value.find((item) => item.value === selectedModelId.value)?.label || "请选择模型"
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
  return Boolean(parallelToolCalls.value !== true || enableBuiltinTools.value !== true);
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
  return "";
});

const webSearchButtonLabel = computed(() => {
  const activeOption = WEB_SEARCH_OPTIONS.find((item) => item.value === webSearch.value);

  return activeOption?.label || "联网搜索";
});

const generationTypeButtonLabel = computed(() => {
  const activeOption = GENERATION_TYPE_OPTIONS.find((item) => item.value === generationType.value);

  return activeOption?.label || "文本";
});

const thinkingButtonLabel = computed(() => {
  const activeOption = THINKING_OPTIONS.find((item) => item.value === thinking.value);
  return activeOption?.label || "默认";
});

const senderAutoSize: NonNullable<SenderProps["autoSize"]> = {
  maxRows: 6,
  minRows: 2,
};

const MarkdownPre: FunctionalComponent = (_, { slots }) => {
  return h(
    "div",
    { class: "max-w-full overflow-x-auto" },
    (slots.default?.() as undefined | VNodeArrayChildren) ?? undefined,
  );
};

const MarkdownCode: FunctionalComponent = (_, { attrs, slots }) => {
  const content = extractMarkdownSlotText(slots.default?.());
  const language = String(attrs["data-lang"] ?? "text").toLowerCase();
  const isBlock = attrs["data-block"] === "true";

  if (!isBlock) {
    return h(
      "code",
      {
        class: "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground",
      },
      slots.default?.() as undefined | VNodeArrayChildren,
    );
  }

  if (language === "mermaid") {
    return renderMermaidBlock(content);
  }

  return renderCodeBlock(content, language);
};

function renderCodeBlock(content: string, language = "text") {
  return h("div", { class: "max-w-full overflow-x-auto" }, [
    h(CodeHighlighter, {
      content,
      language,
      showThemeToggle: false,
      theme: isDark.value ? "dark" : "light",
    }),
  ]);
}

function renderMermaidBlock(content: string) {
  return h("div", { class: "max-w-full overflow-x-auto" }, [
    h(Mermaid, {
      codeHighlighterProps: {
        showThemeToggle: false,
        theme: isDark.value ? "dark" : "light",
      },
      content,
    }),
  ]);
}

function getFileTypeLabel(file: ReturnType<typeof getMessageFileBlocks>[number]) {
  return [file.file_type || "file", file.mime_type, file.source_type].filter(Boolean).join(" · ");
}

function isImageFile(file: ReturnType<typeof getMessageFileBlocks>[number]) {
  return (
    file.file_type === "image" ||
    file.mime_type?.startsWith("image/") ||
    /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/iu.test(file.url || file.name || "")
  );
}

function isAudioFile(file: ReturnType<typeof getMessageFileBlocks>[number]) {
  return file.file_type === "audio" || file.mime_type?.startsWith("audio/");
}

function isVideoFile(file: ReturnType<typeof getMessageFileBlocks>[number]) {
  return file.file_type === "video" || file.mime_type?.startsWith("video/");
}

function renderMessageFileBlock(
  message: ChatMessageItem,
  file: ReturnType<typeof getMessageFileBlocks>[number],
  index: number,
) {
  const title = file.name || file.url || "附件";
  const meta = getFileTypeLabel(file);
  const key = `${message.id}-file-${index}`;

  if (file.url && isImageFile(file)) {
    return h("div", { key, class: "overflow-hidden rounded-xl border border-border bg-muted/15" }, [
      h(
        "a",
        {
          class: "block bg-black/5",
          href: file.url,
          rel: "noreferrer",
          target: "_blank",
        },
        [
          h("img", {
            alt: title,
            class: "max-h-[420px] w-full object-contain",
            loading: "lazy",
            src: file.url,
          }),
        ],
      ),
      h("div", { class: "space-y-1 px-3 py-3" }, [
        h("div", { class: "text-sm font-medium text-foreground" }, title),
        meta ? h("div", { class: "text-xs text-muted-foreground" }, meta) : null,
      ]),
    ]);
  }

  if (file.url && isAudioFile(file)) {
    return h(
      "div",
      {
        key,
        class: "space-y-3 rounded-xl border border-border bg-muted/15 px-3 py-3",
      },
      [
        h("div", { class: "text-sm font-medium text-foreground" }, title),
        h("audio", {
          class: "w-full",
          controls: true,
          preload: "metadata",
          src: file.url,
        }),
        meta ? h("div", { class: "text-xs text-muted-foreground" }, meta) : null,
      ],
    );
  }

  if (file.url && isVideoFile(file)) {
    return h(
      "div",
      {
        key,
        class: "space-y-3 rounded-xl border border-border bg-muted/15 px-3 py-3",
      },
      [
        h("video", {
          class: "max-h-[420px] w-full rounded-lg bg-black/70",
          controls: true,
          preload: "metadata",
          src: file.url,
        }),
        h("div", { class: "text-sm font-medium text-foreground" }, title),
        meta ? h("div", { class: "text-xs text-muted-foreground" }, meta) : null,
      ],
    );
  }

  return h(
    "a",
    {
      key,
      class:
        "block max-w-full rounded-xl border border-border bg-muted/30 px-3 py-2 no-underline transition-colors hover:border-primary/30 hover:bg-accent/30",
      href: file.url || undefined,
      rel: "noreferrer",
      target: file.url ? "_blank" : undefined,
    },
    [
      h("div", { class: "text-sm font-medium text-foreground" }, title),
      meta ? h("div", { class: "mt-1 text-xs text-muted-foreground" }, meta) : null,
    ],
  );
}

function extractMarkdownSlotText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractMarkdownSlotText(item)).join("");
  }

  if (value && typeof value === "object" && "children" in value) {
    return extractMarkdownSlotText((value as { children?: unknown }).children);
  }

  return "";
}

function MarkdownContent(props: { content?: string; streaming?: boolean }) {
  return h(XMarkdown, {
    className: [
      isDark.value ? "x-markdown-dark" : "x-markdown-light",
      "min-w-0 max-w-full break-words",
    ].join(" "),
    components: {
      code: MarkdownCode,
      pre: MarkdownPre,
    },
    config: {
      breaks: true,
      gfm: true,
    },
    content: props.content ?? "",
    openLinksInNewTab: true,
    ...(props.streaming
      ? {
          streaming: {
            hasNextChunk: true,
          },
        }
      : {}),
  });
}

function renderConversationLabel(conversation: AIChatConversationItem) {
  return h("div", { class: "min-w-0 pr-8" }, [
    h("div", { class: "flex min-w-0 items-center gap-1.5" }, [
      h(
        "span",
        {
          class: "min-w-0 flex-1 truncate text-[13px] font-medium leading-5",
          title: conversation.title,
        },
        conversation.title,
      ),
      conversation.is_pinned
        ? h(Pin, {
            class: "size-3.5 shrink-0 text-muted-foreground",
          })
        : null,
    ]),
    conversation.is_pinned
      ? h("div", { class: "mt-0.5 text-[11px] leading-4 text-muted-foreground" }, "已置顶")
      : null,
  ]);
}

const conversationItems = computed<ConversationsProps["items"]>(() => {
  return conversations.value.map((conversation) => ({
    key: conversation.conversation_id,
    label: renderConversationLabel(conversation),
  }));
});

const conversationCreation = computed<ConversationsProps["creation"]>(() => ({
  disabled: sending.value || !canCreateNewConversation.value,
  onClick: createNewConversation,
}));

function getConversationListMenu(value: { key?: string; type?: string }) {
  if (!value || "type" in value) {
    return { items: [] };
  }

  const conversation = conversations.value.find((item) => item.conversation_id === value.key);
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

function handleQuickPhraseSelect(item: AIQuickPhraseResult) {
  appendQuickPhrase(item);
  quickPhrasePopoverOpen.value = false;
}

function handleSenderSubmit(messageText: string) {
  void submitChat(undefined, true, messageText);
}

function handleSenderChange(value: string) {
  prompt.value = value;
}

function getMessageBubbleClasses(message: ChatMessageItem): BubbleProps["classes"] | undefined {
  const baseClasses = {
    body: "min-w-0 max-w-full",
    content: "max-w-full overflow-hidden",
    root: "min-w-0 max-w-[calc(100%-16px)] md:max-w-[82%] xl:max-w-[76%]",
  };

  if (message.message_type !== "error") {
    return baseClasses;
  }

  return {
    ...baseClasses,
    content: `${baseClasses.content} !border !border-destructive/20 !bg-destructive/6 !text-destructive !shadow-none`,
  };
}

function getMessageContentRender(message: ChatMessageItem): BubbleProps["contentRender"] {
  return () => {
    const reasoningText = getThinkingContent(message);
    const text = getMessageTextContent(message, "text");
    const files = getMessageFileBlocks(message);

    if (message.message_type === "error") {
      return h("div", { class: "min-w-0 max-w-full space-y-2" }, [
        h(
          "div",
          {
            class: "text-sm leading-6 whitespace-pre-wrap break-words text-destructive",
          },
          text || "生成失败",
        ),
        message.conversation_id
          ? h(
              "div",
              {
                class:
                  "border-t border-destructive/20 pt-2 text-xs leading-5 whitespace-pre-wrap break-all text-destructive/80",
              },
              ["对话 ID: ", message.conversation_id],
            )
          : null,
      ]);
    }

    return h(
      "div",
      { class: "min-w-0 max-w-full space-y-3" },
      [
        reasoningText
          ? h(
              Think,
              {
                blink: Boolean(message.streaming),
                expanded: isThinkingExpanded(message),
                loading: Boolean(message.streaming),
                title: getThinkingToggleLabel(message),
                "onUpdate:expanded": (expanded: boolean) => {
                  setThinkingExpanded(message, expanded);
                },
              },
              () =>
                h(MarkdownContent, {
                  content: reasoningText,
                  streaming: Boolean(message.streaming),
                }),
            )
          : null,
        text
          ? h(MarkdownContent, {
              content: text,
              streaming: Boolean(message.streaming),
            })
          : null,
        ...files.map((file, index) => renderMessageFileBlock(message, file, index)),
      ].filter(Boolean),
    );
  };
}

function renderMessageHeader(message: ChatMessageItem) {
  return h(
    "div",
    {
      class: [
        "mb-1.5 text-xs text-muted-foreground",
        message.role === "user" ? "text-right" : "text-left",
      ],
    },
    [getMessageDisplayName(message), " · ", parseDateLabel(message.created_time)],
  );
}

function shouldRenderContextDividerAfter(message: ChatMessageItem) {
  return contextDividerAfterMessageId.value === message.id;
}

function getMessageDisplayName(message: ChatMessageItem) {
  if (message.role === "user") {
    return "你";
  }

  return message.model_id || (selectedModelId.value ? selectedModelLabel.value : "AI 助手");
}

function renderMessageAvatar(message: ChatMessageItem): BubbleProps["avatar"] {
  return h(AAvatar, undefined, () => (message.role === "user" ? "你" : "AI"));
}

function confirmDeleteMessage(item: ChatMessageItem) {
  confirm({
    content: `确认删除第 ${item.message_index + 1} 条消息吗？`,
    icon: "warning",
  }).then(async () => {
    await deleteMessageChain(item);
  });
}

function getMessageActionItems(message: ChatMessageItem): ActionsProps["items"] {
  const items: ActionsProps["items"] = [
    {
      icon: h(IconifyIcon, { class: "size-3.5", icon: "mdi:content-copy" }),
      key: "copy",
      label: "复制",
      onItemClick: () => copyMessageContent(message),
    },
  ];

  if (message.role === "user") {
    items.push(
      {
        icon: h(IconifyIcon, { class: "size-3.5", icon: "mdi:refresh" }),
        key: "regenerate",
        label: "重新生成",
        onItemClick: () => regenerateUserMessage(message),
      },
      {
        icon: h(IconifyIcon, { class: "size-3.5", icon: "mdi:pencil-outline" }),
        key: "edit",
        label: "编辑保存",
        onItemClick: () => beginEditMessage(message, "save"),
      },
      {
        icon: h(IconifyIcon, { class: "size-3.5", icon: "mdi:send-outline" }),
        key: "edit-resend",
        label: "编辑重发",
        onItemClick: () => beginEditMessage(message, "resend"),
      },
    );
  }

  if (message.role === "assistant") {
    items.push({
      icon: h(IconifyIcon, { class: "size-3.5", icon: "mdi:refresh" }),
      key: "retry",
      label: "重新生成",
      onItemClick: () => regenerateMessage(message),
    });
  }

  items.push({
    danger: true,
    icon: h(IconifyIcon, { class: "size-3.5", icon: "mdi:delete-outline" }),
    key: "delete",
    label: "删除消息",
    onItemClick: () => confirmDeleteMessage(message),
  });

  return items;
}

function renderMessageFooter(message: ChatMessageItem) {
  return h(Actions, {
    fadeIn: true,
    items: getMessageActionItems(message),
  });
}

function isMessageBubbleLoading(message: ChatMessageItem) {
  return message.role === "assistant" && message.streaming && !hasRenderableMessageContent(message);
}

function renderFooterIconButton(options: {
  disabled?: boolean;
  icon: string;
  onClick?: () => void;
  title: string;
}) {
  return h(AButton, {
    class: "inline-flex size-8 items-center justify-center !px-0",
    disabled: options.disabled,
    htmlType: "button",
    icon: h(IconifyIcon, {
      class: "size-4",
      icon: options.icon,
    }),
    onClick: () => {
      options.onClick?.();
    },
    size: "small",
    title: options.title,
    type: "text",
  });
}

function renderThinkingPopoverContent() {
  return h("div", { class: "w-[320px] space-y-3" }, [
    h("div", { class: "text-xs font-medium text-foreground" }, "思考链"),
    h(
      "div",
      { class: "space-y-2" },
      THINKING_OPTIONS.map((item) =>
        h(
          "button",
          {
            key: item.key,
            class: [
              "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
              thinking.value === item.value
                ? "border-primary/35 bg-primary/10"
                : "border-border bg-background hover:border-primary/30 hover:bg-accent/30",
            ],
            onClick: () => {
              thinking.value = item.value;
            },
            type: "button",
          },
          [
            h(
              "span",
              {
                class: [
                  "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                  thinking.value === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent",
                ],
              },
              "✓",
            ),
            h("span", { class: "min-w-0 flex-1" }, [
              h("span", { class: "block text-xs font-medium text-foreground" }, item.label),
              h("span", { class: "mt-1 block text-[11px] text-muted-foreground/75" }, item.desc),
            ]),
          ],
        ),
      ),
    ),
  ]);
}

function renderGenerationPopoverContent() {
  return h("div", { class: "w-[320px] space-y-3" }, [
    h("div", { class: "text-xs font-medium text-foreground" }, "生成类型"),
    h(
      "div",
      { class: "space-y-2" },
      GENERATION_TYPE_OPTIONS.map((item) =>
        h(
          "button",
          {
            key: item.value,
            class: [
              "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
              generationType.value === item.value
                ? "border-primary/35 bg-primary/10"
                : "border-border bg-background hover:border-primary/30 hover:bg-accent/30",
            ],
            onClick: () => {
              generationType.value = item.value;
            },
            type: "button",
          },
          [
            h(
              "span",
              {
                class: [
                  "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
                  generationType.value === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent",
                ],
              },
              "✓",
            ),
            h("span", { class: "min-w-0 flex-1" }, [
              h(
                "span",
                { class: "block truncate text-xs font-medium leading-4 text-foreground" },
                item.label,
              ),
              h(
                "span",
                { class: "mt-1 block truncate text-[11px] leading-4 text-muted-foreground/75" },
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
  return h("div", { class: "w-[320px] space-y-3" }, [
    h("div", { class: "text-xs font-medium text-foreground" }, "网络搜索"),
    h(
      "div",
      { class: "space-y-2" },
      WEB_SEARCH_OPTIONS.map((item) =>
        h(
          "button",
          {
            key: item.value,
            class: [
              "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
              webSearch.value === item.value
                ? "border-primary/35 bg-primary/10"
                : "border-border bg-background hover:border-primary/30 hover:bg-accent/30",
            ],
            onClick: () => {
              webSearch.value = item.value;
            },
            type: "button",
          },
          [
            h(
              "span",
              {
                class: [
                  "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
                  webSearch.value === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-transparent",
                ],
              },
              "✓",
            ),
            h("span", { class: "min-w-0 flex-1" }, [
              h(
                "span",
                { class: "block truncate text-xs font-medium leading-4 text-foreground" },
                item.label,
              ),
              h(
                "span",
                { class: "mt-1 block truncate text-[11px] leading-4 text-muted-foreground/75" },
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
  return h("div", { class: "w-[360px] space-y-3" }, [
    h("div", { class: "text-xs font-medium text-foreground" }, "MCP"),
    mcps.value.length === 0
      ? h(AEmpty, {
          description: "暂无可用 MCP",
          image: null,
        })
      : h(
          "div",
          {
            class: "flex max-h-[260px] min-h-[120px] flex-col gap-2 overflow-y-auto",
          },
          mcps.value.map((item) =>
            h(
              "button",
              {
                key: item.id,
                class: [
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                  isMcpSelected(item.id)
                    ? "border-primary/30 bg-primary/8 text-foreground"
                    : "border-border bg-background hover:border-primary/20 hover:bg-accent/30",
                ],
                onClick: () => {
                  toggleMcpSelection(item.id);
                },
                title:
                  `${item.name} ${item.description || item.command || item.url || `MCP #${item.id}`}`.trim(),
                type: "button",
              },
              [
                h(
                  "span",
                  {
                    class: "min-w-0 shrink-0 truncate text-xs font-medium text-foreground",
                  },
                  item.name,
                ),
                h(
                  "span",
                  {
                    class: "min-w-0 flex-1 truncate text-[11px] text-muted-foreground/75",
                  },
                  item.description || item.command || item.url || `MCP #${item.id}`,
                ),
                h(
                  "span",
                  {
                    class: [
                      "inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none",
                      isMcpSelected(item.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-transparent",
                    ],
                  },
                  "✓",
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
      "div",
      {
        class: "flex min-h-[120px] items-center justify-center text-muted-foreground",
      },
      [h(ASpin, { size: "small" })],
    );
  } else if (quickPhrases.value.length === 0) {
    quickPhraseContent = h(AEmpty, {
      description: "暂无快捷短语",
      image: null,
    });
  } else {
    quickPhraseContent = h(
      "div",
      {
        class: "flex max-h-[260px] min-h-[120px] flex-col gap-2 overflow-y-auto",
      },
      quickPhrases.value.map((item) =>
        h(
          "button",
          {
            key: item.id,
            class:
              "flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary/20 hover:bg-accent/30",
            onClick: () => {
              handleQuickPhraseSelect(item);
            },
            title: `${item.title} ${item.content}`.trim(),
            type: "button",
          },
          [
            h(
              "span",
              {
                class: "min-w-0 shrink-0 truncate text-xs font-medium text-foreground",
              },
              item.title,
            ),
            h(
              "span",
              {
                class: "min-w-0 flex-1 truncate text-[11px] text-muted-foreground/75",
              },
              item.content,
            ),
          ],
        ),
      ),
    );
  }

  return h("div", { class: "w-[360px] space-y-3" }, [
    h("div", { class: "text-xs font-medium text-foreground" }, "快捷短语"),
    quickPhraseContent,
  ]);
}

const renderSenderFooter: NonNullable<SenderProps["footer"]> = (_, info) => {
  const { LoadingButton, SendButton } = info.components;
  const thinkingButtonTitle = `思考：${thinkingButtonLabel.value}`;

  return h(
    AFlex,
    {
      align: "center",
      gap: "small",
      justify: "space-between",
      vertical: false,
      wrap: "wrap",
    },
    {
      default: () => [
        h(
          AFlex,
          {
            align: "center",
            gap: "middle",
            wrap: "wrap",
          },
          {
            default: () => [
              renderFooterIconButton({
                disabled: sending.value || !canCreateNewConversation.value,
                icon: "mdi:message-plus-outline",
                onClick: createNewConversation,
                title: "新建话题",
              }),
              h(
                Popover,
                { placement: "topLeft", trigger: "click" },
                {
                  content: () => renderGenerationPopoverContent(),
                  default: () =>
                    renderFooterIconButton({
                      disabled: sending.value,
                      icon: generationType.value === "image" ? "mdi:image" : "mdi:image-outline",
                      title: `生成类型：${generationTypeButtonLabel.value}`,
                    }),
                },
              ),
              h(
                Popover,
                { placement: "topLeft", trigger: "click" },
                {
                  content: () => renderThinkingPopoverContent(),
                  default: () =>
                    renderFooterIconButton({
                      disabled: sending.value,
                      icon: "mdi:head-lightbulb-outline",
                      title: thinkingButtonTitle,
                    }),
                },
              ),
              h(
                Popover,
                { placement: "topLeft", trigger: "click" },
                {
                  content: () => renderWebSearchPopoverContent(),
                  default: () =>
                    renderFooterIconButton({
                      disabled: sending.value,
                      icon: "mdi:web",
                      title: `联网搜索：${webSearchButtonLabel.value}`,
                    }),
                },
              ),
              h(
                Popover,
                {
                  align: { overflow: { adjustX: false, adjustY: true } },
                  placement: "topLeft",
                  trigger: "click",
                },
                {
                  content: () => renderMcpPopoverContent(),
                  default: () =>
                    renderFooterIconButton({
                      disabled: sending.value,
                      icon: "simple-icons:modelcontextprotocol",
                      title:
                        selectedMcpIds.value.length > 0
                          ? `已选择 ${selectedMcpIds.value.length} 个 MCP`
                          : "选择 MCP",
                    }),
                },
              ),
              h(
                Popover,
                {
                  align: { overflow: { adjustX: false, adjustY: true } },
                  onOpenChange: handleQuickPhrasePopoverOpenChange,
                  open: quickPhrasePopoverOpen.value,
                  placement: "topLeft",
                  trigger: "click",
                },
                {
                  content: () => renderQuickPhrasePopoverContent(),
                  default: () =>
                    renderFooterIconButton({
                      disabled: sending.value,
                      icon: "mdi:lightning-bolt-outline",
                      title: "快捷短语",
                    }),
                },
              ),
              renderFooterIconButton({
                disabled: sending.value,
                icon: "mdi:cog-outline",
                onClick: () => {
                  settingsModalApi.open();
                },
                title: hasAdvancedSettings.value ? "参数设置（已调整）" : "参数设置",
              }),
              renderFooterIconButton({
                disabled: !canClearMessages.value,
                icon: "mdi:eraser-variant",
                onClick: () => {
                  confirmClearMessages();
                },
                title: "清空消息",
              }),
              renderFooterIconButton({
                disabled: sending.value || !activeConversationId.value,
                icon: "mdi:broom",
                onClick: () => {
                  void clearConversationContext();
                },
                title: "清除上下文",
              }),
            ],
          },
        ),
        h(
          AFlex,
          {
            align: "center",
            class: "w-full md:w-auto",
            gap: "small",
            justify: "flex-end",
            wrap: "wrap",
          },
          {
            default: () => [
              composerHint.value
                ? h(
                    "span",
                    {
                      class:
                        "inline-flex max-w-full whitespace-pre-wrap text-left text-xs leading-5 text-muted-foreground",
                    },
                    composerHint.value,
                  )
                : null,
              sending.value
                ? h(LoadingButton, {
                    type: "default",
                  })
                : h(SendButton, {
                    class: "inline-flex size-8 items-center justify-center !rounded-md !px-0",
                    disabled:
                      !selectedProviderId.value || !selectedModelId.value || !prompt.value.trim(),
                    icon: h(IconifyIcon, {
                      class: "size-4",
                      icon: "mdi:send",
                    }),
                    shape: "default",
                    type: "text",
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
  class: "h-[min(78vh,760px)] w-[min(960px,92vw)] [overscroll-behavior:contain]",
  footer: true,
  onOpenChange(isOpen) {
    document.documentElement.style.overflow = isOpen ? "hidden" : "";
    document.body.style.overflow = isOpen ? "hidden" : "";
  },
  title: "参数设置",
});

onMounted(async () => {
  await fetchProviders();
  await fetchMcps();
  await fetchQuickPhrases();
  await fetchConversations(false);

  if (conversations.value[0]) {
    activeConversationId.value = conversations.value[0].conversation_id;
    await loadConversationDetail(conversations.value[0].conversation_id);
  } else {
    createNewConversation();
  }

  hasInitialized = true;
});

onActivated(async () => {
  if (!hasInitialized) {
    return;
  }

  await refreshChatResources();
});

onBeforeUnmount(() => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  abortTransientRequest();
});
</script>

<template>
  <ColPage auto-content-height content-class="h-full" :left-width="20" :right-width="80">
    <template #left>
      <ChatSidebar
        :active-key="activeConversationId"
        :creation="conversationCreation"
        :has-more="hasMoreConversations"
        :items="conversationItems || []"
        :loading="sidebarLoading"
        :loading-more="sidebarMoreLoading"
        :menu="getConversationListMenu"
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
            <template v-if="isRenamingConversation && activeConversationId">
              <div class="flex flex-wrap items-center gap-2">
                <a-input
                  v-model:value="renameTitle"
                  class="max-w-[360px]"
                  placeholder="请输入话题标题"
                  @press-enter="submitRenameConversation"
                />
                <VbenButton size="sm" @click="submitRenameConversation"> 保存 </VbenButton>
                <VbenButton size="sm" variant="outline" @click="cancelRenameConversation">
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
                  <IconifyIcon
                    class="size-3 shrink-0 text-muted-foreground"
                    icon="mdi:chevron-right"
                  />
                  <a-popover placement="bottomLeft" trigger="click">
                    <template #content>
                      <div class="w-[280px] space-y-3">
                        <div>
                          <div class="mb-2 text-xs font-medium text-foreground">供应商</div>
                          <a-select
                            v-model:value="selectedProviderId"
                            class="w-full"
                            :disabled="sending || resourcesLoading"
                            :options="providerOptions"
                            placeholder="请选择供应商"
                          />
                        </div>
                        <div>
                          <div class="mb-2 text-xs font-medium text-foreground">模型</div>
                          <a-select
                            v-model:value="selectedModelId"
                            class="w-full"
                            :disabled="sending || resourcesLoading || modelOptions.length === 0"
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
        </div>
      </div>

      <div
        ref="messageContainerRef"
        class="flex-1 overflow-x-hidden overflow-y-auto bg-background/60 px-5 py-5 md:px-6 md:py-6"
        @scroll="handleMessageContainerScroll"
      >
        <div v-if="detailLoading" class="flex min-h-full items-center justify-center">
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
              title="开始新的对话"
            />
          </div>
        </div>
        <template v-else>
          <template v-for="item in displayMessages" :key="item.id">
            <div
              class="mb-3.5 flex min-w-0 w-full"
              :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="flex min-w-0 w-full flex-col"
                :class="item.role === 'user' ? 'items-end' : 'items-start'"
              >
                <Bubble
                  :avatar="renderMessageAvatar(item)"
                  :classes="getMessageBubbleClasses(item)"
                  :content="getEditableMessageText(item)"
                  :content-render="getMessageContentRender(item)"
                  :editable="
                    isEditingMessage(item)
                      ? {
                          cancelText: '取消',
                          editing: true,
                          okText: editingMessageIntent === 'resend' ? '重发' : '保存',
                        }
                      : false
                  "
                  :footer="renderMessageFooter(item)"
                  :footer-placement="item.role === 'user' ? 'outer-end' : 'outer-start'"
                  :header="renderMessageHeader(item)"
                  :loading="isMessageBubbleLoading(item)"
                  :placement="item.role === 'user' ? 'end' : 'start'"
                  :streaming="item.role === 'assistant' && item.streaming"
                  :on-edit-cancel="cancelEditMessage"
                  :on-edit-confirm="
                    (value) =>
                      editingMessageIntent === 'resend'
                        ? resendEditedMessage(String(value))
                        : saveEditedMessage(String(value))
                  "
                />
              </div>
            </div>
            <div v-if="shouldRenderContextDividerAfter(item)" class="mb-3.5 w-full">
              <div class="flex items-center gap-3 text-[11px] text-muted-foreground md:text-xs">
                <div class="h-px flex-1 bg-border"></div>
                <span class="shrink-0 rounded-full border border-border bg-background px-3 py-1">
                  已清除上下文
                </span>
                <div class="h-px flex-1 bg-border"></div>
              </div>
            </div>
          </template>
        </template>
      </div>

      <ChatSender
        :auto-size="senderAutoSize"
        :disabled="false"
        :footer="renderSenderFooter"
        :loading="sending"
        :on-cancel="stopStreaming"
        :on-change="handleSenderChange"
        :on-submit="handleSenderSubmit"
        placeholder="在这里输入消息，按 Enter 发送"
        :suffix="false"
        :value="prompt"
      />
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
        <a-button danger type="primary" @click="resetModelSettings"> 重置 </a-button>
      </template>
      <div
        class="grid h-full min-h-0 min-w-0 overscroll-contain lg:grid-cols-[220px_minmax(0,1fr)]"
        @touchmove.stop
        @wheel.stop
      >
        <div class="h-full min-h-0 overflow-hidden border-r border-border bg-muted/10 p-4">
          <div class="rounded-lg bg-accent px-4 py-3 text-left text-sm font-medium text-foreground">
            模型配置
          </div>
        </div>

        <div
          class="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 md:p-5 [overscroll-behavior:contain]"
        >
          <div class="space-y-6">
            <div class="space-y-3">
              <div :class="settingsSectionTitleClass">生成控制：</div>
              <section :class="settingsSectionClass">
                <div class="grid gap-4 md:grid-cols-2">
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Temperature</span>
                        <a-tooltip
                          placement="right"
                          title="控制回答的发散程度，越低越稳定，越高越灵活，取值范围 0 到 2"
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
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span class="inline-flex min-w-0 items-center gap-1.5">
                        <span class="text-sm font-medium text-foreground">Top P</span>
                        <a-tooltip
                          placement="right"
                          title="控制候选词范围，通常与 Temperature 二选一微调即可，取值范围 0 到 1"
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
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Max Tokens</span>
                        <a-tooltip
                          placement="right"
                          title="限制单次回答长度，可选；不填时由模型自行决定"
                        >
                          <IconifyIcon
                            class="text-muted-foreground"
                            icon="mdi:help-circle-outline"
                          />
                        </a-tooltip>
                      </span>
                    </div>
                    <a-input-number v-model:value="maxTokens" class="w-full" :min="1" />
                  </div>
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Timeout</span>
                        <a-tooltip
                          placement="right"
                          title="超过这个时间还没返回结果时，请求会被视为超时，单位为秒"
                        >
                          <IconifyIcon
                            class="text-muted-foreground"
                            icon="mdi:help-circle-outline"
                          />
                        </a-tooltip>
                      </span>
                    </div>
                    <a-input-number v-model:value="timeout" class="w-full" :min="0" :step="1" />
                  </div>
                </div>
              </section>
            </div>

            <div class="space-y-3">
              <div :class="settingsSectionTitleClass">行为控制：</div>
              <section :class="settingsSectionClass">
                <div class="grid gap-4 md:grid-cols-2">
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span class="inline-flex min-w-0 items-center gap-1.5">
                        <span class="text-sm font-medium text-foreground">Seed</span>
                        <a-tooltip
                          placement="right"
                          title="固定随机种子后，更容易复现相似结果；该项可选"
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
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Presence Penalty</span>
                        <a-tooltip
                          placement="right"
                          title="提高后更鼓励模型引入新内容，减少重复话题，取值范围 -2 到 2"
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
                  <div :class="settingsWideFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Frequency Penalty</span>
                        <a-tooltip
                          placement="right"
                          title="提高后更少重复相同措辞，适合压制啰嗦输出，取值范围 -2 到 2"
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
                </div>
              </section>
            </div>

            <div class="space-y-3">
              <div :class="settingsSectionTitleClass">工具能力：</div>
              <section :class="settingsSectionClass">
                <div class="grid gap-4">
                  <div :class="settingsSwitchRowClass">
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-foreground">启用内置工具</div>
                      <div class="mt-1 text-xs text-muted-foreground">允许模型调用系统内置工具</div>
                    </div>
                    <ASwitch v-model:checked="enableBuiltinTools" size="small" />
                  </div>
                  <div :class="settingsSwitchRowClass">
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-foreground">并行工具调用</div>
                      <div class="mt-1 text-xs text-muted-foreground">
                        允许模型同时发起多个工具调用
                      </div>
                    </div>
                    <ASwitch v-model:checked="parallelToolCalls" size="small" />
                  </div>
                </div>
              </section>
            </div>

            <div class="space-y-3">
              <div :class="settingsSectionTitleClass">请求透传：</div>
              <section :class="settingsSectionClass">
                <div class="grid gap-4">
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">停止序列</span>
                        <a-tooltip
                          placement="right"
                          title="当生成到这些内容时立即停止，适合截断特定格式，这里填写的是 JSON 数组"
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
                      :placeholder="stopSequencesPlaceholder"
                    />
                  </div>
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Extra Headers</span>
                        <a-tooltip
                          placement="right"
                          title="额外附加到模型请求中的请求头，通常用于特殊网关，这里填写的是 JSON 对象"
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
                      :placeholder="extraHeadersPlaceholder"
                    />
                  </div>
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Extra Body</span>
                        <a-tooltip
                          placement="right"
                          title="透传额外请求体字段，适合补充模型专属参数，这里填写的是 JSON 内容"
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
                      :placeholder="extraBodyPlaceholder"
                    />
                  </div>
                  <div :class="settingsFieldClass">
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground"
                      >
                        <span class="font-medium">Logit Bias</span>
                        <a-tooltip
                          placement="right"
                          title="用来提高或压低特定 token 的出现概率，适合高级控制，这里填写的是 JSON 对象"
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
                      :placeholder="logitBiasPlaceholder"
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </SettingsModal>
  </ColPage>
</template>
