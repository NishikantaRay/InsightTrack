import { describe, it, expect } from "vitest";
import {
  signRequest,
  verifyRequest,
  computeSignature,
  ReplayGuard,
} from "../src/connect/signing.js";
import { InMemoryKeyStore, sharedSecretKey } from "../src/connect/keystore.js";

const SECRET = "s3cr3t-shared-256bit";
const TOKEN = "proj_abc123";

describe("signRequest / verifyRequest", () => {
  it("verifies a freshly signed request", () => {
    const now = 1_719_000_000;
    const req = signRequest(SECRET, TOKEN, { timestamp: now });
    const res = verifyRequest(SECRET, req, { now: () => now });
    expect(res.ok).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const now = 1_719_000_000;
    const req = signRequest(SECRET, TOKEN, { timestamp: now });
    req.signature = req.signature.replace(/.$/, (c) => (c === "0" ? "1" : "0"));
    const res = verifyRequest(SECRET, req, { now: () => now });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a request signed with the wrong secret", () => {
    const now = 1_719_000_000;
    const req = signRequest("other-secret", TOKEN, { timestamp: now });
    const res = verifyRequest(SECRET, req, { now: () => now });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects an expired request", () => {
    const signedAt = 1_719_000_000;
    const req = signRequest(SECRET, TOKEN, { timestamp: signedAt });
    const res = verifyRequest(SECRET, req, {
      now: () => signedAt + 301,
      toleranceSeconds: 300,
    });
    expect(res).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a timestamp too far in the future", () => {
    const signedAt = 1_719_000_000;
    const req = signRequest(SECRET, TOKEN, { timestamp: signedAt });
    const res = verifyRequest(SECRET, req, {
      now: () => signedAt - 301,
      toleranceSeconds: 300,
    });
    expect(res).toEqual({ ok: false, reason: "future_timestamp" });
  });

  it("detects replay via the ReplayGuard", () => {
    const now = 1_719_000_000;
    const guard = new ReplayGuard(300);
    const req = signRequest(SECRET, TOKEN, { timestamp: now });

    const first = verifyRequest(SECRET, req, { now: () => now, replayGuard: guard });
    expect(first.ok).toBe(true);

    const second = verifyRequest(SECRET, req, { now: () => now, replayGuard: guard });
    expect(second).toEqual({ ok: false, reason: "replay" });
  });

  it("does not treat the same nonce for different projects as a replay", () => {
    const now = 1_719_000_000;
    const guard = new ReplayGuard(300);
    const nonce = "fixed-nonce";
    const a = signRequest(SECRET, "proj_a", { timestamp: now, nonce });
    const b = signRequest(SECRET, "proj_b", { timestamp: now, nonce });
    expect(verifyRequest(SECRET, a, { now: () => now, replayGuard: guard }).ok).toBe(true);
    expect(verifyRequest(SECRET, b, { now: () => now, replayGuard: guard }).ok).toBe(true);
  });

  it("computeSignature is deterministic and order-sensitive", () => {
    const a = computeSignature(SECRET, TOKEN, 100, "n1");
    const b = computeSignature(SECRET, TOKEN, 100, "n1");
    const c = computeSignature(SECRET, TOKEN, 101, "n1");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("ReplayGuard", () => {
  it("forgets nonces after the TTL window", () => {
    const guard = new ReplayGuard(60);
    expect(guard.checkAndRemember("k", 1000)).toBe(false); // first sight
    expect(guard.checkAndRemember("k", 1000)).toBe(true); // replay within TTL
    expect(guard.checkAndRemember("k", 1061)).toBe(false); // TTL elapsed -> allowed
  });

  it("evicts expired entries so it does not grow unbounded", () => {
    const guard = new ReplayGuard(10);
    guard.checkAndRemember("a", 0);
    guard.checkAndRemember("b", 5);
    expect(guard.size).toBe(2);
    guard.checkAndRemember("c", 20);
    expect(guard.size).toBe(1); // only "c" remains
  });
});

describe("InMemoryKeyStore", () => {
  it("stores, fetches, and deletes secrets by logical key", async () => {
    const ks = new InMemoryKeyStore();
    const key = sharedSecretKey(TOKEN);
    expect(await ks.get(key)).toBeUndefined();
    await ks.set(key, SECRET);
    expect(await ks.get(key)).toBe(SECRET);
    await ks.delete(key);
    expect(await ks.get(key)).toBeUndefined();
  });
});
