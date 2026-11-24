import type { Package, Packages } from '@manypkg/get-packages';

// Test the package entrypoint, not the source: stale emitted declarations must fail.
import { getPackage, getPackages, getPackagesSync } from '@vben/node-utils';

import { expectTypeOf, test } from 'vitest';

test('published async package discovery preserves package metadata types', () => {
  expectTypeOf<ReturnType<typeof getPackages>>().toEqualTypeOf<
    Promise<Packages>
  >();
});

test('published sync package discovery preserves package metadata types', () => {
  expectTypeOf<ReturnType<typeof getPackagesSync>>().toEqualTypeOf<Packages>();
});

test('published package lookup preserves the missing-package result', () => {
  expectTypeOf<ReturnType<typeof getPackage>>().toEqualTypeOf<
    Promise<Package | undefined>
  >();
});

test('dependency entries stay strings for the Vite metadata resolver', () => {
  const checkDependencies = async () => {
    const { packages } = await getPackages();
    for (const { packageJson } of packages) {
      expectTypeOf(
        Object.entries(packageJson.dependencies ?? {}),
      ).toEqualTypeOf<[string, string][]>();
      expectTypeOf(
        Object.entries(packageJson.devDependencies ?? {}),
      ).toEqualTypeOf<[string, string][]>();
    }
  };
  expectTypeOf(checkDependencies).returns.toEqualTypeOf<Promise<void>>();
});
