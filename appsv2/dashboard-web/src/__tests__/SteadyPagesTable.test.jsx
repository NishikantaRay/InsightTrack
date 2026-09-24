import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SteadyPagesTable from '../components/search/SteadyPagesTable';

const page = (path, finding, currentWeek = 5) => ({
    path,
    traffic: { significant: false, previousWeek: 4, currentWeek, thresholds: { minPct: 15, minViews: 20 } },
    keywordFindings: [{ keyword: `${path} kw`, location: 'India', ...finding }],
});

describe('SteadyPagesTable', () => {
    const pages = [
        page('/busy', { position: 3, positionChange: 0 }, 12),
        page('/uncited', { position: 5, positionChange: 0, hasAiOverview: true, domainIsCited: false }, 2),
        page('/slipped', { position: 9, previousPosition: 5, positionChange: -4 }, 3),
    ];

    it('lists search-side problems first, then by traffic', () => {
        render(<SteadyPagesTable pages={pages} />);
        const order = screen.getAllByRole('row').slice(1).map((r) => within(r).getByRole('button').textContent);
        expect(order).toEqual(['/uncited', '/slipped', '/busy']);
    });

    it('states the real thresholds and how many rows need a look', () => {
        render(<SteadyPagesTable pages={pages} />);
        expect(screen.getByText(/at least 15% and 20 views/)).toBeInTheDocument();
        expect(screen.getByText(/2 still have something to fix/)).toBeInTheDocument();
    });

    it('shows position moves and unranked keywords plainly', () => {
        render(<SteadyPagesTable pages={[...pages, page('/none', { position: null })]} />);
        expect(screen.getByText('↓4')).toBeInTheDocument();
        expect(screen.getByText('Not ranking')).toBeInTheDocument();
    });
});
