/**
 * helpers/auth.ts
 * Shared utilities for authenticating a test user and seeding a site
 * via the InsightTrack REST API before Passmark steps begin.
 */
import type { APIRequestContext, Page } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

/** Retry-aware POST that backs off on 429 rate limits */
async function apiPost(
  request: APIRequestContext,
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await request.post(`${API_BASE}${path}`, {
      data: body,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status() === 429) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      continue;
    }
    if (!res.ok()) {
      const text = await res.text();
      throw new Error(`POST ${path} → ${res.status()}: ${text}`);
    }
    return res.json() as Promise<Record<string, unknown>>;
  }
  throw new Error(`POST ${path} still rate-limited after retries`);
}

export interface AuthSession {
  token: string;
  userId: string;
  siteId: string;
  email: string;
  password: string;
}

/**
 * Creates (or reuses) a test user and seeds a site so that the SiteGate
 * does not redirect to /onboarding after login.
 */
export async function createTestSession(
  request: APIRequestContext,
  suffix: string,
): Promise<AuthSession> {
  const email =
    process.env.TEST_USER_EMAIL ?? `passmark-${suffix}@insighttrack.local`;
  const password = process.env.TEST_USER_PASSWORD ?? 'Passmark$ecure123';

  // Register (idempotent — ignore 409 Conflict)
  let token: string;
  let userId: string;
  try {
    const reg = await apiPost(request, '/api/auth/register', {
      name: 'Passmark Tester',
      email,
      password,
    });
    const data = (reg.data ?? reg) as Record<string, unknown>;
    token = (data.token ?? reg.token) as string;
    userId = ((data.user as Record<string, unknown>)?.id ?? reg.userId) as string;
  } catch (err: unknown) {
    // User already exists — login instead
    if (String(err).includes('409') || String(err).includes('already')) {
      const login = await apiPost(request, '/api/auth/login', { email, password });
      const data = (login.data ?? login) as Record<string, unknown>;
      token = (data.token ?? login.token) as string;
      userId = ((data.user as Record<string, unknown>)?.id ?? login.userId) as string;
    } else {
      throw err;
    }
  }

  // Create a site so SiteGate skips onboarding
  let siteId: string;
  try {
    const site = await apiPost(
      request,
      '/api/sites',
      { name: 'InsightTrack Demo', domain: `passmark-${suffix}.insighttrack.local` },
      token,
    );
    const data = (site.data ?? site) as Record<string, unknown>;
    siteId = (data.id ?? site.id) as string;
  } catch {
    // Site might already exist; fetch the list
    const listRes = await request.get(`${API_BASE}/api/sites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = (await listRes.json()) as Record<string, unknown>;
    const sites = (list.data ?? list) as Array<{ id: string }>;
    siteId = sites[0].id;
  }

  return { token, userId, siteId, email, password };
}

/**
 * Injects auth token + siteId into localStorage so the React app
 * treats the browser as already logged-in.
 */
export async function injectAuth(page: Page, session: AuthSession): Promise<void> {
  await page.addInitScript(
    ({ token, siteId }) => {
      // Match the keys used by useAuthStore and useSiteStore (zustand persist)
      const authState = {
        state: { token, isAuthenticated: true, user: { id: 'passmark' } },
        version: 0,
      };
      localStorage.setItem('analytics-auth', JSON.stringify(authState));
      localStorage.setItem('analytics-site-id', siteId);
    },
    { token: session.token, siteId: session.siteId },
  );
}
