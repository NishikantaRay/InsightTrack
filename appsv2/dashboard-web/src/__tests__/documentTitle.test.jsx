/**
 * Tab title behaviour.
 *
 * Regression guard for a title that leaked across routes: useSeo set
 * document.title and never restored it, and the dashboard pages set no title at
 * all, so visiting an unknown URL left "Page not found" in the tab above every
 * working page that followed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

function Seoed({ title }) {
    useSeo({ title });
    return <div>page</div>;
}

// Stand-in for DashboardLayout's useRouteTitle: titles known routes only, and
// deliberately leaves an unknown path alone so the 404's own title survives.
function TitledRoute({ name, children }) {
    useEffect(() => {
        if (!name) return;
        document.title = `${name} — InsightsTrack`;
    }, [name]);
    return <>{children}</>;
}

describe('document title', () => {
    beforeEach(() => {
        document.title = 'InsightsTrack — Self-Hosted, Privacy-First Analytics';
    });

    it('useSeo sets a branded title', () => {
        render(<MemoryRouter><Seoed title="Terms" /></MemoryRouter>);
        expect(document.title).toBe('Terms — InsightsTrack');
    });

    it('restores the previous title on unmount', () => {
        const original = document.title;
        const { unmount } = render(<MemoryRouter><Seoed title="Page not found" /></MemoryRouter>);
        expect(document.title).toBe('Page not found — InsightsTrack');
        unmount();
        expect(document.title).toBe(original);
    });

    // The bug as reported: land on a 404, navigate to a dashboard page, and the
    // tab still says "Page not found".
    it('does not leak a 404 title onto the next page', () => {
        const { unmount } = render(<MemoryRouter><Seoed title="Page not found" /></MemoryRouter>);
        expect(document.title).toContain('Page not found');
        unmount();
        cleanup();

        render(<MemoryRouter><TitledRoute name="Dashboard"><div /></TitledRoute></MemoryRouter>);
        expect(document.title).toBe('Dashboard — InsightsTrack');
        expect(document.title).not.toContain('Page not found');
    });

    it('a route-titled page wins over a stale title even without unmount cleanup', () => {
        document.title = 'Page not found — InsightsTrack';
        render(<MemoryRouter><TitledRoute name="Realtime"><div /></TitledRoute></MemoryRouter>);
        expect(document.title).toBe('Realtime — InsightsTrack');
    });

    // A parent's effect runs after its children's, so the layout must NOT claim
    // the title for a path it does not know, or it would overwrite the 404 that
    // renders inside it.
    it('leaves the 404 title intact when it renders inside the layout', () => {
        render(
            <MemoryRouter>
                <TitledRoute name={undefined}>
                    <Seoed title="Page not found" />
                </TitledRoute>
            </MemoryRouter>
        );
        expect(document.title).toBe('Page not found — InsightsTrack');
    });
});
