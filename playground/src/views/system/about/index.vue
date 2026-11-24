<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon, SvgGithubIcon } from '@vben/icons';

import {
  Button,
  Card,
  Descriptions,
  Empty,
  Image,
  message,
  Skeleton,
  Tag,
  TypographyText,
} from 'ant-design-vue';

import { getPublicSiteConfig } from '#/api/system/site';
import { $t } from '#/locales';
import {
  DEFAULT_LOGO_URL,
  DEFAULT_SITE_NAME,
  useSiteBrand,
} from '#/site-brand';

defineOptions({ name: 'SystemAbout' });

const router = useRouter();

const PROJECT_VERSION =
  String(import.meta.env.VITE_APP_VERSION || '').trim() || 'v0.0.0-dev';
const PROJECT_DESCRIPTION_KEY = 'system.about.description';

const loading = ref(true);
const authorName = ref('');
const authorUrl = ref('');
const githubUrl = ref('');
const contactQq = ref('');
const copied = ref(false);
const siteBrand = useSiteBrand();

const displayLogo = computed(() => siteBrand.logoUrl || DEFAULT_LOGO_URL);
const displayName = computed(() => siteBrand.siteName || DEFAULT_SITE_NAME);

const description = computed(
  () => siteBrand.description || $t(PROJECT_DESCRIPTION_KEY),
);

const displayAuthor = computed(
  () => authorName.value || siteBrand.siteName || DEFAULT_SITE_NAME,
);
const displayGithubUrl = computed(
  () =>
    githubUrl.value ||
    siteBrand.githubUrl ||
    'https://github.com/bugpk/bugpkapi',
);
const displayQq = computed(() => contactQq.value || '');

onMounted(async () => {
  try {
    const config = await getPublicSiteConfig();
    authorName.value = String(config?.authorName || '').trim();
    authorUrl.value = String(config?.authorUrl || '').trim();
    githubUrl.value = String(config?.githubUrl || '').trim();
    contactQq.value = String(config?.contactQq || '').trim();
  } catch {
    // 站点配置读取失败时使用默认文案，不影响页面展示
  } finally {
    loading.value = false;
  }
});

async function copyQq() {
  if (!displayQq.value) return;
  try {
    await navigator.clipboard.writeText(displayQq.value);
    copied.value = true;
    message.success($t('system.about.qqCopied'));
    window.setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    message.error($t('system.about.qqCopyFailed'));
  }
}

function openGithub() {
  if (!displayGithubUrl.value) return;
  window.open(displayGithubUrl.value, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <Page
    auto-content-height
    :description="description"
    :title="$t('system.about.title')"
  >
    <template #extra>
      <Button
        class="mr-2"
        data-testid="about-release-notes"
        @click="router.push({ name: 'SystemReleaseNotes' })"
      >
        {{ $t('system.updates.view') }}
      </Button>
      <Button type="primary" @click="openGithub">
        <template #icon>
          <SvgGithubIcon class="size-4" />
        </template>
        {{ $t('system.about.visit') }} GitHub
      </Button>
    </template>

    <div class="about-page">
      <Skeleton v-if="loading" active :paragraph="{ rows: 6 }" />
      <template v-else>
        <!-- 品牌信息卡片（单列堆叠，vben 原生排版） -->
        <Card class="about-card about-brand-card" :bordered="false">
          <div class="about-brand">
            <Image
              v-if="displayLogo"
              :alt="displayName"
              :height="80"
              :preview="false"
              :src="displayLogo"
              :width="80"
              class="about-logo"
            />
            <Empty
              v-else
              :description="$t('system.about.noLogo')"
              :image="Empty.PRESENTED_IMAGE_SIMPLE"
            />
            <div class="about-title">{{ displayName }}</div>
            <div class="about-subtitle">
              <Tag color="blue">{{ PROJECT_VERSION }}</Tag>
              <Tag color="green">{{ $t('system.about.openSource') }}</Tag>
            </div>
            <p class="about-desc">{{ description }}</p>
          </div>
        </Card>

        <!-- 详细信息卡片（单列 Descriptions） -->
        <Card class="about-card about-info-card" :bordered="false">
          <template #title>{{ $t('system.about.title') }}</template>
          <Descriptions
            bordered
            :column="1"
            class="about-descriptions"
            size="middle"
          >
            <Descriptions.Item :label="$t('system.about.version')">
              <TypographyText>{{ PROJECT_VERSION }}</TypographyText>
            </Descriptions.Item>
            <Descriptions.Item :label="$t('system.about.author')">
              <a
                v-if="authorUrl"
                :href="authorUrl"
                rel="noopener noreferrer"
                target="_blank"
              >
                {{ displayAuthor }}
              </a>
              <TypographyText v-else>{{ displayAuthor }}</TypographyText>
            </Descriptions.Item>
            <Descriptions.Item :label="$t('system.about.github')">
              <div class="about-link-row">
                <a
                  :href="displayGithubUrl"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {{ displayGithubUrl }}
                </a>
                <Button size="small" type="link" @click="openGithub">
                  <template #icon>
                    <IconifyIcon icon="lucide:external-link" />
                  </template>
                  {{ $t('system.about.visit') }}
                </Button>
              </div>
            </Descriptions.Item>
            <Descriptions.Item v-if="displayQq" :label="$t('system.about.qq')">
              <div class="about-link-row">
                <TypographyText copyable>{{ displayQq }}</TypographyText>
                <Button size="small" type="link" @click="copyQq">
                  {{
                    copied
                      ? $t('system.about.copied')
                      : $t('system.about.copyQq')
                  }}
                </Button>
              </div>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <!-- 开源说明卡片 -->
        <Card class="about-card about-note-card" :bordered="false">
          <div class="about-footer">
            <SvgGithubIcon class="about-footer-icon" />
            <p>{{ $t('system.about.openSourceNote') }}</p>
          </div>
        </Card>
      </template>
    </div>
  </Page>
</template>

<style scoped>
/* vben 原生单列堆叠排版：移除复杂双列 grid，改为垂直流式布局 */
.about-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.about-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  box-shadow: none;
}

.about-brand {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  text-align: center;
}

.about-logo {
  border-radius: 14px;
  box-shadow: 0 6px 18px rgb(0 0 0 / 8%);
}

.about-title {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
  color: hsl(var(--foreground));
}

.about-subtitle {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

.about-desc {
  max-width: 560px;
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
}

.about-descriptions {
  width: 100%;
}

.about-descriptions :deep(.ant-descriptions-item-label) {
  min-width: 120px;
}

.about-link-row {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.about-link-row a {
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--primary));
  white-space: nowrap;
}

.about-footer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.about-footer-icon {
  width: 28px;
  height: 28px;
  color: hsl(var(--muted-foreground));
}

.about-footer p {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: hsl(var(--muted-foreground));
  text-align: left;
}

@media (max-width: 640px) {
  .about-page {
    max-width: 100%;
  }

  .about-title {
    font-size: 20px;
  }

  .about-footer {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .about-footer p {
    text-align: center;
  }

  .about-link-row {
    flex-wrap: wrap;
  }
}
</style>
