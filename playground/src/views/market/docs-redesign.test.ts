import { describe, expect, it } from 'vitest';
import docs from './docs.vue?raw';
import parameters from './components/docs/DocsParameters.vue?raw';
import response from './components/docs/DocsResponse.vue?raw';
import examples from './components/docs/DocsCodeExamples.vue?raw';
describe('readable API documentation', () => {
  it('gives reading content its own wide column rather than a permanent three-column card', () => {
    expect(docs).toContain('docs-main-column');
    expect(docs).toContain('docs-nav-support');
    expect(docs).toContain('.docs-page :deep(.public-site-main)');
    expect(docs).not.toContain('175px minmax(0, 1fr) 355px');
  });
  it('preserves each configured parameter without a six-column mobile table', () => {
    expect(parameters).toContain('parameter-row');
    expect(parameters).toContain('item.location');
    expect(parameters).toContain('item.required');
    expect(parameters).toContain('exampleValue(item)');
    expect(parameters).not.toContain('<table');
  });
  it('shares accessible copyable code blocks for response and samples', () => {
    expect(response).toContain('DocsCodeBlock');
    expect(examples).toContain('DocsCodeBlock');
    expect(response).toContain('response-layout');
  });
});
