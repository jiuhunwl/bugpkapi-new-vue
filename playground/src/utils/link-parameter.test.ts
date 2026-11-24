import { describe, expect, it } from 'vitest';
import { cleanLinkParameter } from './link-parameter';
describe('pasted business parameters',()=>{
 it('extracts first URL without rewriting its query or encoding',()=>{
  expect(cleanLinkParameter('复制 https://example.com/v?id=12&sign=a%2Fb+z 查看')).toBe('https://example.com/v?id=12&sign=a%2Fb+z');
  expect(cleanLinkParameter('链接（https://one.test/a）。 https://two.test')).toBe('https://one.test/a');
 });
 it('preserves plain text, structured JSON and authentication values',()=>{
  for(const value of ['  hello world  ','普通文本 abc 123','不是 https:// 或 ftp://example.com','{"url":"https://a.test","id":9007199254740993}'])expect(cleanLinkParameter(value)).toBe(value);
  expect(cleanLinkParameter('分享 https://example.com','api_key')).toBe('分享 https://example.com');
 });
 it('keeps balanced URL punctuation and rejects malformed escapes',()=>{
  expect(cleanLinkParameter('https://example.com/a_(b)')).toBe('https://example.com/a_(b)');
  expect(cleanLinkParameter('https://example.com/a?x=! 分享')).toBe('https://example.com/a?x=!');
  expect(cleanLinkParameter('链接 https://example.com/%ZZ')).toBe('链接 https://example.com/%ZZ');
 });
});