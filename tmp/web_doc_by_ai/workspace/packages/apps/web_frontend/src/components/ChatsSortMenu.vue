<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";
import {
  CHAT_SORT_KEYS,
  CHAT_SORT_ORDERS,
  chooseChatSortKey,
  chooseChatSortOrder,
  type ChatSortKey,
  type ChatSortOrder,
} from "../stores/chats";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";
import Icon from "./Icon.vue";

/** The icon of each order: the smallest value first points up, and the largest value first points down. */
const ORDER_ICONS: Record<ChatSortOrder, string> = { ascending: "sort-up", descending: "sort-down" };

/** True while the dropdown menu is open. */
const isOpen = ref(false);
const button = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
/** Where the dropdown menu sits, in pixels from the top and from the right edge of the window. */
const position = ref({ top: 0, right: 0 });

/** Opens the dropdown menu under the button, or closes it. The window places it, so that the sidebar cannot cut it. */
function toggle() {
  if (isOpen.value) {
    close();
    return;
  }
  if (button.value === undefined) {
    return;
  }
  const rect = button.value.getBoundingClientRect();
  position.value = { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) };
  isOpen.value = true;
  nextTick(() => {
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

/** Closes the dropdown menu. */
function close() {
  isOpen.value = false;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
}

/** Closes the dropdown menu on a click outside the dropdown menu and outside the button. */
function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node;
  if (menu.value?.contains(target) === true || button.value?.contains(target) === true) {
    return;
  }
  close();
}

/** Closes the dropdown menu on the key Escape, and gives the keyboard focus back to the button. */
function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
    button.value?.focus();
  }
}

/** Sorts the list by `key`, and closes the dropdown menu. */
function chooseKey(key: ChatSortKey) {
  close();
  void chooseChatSortKey(key);
}

/** Sorts the list from the end that `order` says, and closes the dropdown menu. */
function chooseOrder(order: ChatSortOrder) {
  close();
  void chooseChatSortOrder(order);
}

onBeforeUnmount(close);
</script>

<template>
  <button
    ref="button"
    type="button"
    class="btn d-flex align-items-center gap-2"
    :class="{ show: isOpen }"
    aria-haspopup="menu"
    :aria-expanded="isOpen"
    :aria-label="t('chatsPanel.sortLabel')"
    :title="t('chatsPanel.sortTitle')"
    @click="toggle"
  >
    <Icon :name="ORDER_ICONS[settings.chatsOrder]" />
    {{ t(`chatsPanel.sortKey.${settings.chatsSortKey}`) }}
    <Icon name="caret-down-fill" />
  </button>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menu"
      class="menu show position-fixed"
      role="menu"
      :aria-label="t('chatsPanel.sortLabel')"
      :style="{ top: `${position.top}px`, right: `${position.right}px` }"
    >
      <div class="menu-header">{{ t("chatsPanel.sortByHeading") }}</div>
      <button
        v-for="key in CHAT_SORT_KEYS"
        :key="key"
        type="button"
        class="menu-item d-flex align-items-center gap-2"
        role="menuitemradio"
        :aria-checked="settings.chatsSortKey === key"
        @click="chooseKey(key)"
      >
        <Icon name="check2" :class="{ invisible: settings.chatsSortKey !== key }" />
        {{ t(`chatsPanel.sortKey.${key}`) }}
      </button>
      <div class="menu-divider" role="separator"></div>
      <div class="menu-header">{{ t("chatsPanel.sortOrderHeading") }}</div>
      <button
        v-for="order in CHAT_SORT_ORDERS"
        :key="order"
        type="button"
        class="menu-item d-flex align-items-center gap-2"
        role="menuitemradio"
        :aria-checked="settings.chatsOrder === order"
        @click="chooseOrder(order)"
      >
        <Icon name="check2" :class="{ invisible: settings.chatsOrder !== order }" />
        <Icon :name="ORDER_ICONS[order]" />
        {{ t(`chatsPanel.sortOrder.${order}`) }}
      </button>
    </div>
  </Teleport>
</template>
