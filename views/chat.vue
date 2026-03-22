<script setup lang="ts">
import type {
  AIChatMessage,
  AIChatParams,
  AIModelResult,
  AIProviderResult,
} from '#/plugins/ai/api';

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Page, useVbenModal, VbenButton } from '@vben/common-ui';
import { MaterialSymbolsAdd, Settings } from '@vben/icons';

import { message } from 'antdv-next';
import MarkdownRender from 'markstream-vue';

import {
  getAllAIModelApi,
  getAllAIProviderApi,
  streamAIChatApi,
} from '#/plugins/ai/api';

import 'markstream-vue/index.css';

type ChatMessageItem = AIChatMessage & {
  id: string;
  streaming?: boolean;
};

type ChatThread = {
  createdAt: string;
  id: string;
  messages: ChatMessageItem[];
  title: string;
  updatedAt: string;
};

const loading = ref(false);
const prompt = ref('');
const streamError = ref('');
const activeProviderId = ref<number>();
const activeModelId = ref<string>();

const providers = ref<AIProviderResult[]>([]);
const models = ref<AIModelResult[]>([]);
const messageContainerRef = ref<HTMLElement>();

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

let currentStreamId = 0;
let currentModelFetchId = 0;
let abortController: AbortController | undefined;

function buildMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildThreadId() {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createThread(title = '新建话题'): ChatThread {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    id: buildThreadId(),
    messages: [],
    title,
    updatedAt: now,
  };
}

const threads = ref<ChatThread[]>([createThread('默认话题')]);
const activeThreadId = ref(threads.value[0]!.id);

const activeThread = computed(() => {
  return threads.value.find((item) => item.id === activeThreadId.value)!;
});

const activeMessages = computed(() => {
  return activeThread.value.messages;
});

const sortedThreads = computed(() => {
  return [...threads.value].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
});

const enabledProviders = computed(() => {
  return providers.value.filter((item) => item.status === 1);
});

const enabledModels = computed(() => {
  return models.value.filter(
    (item) =>
      item.status === 1 &&
      (!activeProviderId.value || item.provider_id === activeProviderId.value),
  );
});

const providerOptions = computed(() => {
  return enabledProviders.value.map((item) => ({
    label: item.name,
    value: item.id,
  }));
});

const modelOptions = computed(() => {
  return enabledModels.value.map((item) => ({
    label: item.model_id,
    value: item.model_id,
  }));
});

const canSend = computed(() => {
  return Boolean(
    !loading.value &&
    activeProviderId.value &&
    activeModelId.value &&
    prompt.value.trim(),
  );
});

const initialLoading = computed(() => {
  return loading.value && providers.value.length === 0 && models.value.length === 0;
});

function getThreadById(threadId: string) {
  return threads.value.find((item) => item.id === threadId);
}

function touchThread(thread: ChatThread) {
  thread.updatedAt = new Date().toISOString();
}

function makeThreadTitle(text: string) {
  return text.replaceAll(/\s+/gu, ' ').trim().slice(0, 24) || '新建话题';
}

function isPlaceholderTitle(title: string) {
  return title === '默认话题' || title === '新建话题';
}

function formatThreadTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
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

function parseJsonField<T>(
  raw: string,
  label: string,
  validator?: (value: T) => boolean,
) {
  const text = raw.trim();
  if (!text) {
    return undefined;
  }

  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} 必须是合法 JSON`);
  }

  if (validator && !validator(parsed)) {
    throw new Error(`${label} 格式不正确`);
  }

  return parsed;
}

function mergeModelContent(previous: string, incoming: string) {
  if (!previous) {
    return incoming;
  }
  if (incoming.startsWith(previous)) {
    return incoming;
  }
  return `${previous}${incoming}`;
}

function finalizeStreamingMessage(threadId: string) {
  const thread = getThreadById(threadId);
  const lastMessage = thread?.messages.at(-1);
  if (lastMessage?.role === 'model') {
    lastMessage.streaming = false;
  }
}

function consumeBufferedLines(buffer: string, threadId: string) {
  const thread = getThreadById(threadId);
  if (!thread) {
    return '';
  }

  const lines = buffer.split('\n');
  const rest = lines.pop() || '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const data = JSON.parse(line) as AIChatMessage;

    if (data.role === 'user') {
      thread.messages.push({
        ...data,
        id: buildMessageId(),
      });
    } else {
      const lastMessage = thread.messages.at(-1);
      if (lastMessage?.role === 'model') {
        lastMessage.content = mergeModelContent(lastMessage.content, data.content);
        lastMessage.timestamp = data.timestamp;
        lastMessage.streaming = true;
      } else {
        thread.messages.push({
          ...data,
          id: buildMessageId(),
          streaming: true,
        });
      }
    }

    touchThread(thread);
    scrollToBottom();
  }

  return rest;
}

async function fetchChatResources() {
  loading.value = true;
  try {
    providers.value = await getAllAIProviderApi();

    if (
      activeProviderId.value &&
      !enabledProviders.value.some((item) => item.id === activeProviderId.value)
    ) {
      activeProviderId.value = undefined;
    }
  } finally {
    loading.value = false;
  }
}

async function fetchModelsByProvider(providerId?: number) {
  const fetchId = ++currentModelFetchId;

  if (!providerId) {
    models.value = [];
    activeModelId.value = undefined;
    return;
  }

  loading.value = true;
  try {
    const data = await getAllAIModelApi({ provider_id: providerId });

    if (fetchId !== currentModelFetchId) {
      return;
    }

    models.value = data;

    if (!enabledModels.value.some((item) => item.model_id === activeModelId.value)) {
      activeModelId.value = undefined;
    }
  } finally {
    if (fetchId === currentModelFetchId) {
      loading.value = false;
    }
  }
}

function stopStreaming() {
  abortController?.abort();
  abortController = undefined;
  loading.value = false;
}

function createNewThread() {
  stopStreaming();
  const thread = createThread();
  threads.value.unshift(thread);
  activeThreadId.value = thread.id;
  prompt.value = '';
  streamError.value = '';
  nextTick(() => {
    messageContainerRef.value?.scrollTo({ top: 0 });
  });
}

function selectThread(threadId: string) {
  if (threadId === activeThreadId.value) {
    return;
  }

  stopStreaming();
  activeThreadId.value = threadId;
  streamError.value = '';
  scrollToBottom();
}

function removeThread(threadId: string) {
  stopStreaming();

  if (threads.value.length === 1) {
    threads.value = [createThread('默认话题')];
    activeThreadId.value = threads.value[0]!.id;
    prompt.value = '';
    streamError.value = '';
    return;
  }

  const nextThreads = threads.value.filter((item) => item.id !== threadId);
  if (activeThreadId.value === threadId) {
    activeThreadId.value = nextThreads[0]!.id;
  }
  threads.value = nextThreads;
}

async function submitChat() {
  if (!canSend.value || !activeProviderId.value || !activeModelId.value) {
    return;
  }

  const thread = activeThread.value;
  const threadId = thread.id;
  const promptText = prompt.value.trim();

  if (thread.messages.length === 0 && isPlaceholderTitle(thread.title)) {
    thread.title = makeThreadTitle(promptText);
  }
  touchThread(thread);

  let payload: AIChatParams;
  try {
    payload = {
      provider_id: activeProviderId.value,
      model_id: activeModelId.value,
      user_prompt: promptText,
      max_tokens: maxTokens.value,
      temperature: temperature.value,
      top_p: topP.value,
      timeout: timeout.value,
      parallel_tool_calls: parallelToolCalls.value,
      seed: seed.value,
      presence_penalty: presencePenalty.value,
      frequency_penalty: frequencyPenalty.value,
      stop_sequences: parseJsonField<string[]>(
        stopSequences.value,
        '停止序列',
        (value) =>
          Array.isArray(value) && value.every((item) => typeof item === 'string'),
      ),
      extra_headers: parseJsonField<Record<string, string>>(
        extraHeaders.value,
        '额外请求头',
        (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      ),
      extra_body: parseJsonField<Record<string, any>>(
        extraBody.value,
        '额外请求体',
        (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      ),
      logit_bias: parseJsonField<Record<string, number>>(
        logitBias.value,
        'Logit Bias',
        (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      ),
    };
  } catch (error) {
    message.error((error as Error).message);
    return;
  }

  const streamId = ++currentStreamId;
  abortController?.abort();
  abortController = new AbortController();
  loading.value = true;
  streamError.value = '';
  prompt.value = '';

  const chunkBuffer = ref('');

  try {
    await streamAIChatApi(payload, {
      signal: abortController.signal,
      onMessage: (chunk) => {
        if (streamId !== currentStreamId) {
          return;
        }

        chunkBuffer.value += chunk;
        chunkBuffer.value = consumeBufferedLines(chunkBuffer.value, threadId);
      },
    });

    if (chunkBuffer.value.trim()) {
      chunkBuffer.value = consumeBufferedLines(`${chunkBuffer.value}\n`, threadId);
    }
    finalizeStreamingMessage(threadId);
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      streamError.value = (error as Error).message;
      message.error(streamError.value);
    }
    finalizeStreamingMessage(threadId);
  } finally {
    if (streamId === currentStreamId) {
      loading.value = false;
      abortController = undefined;
    }
  }
}

function handlePromptKeydown(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitChat();
  }
}

function clearMessages() {
  stopStreaming();
  activeThread.value.messages = [];
  touchThread(activeThread.value);
  streamError.value = '';
}

watch(
  activeProviderId,
  async (providerId) => {
    await fetchModelsByProvider(providerId);
  },
  { immediate: true },
);

watch(
  activeThreadId,
  () => {
    scrollToBottom();
  },
  { immediate: true },
);

const [SettingsModal, settingsModalApi] = useVbenModal({
  class: 'w-5/12',
  footer: false,
  title: '参数设置',
});

onMounted(async () => {
  await fetchChatResources();
});

onBeforeUnmount(() => {
  abortController?.abort();
});
</script>

<template>
  <Page auto-content-height content-class="h-full">
    <div class="grid h-full gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside
        class="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        <div class="flex items-center justify-between border-b border-border px-4 py-4">
          <div>
            <div class="text-sm font-semibold text-foreground">话题</div>
            <div class="mt-1 text-xs text-muted-foreground">
              保留当前会话上下文
            </div>
          </div>
          <VbenButton @click="createNewThread">
            <MaterialSymbolsAdd class="size-5" />
            新建
          </VbenButton>
        </div>

        <div class="flex-1 space-y-3 overflow-y-auto p-3">
          <a-empty
            v-if="sortedThreads.length === 0"
            description="暂无话题"
            :image="null"
          />
          <div
            v-for="thread in sortedThreads"
            :key="thread.id"
            class="rounded-xl border transition-colors"
            :class="
              thread.id === activeThreadId
                ? 'border-primary/30 bg-primary/8'
                : 'border-transparent bg-background hover:border-border'
            "
          >
            <div class="flex items-start gap-2 p-3">
              <button
                class="min-w-0 flex-1 text-left"
                type="button"
                @click="selectThread(thread.id)"
              >
                <div class="truncate text-sm font-medium text-foreground">
                  {{ thread.title }}
                </div>
                <div class="mt-1 text-xs text-muted-foreground">
                  {{ formatThreadTime(thread.updatedAt) }}
                </div>
              </button>
              <button
                class="mt-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                type="button"
                @click="removeThread(thread.id)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </aside>

      <section
        class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
      >
        <div class="border-b border-border px-5 py-4 md:px-6">
          <div class="flex flex-wrap items-center gap-2.5">
            <div class="truncate text-sm font-semibold text-foreground">
              {{ activeThread.title }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ activeMessages.length }} 条消息
            </div>
            <div class="ml-auto flex items-center gap-2">
              <VbenButton
                size="sm"
                variant="outline"
                :disabled="activeMessages.length === 0"
                @click="clearMessages"
              >
                清空
              </VbenButton>
              <VbenButton
                v-if="loading"
                danger
                size="xs"
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
          <a-spin v-if="initialLoading" class="block py-20" />
          <div
            v-else-if="activeMessages.length === 0"
            class="flex min-h-full items-center justify-center"
          >
            <a-empty description="选择供应商和模型后开始对话" />
          </div>
          <template v-else>
            <div
              v-for="item in activeMessages"
              :key="item.id"
              class="mb-5 flex"
              :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="flex max-w-[92%] flex-col animate-[ai-message-enter_0.24s_ease-out] md:max-w-[84%]"
                :class="item.role === 'user' ? 'items-end' : 'items-start'"
              >
                <div
                  class="mb-2 inline-flex items-center gap-2 px-1"
                  :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
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
                  <span class="text-xs text-muted-foreground">{{ item.timestamp }}</span>
                </div>
                <div
                  class="relative overflow-hidden border px-4 py-3 text-sm leading-7 text-foreground shadow-[0_10px_24px_-18px_rgb(15_23_42/0.42),0_1px_2px_0_rgb(15_23_42/0.06)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_18px_36px_-24px_rgb(15_23_42/0.38),0_4px_10px_0_rgb(15_23_42/0.06)]"
                  :class="
                    item.role === 'user'
                      ? 'rounded-[24px_24px_10px_24px] border-primary/20 bg-[linear-gradient(180deg,hsl(var(--primary)/0.14),hsl(var(--primary)/0.08))]'
                      : 'rounded-[24px_24px_24px_10px] border-border bg-[radial-gradient(circle_at_top_left,hsl(var(--accent)/0.35),transparent_34%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))]'
                  "
                >
                  <div v-if="item.role === 'user'" class="whitespace-pre-wrap">
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
                  v-if="item.streaming"
                  class="mt-2 inline-flex items-center gap-2 px-1 text-xs text-muted-foreground"
                >
                  <span
                    class="size-2 rounded-full bg-primary animate-[ai-status-pulse_1.4s_ease-out_infinite]"
                  ></span>
                  正在生成...
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="border-t border-border bg-card px-5 py-5 md:px-6 md:py-6">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <a-select
              v-model:value="activeProviderId"
              size="small"
              :style="{ width: '150px' }"
              :disabled="loading || providerOptions.length === 0"
              :options="providerOptions"
              placeholder="请选择供应商"
            />
            <a-select
              v-model:value="activeModelId"
              size="small"
              :style="{ width: '280px' }"
              :disabled="loading || modelOptions.length === 0"
              :options="modelOptions"
              placeholder="请选择模型"
            />
            <button
              class="inline-flex items-center justify-center p-0 text-muted-foreground transition-colors hover:text-foreground"
              title="参数设置"
              type="button"
              @click="settingsModalApi.open()"
            >
              <Settings class="size-4" />
            </button>
          </div>
          <a-textarea
            v-model:value="prompt"
            :auto-size="{ minRows: 4, maxRows: 10 }"
            placeholder="输入消息，Enter 发送，Shift + Enter 换行"
            @keydown="handlePromptKeydown"
          />
        </div>
      </section>
    </div>

    <SettingsModal content-class="px-4 py-4 md:px-5 md:py-5">
      <div class="space-y-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-foreground">当前话题参数</div>
            <div class="mt-1 text-xs text-muted-foreground">仅作用于当前会话，修改后立即生效</div>
          </div>
          <VbenButton size="sm" variant="outline" @click="resetAdvancedSettings">
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
                  <div class="ai-setting-switch__desc">允许模型同时发起多个工具调用</div>
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
                placeholder="[&quot;</thinking>&quot;]"
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
                placeholder="{&quot;x-trace-id&quot;:&quot;chat-demo&quot;}"
              />
            </div>
            <div class="ai-setting-field">
              <div class="ai-setting-field__head">
                <span class="ai-setting-field__label">Extra Body</span>
                <span class="ai-setting-field__hint">JSON 对象</span>
              </div>
              <a-textarea
                v-model:value="extraBody"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                placeholder="{&quot;reasoning&quot;:{&quot;effort&quot;:&quot;medium&quot;}}"
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
                placeholder="{&quot;198&quot;:-100}"
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
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
  background: hsl(var(--background));
  padding: 16px;
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  padding: 12px 14px;
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
  overflow-x: auto;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  padding: 12px 14px;
}

.ai-markdown :deep(blockquote) {
  margin: 10px 0 0;
  border-left: 3px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  padding-left: 12px;
}

.ai-markdown :deep(code):not(pre code) {
  border-radius: 6px;
  background: hsl(var(--background));
  padding: 2px 6px;
}

.ai-markdown :deep(ul),
.ai-markdown :deep(ol) {
  margin: 10px 0 0;
  padding-left: 20px;
}

.ai-markdown :deep(li + li) {
  margin-top: 4px;
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
    box-shadow: 0 0 0 0 hsl(var(--primary) / 0.28);
  }
  70% {
    box-shadow: 0 0 0 8px hsl(var(--primary) / 0);
  }
  100% {
    box-shadow: 0 0 0 0 hsl(var(--primary) / 0);
  }
}

@media (min-width: 768px) {
  .ai-settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
