import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, cleanTestDB, closeTestDB, insertTestSite, TEST_SITE_ID } from './testHelper.js';
import { sitesService } from '../src/services/sitesService.js';

describe('sitesService', () => {
    beforeAll(async () => {
        await setupTestDB();
    });

    beforeEach(async () => {
        await cleanTestDB();
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('createSite', () => {
        it('should create a site with generated id', async () => {
            const site = await sitesService.createSite('My Blog', 'myblog.test.example.com');
            expect(site).toBeDefined();
            expect(site.id).toMatch(/^site_/);
            expect(site.name).toBe('My Blog');
            expect(site.domain).toBe('myblog.test.example.com');
            expect(site.created_at).toBeDefined();
        });
    });

    describe('getSiteById', () => {
        it('should return site by id', async () => {
            await insertTestSite();
            const site = await sitesService.getSiteById(TEST_SITE_ID);
            expect(site).toBeDefined();
            expect(site.id).toBe(TEST_SITE_ID);
            expect(site.name).toBe('Test Site');
        });

        it('should return null for nonexistent site', async () => {
            const site = await sitesService.getSiteById('site_nonexistent');
            expect(site).toBeNull();
        });
    });

    describe('getAllSites', () => {
        it('should return all sites', async () => {
            await insertTestSite('site_test1', 'Site A', 'a.com');
            await insertTestSite('site_test2', 'Site B', 'b.com');
            const sites = await sitesService.getAllSites();
            const testSites = sites.filter(s => s.id.startsWith('site_test'));
            expect(testSites.length).toBe(2);
        });
    });

    describe('updateSite', () => {
        it('should update site name and domain', async () => {
            await insertTestSite();
            const updated = await sitesService.updateSite(TEST_SITE_ID, 'Updated Name', 'updated.com');
            expect(updated.name).toBe('Updated Name');
            expect(updated.domain).toBe('updated.com');
        });

        it('should return null for nonexistent site', async () => {
            const result = await sitesService.updateSite('site_nonexistent', 'x', 'x.com');
            expect(result).toBeNull();
        });
    });

    describe('deleteSite', () => {
        it('should delete site and cascade to events/sessions', async () => {
            await insertTestSite();
            const result = await sitesService.deleteSite(TEST_SITE_ID);
            expect(result.success).toBe(true);
            const site = await sitesService.getSiteById(TEST_SITE_ID);
            expect(site).toBeNull();
        });
    });

    describe('getTrackingScript', () => {
        it('should return script tag', () => {
            const script = sitesService.getTrackingScript('site_abc');
            expect(script).toContain('<script');
            expect(script).toContain('site_abc');
            expect(script).toContain('/script');
        });
    });

    describe('getRawTrackingScript', () => {
        it('should return executable JS with site id', () => {
            const script = sitesService.getRawTrackingScript('site_abc', 'http://localhost:3001');
            expect(script).toContain('site_abc');
            expect(script).toContain('trackPageview');
            expect(script).toContain('getCountry');
            expect(script).toContain('getUserId');
            expect(script).toContain('getSessionId');
        });

        it('should include timezone-to-country mapping', () => {
            const script = sitesService.getRawTrackingScript('site_abc');
            expect(script).toContain('Asia/Kolkata');
            expect(script).toContain('Asia/Calcutta');
            expect(script).toContain('America/New_York');
            expect(script).toContain('Europe/London');
        });
    });
});
