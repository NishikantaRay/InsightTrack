/**
 * KeyStore abstraction (Section 8.1 "Key Storage").
 *
 * Stores per-project Platform Connect shared secrets and our internal service
 * keys. Customer AI provider keys are NEVER stored here — they are fetched live
 * per request and discarded.
 *
 * The shape matches how HashiCorp Vault is used in production; the in-memory
 * implementation lets the whole engine run and be tested with zero external
 * dependencies. Swap `InMemoryKeyStore` for a `VaultKeyStore` with the same
 * methods (get/set/delete) without touching call sites.
 */

/** Logical key name for a project's Platform Connect shared secret. */
export function sharedSecretKey(projectToken) {
  return `connect/shared_secret/${projectToken}`;
}

/** Non-persistent KeyStore for local dev and tests. */
export class InMemoryKeyStore {
  constructor() {
    this.store = new Map();
  }

  async get(name) {
    return this.store.get(name);
  }

  async set(name, value) {
    this.store.set(name, value);
  }

  async delete(name) {
    this.store.delete(name);
  }
}
