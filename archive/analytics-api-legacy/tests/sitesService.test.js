import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, getTestPool, insertTestSite } from './testHelper.js';
import { sitesService } from '../src/services/sitesService.js';

describe('SitesService', () => {
    let pool;

    beforeAll(async () => {
        await setupTestDB();
        pool = getTestPool();
        await cleanTestDB();
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('createSite', () => {
        it('should create a new site and return it', async () => {
            const site = await sitesService.createSite('My Site', 'mysite.com');

            expect(site).toBeDefined();
            expect(site.id).toMatch(/^site_/);
            expect(site.name).toBe('My Site');
            expect(site.domain).toBe('mysite.com');
            expect(site.created_at).toBeDefined();
        });
    });

    describe('getSiteById', () => {
        it('should return site when it exists', async () => {
            await insertTestSite(pool, 'site_get1', 'Get Site', 'getsite.com');
            const site = await sitesService.getSiteById('site_get1');

            expect(site).toBeDefined();
            expect(site.name).toBe('Get Site');
        });

        it('should return null for non-existent site', async () => {
            const site = await sitesService.getSiteById('site_nonexistent');
            expect(site).toBeNull();
        });
    });

    describe('getAllSites', () => {
        it('should return all sites', async () => {
            const sites = await sitesService.getAllSites();
            expect(Array.isArray(sites)).toBe(true);
            expect(sites.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('updateSite', () => {
        it('should update site name and domain', async () => {
            await insertTestSite(pool, 'site_upd1', 'Old Name', 'old.com');
            const updated = await sitesService.updateSite('site_upd1', 'New Name', 'new.com');

            expect(updated.name).toBe('New Name');
            expect(updated.domain).toBe('new.com');
        });

        it('should return null for non-existent site', async () => {
            const result = await sitesService.updateSite('site_no_exist', 'Name', 'domain.com');
            expect(result).toBeNull();
        });
    });

    describe('deleteSite', () => {
        it('should delete site and its related data', async () => {
            await insertTestSite(pool, 'site_del1', 'Delete Me', 'delete.com');

            // Insert related event and session
            await pool.query(
                `INSERT INTO events (site_id, user_id, session_id, type, timestamp, properties) VALUES ($1, $2, $3, $4, NOW(), '{}')`,
                ['site_del1', 'u_del', 's_del', 'pageview']
            );
            await pool.query(
                `INSERT INTO sessions (id, site_id, user_id, started_at, ended_at) VALUES ($1, $2, $3, NOW(), NOW())`,
                ['s_del', 'site_del1', 'u_del']
            );

            await sitesService.deleteSite('site_del1');

            const site = await sitesService.getSiteById('site_del1');
            expect(site).toBeNull();

            const events = await pool.query(`SELECT * FROM events WHERE site_id = 'site_del1'`);
            expect(events.rows.length).toBe(0);

            const sessions = await pool.query(`SELECT * FROM sessions WHERE site_id = 'site_del1'`);
            expect(sessions.rows.length).toBe(0);
        });
    });

    describe('getTrackingScript', () => {
        it('should return a script tag snippet with siteId', () => {
            const script = sitesService.getTrackingScript('site_abc', 'http://localhost:3001');

            expect(script).toContain('site_abc');
            expect(script).toContain('http://localhost:3001');
            expect(script).toContain('<script');
        });
    });

    describe('getRawTrackingScript', () => {
        it('should return raw JavaScript with siteId embedded', () => {
            const script = sitesService.getRawTrackingScript('site_abc', 'http://localhost:3001');

            expect(script).toContain('site_abc');
            expect(script).toContain('http://localhost:3001');
            expect(script).toContain('trackPageview');
            expect(script).not.toContain('<script>');
        });
    });
});
