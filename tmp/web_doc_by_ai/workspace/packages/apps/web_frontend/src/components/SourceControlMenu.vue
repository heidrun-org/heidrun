<script setup lang="ts">
// A dropdown menu of the Source control sidebar section: the menu of the arrow of the commit button, and the menu of
// the three dots of the header. The window places it, so that the sidebar cannot cut it.
// - issue #305
import { nextTick, onBeforeUnmount, ref } from "vue";
import Icon from "./Icon.vue";

const props = defineProps<{
  /** The items of the dropdown menu. */
  items: { id: string; label: string; isDisabled?: boolean; icon?: string; isDanger?: boolean; hasDividerBefore?: boolean }[];
  /** The Bootstrap Icons name of the button. */
  icon: string;
  /** The accessible name and the tooltip of the button. */
  label: string;
  /** The classes of the button. */
  buttonClass: string;
  /** True when the button cannot be clicked. */
  isDisabled?: boolean;
}>();

const emit = defineEmits<{
  /** The person chose the item `id`. */
  choose: [id: string];
}>();

/** True while the dropdown menu is open. */
const isOpen = ref(false);
const button = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
/** Where the dropdown menu sits, in pixels from the top and from the left edge of the window. */
const position = ref({ top: 0, left: 0 });

/** Opens the dropdown menu under the button, or closes it. */
function toggle() {
  if (isOpen.value) {
    close();
    return;
  }
  if (button.value === undefined) {
    return;
  }
  const rect = button.value.getBoundingClientRect();
  position.value = { top: rect.bottom + 4, left: Math.max(8, rect.right - 220) };
  isOpen.value = true;
  nextTick(() => {
    // The right edge of the dropdown menu lines up with the right edge of the button, whatever the width of the menu.
    const menuWidth = menu.value?.offsetWidth ?? 220;
    position.value = { top: rect.bottom + 4, left: Math.max(8, rect.right - menuWidth) };
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

/** Closes the dropdown menu, and tells which item the person chose. */
function choose(id: string) {
  close();
  emit("choose", id);
}

onBeforeUnmount(close);
</script>

<template>
  <button
    ref="button"
    type="button"
    :class="[props.buttonClass, { show: isOpen }]"
    aria-haspopup="menu"
    :aria-expanded="isOpen"
    :aria-label="props.label"
    :title="props.label"
    :disabled="props.isDisabled"
    @click="toggle"
  >
    <Icon :name="props.icon" />
  </button>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="menu"
      class="menu show position-fixed"
      role="menu"
      :aria-label="props.label"
      :style="{ top: `${position.top}px`, left: `${position.left}px` }"
    >
      <template v-for="item in props.items" :key="item.id">
        <div v-if="item.hasDividerBefore === true" class="menu-divider" role="separator"></div>
        <button
          type="button"
          class="menu-item"
          :class="{ 'theme-danger': item.isDanger === true }"
          role="menuitem"
          :disabled="item.isDisabled"
          @click="choose(item.id)"
        >
          <Icon v-if="item.icon !== undefined" :name="item.icon" />{{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>
