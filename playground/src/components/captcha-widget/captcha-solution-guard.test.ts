import { describe, expect, it } from 'vitest';

import { createCaptchaSolutionGuard } from './captcha-solution-guard';

describe('captcha solution guard', () => {
  it('accepts only one solution in a challenge generation', () => {
    const guard = createCaptchaSolutionGuard();
    const generation = guard.begin('captcha-a');

    expect(guard.accept(generation, 'captcha-a')).toBe(true);
    expect(guard.accept(generation, 'captcha-a')).toBe(false);
  });

  it('rejects callbacks from an old challenge', () => {
    const guard = createCaptchaSolutionGuard();
    const staleGeneration = guard.begin('captcha-a');
    const currentGeneration = guard.begin('captcha-b');

    expect(guard.accept(staleGeneration, 'captcha-a')).toBe(false);
    expect(guard.accept(currentGeneration, 'captcha-a')).toBe(false);
    expect(guard.accept(currentGeneration, 'captcha-b')).toBe(true);
  });

  it('allows the current challenge to retry after a local reset', () => {
    const guard = createCaptchaSolutionGuard();
    const generation = guard.begin('captcha-a');

    expect(guard.accept(generation, 'captcha-a')).toBe(true);
    guard.retry();
    expect(guard.accept(generation, 'captcha-a')).toBe(true);
    guard.invalidate();
    expect(guard.accept(generation, 'captcha-a')).toBe(false);
  });
});
