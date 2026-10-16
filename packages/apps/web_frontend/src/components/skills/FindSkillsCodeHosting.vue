<script setup lang="ts">
import { useId } from "vue";
import SkillsHelpCard from "./SkillsHelpCard.vue";
import { showAddress, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

// The field of the source Code hosting: the web address of a skill folder on GitHub or GitLab. The address is read at each key
// typed. GitHub or GitLab is asked only when the developer inspects or installs the folder.

const inputId = useId();
const helpId = useId();

function onAddressInput(event: Event) {
  showAddress((event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="d-flex flex-column gap-1">
    <div class="d-flex align-items-center gap-2">
      <label class="form-label m-0" :for="inputId">{{ t("settingsSkills.help_address_title") }}</label>
      <SkillsHelpCard topic="address" />
    </div>
    <div :id="helpId" class="form-text m-0">{{ t("settingsSkills.addressHelp") }}</div>
    <input
      :id="inputId"
      class="form-control"
      type="text"
      spellcheck="false"
      :value="skills.address"
      :placeholder="t('settingsSkills.addressPlaceholder')"
      :aria-describedby="helpId"
      @input="onAddressInput"
    />
  </div>
</template>
