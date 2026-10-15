<script setup lang="ts">
import { useId } from "vue";

// One line with a Bootstrap switch and its label, for the Settings window and for the header of the Clipboard sidebar
// section. The slot is placed after the label, for example for the circled question mark of an information card.

defineProps<{
  /** The text of the label, written after the switch. */
  label: string;
  /** Switches the control off and blocks the mouse, while the setting cannot change. */
  isDisabled?: boolean;
}>();

/** The state of the switch: true when the setting is on. */
const isOn = defineModel<boolean>({ required: true });

const inputId = useId();
</script>

<template>
  <div class="d-flex align-items-center gap-2">
    <span class="switch"><input :id="inputId" v-model="isOn" type="checkbox" role="switch" :disabled="isDisabled" /></span>
    <label :for="inputId">{{ label }}</label>
    <slot />
  </div>
</template>
