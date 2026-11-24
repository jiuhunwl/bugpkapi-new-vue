<script lang="ts" setup>
import { SvgGithubIcon, SvgLinuxDoIcon, SvgQQChatIcon, SvgWeChatIcon } from '@vben/icons';

defineProps<{
  displayName?: string;
  iconKey?: string;
}>();
</script>

<template>
  <SvgQQChatIcon v-if="iconKey === 'qq'" class="size-5" />
  <SvgWeChatIcon v-else-if="iconKey === 'wechat'" class="size-5" />
  <SvgGithubIcon v-else-if="iconKey === 'github'" class="size-5" />
  <SvgLinuxDoIcon v-else-if="iconKey === 'linuxdo'" class="size-5 rounded-full" />
  <span
    v-else
    class="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
  >
    {{ (displayName || '?').slice(0, 1).toUpperCase() }}
  </span>
</template>
