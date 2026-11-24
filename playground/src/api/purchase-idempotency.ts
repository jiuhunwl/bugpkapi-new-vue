export function createPurchaseIdempotencyKey() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random generator is unavailable.');
  }
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  const randomHex = [...bytes]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `bp_${randomHex}`;
}

export function purchaseRequestConfig() {
  return {
    headers: {
      'Idempotency-Key': createPurchaseIdempotencyKey(),
    },
  };
}
