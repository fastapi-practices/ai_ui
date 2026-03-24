<script setup lang="ts">
import type { ChatMessageItem } from './data';

import type {
  AIChatConversationDetail,
  AIChatConversationItem,
  AIChatMessage,
  AIChatParams,
  AIModelResult,
  AIProviderResult,
  AIQuickPhraseResult,
} from '#/plugins/ai/api';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { RouterLink } from 'vue-router';

import { Page, useVbenModal, VbenButton } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useClipboard } from '@vueuse/core';

import { message } from 'antdv-next';
import MarkdownRender from 'markstream-vue';

import {
  clearAIChatConversationMessagesApi,
  deleteAIChatConversationApi,
  deleteAIChatMessageApi,
  getAIChatConversationDetailApi,
  getAllAIModelApi,
  getAllAIProviderApi,
  getAllAIQuickPhraseApi,
  getRecentAIChatConversationsApi,
  pinAIChatConversationApi,
  streamAIChatApi,
  updateAIChatConversationApi,
} from '#/plugins/ai/api';

import {
  compareConversations,
  COMPOSER_DEFAULT_HEIGHT,
  COMPOSER_FALLBACK_MAX_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  consumeBufferedLines,
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

import 'markstream-vue/index.css';

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
    conversations.value[index] = {
      ...conversations.value[index],
      ...summary,
    };
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

function resetAdvancedSettings() {
  maxTokens.value = undefined;
  temperature.value = 1;
  topP.value = undefined;
  timeout.value = undefined;
  seed.value = undefined;
  presencePenalty.value = undefined;
  frequencyPenalty.value = undefined;
  parallelToolCalls.value = true;
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
  upsertConversation({
    conversation_id: detail.conversation_id,
    created_time: detail.created_time,
    id: detail.id,
    is_pinned: detail.is_pinned,
    last_activity_time: detail.last_activity_time,
    last_message: detail.last_message,
    message_count: detail.message_count,
    model_id: detail.model_id,
    pinned_time: detail.pinned_time,
    provider_id: detail.provider_id,
    title: detail.title,
    updated_time: detail.updated_time,
    user_id: detail.user_id,
  });
}

function finalizeStreamingMessages() {
  activeMessages.value = activeMessages.value.map((item) => ({
    ...item,
    streaming: false,
  }));
}

function stopStreaming() {
  abortController?.abort();
  abortController = undefined;
  sending.value = false;
  finalizeStreamingMessages();
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
      last_activity_time: data.timestamp,
      last_message: messageContent,
      message_count: activeMessages.value.length + 1,
      model_id: selectedModelId.value || '',
      pinned_time: null,
      provider_id: selectedProviderId.value || 0,
      title: draftConversationTitle.value,
      updated_time: data.timestamp,
      user_id: 0,
    });
  }

  if (data.role === 'user') {
    activeMessages.value.push(
      normalizeMessage(
        data,
        activeMessages.value.length,
        activeConversationId.value,
      ),
    );
  } else {
    const lastMessage = activeMessages.value.at(-1);
    if (
      lastMessage?.role === 'model' &&
      (data.message_index === undefined ||
        data.message_index === lastMessage.message_index)
    ) {
      lastMessage.content = mergeModelContent(
        lastMessage.content,
        messageContent,
      );
      lastMessage.conversation_id =
        data.conversation_id ?? lastMessage.conversation_id;
      lastMessage.error_message = data.error_message ?? lastMessage.error_message;
      lastMessage.is_error = data.is_error ?? lastMessage.is_error;
      lastMessage.message_index =
        data.message_index ?? lastMessage.message_index;
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
      last_activity_time: data.timestamp,
      last_message: messageContent,
      message_count: activeMessages.value.length,
      model_id: selectedModelId.value || '',
      pinned_time: existingConversation?.pinned_time || null,
      provider_id: selectedProviderId.value || 0,
      title: existingConversation?.title || draftConversationTitle.value,
      updated_time: data.timestamp,
      user_id: existingConversation?.user_id || 0,
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

async function handleProviderModelPopoverOpenChange(open: boolean) {
  if (!open) {
    return;
  }

  await fetchProviders();

  if (selectedProviderId.value) {
    await fetchModelsByProvider(selectedProviderId.value);
  }
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

  if (
    !activeConversationId.value &&
    !data.some((item) => item.model_id === selectedModelId.value)
  ) {
    selectedModelId.value = undefined;
  }
}

async function fetchQuickPhrases() {
  quickPhraseLoading.value = true;
  try {
    const data = await getAllAIQuickPhraseApi();
    quickPhrases.value = [...data].toSorted((a, b) => {
      if ((a.sort || 0) !== (b.sort || 0)) {
        return (a.sort || 0) - (b.sort || 0);
      }
      return (
        new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
      );
    });
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
      before: append ? conversationBeforeCursor.value : undefined,
      limit: 20,
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
    conversationBeforeCursor.value = data.next_before || undefined;
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
    (item.role !== 'user' && item.role !== 'model') ||
    item.message_index === undefined
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

function saveEditedMessage() {
  const trimmedContent = editingMessageDraft.value.trim();
  const targetMessage = editingMessage.value;

  if (!targetMessage) {
    return;
  }

  if (!trimmedContent) {
    message.warning('请输入消息内容');
    return;
  }

  updateMessageContent(targetMessage, trimmedContent);
  cancelEditMessage();
  message.success('消息内容已保存');
}

async function resendEditedMessage() {
  const trimmedContent = editingMessageDraft.value.trim();
  const targetMessage = editingMessage.value;

  if (!targetMessage || targetMessage.message_index === undefined) {
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
  await submitChat(undefined, true, trimmedContent);
}

async function regenerateUserMessage(item: ChatMessageItem) {
  if (item.role !== 'user' || item.message_index === undefined) {
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

function startRenameConversation() {
  if (!activeConversation.value) {
    return;
  }
  renameTitle.value = activeConversation.value.title;
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

async function togglePinConversation() {
  const conversation = activeConversation.value;
  if (!conversation) {
    return;
  }

  await pinAIChatConversationApi(conversation.conversation_id, {
    is_pinned: !conversation.is_pinned,
  });
  await fetchConversations(false);
  message.success(conversation.is_pinned ? '已取消置顶' : '已置顶话题');
}

async function removeConversation(conversationId: string) {
  stopStreaming();
  await deleteAIChatConversationApi(conversationId);
  removeConversationSummary(conversationId);

  if (activeConversationId.value === conversationId) {
    const nextConversation = sortedConversations.value.find(
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
      last_activity_time: new Date().toISOString(),
      last_message: null,
      message_count: 0,
    });
  }
  streamError.value = '';
  message.success('当前话题消息已清空');
}

async function deleteMessageChain(item: ChatMessageItem) {
  if (!activeConversationId.value || item.message_index === undefined) {
    return;
  }

  stopStreaming();

  const result = await deleteAIChatMessageApi(
    activeConversationId.value,
    item.message_index,
  );

  if (result.deleted_conversation) {
    const deletedConversationId = activeConversationId.value;
    removeConversationSummary(deletedConversationId);
    const nextConversation = sortedConversations.value.find(
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
  if (item.role !== 'model' || item.message_index === undefined) {
    return;
  }

  regeneratingMessageIndex.value = item.message_index;
  editingMessage.value = undefined;
  await submitChat(item.message_index);
}

async function submitChat(
  regenerateMessageIndex?: number,
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
    regenerateMessageIndex === undefined
      ? (overridePromptText ?? prompt.value).trim()
      : undefined;

  if (regenerateMessageIndex === undefined && !promptText) {
    if (notifyInvalid) {
      message.warning('请输入消息内容');
    }
    return;
  }

  const editingMessageIndex = editingMessage.value?.message_index;
  const submittedTitle =
    activeConversationId.value || !promptText
      ? draftConversationTitle.value
      : makeConversationTitle(promptText);

  let payload: AIChatParams;
  try {
    payload = {
      conversation_id: activeConversationId.value,
      edit_message_index: editingMessageIndex,
      extra_body: extraBody.value.trim() || undefined,
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
      model_id: selectedModelId.value,
      parallel_tool_calls: parallelToolCalls.value,
      presence_penalty: presencePenalty.value,
      provider_id: selectedProviderId.value,
      regenerate_message_index: regenerateMessageIndex,
      seed: seed.value,
      stop_sequences: parseJsonField<string[]>(
        stopSequences.value,
        '停止序列',
        (value) =>
          Array.isArray(value) &&
          value.every((entry) => typeof entry === 'string'),
      ),
      temperature: temperature.value,
      timeout: timeout.value,
      top_p: topP.value,
      user_prompt:
        regenerateMessageIndex === undefined ? promptText || null : null,
    };
  } catch (error) {
    message.error((error as Error).message);
    return;
  }

  if (editingMessageIndex !== undefined) {
    activeMessages.value = activeMessages.value.filter(
      (item) => item.message_index < editingMessageIndex,
    );
  } else if (regenerateMessageIndex !== undefined) {
    activeMessages.value = activeMessages.value.filter(
      (item) => item.message_index < regenerateMessageIndex,
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
  if (regenerateMessageIndex === undefined) {
    prompt.value = '';
  }

  let chunkBuffer = '';
  let streamedConversationId = activeConversationId.value;

  try {
    await streamAIChatApi(payload, {
      signal: abortController.signal,
      onMessage: (chunk) => {
        if (streamId !== currentStreamId) {
          return;
        }

        chunkBuffer += chunk;
        chunkBuffer = consumeBufferedLines(chunkBuffer, (data) => {
          if (data.conversation_id) {
            streamedConversationId = data.conversation_id;
          }
          applyStreamMessage(data);
        });
      },
    });

    if (chunkBuffer.trim()) {
      chunkBuffer = consumeBufferedLines(`${chunkBuffer}\n`, (data) => {
        if (data.conversation_id) {
          streamedConversationId = data.conversation_id;
        }
        applyStreamMessage(data);
      });
    }

    finalizeStreamingMessages();
    await fetchConversations(false);

    if (streamedConversationId) {
      activeConversationId.value = streamedConversationId;
      await loadConversationDetail(streamedConversationId);
    } else if (sortedConversations.value[0]) {
      activeConversationId.value = sortedConversations.value[0].conversation_id;
      await loadConversationDetail(
        sortedConversations.value[0].conversation_id,
      );
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      streamError.value = (error as Error).message;
      message.error(streamError.value);

      if (
        regenerateMessageIndex === undefined &&
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

const sortedConversations = computed(() => {
  return [...conversations.value].toSorted(compareConversations);
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
    `${activeConversation.value.message_count} 条消息`,
    `最后活跃 ${parseDateLabel(activeConversation.value.last_activity_time)}`,
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

const providerModelLabel = computed(() => {
  if (!selectedProviderId.value && !selectedModelId.value) {
    return '请选择供应商和模型';
  }
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
    stopSequences.value.trim() ||
    extraHeaders.value.trim() ||
    extraBody.value.trim() ||
    logitBias.value.trim(),
  );
});

const canClearMessages = computed(() => {
  return Boolean(activeConversationId.value && activeMessages.value.length > 0);
});

const composerHint = computed(() => {
  if (editingMessage.value?.message_index !== undefined) {
    return `正在编辑第 ${editingMessage.value.message_index + 1} 条${editingMessage.value.role === 'user' ? '用户' : 'AI'}消息`;
  }
  if (regeneratingMessageIndex.value !== undefined) {
    return `正在重新生成第 ${regeneratingMessageIndex.value + 1} 条 AI 回复`;
  }
  if (activeConversationId.value) {
    return '继续当前话题';
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

const [SettingsModal, settingsModalApi] = useVbenModal({
  class: 'w-5/12',
  footer: false,
  title: '参数设置',
});

onMounted(async () => {
  composerHeight.value = COMPOSER_DEFAULT_HEIGHT;
  nextTick(() => {
    setupComposerLayoutObserver();
  });

  await fetchConversations(false);

  if (sortedConversations.value[0]) {
    activeConversationId.value = sortedConversations.value[0].conversation_id;
    await loadConversationDetail(sortedConversations.value[0].conversation_id);
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
            sortedConversations.length === 0
              ? 'flex items-center justify-center'
              : 'space-y-3'
          "
        >
          <a-spin
            v-if="sidebarLoading && sortedConversations.length === 0"
            class="block py-10"
          />
          <a-empty
            v-else-if="sortedConversations.length === 0"
            description="暂无聊天历史"
            :image="null"
          />
          <template v-else>
            <div
              v-for="conversation in sortedConversations"
              :key="conversation.conversation_id"
              class="rounded-xl border transition-colors"
              :class="
                conversation.conversation_id === activeConversationId
                  ? 'border-primary/30 bg-primary/8'
                  : 'border-transparent bg-background hover:border-border'
              "
            >
              <div class="p-3">
                <div class="flex items-start gap-2">
                  <button
                    class="min-w-0 flex-1 text-left"
                    type="button"
                    @click="selectConversation(conversation.conversation_id)"
                  >
                    <div class="flex items-center gap-2">
                      <div class="truncate text-sm font-medium text-foreground">
                        {{ conversation.title }}
                      </div>
                      <span
                        v-if="conversation.is_pinned"
                        class="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                      >
                        置顶
                      </span>
                    </div>
                    <div
                      class="mt-2 line-clamp-2 text-xs text-muted-foreground"
                    >
                      {{ conversation.last_message || '暂无消息内容' }}
                    </div>
                    <div
                      class="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground"
                    >
                      <span>{{ conversation.message_count }} 条消息</span>
                      <span>{{
                        parseDateLabel(conversation.last_activity_time)
                      }}</span>
                    </div>
                  </button>
                  <a-popconfirm
                    title="删除该聊天历史？"
                    :description="conversation.title"
                    @confirm="removeConversation(conversation.conversation_id)"
                  >
                    <button
                      class="mt-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      type="button"
                    >
                      删除
                    </button>
                  </a-popconfirm>
                </div>
              </div>
            </div>
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
                <div class="flex items-center gap-2">
                  <div class="truncate text-sm font-semibold text-foreground">
                    {{ activeConversationTitle }}
                  </div>
                  <span
                    v-if="activeConversation?.is_pinned"
                    class="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    置顶
                  </span>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">
                  {{ activeConversationSubtitle }}
                </div>
              </template>
            </div>

            <div class="ml-auto flex items-center gap-2">
              <VbenButton
                v-if="activeConversationId && !isRenamingConversation"
                size="sm"
                variant="outline"
                @click="startRenameConversation"
              >
                重命名
              </VbenButton>
              <VbenButton
                v-if="activeConversationId && !isRenamingConversation"
                size="sm"
                variant="outline"
                @click="togglePinConversation"
              >
                {{ activeConversation?.is_pinned ? '取消置顶' : '置顶' }}
              </VbenButton>
              <a-popconfirm
                v-if="activeConversationId"
                title="删除当前聊天历史？"
                :description="activeConversationTitle"
                @confirm="removeConversation(activeConversationId)"
              >
                <VbenButton danger size="sm" variant="outline">删除</VbenButton>
              </a-popconfirm>
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
            v-else-if="activeMessages.length === 0"
            class="flex min-h-full items-center justify-center"
          >
            <a-empty description="选择模型后开始对话，历史会自动保存" />
          </div>
          <template v-else>
            <div
              v-for="item in activeMessages"
              :key="item.id"
              class="ai-message mb-3.5 flex"
              :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="flex max-w-[92%] flex-col animate-[ai-message-enter_0.24s_ease-out] md:max-w-[84%]"
                :class="item.role === 'user' ? 'items-end' : 'items-start'"
              >
                <div
                  class="mb-1.5 inline-flex items-center gap-2 px-1"
                  :class="
                    item.role === 'user' ? 'justify-end' : 'justify-start'
                  "
                >
                  <span
                    class="inline-flex h-[22px] min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-[0.02em]"
                    :class="
                      item.role === 'user'
                        ? 'border border-primary/20 bg-primary/12 text-primary'
                        : 'border border-border bg-background text-muted-foreground'
                    "
                  >
                    {{ item.role === 'user' ? '你' : 'AI' }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {{ parseDateLabel(item.timestamp) }}
                  </span>
                </div>

                <div
                  class="relative overflow-hidden border px-4 py-2.5 text-sm leading-[1.65] text-foreground shadow-[0_10px_24px_-18px_rgb(15_23_42/0.42),0_1px_2px_0_rgb(15_23_42/0.06)] transition-all duration-200 hover:shadow-[0_18px_36px_-24px_rgb(15_23_42/0.38),0_4px_10px_0_rgb(15_23_42/0.06)]"
                  :class="
                    item.is_error
                      ? 'rounded-[12px] border-destructive/25 bg-[linear-gradient(180deg,hsl(var(--destructive)/0.1),hsl(var(--destructive)/0.04))]'
                      : item.role === 'user'
                      ? 'rounded-[12px] border-primary/20 bg-[linear-gradient(180deg,hsl(var(--primary)/0.14),hsl(var(--primary)/0.08))]'
                      : 'rounded-[12px] border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.35),transparent_34%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))]'
                  "
                >
                  <textarea
                    v-if="isEditingMessage(item)"
                    v-model="editingMessageDraft"
                    :disabled="sending"
                    class="block min-h-[88px] w-[min(520px,70vw)] resize-none overflow-y-auto border-0 bg-transparent p-0 leading-[1.7] text-inherit outline-none placeholder:text-muted-foreground/70"
                    placeholder="请输入消息内容"
                    rows="3"
                    spellcheck="false"
                  ></textarea>
                  <div v-else-if="item.role === 'user'" class="whitespace-pre-wrap">
                    {{ item.content }}
                  </div>
                  <div v-else class="ai-markdown">
                    <MarkdownRender
                      custom-id="ai-chat"
                      :content="item.content"
                      :max-live-nodes="0"
                    />
                  </div>
                </div>

                <div
                  v-if="item.is_error && item.error_message"
                  class="mt-1 px-1 text-xs text-destructive/85"
                >
                  {{ item.error_message }}
                </div>

                <div
                  v-if="item.streaming"
                  class="mt-1.5 inline-flex items-center gap-2 px-1 text-xs text-muted-foreground"
                >
                  <span
                    class="size-2 rounded-full bg-primary animate-[ai-status-pulse_1.4s_ease-out_infinite]"
                  ></span>
                  正在生成...
                </div>

                <div
                  v-if="
                    !item.streaming &&
                    activeConversationId &&
                    item.message_index !== undefined
                  "
                  class="ai-message__actions mt-1 flex min-h-[28px] items-center gap-1 px-1"
                  :class="
                    item.role === 'user' ? 'justify-end' : 'justify-start'
                  "
                >
                  <template v-if="isEditingMessage(item)">
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
                      v-if="item.role === 'user'"
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
                    v-if="item.role === 'user' && !isEditingMessage(item)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    :disabled="sending"
                    title="重新生成"
                    type="button"
                    @click="regenerateUserMessage(item)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:refresh" />
                  </button>
                  <button
                    v-if="item.role === 'user' && !isEditingMessage(item)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="编辑重发"
                    type="button"
                    @click="beginEditMessage(item)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:pencil-outline" />
                  </button>
                  <button
                    v-if="item.role === 'user' && !isEditingMessage(item)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="复制"
                    type="button"
                    @click="copyMessageContent(item)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:content-copy" />
                  </button>
                  <button
                    v-if="item.role === 'model' && !isEditingMessage(item)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="复制"
                    type="button"
                    @click="copyMessageContent(item)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:content-copy" />
                  </button>
                  <button
                    v-if="item.role === 'model' && !isEditingMessage(item)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="编辑"
                    type="button"
                    @click="beginEditMessage(item)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:pencil-outline" />
                  </button>
                  <button
                    v-if="item.role === 'model' && !isEditingMessage(item)"
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/75 hover:text-foreground"
                    title="重新生成"
                    type="button"
                    @click="regenerateMessage(item)"
                  >
                    <IconifyIcon class="size-3.5" icon="mdi:refresh" />
                  </button>
                  <a-popconfirm
                    v-if="!isEditingMessage(item)"
                    title="删除该消息及其后续历史？"
                    :description="`第 ${item.message_index + 1} 条消息`"
                    @confirm="deleteMessageChain(item)"
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
                    :disabled="sending"
                    title="新建话题"
                    type="button"
                    @click="createNewConversation"
                  >
                    <IconifyIcon
                      class="size-4"
                      icon="mdi:message-plus-outline"
                    />
                  </button>

                  <a-popover
                    placement="topLeft"
                    trigger="click"
                    @open-change="handleProviderModelPopoverOpenChange"
                  >
                    <template #content>
                      <div class="w-[280px] space-y-3">
                        <div>
                          <div class="mb-2 text-xs font-medium text-foreground">
                            供应商
                          </div>
                          <a-select
                            v-model:value="selectedProviderId"
                            class="w-full"
                            :disabled="
                              sending ||
                              resourcesLoading ||
                              !!activeConversationId
                            "
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
                              !!activeConversationId ||
                              modelOptions.length === 0
                            "
                            :options="modelOptions"
                            placeholder="请选择模型"
                          />
                        </div>
                      </div>
                    </template>
                    <button
                      class="ai-composer__tool"
                      :class="{
                        'ai-composer__tool--active':
                          !!selectedProviderId || !!selectedModelId,
                      }"
                      :disabled="sending || resourcesLoading"
                      :title="providerModelLabel"
                      type="button"
                    >
                      <IconifyIcon class="size-4" icon="carbon:model-alt" />
                    </button>
                  </a-popover>

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

                  <button
                    class="ai-composer__tool"
                    disabled
                    title="深度思考（暂未开放）"
                    type="button"
                  >
                    <IconifyIcon
                      class="size-4"
                      icon="mdi:head-lightbulb-outline"
                    />
                  </button>

                  <button
                    class="ai-composer__tool"
                    disabled
                    title="网络搜索（暂未开放）"
                    type="button"
                  >
                    <IconifyIcon class="size-4" icon="mdi:web" />
                  </button>

                  <button
                    class="ai-composer__tool"
                    disabled
                    title="MCP（暂未开放）"
                    type="button"
                  >
                    <IconifyIcon
                      class="size-4"
                      icon="simple-icons:modelcontextprotocol"
                    />
                  </button>

                  <a-popover
                    :align="{ overflow: { adjustX: false, adjustY: true } }"
                    :open="quickPhrasePopoverOpen"
                    placement="topLeft"
                    trigger="click"
                    @open-change="handleQuickPhrasePopoverOpenChange"
                  >
                    <template #content>
                      <div class="w-[320px]">
                        <div
                          class="mb-2 flex items-center justify-between gap-3"
                        >
                          <div class="text-xs font-medium text-foreground">
                            快捷短语
                          </div>
                          <RouterLink
                            class="text-xs text-muted-foreground transition-colors hover:text-foreground"
                            to="/plugins/ai/quick-phrase"
                          >
                            管理
                          </RouterLink>
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
                  <span class="ai-composer__hint">{{ composerHint }}</span>
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

        <section class="ai-settings-section">
          <div class="ai-settings-section__title">基础参数</div>
          <div class="ai-settings-grid">
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Temperature</span>
                <span class="ai-setting-field__hint">0 - 2</span>
              </div>
              <a-input-number
                v-model:value="temperature"
                class="w-full"
                :max="2"
                :min="0"
                :step="0.1"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Max Tokens</span>
                <span class="ai-setting-field__hint">可选</span>
              </div>
              <a-input-number
                v-model:value="maxTokens"
                class="w-full"
                :min="1"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Top P</span>
                <span class="ai-setting-field__hint">0 - 1</span>
              </div>
              <a-input-number
                v-model:value="topP"
                class="w-full"
                :max="1"
                :min="0"
                :step="0.1"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Timeout</span>
                <span class="ai-setting-field__hint">秒</span>
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

        <section class="ai-settings-section">
          <div class="ai-settings-section__title">高级参数</div>
          <div class="ai-settings-grid">
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Seed</span>
                <span class="ai-setting-field__hint">可选</span>
              </div>
              <a-input-number v-model:value="seed" class="w-full" />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Presence Penalty</span>
                <span class="ai-setting-field__hint">-2 - 2</span>
              </div>
              <a-input-number
                v-model:value="presencePenalty"
                class="w-full"
                :max="2"
                :min="-2"
                :step="0.1"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Frequency Penalty</span>
                <span class="ai-setting-field__hint">-2 - 2</span>
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
              <div class="ai-setting-switch">
                <div class="min-w-0">
                  <div class="ai-setting-field__label">并行工具调用</div>
                  <div class="ai-setting-switch__desc">
                    允许模型同时发起多个工具调用
                  </div>
                </div>
                <a-switch v-model:checked="parallelToolCalls" size="small" />
              </div>
            </div>
          </div>
        </section>

        <section class="ai-settings-section">
          <div class="ai-settings-section__title">扩展参数</div>
          <div class="ai-settings-stack">
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">停止序列</span>
                <span class="ai-setting-field__hint">JSON 数组</span>
              </div>
              <a-textarea
                v-model:value="stopSequences"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                :placeholder="STOP_SEQUENCES_PLACEHOLDER"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Extra Headers</span>
                <span class="ai-setting-field__hint">JSON 对象</span>
              </div>
              <a-textarea
                v-model:value="extraHeaders"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                :placeholder="EXTRA_HEADERS_PLACEHOLDER"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Extra Body</span>
                <span class="ai-setting-field__hint">JSON</span>
              </div>
              <a-textarea
                v-model:value="extraBody"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :placeholder="EXTRA_BODY_PLACEHOLDER"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Logit Bias</span>
                <span class="ai-setting-field__hint">JSON 对象</span>
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
.ai-settings-section {
  padding: 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
}

.ai-settings-section__title {
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.ai-settings-grid {
  display: grid;
  gap: 12px;
}

.ai-settings-stack {
  display: grid;
  gap: 12px;
}

.ai-setting-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-setting-field__head {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.ai-setting-field__label {
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.ai-setting-field__hint {
  flex-shrink: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.ai-setting-switch {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
}

.ai-setting-switch__desc {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

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

@media (min-width: 768px) {
  .ai-settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
