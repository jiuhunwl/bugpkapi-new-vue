<script setup lang="ts">
import type { AdvertisementDraft } from '../form-model';

import { computed } from 'vue';

import {
  Alert,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import { targetOptions } from '../data';
import PayloadParameterEditor from './PayloadParameterEditor.vue';
import PlacementSelector from './PlacementSelector.vue';

const model = defineModel<AdvertisementDraft>({ required: true });

const isServiceProvider = computed(
  () => model.value.placement === 'SERVICE_PROVIDER',
);
const isAPIResponse = computed(() => model.value.placement === 'API_RESPONSE');
const preservedPayloadKeys = computed(() =>
  Object.keys(model.value.preservedPayload),
);
const placementHelp = computed(() =>
  $t(`advertisementAdmin.placementDetails.${placementKey.value}.help`),
);
const placementTitle = computed(() =>
  $t(`advertisementAdmin.placementDetails.${placementKey.value}.title`),
);
const placementKey = computed(() => {
  if (model.value.placement === 'API_RESPONSE') return 'apiResponse';
  if (model.value.placement === 'CONSOLE') return 'console';
  if (model.value.placement === 'NOTICE') return 'notice';
  if (model.value.placement === 'SERVICE_PROVIDER') {
    return 'serviceProvider';
  }
  return 'home';
});
const displayTitleLabel = computed(() =>
  isServiceProvider.value
    ? $t('advertisementAdmin.editorFields.providerName')
    : isAPIResponse.value
      ? $t('advertisementAdmin.editorFields.responseTitle')
      : $t('advertisementAdmin.fields.title'),
);
const linkLabel = computed(() =>
  isServiceProvider.value
    ? $t('advertisementAdmin.editorFields.providerUrl')
    : $t('advertisementAdmin.fields.linkUrl'),
);

function updateField<K extends keyof AdvertisementDraft>(
  key: K,
  value: AdvertisementDraft[K],
) {
  model.value = { ...model.value, [key]: value };
}

function updateLinkTarget(value: unknown) {
  updateField('linkTarget', value === '_self' ? '_self' : '_blank');
}
</script>

<template>
  <Form class="advertisement-editor" layout="vertical">
    <section class="editor-section editor-section--placement">
      <header class="editor-section__header">
        <div>
          <span class="editor-section__eyebrow">
            {{ $t('advertisementAdmin.editor.placementStep') }}
          </span>
          <h3>{{ $t('advertisementAdmin.editor.placementTitle') }}</h3>
          <p>{{ $t('advertisementAdmin.editor.placementDescription') }}</p>
        </div>
        <Tag color="processing">{{ placementTitle }}</Tag>
      </header>
      <PlacementSelector
        :model-value="model.placement"
        @update:model-value="updateField('placement', $event)"
      />
    </section>

    <section class="editor-section">
      <header class="editor-section__header">
        <div>
          <span class="editor-section__eyebrow">
            {{ $t('advertisementAdmin.editor.basicStep') }}
          </span>
          <h3>{{ $t('advertisementAdmin.editor.basicTitle') }}</h3>
          <p>{{ $t('advertisementAdmin.editor.basicDescription') }}</p>
        </div>
        <Tag :color="model.status ? 'success' : 'default'">
          {{
            model.status
              ? $t('advertisementAdmin.status.enabled')
              : $t('advertisementAdmin.status.disabled')
          }}
        </Tag>
      </header>

      <div class="editor-grid editor-grid--basic">
        <Form.Item :label="$t('advertisementAdmin.fields.name')" required>
          <Input
            :maxlength="64"
            :placeholder="$t('advertisementAdmin.editorFields.namePlaceholder')"
            show-count
            :value="model.name"
            @update:value="updateField('name', String($event))"
          />
        </Form.Item>
        <Form.Item :label="$t('advertisementAdmin.fields.sortNo')">
          <InputNumber
            class="w-full"
            :max="100_000"
            :min="-100_000"
            :precision="0"
            :value="model.sortNo"
            @update:value="updateField('sortNo', Number($event ?? 0))"
          />
        </Form.Item>
        <Form.Item
          class="editor-grid__full"
          :label="$t('advertisementAdmin.fields.status')"
        >
          <div class="editor-switch-row">
            <Switch
              :checked="model.status"
              :checked-children="$t('advertisementAdmin.status.enabled')"
              :un-checked-children="$t('advertisementAdmin.status.disabled')"
              @update:checked="updateField('status', Boolean($event))"
            />
            <span>{{ $t('advertisementAdmin.editorFields.statusHelp') }}</span>
          </div>
        </Form.Item>
      </div>
    </section>

    <section class="editor-section">
      <header class="editor-section__header">
        <div>
          <span class="editor-section__eyebrow">
            {{ $t('advertisementAdmin.editor.contentStep') }}
          </span>
          <h3>{{ placementTitle }}</h3>
          <p>{{ placementHelp }}</p>
        </div>
      </header>

      <Alert
        :description="$t('advertisementAdmin.placementDetails.dynamicHelp')"
        show-icon
        type="info"
      />

      <div class="editor-grid">
        <Form.Item :label="displayTitleLabel" required>
          <Input
            :maxlength="128"
            :placeholder="
              isServiceProvider
                ? $t('advertisementAdmin.editorFields.providerNamePlaceholder')
                : $t('advertisementAdmin.editorFields.titlePlaceholder')
            "
            show-count
            :value="model.title"
            @update:value="updateField('title', String($event))"
          />
        </Form.Item>

        <Form.Item :label="linkLabel">
          <Input
            :placeholder="
              isServiceProvider
                ? 'https://provider.example.com'
                : 'https://example.com/campaign'
            "
            :value="model.linkUrl"
            @update:value="updateField('linkUrl', String($event))"
          />
        </Form.Item>

        <Form.Item
          v-if="!isServiceProvider"
          class="editor-grid__full"
          :label="$t('advertisementAdmin.fields.description')"
        >
          <Input.TextArea
            :maxlength="512"
            :placeholder="
              $t('advertisementAdmin.editorFields.descriptionPlaceholder')
            "
            :rows="3"
            show-count
            :value="model.description"
            @update:value="updateField('description', String($event))"
          />
        </Form.Item>

        <Form.Item
          v-if="!isServiceProvider"
          :label="$t('advertisementAdmin.fields.imageUrl')"
        >
          <Input
            placeholder="https://example.com/banner.webp"
            :value="model.imageUrl"
            @update:value="updateField('imageUrl', String($event))"
          />
        </Form.Item>

        <Form.Item :label="$t('advertisementAdmin.fields.linkTarget')">
          <Select
            class="w-full"
            :options="targetOptions()"
            :value="model.linkTarget"
            @update:value="updateLinkTarget($event)"
          />
        </Form.Item>
      </div>

      <PayloadParameterEditor
        v-if="isAPIResponse"
        :model-value="model.parameters"
        :preserved-keys="preservedPayloadKeys"
        @update:model-value="updateField('parameters', $event)"
      />
    </section>

    <section class="editor-section">
      <header class="editor-section__header">
        <div>
          <span class="editor-section__eyebrow">
            {{ $t('advertisementAdmin.editor.scheduleStep') }}
          </span>
          <h3>{{ $t('advertisementAdmin.editor.scheduleTitle') }}</h3>
          <p>{{ $t('advertisementAdmin.editor.scheduleDescription') }}</p>
        </div>
      </header>
      <div class="editor-grid">
        <Form.Item :label="$t('advertisementAdmin.fields.startTime')">
          <DatePicker
            class="w-full"
            format="YYYY-MM-DD HH:mm:ss"
            :show-time="{ format: 'HH:mm:ss' }"
            :value="model.startTime || undefined"
            value-format="YYYY-MM-DD HH:mm:ss"
            @update:value="updateField('startTime', String($event ?? ''))"
          />
        </Form.Item>
        <Form.Item :label="$t('advertisementAdmin.fields.endTime')">
          <DatePicker
            class="w-full"
            format="YYYY-MM-DD HH:mm:ss"
            :show-time="{ format: 'HH:mm:ss' }"
            :value="model.endTime || undefined"
            value-format="YYYY-MM-DD HH:mm:ss"
            @update:value="updateField('endTime', String($event ?? ''))"
          />
        </Form.Item>
      </div>
    </section>
  </Form>
</template>

<style scoped>
.advertisement-editor {
  display: grid;
  gap: 16px;
}

.editor-section {
  display: grid;
  gap: 16px;
  padding: 18px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.editor-section--placement {
  background: linear-gradient(
    155deg,
    hsl(var(--primary) / 7%),
    hsl(var(--card)) 54%
  );
}

.editor-section__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.editor-section__header h3 {
  margin: 2px 0 0;
  font-size: 16px;
  font-weight: 750;
  color: hsl(var(--foreground));
}

.editor-section__header p {
  max-width: 700px;
  margin: 5px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.editor-section__eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.13em;
  color: hsl(var(--primary));
  text-transform: uppercase;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.editor-grid--basic {
  grid-template-columns: minmax(0, 1.5fr) minmax(180px, 0.5fr);
}

.editor-grid__full {
  grid-column: 1 / -1;
}

.editor-switch-row {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 32px;
}

.editor-switch-row span {
  font-size: 12px;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
}

:deep(.ant-form-item) {
  margin-bottom: 14px;
}

:deep(.ant-form-item-label > label) {
  font-size: 12px;
  font-weight: 650;
}

@media (max-width: 720px) {
  .editor-section {
    padding: 15px;
  }

  .editor-section__header {
    flex-direction: column;
  }

  .editor-grid,
  .editor-grid--basic {
    grid-template-columns: 1fr;
  }

  .editor-grid__full {
    grid-column: auto;
  }
}
</style>
