import type { MaybeRefOrGetter } from 'vue';

import { onBeforeUnmount, toValue, watch } from 'vue';

interface PublicSeoOptions {
  canonicalPath?: MaybeRefOrGetter<string | undefined>;
  description?: MaybeRefOrGetter<string | undefined>;
  noindex?: MaybeRefOrGetter<boolean | undefined>;
  title?: MaybeRefOrGetter<string | undefined>;
}

type HeadElement = HTMLLinkElement | HTMLMetaElement;

function ensureMeta(
  selector: string,
  create: () => HTMLMetaElement,
): null | { created: boolean; element: HTMLMetaElement } {
  if (typeof document === 'undefined') return null;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) return { created: false, element: existing };
  const element = create();
  document.head.append(element);
  return { created: true, element };
}

function ensureLink(
  selector: string,
): null | { created: boolean; element: HTMLLinkElement } {
  if (typeof document === 'undefined') return null;
  const existing = document.head.querySelector<HTMLLinkElement>(selector);
  if (existing) return { created: false, element: existing };
  const element = document.createElement('link');
  element.rel = 'canonical';
  document.head.append(element);
  return { created: true, element };
}

function canonicalUrl(path: string | undefined) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return new URL(path.startsWith('/') ? path : `/${path}`, window.location.origin).href;
}

function usePublicSeo(options: PublicSeoOptions = {}) {
  if (typeof document === 'undefined') return;

  const titleBefore = document.title;
  const entries: Array<{
    attribute: 'content' | 'href';
    created: boolean;
    element: HeadElement;
    value: null | string;
  }> = [];

  const titleEnabled = 'title' in options;
  const descriptionEnabled = 'description' in options;
  const canonicalEnabled = 'canonicalPath' in options;
  const robotsEnabled = 'noindex' in options;

  const description = descriptionEnabled
    ? ensureMeta('meta[name="description"]', () => {
        const element = document.createElement('meta');
        element.name = 'description';
        return element;
      })
    : null;
  const canonicalEntry = canonicalEnabled ? ensureLink('link[rel="canonical"]') : null;
  const ogUrl = canonicalEnabled
    ? ensureMeta('meta[property="og:url"]', () => {
        const element = document.createElement('meta');
        element.setAttribute('property', 'og:url');
        return element;
      })
    : null;
  const ogTitle = titleEnabled
    ? ensureMeta('meta[property="og:title"]', () => {
        const element = document.createElement('meta');
        element.setAttribute('property', 'og:title');
        return element;
      })
    : null;
  const ogDescription = descriptionEnabled
    ? ensureMeta('meta[property="og:description"]', () => {
        const element = document.createElement('meta');
        element.setAttribute('property', 'og:description');
        return element;
      })
    : null;
  const twitterTitle = titleEnabled
    ? ensureMeta('meta[name="twitter:title"]', () => {
        const element = document.createElement('meta');
        element.name = 'twitter:title';
        return element;
      })
    : null;
  const twitterDescription = descriptionEnabled
    ? ensureMeta('meta[name="twitter:description"]', () => {
        const element = document.createElement('meta');
        element.name = 'twitter:description';
        return element;
      })
    : null;
  const robots = robotsEnabled
    ? ensureMeta('meta[name="robots"]', () => {
        const element = document.createElement('meta');
        element.name = 'robots';
        return element;
      })
    : null;

  function remember(
    entry: null | { created: boolean; element: HeadElement },
    attribute: 'content' | 'href',
  ) {
    if (!entry) return;
    entries.push({
      attribute,
      ...entry,
      value: entry.element.getAttribute(attribute),
    });
  }

  remember(description, 'content');
  remember(canonicalEntry, 'href');
  remember(ogUrl, 'content');
  remember(ogTitle, 'content');
  remember(ogDescription, 'content');
  remember(twitterTitle, 'content');
  remember(twitterDescription, 'content');
  remember(robots, 'content');

  const sources = [
    () => toValue(options.title),
    () => toValue(options.description),
    () => toValue(options.canonicalPath),
    () => toValue(options.noindex),
  ];

  function update() {
    const title = String(toValue(options.title) ?? '').trim();
    const descriptionText = String(toValue(options.description) ?? '').trim();
    const canonical = canonicalUrl(toValue(options.canonicalPath));
    const robotsValue = toValue(options.noindex) ? 'noindex, nofollow' : 'index, follow';

    if (titleEnabled) {
      document.title = title;
      if (ogTitle) ogTitle.element.content = title;
      if (twitterTitle) twitterTitle.element.content = title;
    }
    if (descriptionEnabled) {
      if (description) description.element.content = descriptionText;
      if (ogDescription) ogDescription.element.content = descriptionText;
      if (twitterDescription) twitterDescription.element.content = descriptionText;
    }
    if (canonicalEnabled) {
      if (canonicalEntry) canonicalEntry.element.href = canonical;
      if (ogUrl) ogUrl.element.content = canonical;
    }
    if (robotsEnabled && robots) robots.element.content = robotsValue;
  }

  const stop = watch(sources, update, { immediate: true });
  onBeforeUnmount(() => {
    stop();
    document.title = titleBefore;
    for (const entry of entries) {
      if (entry.created) {
        entry.element.remove();
      } else {
        if (entry.value === null) {
          entry.element.removeAttribute(entry.attribute);
        } else {
          entry.element.setAttribute(entry.attribute, entry.value);
        }
      }
    }
  });
}

export type { PublicSeoOptions };
export { usePublicSeo };
