/**
 * Token-at-rest encryption for refresh tokens stored in D1.
 * AES-GCM with a per-user subkey derived from the master key via HKDF.
 *
 * Ciphertext format (base64): [12-byte IV][ciphertext||auth-tag]
 * Concretely: atob() → 12 + N bytes. IV = bytes 0..12. Body = bytes 12..end.
 */

async function deriveKey(
  masterHex: string,
  userId: string,
  purpose: string,
): Promise<CryptoKey> {
  const masterBytes = hexToBytes(masterHex);
  const master = await crypto.subtle.importKey(
    'raw',
    masterBytes,
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(userId),
      info: new TextEncoder().encode(purpose),
    },
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptToken(
  masterHex: string,
  userId: string,
  plaintext: string,
  purpose = 'refresh-token-v1',
): Promise<string> {
  const key = await deriveKey(masterHex, userId, purpose);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return bytesToBase64(combined);
}

export async function decryptToken(
  masterHex: string,
  userId: string,
  ciphertextB64: string,
  purpose = 'refresh-token-v1',
): Promise<string> {
  const key = await deriveKey(masterHex, userId, purpose);
  const combined = base64ToBytes(ciphertextB64);
  if (combined.length < 13) throw new Error('ciphertext too short');
  const iv = combined.slice(0, 12);
  const body = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    body,
  );
  return new TextDecoder().decode(plaintext);
}

/** HMAC-SHA256 for Stripe signature verification. Returns hex. */
export async function hmacSha256Hex(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  );
  return bytesToHex(sig);
}

/** Constant-time comparison for signature check. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function randomId(): string {
  return crypto.randomUUID();
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '').trim();
  if (clean.length % 2 !== 0) throw new Error('hex length must be even');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
