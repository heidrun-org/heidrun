<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../i18n/index';

const isSelected = ref(true);
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <section v-for="surface in ['bg', 'panel', 'shell', 'field', 'hover', 'sel']" :key="surface" class="p-3 border rounded d-flex flex-column gap-2" :style="{ background: `var(--${surface})` }">
      <h4 class="m-0">{{ t(`settingsDesign.color.${surface}`) }}</h4>
      <p class="m-0">{{ t('settingsDesign.sampleText') }} <span class="text-body-secondary mx-2">{{ t('settingsDesign.sampleSecondary') }}</span></p>
      <div :id="surface === 'bg' ? 'buttons' : undefined" class="d-flex flex-wrap gap-2 align-items-center">
        <button class="btn">{{ t('settingsDesign.secondaryAction') }}</button>
        <button class="btn primary">{{ t('settingsDesign.primaryAction') }}</button>
        <button class="btn danger">{{ t('settingsDesign.dangerAction') }}</button>
        <button class="btn" :aria-pressed="isSelected" @click="isSelected = !isSelected">{{ t('settingsDesign.selection') }}</button>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <button class="btn" disabled>{{ t('settingsDesign.unavailable') }}</button>
        <button class="btn primary" disabled>{{ t('settingsDesign.unavailablePrimary') }}</button>
        <button class="btn danger" disabled>{{ t('settingsDesign.unavailableDanger') }}</button>
        <button class="btn small">{{ t('settingsDesign.small') }}</button>
        <button class="btn lg"><i class="bi bi-plus" aria-hidden="true"></i>{{ t('settingsDesign.addItem') }}</button>
      </div>
      <label>{{ t('settingsDesign.exampleInput') }}<input class="form-control" :placeholder="t('settingsDesign.placeholder')"></label>
      <div class="d-flex flex-wrap gap-2 align-items-center">
        <span><span class="dot blocked" aria-hidden="true"></span> {{ t('settingsDesign.blocked') }}</span>
        <span><span class="dot working" aria-hidden="true"></span> {{ t('settingsDesign.working') }}</span>
        <span><span class="dot done" aria-hidden="true"></span> {{ t('settingsDesign.finished') }}</span>
        <span><span class="dot" aria-hidden="true"></span> {{ t('settingsDesign.idle') }}</span>
      </div>
    </section>
  </div>
</template>

