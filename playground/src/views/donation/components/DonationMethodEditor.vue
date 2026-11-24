<script setup lang="ts">
import type { UploadRequestOption } from 'ant-design-vue/es/vc-upload/interface';

import type { DonationIconPreset } from '../model';

import type { DonationApi } from '#/api/donation';

import { computed, shallowRef } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Switch,
  Tooltip,
  Upload,
} from 'ant-design-vue';

import { uploadDonationQRCode } from '#/api/donation';
import { $t } from '#/locales';

import { createDonationMethod } from '../model';
import DonationIconPicker from './DonationIconPicker.vue';

const props = defineProps<{
  canUpload: boolean;
  disabled: boolean;
  methods: DonationApi.Method[];
}>();

const emit = defineEmits<{
  'update:methods': [value: DonationApi.Method[]];
}>();

const uploadingIndex = shallowRef<null | number>(null);
const canAdd = computed(() => !props.disabled && props.methods.length < 8);

function replaceMethods(methods: DonationApi.Method[]) {
  emit(
    'update:methods',
    methods.map((method, index) => ({
      ...method,
      sortNo: (index + 1) * 10,
    })),
  );
}

function updateMethod(index: number, patch: Partial<DonationApi.Method>) {
  const methods = props.methods.map((method, currentIndex) =>
    currentIndex === index ? { ...method, ...patch } : method,
  );
  replaceMethods(methods);
}

function addMethod() {
  if (!canAdd.value) return;
  replaceMethods([...props.methods, createDonationMethod(props.methods)]);
}

function removeMethod(index: number) {
  if (props.disabled) return;
  replaceMethods(
    props.methods.filter((_, currentIndex) => currentIndex !== index),
  );
}

function moveMethod(index: number, direction: -1 | 1) {
  if (props.disabled) return;
  const target = index + direction;
  if (target < 0 || target >= props.methods.length) return;
  const methods = [...props.methods];
  [methods[index], methods[target]] = [methods[target]!, methods[index]!];
  replaceMethods(methods);
}

function updateColorFromEvent(index: number, event: Event) {
  if (event.target instanceof HTMLInputElement) {
    updateMethod(index, { color: event.target.value });
  }
}

function applyIconPreset(index: number, preset: DonationIconPreset) {
  updateMethod(index, { color: preset.color, icon: preset.icon });
}

function uploadRequest(index: number) {
  return async (options: UploadRequestOption) => {
    if (!(options.file instanceof File)) {
      options.onError?.(new Error('Invalid file'));
      return;
    }
    const file = options.file;
    if (!/^image\/(?:gif|jpeg|png|webp)$/i.test(file.type)) {
      const error = new Error($t('donationSettings.messages.invalidImage'));
      message.error(error.message);
      options.onError?.(error);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const error = new Error($t('donationSettings.messages.imageTooLarge'));
      message.error(error.message);
      options.onError?.(error);
      return;
    }
    uploadingIndex.value = index;
    options.onProgress?.({ percent: 0 });
    try {
      const qrCodeUrl = await uploadDonationQRCode(file);
      updateMethod(index, { qrCodeUrl });
      options.onProgress?.({ percent: 100 });
      options.onSuccess?.({ url: qrCodeUrl });
      message.success($t('donationSettings.messages.uploaded'));
    } catch (cause) {
      options.onError?.(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    } finally {
      uploadingIndex.value = null;
    }
  };
}
</script>

<template>
  <section class="method-section">
    <header class="section-heading">
      <div>
        <h2>{{ $t('donationSettings.methods.title') }}</h2>
        <p>{{ $t('donationSettings.methods.description') }}</p>
      </div>
      <Button :disabled="!canAdd" type="primary" @click="addMethod">
        <template #icon><IconifyIcon icon="lucide:plus" /></template>
        {{ $t('donationSettings.actions.addMethod') }}
      </Button>
    </header>

    <Form v-if="methods.length" class="method-list" layout="vertical">
      <article
        v-for="(method, index) in methods"
        :key="index"
        class="method-item"
      >
        <header class="method-item-header">
          <div class="method-order">
            <span>{{
              $t('donationSettings.methods.channel', [index + 1])
            }}</span>
            <Switch
              :checked="method.enabled === 1"
              :disabled="disabled"
              size="small"
              @update:checked="updateMethod(index, { enabled: $event ? 1 : 0 })"
            />
          </div>
          <div class="method-actions">
            <Tooltip :title="$t('donationSettings.actions.moveUp')">
              <Button
                :disabled="disabled || index === 0"
                size="small"
                type="text"
                @click="moveMethod(index, -1)"
              >
                <IconifyIcon icon="lucide:arrow-up" />
              </Button>
            </Tooltip>
            <Tooltip :title="$t('donationSettings.actions.moveDown')">
              <Button
                :disabled="disabled || index === methods.length - 1"
                size="small"
                type="text"
                @click="moveMethod(index, 1)"
              >
                <IconifyIcon icon="lucide:arrow-down" />
              </Button>
            </Tooltip>
            <Tooltip :title="$t('donationSettings.actions.remove')">
              <Button
                danger
                :disabled="disabled"
                size="small"
                type="text"
                @click="removeMethod(index)"
              >
                <IconifyIcon icon="lucide:trash-2" />
              </Button>
            </Tooltip>
          </div>
        </header>

        <div class="method-grid">
          <FormItem :label="$t('donationSettings.fields.methodKey')" required>
            <Input
              :disabled="disabled"
              :maxlength="32"
              :value="method.key"
              @update:value="updateMethod(index, { key: $event })"
            />
          </FormItem>
          <FormItem :label="$t('donationSettings.fields.methodName')" required>
            <Input
              :disabled="disabled"
              :maxlength="32"
              :value="method.name"
              @update:value="updateMethod(index, { name: $event })"
            />
          </FormItem>
          <FormItem
            class="method-wide"
            :label="$t('donationSettings.fields.icon')"
          >
            <div class="icon-field">
              <DonationIconPicker
                :disabled="disabled"
                :icon="method.icon"
                @select="applyIconPreset(index, $event)"
              />
              <Input
                :disabled="disabled"
                :maxlength="96"
                :placeholder="$t('donationSettings.placeholders.customIcon')"
                :value="method.icon"
                @update:value="updateMethod(index, { icon: $event })"
              />
            </div>
          </FormItem>
          <FormItem :label="$t('donationSettings.fields.color')">
            <div class="color-field">
              <input
                :aria-label="$t('donationSettings.fields.color')"
                class="color-swatch"
                :disabled="disabled"
                type="color"
                :value="method.color"
                @input="updateColorFromEvent(index, $event)"
              />
              <Input
                :disabled="disabled"
                :maxlength="7"
                :value="method.color"
                @update:value="updateMethod(index, { color: $event })"
              />
            </div>
          </FormItem>
          <FormItem
            class="method-wide"
            :label="$t('donationSettings.fields.qrCodeUrl')"
          >
            <div class="qr-code-field">
              <div class="qr-code-preview">
                <img
                  v-if="method.qrCodeUrl"
                  :alt="$t('donationSettings.preview.qrAlt', [method.name])"
                  :src="method.qrCodeUrl"
                />
                <IconifyIcon v-else icon="lucide:qr-code" />
              </div>
              <div class="qr-code-controls">
                <Input
                  :disabled="disabled"
                  :maxlength="1024"
                  :placeholder="$t('donationSettings.placeholders.qrCodeUrl')"
                  :value="method.qrCodeUrl"
                  @update:value="updateMethod(index, { qrCodeUrl: $event })"
                />
                <Upload
                  accept=".png,.jpg,.jpeg,.webp,.gif"
                  :custom-request="uploadRequest(index)"
                  :disabled="disabled || !canUpload"
                  :show-upload-list="false"
                >
                  <Button
                    :disabled="disabled || !canUpload"
                    :loading="uploadingIndex === index"
                  >
                    <template #icon>
                      <IconifyIcon icon="lucide:upload" />
                    </template>
                    {{ $t('donationSettings.actions.uploadQrCode') }}
                  </Button>
                </Upload>
              </div>
            </div>
          </FormItem>
          <FormItem
            class="method-wide"
            :label="$t('donationSettings.fields.tip')"
          >
            <Input
              :disabled="disabled"
              :maxlength="120"
              :value="method.tip"
              @update:value="updateMethod(index, { tip: $event })"
            />
          </FormItem>
        </div>
      </article>
    </Form>

    <div v-else class="method-empty">
      <IconifyIcon icon="lucide:qr-code" />
      <strong>{{ $t('donationSettings.methods.emptyTitle') }}</strong>
      <span>{{ $t('donationSettings.methods.emptyDescription') }}</span>
    </div>
  </section>
</template>

<style scoped>
.method-section {
  padding-top: 20px;
}

.section-heading,
.method-item-header,
.method-order,
.method-actions,
.color-field,
.qr-code-field,
.qr-code-controls {
  display: flex;
  align-items: center;
}

.section-heading {
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 16px;
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

.method-list {
  display: grid;
  gap: 12px;
}

.method-item {
  padding: 16px;
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.method-item-header {
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid hsl(var(--border));
}

.method-order {
  gap: 10px;
  font-size: 14px;
  font-weight: 650;
}

.method-actions {
  gap: 2px;
}

.method-actions :deep(.ant-btn) {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
}

.method-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.method-wide {
  grid-column: 1 / -1;
}

.color-field {
  gap: 8px;
}

.icon-field {
  display: grid;
  gap: 10px;
}

.color-swatch {
  flex: 0 0 38px;
  width: 38px;
  height: 32px;
  padding: 2px;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.qr-code-field {
  gap: 12px;
  align-items: flex-start;
}

.qr-code-preview {
  display: grid;
  flex: 0 0 88px;
  place-items: center;
  width: 88px;
  height: 88px;
  overflow: hidden;
  font-size: 28px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
}

.qr-code-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-code-controls {
  flex: 1;
  gap: 8px;
  align-items: flex-start;
  min-width: 0;
}

.method-empty {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 24px;
  text-align: center;
  color: hsl(var(--muted-foreground));
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
}

.method-empty svg {
  margin-bottom: 8px;
  font-size: 32px;
}

.method-empty strong {
  color: hsl(var(--foreground));
}

.method-empty span {
  margin-top: 4px;
  font-size: 13px;
}

@media (max-width: 720px) {
  .section-heading,
  .qr-code-controls {
    align-items: stretch;
  }

  .section-heading,
  .qr-code-field,
  .qr-code-controls {
    flex-direction: column;
  }

  .method-grid {
    grid-template-columns: 1fr;
  }

  .method-wide {
    grid-column: auto;
  }
}
</style>
