/**
 * AES-256-GCM encryption for storage-connector secrets at rest.
 * Key from env STORAGE_ENCRYPTION_KEY (base64 or hex, 32 bytes). Never log secrets.
 * Blob layout: base64( iv[12] | authTag[16] | ciphertext ).
 */
import crypto from 'crypto';

function key(): Buffer {
  const raw = process.env.STORAGE_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('STORAGE_ENCRYPTION_KEY is not set');
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('STORAGE_ENCRYPTION_KEY must decode to 32 bytes');
  return buf;
}

export function encryptSecret(plain: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.from(typeof plain === 'string' ? plain : JSON.stringify(plain), 'utf8');
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret<T = any>(blob: string | null | undefined): T | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!blob) return null;
  try {
    const buf = Buffer.from(blob, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    try { return JSON.parse(dec) as T; } catch { return dec as unknown as T; }
  } catch {
    return null;
  }
}

export function hasEncryptionKey(): boolean {
  try { key(); return true; } catch { return false; }
}
