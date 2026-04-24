import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    setupTestDB, cleanTestDB, closeTestDB, getTestPool,
    insertTestSite, insertTestEvents, insertTestSessions,
} from './testHelper.js';
import analyticsService from '../src/services/analyticsService.js';

describe('AnalyticsService', () => {
    let pool;

    beforeAll(async () => {
        await setupTestDB();
        pool = getTestPool();
        await cleanTestDB();
        await insertTestSite(pool);
        await insertTestEvents(pool);
        await insertTestSessions(pool);
    });

    afterAll(async () => {
        await cleanTestDB();
        await closeTestDB();
    });

    describe('getTrafficOverTime', () => {
        it('should return daily traffic data', async () => {
            const data = await analyticsService.getTrafficOverTime('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('date');
            expect(data[0]).toHaveProperty('visitors');
            expect(data[0]).toHaveProperty('sessions');
            expect(data[0]).toHaveProperty('pageviews');
            expect(typeof data[0].visitors).toBe('number');
        });
    });

    describe('getPageViewsOverTime', () => {
        it('should return daily pageview counts', async () => {
            const data = await analyticsService.getPageViewsOverTime('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('date');
            expect(data[0]).toHaveProperty('pageviews');
        });
    });

    describe('getBounceRateOverTime', () => {
        it('should return daily bounce rate trend', async () => {
            const data = await analyticsService.getBounceRateOverTime('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('date');
            expect(data[0]).toHaveProperty('bounceRate');
            expect(typeof data[0].bounceRate).toBe('number');
            // Bounce rate should be between 0 and 100
            data.forEach(d => {
                expect(d.bounceRate).toBeGreaterThanOrEqual(0);
                expect(d.bounceRate).toBeLessThanOrEqual(100);
            });
        });
    });

    describe('getAvgSessionOverTime', () => {
        it('should return daily avg session duration', async () => {
            const data = await analyticsService.getAvgSessionOverTime('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('date');
            expect(data[0]).toHaveProperty('avgDuration');
            expect(typeof data[0].avgDuration).toBe('number');
        });
    });

    describe('getTopPages', () => {
        it('should return top pages with view counts', async () => {
            const data = await analyticsService.getTopPages('site_test1', '7d', 5);

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('path');
            expect(data[0]).toHaveProperty('views');
            expect(data[0]).toHaveProperty('uniqueVisitors');
            // Should be sorted by views desc
            for (let i = 1; i < data.length; i++) {
                expect(data[i - 1].views).toBeGreaterThanOrEqual(data[i].views);
            }
        });
    });

    describe('getTrafficSources', () => {
        it('should return categorized traffic sources', async () => {
            const data = await analyticsService.getTrafficSources('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);

            const sourceNames = data.map(d => d.source);
            // Should have at least Direct and Search (from our test data)
            expect(sourceNames.some(s => ['Direct', 'Search', 'Social', 'Email', 'Referral'].includes(s))).toBe(true);

            data.forEach(d => {
                expect(d).toHaveProperty('source');
                expect(d).toHaveProperty('visitors');
                expect(d).toHaveProperty('percentage');
            });
        });

        it('should classify google referrer as Search', async () => {
            const data = await analyticsService.getTrafficSources('site_test1', '7d');
            const searchSource = data.find(d => d.source === 'Search');
            expect(searchSource).toBeDefined();
            expect(searchSource.visitors).toBeGreaterThan(0);
        });
    });

    describe('getDeviceBreakdown', () => {
        it('should return device stats', async () => {
            const data = await analyticsService.getDeviceBreakdown('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            data.forEach(d => {
                expect(d).toHaveProperty('device');
                expect(d).toHaveProperty('visitors');
                expect(d).toHaveProperty('percentage');
            });
        });
    });

    describe('getCountries', () => {
        it('should return country stats', async () => {
            const data = await analyticsService.getCountries('site_test1', '7d', 10);

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            data.forEach(d => {
                expect(d).toHaveProperty('country');
                expect(d).toHaveProperty('visitors');
                expect(d).toHaveProperty('percentage');
                expect(d).toHaveProperty('code');
            });
        });
    });

    describe('getSessionDuration', () => {
        it('should return session duration buckets', async () => {
            const data = await analyticsService.getSessionDuration('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            data.forEach(d => {
                expect(d).toHaveProperty('bucket');
                expect(d).toHaveProperty('sessions');
                expect(d).toHaveProperty('percentage');
            });
        });
    });

    describe('getKPISummary', () => {
        it('should return KPI data with trend comparisons', async () => {
            const data = await analyticsService.getKPISummary('site_test1', '7d');

            expect(data).toHaveProperty('totalVisitors');
            expect(data).toHaveProperty('totalPageviews');
            expect(data).toHaveProperty('totalSessions');
            expect(data).toHaveProperty('bounceRate');
            expect(data).toHaveProperty('avgSessionDuration');
            expect(data).toHaveProperty('visitorsTrend');
            expect(data).toHaveProperty('pageviewsTrend');
            expect(data).toHaveProperty('bounceRateTrend');
            expect(data).toHaveProperty('sessionTrend');

            expect(data.totalVisitors).toBeGreaterThan(0);
            expect(data.totalPageviews).toBeGreaterThan(0);
            expect(typeof data.bounceRate).toBe('number');
        });
    });

    describe('getFunnelData', () => {
        it('should return funnel steps', async () => {
            const data = await analyticsService.getFunnelData('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(5);
            expect(data[0].step).toBe('Visit Homepage');
            expect(data[1].step).toBe('View Product');

            data.forEach(d => {
                expect(d).toHaveProperty('step');
                expect(d).toHaveProperty('visitors');
                expect(d).toHaveProperty('percentage');
            });
        });
    });

    describe('getRealTimeVisitors', () => {
        it('should return realtime data structure', async () => {
            const data = await analyticsService.getRealTimeVisitors('site_test1');

            expect(data).toHaveProperty('activeVisitors');
            expect(data).toHaveProperty('topPages');
            expect(data).toHaveProperty('devices');
            expect(data).toHaveProperty('countries');
            expect(typeof data.activeVisitors).toBe('number');
            expect(Array.isArray(data.topPages)).toBe(true);
        });
    });

    describe('getUTMCampaigns', () => {
        it('should return UTM campaign data', async () => {
            const data = await analyticsService.getUTMCampaigns('site_test1', '7d');

            expect(Array.isArray(data)).toBe(true);
            // We inserted events with UTM params
            expect(data.length).toBeGreaterThan(0);

            data.forEach(d => {
                expect(d).toHaveProperty('source');
                expect(d).toHaveProperty('medium');
                expect(d).toHaveProperty('campaign');
                expect(d).toHaveProperty('visitors');
                expect(d).toHaveProperty('pageviews');
                expect(d).toHaveProperty('percentage');
            });
        });

        it('should not include events without UTM params', async () => {
            const data = await analyticsService.getUTMCampaigns('site_test1', '7d');

            // Every result should have at least one non-empty UTM field
            data.forEach(d => {
                const hasUtm = d.source !== '(none)' || d.medium !== '(none)' || d.campaign !== '(none)';
                expect(hasUtm).toBe(true);
            });
        });
    });

    describe('Custom date range', () => {
        it('should support custom date range format', async () => {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);

            const customRange = `custom:${weekAgo.toISOString().split('T')[0]}:${today.toISOString().split('T')[0]}`;
            const data = await analyticsService.getTrafficOverTime('site_test1', customRange);

            expect(Array.isArray(data)).toBe(true);
            // Should return data within the custom range
            expect(data.length).toBeGreaterThan(0);
        });
    });

    describe('getComparisonTraffic', () => {
        it('should return current and previous period data', async () => {
            const data = await analyticsService.getComparisonTraffic('site_test1', '7d');

            expect(data).toHaveProperty('current');
            expect(data).toHaveProperty('previous');
            expect(data).toHaveProperty('merged');
            expect(data).toHaveProperty('period');
            expect(Array.isArray(data.current)).toBe(true);
            expect(Array.isArray(data.previous)).toBe(true);
            expect(Array.isArray(data.merged)).toBe(true);
        });

        it('should have merged data with prev fields', async () => {
            const data = await analyticsService.getComparisonTraffic('site_test1', '7d');

            if (data.merged.length > 0) {
                expect(data.merged[0]).toHaveProperty('date');
                expect(data.merged[0]).toHaveProperty('visitors');
                expect(data.merged[0]).toHaveProperty('prevVisitors');
                expect(data.merged[0]).toHaveProperty('prevSessions');
            }
        });

        it('should return period date ranges', async () => {
            const data = await analyticsService.getComparisonTraffic('site_test1', '7d');

            expect(data.period).toHaveProperty('current');
            expect(data.period).toHaveProperty('previous');
            expect(data.period.current).toHaveProperty('start');
            expect(data.period.current).toHaveProperty('end');
        });
    });

    describe('getUserFlow', () => {
        it('should return transitions, entry and exit pages', async () => {
            const data = await analyticsService.getUserFlow('site_test1', '7d');

            expect(data).toHaveProperty('transitions');
            expect(data).toHaveProperty('entryPages');
            expect(data).toHaveProperty('exitPages');
            expect(Array.isArray(data.transitions)).toBe(true);
            expect(Array.isArray(data.entryPages)).toBe(true);
            expect(Array.isArray(data.exitPages)).toBe(true);
        });

        it('should return transitions with from/to/count', async () => {
            const data = await analyticsService.getUserFlow('site_test1', '7d');

            if (data.transitions.length > 0) {
                expect(data.transitions[0]).toHaveProperty('from');
                expect(data.transitions[0]).toHaveProperty('to');
                expect(data.transitions[0]).toHaveProperty('count');
                expect(typeof data.transitions[0].count).toBe('number');
            }
        });

        it('should return entry pages with page/count', async () => {
            const data = await analyticsService.getUserFlow('site_test1', '7d');

            if (data.entryPages.length > 0) {
                expect(data.entryPages[0]).toHaveProperty('page');
                expect(data.entryPages[0]).toHaveProperty('count');
                expect(typeof data.entryPages[0].count).toBe('number');
            }
        });

        it('should respect limit parameter', async () => {
            const data = await analyticsService.getUserFlow('site_test1', '7d', 2);

            expect(data.transitions.length).toBeLessThanOrEqual(2);
        });
    });

    describe('getAlerts', () => {
        it('should return an array of alerts', async () => {
            const data = await analyticsService.getAlerts('site_test1', '30d');

            expect(Array.isArray(data)).toBe(true);
        });

        it('should have correct alert structure when alerts exist', async () => {
            const data = await analyticsService.getAlerts('site_test1', '30d');

            data.forEach(alert => {
                expect(alert).toHaveProperty('type');
                expect(alert).toHaveProperty('severity');
                expect(alert).toHaveProperty('date');
                expect(alert).toHaveProperty('message');
                expect(alert).toHaveProperty('value');
                expect(alert).toHaveProperty('average');
                expect(alert).toHaveProperty('change');
                expect(['spike', 'drop']).toContain(alert.type);
                expect(['warning', 'error']).toContain(alert.severity);
            });
        });

        it('should return empty array for nonexistent site', async () => {
            const data = await analyticsService.getAlerts('nonexistent_site', '7d');

            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(0);
        });
    });
});
