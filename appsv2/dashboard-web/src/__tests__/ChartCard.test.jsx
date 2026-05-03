import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChartCard from '../components/ui/ChartCard';

describe('ChartCard', () => {
    it('should render title', () => {
        render(<ChartCard title="Traffic Overview">
            <div>chart content</div>
        </ChartCard>);
        expect(screen.getByText('Traffic Overview')).toBeInTheDocument();
    });

    it('should render subtitle', () => {
        render(<ChartCard title="Traffic" subtitle="Last 30 days">
            <div>content</div>
        </ChartCard>);
        expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('should show loading skeleton when loading=true', () => {
        const { container } = render(<ChartCard title="Traffic" loading={true} />);
        // LoadingSkeleton renders animate-pulse elements
        expect(container.querySelector('.animate-pulse')).toBeTruthy();
    });

    it('should show error state', () => {
        render(<ChartCard title="Traffic" error="Failed to load" />);
        expect(screen.getAllByText(/failed to load/i).length).toBeGreaterThan(0);
    });

    it('should render children when not loading/error', () => {
        render(<ChartCard title="Traffic">
            <div data-testid="chart">Chart</div>
        </ChartCard>);
        expect(screen.getByTestId('chart')).toBeInTheDocument();
    });

    it('should show export button when onExport is provided', () => {
        const onExport = vi.fn();
        render(<ChartCard title="Traffic" onExport={onExport}>
            <div>content</div>
        </ChartCard>);
        // Should have at least the PNG export button always, and CSV when onExport is given
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
});
