/**
 * Tiny symmetric secret box for storing user-supplied secrets (e.g. BYO AI keys)
 * encrypted at rest in PostgreSQL. AES-256-GCM, dependency-free (node:crypto).
 *
 * The key is derived (scrypt) from ENCRYPTION_KEY if set, else from JWT_SECRET so
 * self-hosters don't need extra config. Rotating either invalidates stored blobs
 * (the app treats an undecryptable blob as "no key on file", which is safe).
 *
 * Format of encrypt() output (all base64url, dot-separated):  iv.tag.ciphertext
 */
import crypto from 'node:crypto';

const SECRET = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
// Static salt: we want deterministic key derivation, not per-secret salts (the
// per-secret IV already guarantees unique ciphertexts).
const SALT = 'insighttrack.secretbox.v1';

let KEY = null;
function key() {
    if (!SECRET) throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set to store secrets.');
    if (!KEY) KEY = crypto.scryptSync(SECRET, SALT, 32);
    return KEY;
}

const b64u = (buf) => buf.toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url');

/** Encrypt a UTF-8 string. Returns "iv.tag.ciphertext" (base64url) or throws. */
export function encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    return [b64u(iv), b64u(cipher.getAuthTag()), b64u(ct)].join('.');
}

/** Decrypt a blob produced by encrypt(). Returns the string, or null if invalid. */
export function decrypt(blob) {
    try {
        const [iv, tag, ct] = String(blob).split('.');
        if (!iv || !tag || !ct) return null;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key(), unb64u(iv));
        decipher.setAuthTag(unb64u(tag));
        return Buffer.concat([decipher.update(unb64u(ct)), decipher.final()]).toString('utf8');
    } catch {
        return null; // wrong key / tampered / rotated secret → treat as absent
    }
}

/** A non-reversible hint for display, e.g. "sk-…a1b2" — never returns the key. */
export function maskSecret(plaintext) {
    const s = String(plaintext || '');
    if (s.length <= 8) return '••••';
    return `${s.slice(0, 3)}…${s.slice(-4)}`;
}
