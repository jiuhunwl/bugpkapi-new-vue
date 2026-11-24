<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Button, Card, Tag } from 'ant-design-vue';
import releases from '#/data/releases.json';
import { $t } from '#/locales';

defineOptions({ name: 'SystemReleaseNotes' });
const router = useRouter();
const currentVersion = String(import.meta.env.VITE_APP_VERSION || 'v0.0.0-dev');
const labels = computed<Record<string, string>>(() => ({
  feature: $t('system.updates.feature'),
  improvement: $t('system.updates.improvement'),
  fix: $t('system.updates.fix'),
}));
const colors: Record<string, string> = {
  feature: 'green',
  improvement: 'blue',
  fix: 'orange',
};
</script>

<template>
  <Page
    :title="$t('system.updates.title')"
    :description="$t('system.updates.description')"
  >
    <template #extra>
      <Button @click="router.push({ name: 'SystemAbout' })">{{
        $t('system.updates.back')
      }}</Button>
    </template>
    <div class="release-page" data-testid="release-notes-page">
      <div class="release-summary">
        <span>{{ $t('system.updates.current') }}</span>
        <Tag color="blue">{{ currentVersion }}</Tag>
      </div>
      <ol class="release-timeline" :aria-label="$t('system.updates.title')">
        <li
          v-for="(release, index) in releases"
          :id="'release-' + release.version"
          :key="release.version"
          class="release-item"
          data-testid="release-entry"
        >
          <span
            class="release-dot"
            :class="{ 'release-dot-latest': index === 0 }"
            aria-hidden="true"
          ></span>
          <Card :bordered="false" class="release-card">
            <div class="release-heading">
              <h2>v{{ release.version }}</h2>
              <Tag v-if="index === 0" color="blue">{{
                $t('system.updates.latest')
              }}</Tag>
              <time :datetime="release.date">{{ release.date }}</time>
            </div>
            <h3>{{ release.title }}</h3>
            <ul class="release-changes">
              <li
                v-for="(change, changeIndex) in release.changes"
                :key="changeIndex"
              >
                <Tag :color="colors[change.type]">{{
                  labels[change.type]
                }}</Tag>
                <span>{{ change.text }}</span>
              </li>
            </ul>
            <p v-if="release.database" class="release-database">
              <strong>{{ $t('system.updates.database') }}：</strong
              >{{ release.database }}
            </p>
            <details v-if="release.history.length" class="release-history" open>
              <summary>{{ $t('system.updates.history') }}</summary>
              <ul>
                <li v-for="event in release.history" :key="event.date">
                  <time :datetime="event.date">{{ event.date }}</time
                  ><span>{{ event.text }}</span>
                </li>
              </ul>
            </details>
          </Card>
        </li>
      </ol>
      <div class="release-footnote">
        <p>{{ $t('system.updates.historyNotice') }}</p>
        <p>{{ $t('system.updates.archiveNotice') }}</p>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.release-page {
  max-width: 1040px;
  margin: 0 auto;
  padding-bottom: 24px;
}
.release-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  color: hsl(var(--muted-foreground));
}
.release-timeline {
  list-style: none;
  margin: 0 0 0 7px;
  padding: 0;
  border-left: 1px solid hsl(var(--border));
}
.release-item {
  position: relative;
  padding: 0 0 24px 28px;
}
.release-dot {
  position: absolute;
  top: 27px;
  left: -5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground));
}
.release-dot-latest {
  background: hsl(var(--primary));
  box-shadow: 0 0 0 4px hsl(var(--primary) / 12%);
}
.release-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.release-heading h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.4;
}
.release-heading time {
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
}
.release-card h3 {
  margin: 0 0 18px;
  font-size: 16px;
  font-weight: 600;
}
.release-changes {
  display: grid;
  gap: 14px;
  padding: 0;
  list-style: none;
}
.release-changes li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1.8;
}
.release-changes :deep(.ant-tag) {
  flex-shrink: 0;
  margin: 3px 0 0;
}
.release-database {
  margin-top: 20px;
  padding: 12px 14px;
  background: hsl(var(--muted) / 55%);
  border-radius: 8px;
  line-height: 1.8;
}
.release-history {
  margin-top: 20px;
  color: hsl(var(--muted-foreground));
}
.release-history summary {
  cursor: pointer;
  font-weight: 500;
}
.release-history ul {
  display: grid;
  gap: 12px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.release-history li {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  line-height: 1.8;
}
.release-history time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.release-footnote {
  margin-left: 35px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.9;
}
@media (max-width: 640px) {
  .release-item {
    padding-left: 18px;
  }
  .release-heading time {
    width: 100%;
    margin-left: 0;
  }
  .release-changes li,
  .release-history li {
    flex-direction: column;
    gap: 4px;
  }
  .release-card :deep(.ant-card-body) {
    padding: 18px;
  }
  .release-footnote {
    margin-left: 25px;
  }
}
</style>
