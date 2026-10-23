<script setup lang="ts">
import { onBeforeUnmount, useId } from "vue";
import Icon from "../Icon.vue";
import SkillsHelpCard from "./SkillsHelpCard.vue";
import { chooseLocalFolder, findLocalFolder, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

// The field of the source Local folder: the full path of the folder, typed or chosen with the folder chooser of the system.
// The path is checked 300 milliseconds after the last key typed, and at once for a folder that the chooser gives.

const CHECK_DELAY_MS = 300;
let checkTimer = 0;
const inputId = useId();
const helpId = useId();

function onPathInput(event: Event) {
  const path = (event.target as HTMLInputElement).value;
  skills.localPath = path;
  window.clearTimeout(checkTimer);
  checkTimer = window.setTimeout(() => findLocalFolder(path), CHECK_DELAY_MS);
}

onBeforeUnmount(() => window.clearTimeout(checkTimer));
</script>

<template>
  <div class="d-flex flex-column gap-1">
    <div class="d-flex align-items-center gap-2">
      <label class="form-label m-0" :for="inputId">{{ t("settingsSkills.help_folder_title") }}</label>
      <SkillsHelpCard topic="folder" />
    </div>
    <div :id="helpId" class="form-text m-0">{{ t("settingsSkills.folderHelp") }}</div>
    <div class="d-flex align-items-center gap-2">
      <input
        :id="inputId"
        class="form-control flex-fill"
        type="text"
        spellcheck="false"
        :value="skills.localPath"
        :placeholder="t('settingsSkills.folderPlaceholder')"
        :aria-describedby="helpId"
        @input="onPathInput"
      />
      <button type="button" class="btn" @click="chooseLocalFolder()"><Icon name="folder" /> {{ t("settingsSkills.folderChoose") }}</button>
    </div>
  </div>
</template>
