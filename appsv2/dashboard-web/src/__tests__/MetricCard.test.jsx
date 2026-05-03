import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricCard from '../components/ui/MetricCard';

// Mock Recharts since it doesn't work well in jsdom
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ children }) => <div>{children}</div>,
    Area: () => <div />,
}));

describe('MetricCard', () => {
    it('should render title and value', () => {
        render(<MetricCard title="Visitors" value="1,234" />);
        expect(screen.getByText('Visitors')).toBeInTheDocument();
        expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('should show upward trend', () => {
        render(<MetricCard title="Visitors" value="1,000" trend={15} />);
        expect(screen.getByText('15%')).toBeInTheDocument();
    });

    it('should show downward trend', () => {
        render(<MetricCard title="Visitors" value="800" trend={-10} />);
        expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('should show trend label', () => {
        render(<MetricCard title="Visitors" value="1,000" trendLabel="vs last month" />);
        expect(screen.getByText('vs last month')).toBeInTheDocument();
    });

    it('should render without crashing when no optional props', () => {
        const { container } = render(<MetricCard title="Test" value="0" />);
        expect(container.firstChild).toBeTruthy();
    });
});
