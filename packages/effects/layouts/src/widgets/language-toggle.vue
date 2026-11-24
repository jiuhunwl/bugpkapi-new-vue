<script setup lang="ts">
import type { SupportedLanguagesType } from '@vben/locales';

import { computed } from 'vue';

import { Languages } from '@vben/icons';
import { getLocaleOptions, loadLocaleMessages } from '@vben/locales';
import { preferences, updatePreferences } from '@vben/preferences';

import { VbenDropdownRadioMenu, VbenIconButton } from '@vben-core/shadcn-ui';

defineOptions({
  name: 'LanguageToggle',
});

const languageOptions = computed(() => [...getLocaleOptions().value]);

async function handleUpdate(value: string | undefined) {
  if (!value) return;
  const locale = value as SupportedLanguagesType;
  if (locale === preferences.app.locale) return;
  updatePreferences({
    app: {
      locale,
    },
  });
  await loadLocaleMessages(locale);
  // 表格列、表单 schema 等在挂载时用当时的语言构建，切换语言后不会自动重建；
  // 重新加载页面才能让所有页面（含 keep-alive 标签页）统一使用新语言。
  window.setTimeout(() => window.location.reload(), 250);
}
</script>

<template>
  <div>
    <VbenDropdownRadioMenu
      :menus="languageOptions"
      :model-value="preferences.app.locale"
      @update:model-value="handleUpdate"
    >
      <VbenIconButton class="hover:animate-[shrink_0.3s_ease-in-out]">
        <Languages class="size-4 text-foreground" />
      </VbenIconButton>
    </VbenDropdownRadioMenu>
  </div>
</template>
