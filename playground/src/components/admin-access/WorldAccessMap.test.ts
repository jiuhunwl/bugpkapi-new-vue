import { createApp } from 'vue';

import { describe, expect, it } from 'vitest';

import WorldAccessMap from './WorldAccessMap.vue';
import { installTestI18n } from './test-i18n';

describe('WorldAccessMap official geography', () => {
  it('renders the complete official country and region feature set', () => {
    const { container, unmount } = mountMap();

    expect(
      container.querySelectorAll('.world-access-map__countries > path').length,
    ).toBeGreaterThanOrEqual(200);
    unmount();
  });

  it('adds the official South China Sea islands and boundary line', () => {
    const { container, unmount } = mountMap();
    const maritime = container.querySelector(
      '[data-map-layer="china-maritime"]',
    );

    expect(maritime).not.toBeNull();
    expect(
      maritime?.querySelectorAll('[data-geometry="island"] path').length,
    ).toBeGreaterThan(0);
    expect(
      maritime?.querySelectorAll('[data-geometry="boundary-line"] path'),
    ).toHaveLength(10);
    unmount();
  });
});

function mountMap() {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createApp(WorldAccessMap, { locations: [] });
  installTestI18n(app);
  app.mount(container);
  return {
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}
