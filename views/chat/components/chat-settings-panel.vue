<script setup lang="ts">
import { IconifyIcon } from '@vben/icons';

const temperature = defineModel<number | undefined>('temperature');
const topP = defineModel<number | undefined>('topP');
const maxTokens = defineModel<number | undefined>('maxTokens');
const timeout = defineModel<number | undefined>('timeout');
const seed = defineModel<number | undefined>('seed');
const presencePenalty = defineModel<number | undefined>('presencePenalty');
const frequencyPenalty = defineModel<number | undefined>('frequencyPenalty');
const enableBuiltinTools = defineModel<boolean>('enableBuiltinTools', { required: true });
const parallelToolCalls = defineModel<boolean>('parallelToolCalls', { required: true });
const stopSequences = defineModel<string>('stopSequences', { required: true });
const extraHeaders = defineModel<string>('extraHeaders', { required: true });
const extraBody = defineModel<string>('extraBody', { required: true });
const logitBias = defineModel<string>('logitBias', { required: true });

const settingsFieldClass = 'space-y-2 px-1 py-1';
const settingsSectionClass =
  'space-y-4 rounded-2xl border border-border/70 bg-muted/10 px-4 py-4 md:px-5';
const settingsSectionTitleClass =
  'px-1 text-xs font-medium tracking-[0.08em] text-muted-foreground';
const settingsSwitchRowClass = 'flex items-center justify-between gap-4 px-1 py-2';
const stopSequencesPlaceholder = '["</thinking>"]';
const extraHeadersPlaceholder = '{"x-trace-id":"chat-demo"}';
const extraBodyPlaceholder = '{"metadata":{"scene":"chat"}}';
const logitBiasPlaceholder = '{"198":-100}';

interface NumberFieldConfig {
  key: string;
  label: string;
  model: ReturnType<typeof defineModel<number | undefined>>;
  tip: string;
  max?: number;
  min?: number;
  step?: number;
  wide?: boolean;
}

interface SwitchFieldConfig {
  key: string;
  label: string;
  model: ReturnType<typeof defineModel<boolean>>;
  tip: string;
}

interface TextareaFieldConfig {
  key: string;
  label: string;
  model: ReturnType<typeof defineModel<string>>;
  tip: string;
  placeholder: string;
  minRows: number;
  maxRows: number;
}

const generationFields: NumberFieldConfig[] = [
  { key: 'temperature', label: 'Temperature', model: temperature, tip: '控制回答的发散程度，越低越稳定，越高越灵活，取值范围 0 到 2', min: 0, max: 2, step: 0.1 },
  { key: 'top-p', label: 'Top P', model: topP, tip: '控制候选词范围，通常与 Temperature 二选一微调即可，取值范围 0 到 1', min: 0, max: 1, step: 0.1 },
  { key: 'max-tokens', label: 'Max Tokens', model: maxTokens, tip: '限制单次回答长度，可选；不填时由模型自行决定', min: 1 },
  { key: 'timeout', label: 'Timeout', model: timeout, tip: '超过这个时间还没返回结果时，请求会被视为超时，单位为秒', min: 0, step: 1 },
];

const behaviorFields: NumberFieldConfig[] = [
  { key: 'seed', label: 'Seed', model: seed, tip: '固定随机种子后，更容易复现相似结果；该项可选' },
  { key: 'presence-penalty', label: 'Presence Penalty', model: presencePenalty, tip: '提高后更鼓励模型引入新内容，减少重复话题，取值范围 -2 到 2', min: -2, max: 2, step: 0.1 },
  { key: 'frequency-penalty', label: 'Frequency Penalty', model: frequencyPenalty, tip: '提高后更少重复相同措辞，适合压制啰嗦输出，取值范围 -2 到 2', min: -2, max: 2, step: 0.1, wide: true },
];

const toolFields: SwitchFieldConfig[] = [
  { key: 'enable-builtin-tools', label: '启用内置工具', model: enableBuiltinTools, tip: '允许模型调用系统内置工具' },
  { key: 'parallel-tool-calls', label: '并行工具调用', model: parallelToolCalls, tip: '允许模型同时发起多个工具调用' },
];

const passthroughFields: TextareaFieldConfig[] = [
  { key: 'stop-sequences', label: '停止序列', model: stopSequences, tip: '当生成到这些内容时立即停止，适合截断特定格式，这里填写的是 JSON 数组', placeholder: stopSequencesPlaceholder, minRows: 2, maxRows: 4 },
  { key: 'extra-headers', label: 'Extra Headers', model: extraHeaders, tip: '额外附加到模型请求中的请求头，通常用于特殊网关，这里填写的是 JSON 对象', placeholder: extraHeadersPlaceholder, minRows: 2, maxRows: 4 },
  { key: 'extra-body', label: 'Extra Body', model: extraBody, tip: '透传额外请求体字段，适合补充模型专属参数，这里填写的是 JSON 内容', placeholder: extraBodyPlaceholder, minRows: 2, maxRows: 5 },
  { key: 'logit-bias', label: 'Logit Bias', model: logitBias, tip: '用来提高或压低特定 token 的出现概率，适合高级控制，这里填写的是 JSON 对象', placeholder: logitBiasPlaceholder, minRows: 2, maxRows: 4 },
];
</script>

<template>
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

    <div class="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 md:p-5 [overscroll-behavior:contain]">
      <div class="space-y-6">
        <div class="space-y-3">
          <div :class="settingsSectionTitleClass">生成控制：</div>
          <section :class="settingsSectionClass">
            <div class="grid gap-4 md:grid-cols-2">
              <div v-for="field in generationFields" :key="field.key" :class="settingsFieldClass">
                <div class="flex items-center justify-between gap-3">
                  <span class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                    <span class="font-medium">{{ field.label }}</span>
                    <a-tooltip placement="right" :title="field.tip"><IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" /></a-tooltip>
                  </span>
                </div>
                <a-input-number :value="field.model.value" class="w-full" :max="field.max" :min="field.min" :step="field.step" @update:value="field.model.value = $event" />
              </div>
            </div>
          </section>
        </div>

        <div class="space-y-3">
          <div :class="settingsSectionTitleClass">行为控制：</div>
          <section :class="settingsSectionClass">
            <div class="grid gap-4 md:grid-cols-2">
              <div v-for="field in behaviorFields" :key="field.key" :class="[settingsFieldClass, field.wide ? 'md:col-span-2' : '']">
                <div class="flex items-center justify-between gap-3">
                  <span class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                    <span class="font-medium">{{ field.label }}</span>
                    <a-tooltip placement="right" :title="field.tip"><IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" /></a-tooltip>
                  </span>
                </div>
                <a-input-number :value="field.model.value" class="w-full" :max="field.max" :min="field.min" :step="field.step" @update:value="field.model.value = $event" />
              </div>
            </div>
          </section>
        </div>

        <div class="space-y-3">
          <div :class="settingsSectionTitleClass">工具能力：</div>
          <section :class="settingsSectionClass">
            <div class="grid gap-4">
              <div v-for="field in toolFields" :key="field.key" :class="settingsSwitchRowClass">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">{{ field.label }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ field.tip }}</div>
                </div>
                <a-switch :checked="field.model.value" size="small" @update:checked="field.model.value = Boolean($event)" />
              </div>
            </div>
          </section>
        </div>

        <div class="space-y-3">
          <div :class="settingsSectionTitleClass">请求透传：</div>
          <section :class="settingsSectionClass">
            <div class="grid gap-4">
              <div v-for="field in passthroughFields" :key="field.key" :class="settingsFieldClass">
                <div class="flex items-center justify-between gap-3">
                  <span class="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
                    <span class="font-medium">{{ field.label }}</span>
                    <a-tooltip placement="right" :title="field.tip"><IconifyIcon class="text-muted-foreground" icon="mdi:help-circle-outline" /></a-tooltip>
                  </span>
                </div>
                <a-textarea :value="String(field.model.value ?? '')" :auto-size="{ minRows: field.minRows, maxRows: field.maxRows }" :placeholder="field.placeholder" @update:value="field.model.value = String($event ?? '')" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
