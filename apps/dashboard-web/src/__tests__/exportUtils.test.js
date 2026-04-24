import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCSV, exportToJSON } from '../utils/exportUtils';

describe('exportToCSV', () => {
    beforeEach(() => {
        // Mock DOM APIs for file download
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn(),
        });
    });

    it('should not throw for valid data', () => {
        const data = [
            { name: 'Home', views: 100 },
            { name: 'About', views: 50 },
        ];
        // Should create a download link and click it
        const mockClick = vi.fn();
        const mockLink = { click: mockClick, href: '', download: '' };
        vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

        exportToCSV(data, 'test.csv');
        expect(mockClick).toHaveBeenCalled();
        expect(mockLink.download).toBe('test.csv');
    });

    it('should handle empty data', () => {
        expect(() => exportToCSV([], 'test.csv')).not.toThrow();
        expect(() => exportToCSV(null, 'test.csv')).not.toThrow();
    });

    it('should escape values with commas', () => {
        const data = [{ name: 'Hello, World', value: 42 }];
        const mockClick = vi.fn();
        const mockLink = { click: mockClick, href: '', download: '' };
        vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

        exportToCSV(data);
        expect(mockClick).toHaveBeenCalled();
    });
});

describe('exportToJSON', () => {
    beforeEach(() => {
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:mock'),
            revokeObjectURL: vi.fn(),
        });
    });

    it('should not throw for valid data', () => {
        const data = { visitors: 100, pageviews: 500 };
        const mockClick = vi.fn();
        const mockLink = { click: mockClick, href: '', download: '' };
        vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

        exportToJSON(data, 'test.json');
        expect(mockClick).toHaveBeenCalled();
        expect(mockLink.download).toBe('test.json');
    });

    it('should handle null data', () => {
        expect(() => exportToJSON(null)).not.toThrow();
    });
});
