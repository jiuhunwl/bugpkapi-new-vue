<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Tag } from 'ant-design-vue';

import { getUserInfoApi } from '#/api';
import OAuthBindingsCard from '#/components/oauth/OAuthBindingsCard.vue';
import { $t } from '#/locales';

const email = ref('');
const mobile = ref('');

function maskEmail(value: string) {
  if (!value) return '';
  const at = value.indexOf('@');
  if (at <= 2) return value;
  return `${value.slice(0, 2)}***${value.slice(at)}`;
}

function maskMobile(value: string) {
  if (!value || value.length < 7) return value;
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

const securityItems = computed(() => [
  {
    value: true,
    fieldName: 'accountPassword',
    label: $t('profile.security.password'),
    description: $t('profile.security.passwordDescription'),
  },
  {
    value: !!mobile.value,
    fieldName: 'securityPhone',
    label: $t('profile.security.mobile'),
    description: mobile.value
      ? $t('profile.security.mobileBound', [maskMobile(mobile.value)])
      : $t('profile.security.mobileUnbound'),
  },
  {
    value: !!email.value,
    fieldName: 'securityEmail',
    label: $t('profile.security.email'),
    description: email.value
      ? $t('profile.security.emailBound', [maskEmail(email.value)])
      : $t('profile.security.emailUnbound'),
  },
]);

onMounted(async () => {
  const data = await getUserInfoApi();
  email.value = (data as any).email || '';
  mobile.value = (data as any).mobile || '';
});
</script>

<template>
  <div class="profile-security text-foreground">
    <h2>{{ $t('profile.tabs.security') }}</h2>
    <div class="security-list">
      <section
        v-for="item in securityItems"
        :key="item.fieldName"
        class="security-item"
      >
        <div>
          <strong>{{ item.label }}</strong>
          <p>{{ item.description }}</p>
        </div>
        <Tag :color="item.value ? 'green' : 'default'">
          {{
            item.value
              ? $t('profile.security.bound')
              : $t('profile.status.unbound')
          }}
        </Tag>
      </section>
    </div>

    <OAuthBindingsCard />
  </div>
</template>

<style scoped>
.profile-security {
  display: grid;
  gap: 20px;
  width: 100%;
  max-width: 860px;
}

.profile-security h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.security-list {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 9px;
}

.security-item {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.security-item:last-child {
  border-bottom: 0;
}

.security-item p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 560px) {
  .security-item {
    align-items: flex-start;
  }
}
</style>
