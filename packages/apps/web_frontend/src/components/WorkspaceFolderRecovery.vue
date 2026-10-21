<script setup lang="ts">
import { computed, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { selectedWorkspace, refresh } from '../stores/session';
import { WorkspaceFolders } from '../stores/workspace_folders';
import { t } from '../i18n/index';

const isBusy = ref(false);
const error = ref('');
const workspace = computed(() => {
	const selected = selectedWorkspace.value;
	return selected !== null && WorkspaceFolders.get(selected.workspace_id) === null ? selected : null;
});

/** Asks the developer to recover the fixed workspace folder and saves the selection. */
async function chooseFolder(): Promise<void> {
	const selected = workspace.value;
	if (selected === null) {
		return;
	}
	isBusy.value = true;
	error.value = '';
	try {
		const folder = await open({
			directory: true,
			multiple: false,
			title: t('workspaceFolderRecovery.choose'),
		});
		if (typeof folder !== 'string') {
			return;
		}
		await invoke('workspace_folder_recover', {
			workspaceId: selected.workspace_id,
			folder,
		});
		await refresh();
	} catch (reason) {
		error.value = String(reason);
	} finally {
		isBusy.value = false;
	}
}
</script>

<template>
  <section v-if="workspace !== null" class="workspace-folder-recovery" role="status">
    <div>
      <strong>{{ t('workspaceFolderRecovery.title', { name: workspace.label }) }}</strong>
      <p>{{ t('workspaceFolderRecovery.explanation') }}</p>
      <p v-if="error !== ''" role="alert">{{ error }}</p>
    </div>
    <button class="btn primary" type="button" :disabled="isBusy" @click="chooseFolder">
      {{ t('workspaceFolderRecovery.choose') }}
    </button>
  </section>
</template>

<style scoped>
.workspace-folder-recovery { position: fixed; bottom: 50px; left: 50%; transform: translateX(-50%); z-index: 80; width: min(650px, calc(100% - 48px)); padding: 18px 22px; border: 1px solid var(--line-strong); border-radius: 12px; background: var(--panel); color: var(--text); box-shadow: 0 12px 36px var(--shadow-soft); display: flex; align-items: center; gap: 20px; }
p { margin: 6px 0 0; color: var(--muted); }
button { flex: 0 0 auto; }
</style>
