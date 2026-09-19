#!/usr/bin/env node
/**
 * Register StudyTub's pages for Search Visibility tracking.
 *
 * StudyTub already reports first-party traffic to this InsightTrack instance
 * (site_9ad371c3), so the traffic half of the correlation exists. This maps its
 * pages to the keywords they target so the SERP half has something to check.
 *
 * Keywords are the ones students actually search, in two shapes:
 *   - subject codes (18EC1T12) — what is printed on a timetable, and what a
 *     student types when they do not remember the subject's full name
 *   - subject and semester names — the broader, more competitive terms
 *
 * Deliberately conservative: 14 keywords, not 40. On a SerpApi free tier of 100
 * searches a month, a daily check of 14 keywords costs ~420 — so the scheduler's
 * MIN_HOURS and MAX_PER_RUN caps matter, and adding more keywords should be a
 * decision rather than an accident.
 *
 * Idempotent. Usage:  npm run setup:studytub
 */
import { createPool, initializeDatabase, query, closeConnection } from '../src/db/postgres.js';
import dotenv from 'dotenv';

dotenv.config();

const SITE_ID = process.env.STUDYTUB_SITE_ID || 'site_9ad371c3';
const LOCATION = 'India';   // the audience is Indian engineering students

/**
 * path → keywords. Paths are the static pages from the website's PR; keywords
 * are what a student would type to find that page.
 */
const MAP = [
  ['/notes/', ['btech notes', 'engineering notes pdf'], true],
  ['/notes/subjects/', ['btech subject notes', 'engineering question papers'], false],
  ['/notes/first-year-engineering-notes.html',
    ['first year engineering notes', 'btech 1st year notes'], true],
  ['/notes/3rd-semester-btech-notes.html', ['3rd semester btech notes'], false],
  ['/notes/7th-semester-btech-notes.html', ['7th semester btech notes'], false],
  // Subject codes: low competition, and the exact string a student searches.
  ['/notes/subjects/digital-communication.html', ['18EC1T12', 'digital communication notes'], true],
  ['/notes/subjects/analog-electronic-circuits.html', ['18EI1T01'], false],
  ['/notes/subjects/circuit-theory.html', ['18EE1T01', 'circuit theory notes'], false],
  ['/notes/subjects/oop-using-java.html', ['18ES1T06'], false],
  ['/notes/subjects/machine-learning.html', ['machine learning notes btech'], false],
];

async function main() {
  console.log('🔍 Registering StudyTub for Search Visibility…\n');
  createPool();
  await initializeDatabase();

  const { rows: site } = await query('SELECT id, name, domain FROM sites WHERE id = $1', [SITE_ID]);
  if (!site.length) {
    console.error(`❌ Site ${SITE_ID} not found in this database.`);
    console.error('   Run against the instance StudyTub reports to, or set STUDYTUB_SITE_ID.');
    process.exit(1);
  }
  console.log(`  site: ${site[0].name} (${site[0].domain})`);

  let added = 0;
  for (const [path, keywords, primaryFirst] of MAP) {
    for (const [i, keyword] of keywords.entries()) {
      const { rowCount } = await query(
        `INSERT INTO page_keywords (site_id, path, keyword, location, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (site_id, path, keyword, location) DO NOTHING`,
        [SITE_ID, path, keyword, LOCATION, primaryFirst && i === 0],
      );
      if (rowCount) added++;
    }
  }

  const { rows: total } = await query(
    'SELECT COUNT(*)::int AS n FROM page_keywords WHERE site_id = $1', [SITE_ID]);
  const { rows: hist } = await query(
    'SELECT COUNT(*)::int AS n FROM rank_history WHERE site_id = $1', [SITE_ID]);

  console.log(`  ✓ ${added} new keyword mapping${added === 1 ? '' : 's'} (${total[0].n} total)`);
  console.log(`  · ${hist[0].n} rank observations recorded so far\n`);

  const key = (process.env.SERPAPI_KEY || '').trim();
  if (key) {
    console.log('✅ SERPAPI_KEY is set — the scheduler will start recording positions.');
    console.log('   First sweep runs a minute after the server starts, then every 6 hours.');
  } else {
    console.log('⚠  No SERPAPI_KEY set, so nothing will be recorded yet.');
    console.log('   Add one in the dashboard (Search Visibility → Connect SerpApi) or as an');
    console.log('   env var, and the scheduler picks it up on the next sweep.');
  }
  console.log('\n   Rank deltas need two observations, so the first useful comparison');
  console.log('   appears about a day after the key is added.');
}

main()
  .catch((e) => { console.error('❌ Setup failed:', e.message); process.exit(1); })
  .finally(() => closeConnection());
