#!/usr/bin/env node
/**
 * Generates a per-post Open Graph image into dist/og/<slug>.png.
 *
 * Every post previously shared one generic og-image.png, so every link looked
 * identical when shared. These cards carry the post title, tags, and read time,
 * which is what drives click-through from social and chat.
 *
 * Rendered by the same headless Chromium the prerender step already installs —
 * an SVG/HTML card screenshotted at 1200x630, so there is no image library and
 * no new dependency.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, 'og');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function card({ title, tags, readingMinutes }) {
    return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;display:flex;flex-direction:column;justify-content:space-between;
       padding:72px;background:#0a0a0f;color:#fff;
       font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background-image:radial-gradient(circle at 85% 15%, rgba(99,102,241,.25), transparent 45%),
                        radial-gradient(circle at 10% 90%, rgba(139,92,246,.18), transparent 45%);}
  .brand{display:flex;align-items:center;gap:14px;font-size:24px;font-weight:600;letter-spacing:-.01em}
  .logo{width:44px;height:44px;border-radius:12px;
        background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center}
  .logo svg{width:24px;height:24px}
  h1{font-size:60px;line-height:1.12;font-weight:900;letter-spacing:-.03em;
     display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .foot{display:flex;align-items:center;gap:12px;font-size:20px;color:#a1a1aa}
  .tag{padding:7px 16px;border-radius:999px;background:rgba(99,102,241,.16);
       border:1px solid rgba(99,102,241,.35);color:#c7d2fe;font-size:19px;font-weight:600}
  .dot{opacity:.5}
</style></head><body>
  <div class="brand">
    <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/>
      <path d="M13 17V5"/><path d="M8 17v-3"/></svg></div>
    <span>InsightsTrack</span>
  </div>
  <h1>${esc(title)}</h1>
  <div class="foot">
    ${(tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
    <span class="dot">•</span><span>${readingMinutes} min read</span>
  </div>
</body></html>`;
}

async function main() {
    if (!existsSync(DIST)) {
        console.error('og-images: dist/ not found — run `vite build` first.');
        process.exit(1);
    }
    const { BLOG_POSTS } = await import('../src/data/blogPosts.js');
    const { chromium } = await import('playwright-core');

    mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

    let n = 0;
    for (const post of BLOG_POSTS) {
        await page.setContent(card(post), { waitUntil: 'networkidle' });
        await page.screenshot({ path: join(OUT, `${post.slug}.png`) });
        n++;
    }
    await browser.close();
    console.log(`og-images: ${n} card(s) written to dist/og/`);
}

main().catch((e) => { console.error('og-images failed:', e.message); process.exit(1); });
