const OFFICIAL_ALIPAY_GATEWAYS = new Set([
  'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
  'https://openapi.alipay.com/gateway.do',
]);
const ALIPAY_FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/i;
const MAX_ALIPAY_FIELDS = 64;
const MAX_ALIPAY_FIELD_VALUE_LENGTH = 32_768;

interface AlipayFormSource {
  formActionUrl?: string;
  formParams?: Record<string, string>;
  gatewayUrl?: string;
  payForm?: null | string;
}

interface AlipaySubmission {
  action: string;
  params: Record<string, string>;
}

function officialGateway(value: unknown): null | string {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !OFFICIAL_ALIPAY_GATEWAYS.has(parsed.href)
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function normalizeParams(entries: Iterable<[string, unknown]>) {
  const params: Record<string, string> = {};
  let count = 0;
  for (const [rawName, rawValue] of entries) {
    const name = String(rawName ?? '').trim();
    const value = String(rawValue ?? '');
    count += 1;
    if (
      count > MAX_ALIPAY_FIELDS ||
      !ALIPAY_FIELD_NAME_PATTERN.test(name) ||
      value.length > MAX_ALIPAY_FIELD_VALUE_LENGTH ||
      Object.hasOwn(params, name)
    ) {
      return null;
    }
    params[name] = value;
  }
  return count > 0 ? params : null;
}

function parseGeneratedPayForm(html: string): AlipaySubmission | null {
  if (!html || html.length > 256 * 1024 || typeof DOMParser === 'undefined') {
    return null;
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  const forms = document.querySelectorAll('form');
  if (forms.length !== 1) return null;
  const form = forms[0]!;
  if (String(form.getAttribute('method') || 'get').toLowerCase() !== 'post') {
    return null;
  }
  const action = officialGateway(form.getAttribute('action'));
  if (!action) return null;
  const inputs = [...form.querySelectorAll('input')];
  if (inputs.some((input) => String(input.type).toLowerCase() !== 'hidden')) {
    return null;
  }
  const params = normalizeParams(
    inputs.map((input) => [input.name, input.value] as [string, string]),
  );
  return params ? { action, params } : null;
}

function resolveAlipaySubmission(
  source: AlipayFormSource,
): AlipaySubmission | null {
  const structuredEntries = Object.entries(source.formParams ?? {});
  if (structuredEntries.length > 0) {
    const action = officialGateway(source.formActionUrl || source.gatewayUrl);
    const params = normalizeParams(structuredEntries);
    return action && params ? { action, params } : null;
  }
  return parseGeneratedPayForm(String(source.payForm ?? ''));
}

function submitAlipayForm(source: AlipayFormSource, target: string) {
  const submission = resolveAlipaySubmission(source);
  if (!submission || typeof document === 'undefined') return false;
  const form = document.createElement('form');
  form.method = 'post';
  form.acceptCharset = 'utf-8';
  form.action = submission.action;
  form.target = target;
  form.style.display = 'none';
  for (const [key, value] of Object.entries(submission.params)) {
    if (key === 'charset') continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
  window.setTimeout(() => form.remove(), 1000);
  return true;
}

export { resolveAlipaySubmission, submitAlipayForm };

