<script setup lang="ts">
import type { DonationApi } from '#/api/donation';

import { Form, FormItem, Input, Switch } from 'ant-design-vue';
import TextArea from 'ant-design-vue/es/input/TextArea';

import { $t } from '#/locales';

const props = defineProps<{
  disabled: boolean;
  modelValue: DonationApi.Config;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DonationApi.Config];
}>();

type CopyField =
  | 'description'
  | 'enabled'
  | 'eyebrow'
  | 'scanDescription'
  | 'scanTitle'
  | 'thanks'
  | 'title';

function updateField(field: CopyField, value: number | string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: field === 'enabled' ? (value ? 1 : 0) : String(value),
  });
}
</script>

<template>
  <section class="donation-copy-section">
    <header class="section-heading">
      <div>
        <h2>{{ $t('donationSettings.copy.title') }}</h2>
        <p>{{ $t('donationSettings.copy.description') }}</p>
      </div>
      <div class="publish-switch">
        <span>{{ $t('donationSettings.fields.enabled') }}</span>
        <Switch
          :checked="modelValue.enabled === 1"
          :checked-children="$t('donationSettings.status.published')"
          :disabled="disabled"
          :un-checked-children="$t('donationSettings.status.unpublished')"
          @update:checked="updateField('enabled', $event ? 1 : 0)"
        />
      </div>
    </header>

    <Form class="copy-form" layout="vertical">
      <div class="copy-form-grid">
        <FormItem :label="$t('donationSettings.fields.eyebrow')" required>
          <Input
            :disabled="disabled"
            :maxlength="64"
            :value="modelValue.eyebrow"
            @update:value="updateField('eyebrow', $event)"
          />
        </FormItem>
        <FormItem :label="$t('donationSettings.fields.title')" required>
          <Input
            :disabled="disabled"
            :maxlength="120"
            :value="modelValue.title"
            @update:value="updateField('title', $event)"
          />
        </FormItem>
        <FormItem
          class="full-width"
          :label="$t('donationSettings.fields.description')"
        >
          <TextArea
            :disabled="disabled"
            :maxlength="500"
            :rows="3"
            show-count
            :value="modelValue.description"
            @update:value="updateField('description', $event)"
          />
        </FormItem>
        <FormItem :label="$t('donationSettings.fields.scanTitle')" required>
          <Input
            :disabled="disabled"
            :maxlength="120"
            :value="modelValue.scanTitle"
            @update:value="updateField('scanTitle', $event)"
          />
        </FormItem>
        <FormItem :label="$t('donationSettings.fields.scanDescription')">
          <Input
            :disabled="disabled"
            :maxlength="255"
            :value="modelValue.scanDescription"
            @update:value="updateField('scanDescription', $event)"
          />
        </FormItem>
        <FormItem
          class="full-width"
          :label="$t('donationSettings.fields.thanks')"
        >
          <TextArea
            :disabled="disabled"
            :maxlength="255"
            :rows="2"
            show-count
            :value="modelValue.thanks"
            @update:value="updateField('thanks', $event)"
          />
        </FormItem>
      </div>
    </Form>
  </section>
</template>

<style scoped>
.donation-copy-section {
  min-width: 0;
}

.section-heading {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.section-heading h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0;
}

.section-heading p {
  margin: 5px 0 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.publish-switch {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.copy-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.full-width {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .section-heading {
    flex-direction: column;
  }

  .copy-form-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: auto;
  }
}
</style>
