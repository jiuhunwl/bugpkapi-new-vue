export type CustomCodeTag = 'script' | 'style';

export function hasCompleteCustomCodeTags(
  value: string,
  tag: CustomCodeTag,
) {
  if (!value.trim()) return true;
  const expression = new RegExp(
    `^\\s*(?:<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>\\s*)+$`,
    'i',
  );
  return expression.test(value);
}
