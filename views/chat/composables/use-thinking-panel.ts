import type { ComputedRef, Ref } from 'vue';

import type { ChatMessageItem } from '#/plugins/ai/runtime/message';

import { ref, watch } from 'vue';

import { getMessageTextContent } from '#/plugins/ai/runtime/message';

type ThinkingPanelState = {
  autoOpened: boolean;
  expanded: boolean;
};

export interface UseThinkingPanelOptions {
  autoFollowMessageScroll: Ref<boolean>;
  displayMessages: ComputedRef<ChatMessageItem[]>;
  scrollToBottom: () => void;
}

export function useThinkingPanel(options: UseThinkingPanelOptions) {
  const { autoFollowMessageScroll, displayMessages, scrollToBottom } = options;

  const thinkingPanelStates = ref<Record<string, ThinkingPanelState>>({});

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

  watch(
    displayMessages,
    (messages) => {
      const nextStates: Record<string, ThinkingPanelState> = {};
      let hasChanges = false;

      for (const message of messages) {
        if (!hasThinkingContent(message)) {
          continue;
        }

        const key = getThinkingPanelKey(message);
        const previous = thinkingPanelStates.value[key];
        const hasTextStarted = Boolean(
          getMessageTextContent(message, 'text').trim(),
        );
        const shouldAutoExpand = Boolean(
          message.streaming && !hasTextStarted,
        );

        if (shouldAutoExpand) {
          if (!previous?.expanded || !previous?.autoOpened) {
            hasChanges = true;
          }
          nextStates[key] = {
            autoOpened: true,
            expanded: true,
          };
          continue;
        }

        if (previous?.autoOpened) {
          if (previous.expanded !== false) {
            hasChanges = true;
          }
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

      const previousKeys = Object.keys(thinkingPanelStates.value);
      const nextKeys = Object.keys(nextStates);
      if (hasChanges || previousKeys.length !== nextKeys.length) {
        thinkingPanelStates.value = nextStates;
      }

      if (messages.length > 0 && autoFollowMessageScroll.value) {
        scrollToBottom();
      }
    },
    { immediate: true },
  );

  return {
    getThinkingContent,
    hasThinkingContent,
    isThinkingExpanded,
    setThinkingExpanded,
    thinkingPanelStates,
  };
}
