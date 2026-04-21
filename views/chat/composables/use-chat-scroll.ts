import { nextTick, ref } from 'vue';

export function useChatScroll() {
  const messageContainerRef = ref<HTMLElement>();
  const autoFollowMessageScroll = ref(true);
  let suppressNextMessageScrollEvent = false;

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

  return {
    autoFollowMessageScroll,
    handleMessageContainerScroll,
    messageContainerRef,
    scrollToBottom,
    scrollToTop,
  };
}
