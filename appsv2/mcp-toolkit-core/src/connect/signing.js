/**
 * Platform Connect signing & verification (F-09, Section 8.3).
 *
 * Every tool call carries an HMAC-SHA256 signature over a canonical payload of
 * (token, timestamp, nonce). The runtime verifies it in-memory before doing any
 * work — no DB lookup, sub-millisecond. Replay is prevented by a freshness
 * window on the timestamp plus a nonce cache (see ReplayGuard).
 *
 * The shared secret is exchanged once during the handshake and stored in the
 * KeyStore (Vault in prod). It is never transmitted after the initial exchange.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Canonical string that gets signed. Order is fixed and must never change. */
function canonicalPayload(token, timestamp, nonce) {
  return `${token}\n${timestamp}\n${nonce}`;
}

export function computeSignature(sharedSecret, token, timestamp, nonce) {
  return createHmac("sha256", sharedSecret)
    .update(canonicalPayload(token, timestamp, nonce))
    .digest("hex");
}

/** Produce a signed request envelope for `token` using `sharedSecret`. */
export function signRequest(sharedSecret, token, opts = {}) {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = opts.nonce ?? randomBytes(16).toString("hex");
  const signature = computeSignature(sharedSecret, token, timestamp, nonce);
  return { token, timestamp, nonce, signature };
}

/**
 * Verify a signed request against the shared secret. Checks, in order:
 * signature validity (constant-time), freshness window, then replay.
 *
 * @returns {{ ok: true } | { ok: false, reason: string }}
 *   reason is one of "bad_signature" | "expired" | "future_timestamp" | "replay".
 */
export function verifyRequest(sharedSecret, req, options = {}) {
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ? options.now() : Math.floor(Date.now() / 1000);

  const expected = computeSignature(sharedSecret, req.token, req.timestamp, req.nonce);
  if (!constantTimeEqualHex(expected, req.signature)) {
    return { ok: false, reason: "bad_signature" };
  }

  // Reject timestamps too far in the future (clock skew or forgery attempt).
  if (req.timestamp - now > tolerance) {
    return { ok: false, reason: "future_timestamp" };
  }
  if (now - req.timestamp > tolerance) {
    return { ok: false, reason: "expired" };
  }

  if (options.replayGuard) {
    // Scope the nonce by token so different projects can't collide.
    const seen = options.replayGuard.checkAndRemember(`${req.token}:${req.nonce}`, now);
    if (seen) return { ok: false, reason: "replay" };
  }

  return { ok: true };
}

/** Constant-time comparison of two hex strings of equal length. */
function constantTimeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * In-memory replay guard. Remembers nonces for a TTL window and rejects repeats.
 * In production this is backed by Redis (Section 8.3) so it works across the
 * container fleet; the interface is identical.
 */
export class ReplayGuard {
  constructor(ttlSeconds = 300) {
    this.ttlSeconds = ttlSeconds;
    this.seen = new Map();
  }

  /**
   * Returns true if `key` was already seen within the TTL (i.e. a replay).
   * Otherwise records it and returns false. Also opportunistically evicts
   * expired entries so the map does not grow unbounded.
   */
  checkAndRemember(key, nowSeconds) {
    this.evictExpired(nowSeconds);
    const existing = this.seen.get(key);
    if (existing !== undefined && nowSeconds - existing <= this.ttlSeconds) {
      return true;
    }
    this.seen.set(key, nowSeconds);
    return false;
  }

  evictExpired(nowSeconds) {
    for (const [key, ts] of this.seen) {
      if (nowSeconds - ts > this.ttlSeconds) this.seen.delete(key);
    }
  }

  /** Current number of remembered nonces (useful for tests/metrics). */
  get size() {
    return this.seen.size;
  }
}
