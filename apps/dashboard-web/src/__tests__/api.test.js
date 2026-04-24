import { describe, it, expect } from 'vitest';
import { analyticsAPI, sitesAPI, authAPI } from '../services/api';

describe('API Service', () => {
    describe('analyticsAPI', () => {
        it('should export all endpoint functions', () => {
            const endpoints = [
                'getKPIs', 'getTraffic', 'getBounceRateTrend', 'getAvgSessionTrend',
                'getPageviews', 'getTopPages', 'getSources', 'getDevices',
                'getCountries', 'getSessions', 'getFunnel', 'getRealtime',
                'getUTM', 'getComparison', 'getUserFlow', 'getAlerts', 'getAll',
            ];
            endpoints.forEach((ep) => {
                expect(typeof analyticsAPI[ep]).toBe('function');
            });
        });
    });

    describe('sitesAPI', () => {
        it('should export CRUD functions', () => {
            expect(typeof sitesAPI.list).toBe('function');
            expect(typeof sitesAPI.get).toBe('function');
            expect(typeof sitesAPI.create).toBe('function');
            expect(typeof sitesAPI.update).toBe('function');
            expect(typeof sitesAPI.delete).toBe('function');
        });
    });

    describe('authAPI', () => {
        it('should export auth functions', () => {
            expect(typeof authAPI.register).toBe('function');
            expect(typeof authAPI.login).toBe('function');
            expect(typeof authAPI.me).toBe('function');
            expect(typeof authAPI.updateProfile).toBe('function');
        });
    });
});
