import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Authenticated encryption for the one field that needs it — decision D-18.
 *
 * Passport numbers are the most sensitive thing this system stores, and the design handoff does
 * not mention them once. They are encrypted before they reach the column, so a database dump,
 * a backup file or a stray `SELECT *` in the admin yields ciphertext; they are absent from
 * every list response; and each decryption writes a row to `audit_log`, because "who looked at
 * it" is the question asked after an incident rather than before.
 *
 * GCM rather than CBC: it authenticates as well as encrypts, so a modified ciphertext fails
 * loudly instead of decrypting to something else. The nonce is random per value and stored
 * beside it — reusing one under the same key would leak the relationship between two numbers.
 */

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** `nonce.tag.ciphertext`, all base64url, so the whole thing is one printable column value. */
export function seal(plaintext: string, keyHex: string): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(keyHex, 'hex'), nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [nonce, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

/**
 * Reverses `seal`, or throws.
 *
 * It throws rather than returning null on purpose: a passport number that will not decrypt
 * means the key has changed or the row was tampered with, and both deserve to stop the request
 * rather than to render an empty field that looks like a missing value.
 */
export function open(sealed: string, keyHex: string): string {
  const parts = sealed.split('.');
  if (parts.length !== 3) {
    throw new Error('Sealed value is malformed: expected nonce.tag.ciphertext');
  }

  const [nonce, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'));
  if (nonce === undefined || tag === undefined || ciphertext === undefined) {
    throw new Error('Sealed value is malformed: expected nonce.tag.ciphertext');
  }
  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Sealed value is malformed: nonce or tag has the wrong length');
  }

  const decipher = createDecipheriv(ALGORITHM, Buffer.from(keyHex, 'hex'), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
