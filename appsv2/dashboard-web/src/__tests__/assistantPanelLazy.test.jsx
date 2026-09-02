import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAssistantStore } from '../store/useAssistantStore';

// AssistantPanel is lazy-loaded from DashboardLayout so that Recharts — which
// it pulls in for Pulse's result cards — stays out of the entry chunk that
// every visitor downloads, blog readers included. A static import would put
// ~430 KB back into first paint without failing any other test, so this file
// guards both halves of the contract: the panel must not render before it is
// opened, and it must still appear once it is.

vi.mock('../services/assistant', () => ({
    getStatus: vi.fn().mockResolvedValue({ available: false, toolCount: 0 }),
    listThreads: vi.fn().mockResolvedValue([]),
    loadThread: vi.fn().mockResolvedValue({ messages: [] }),
    ask: vi.fn(),
}));

const mountLayout = () => render(
    <MemoryRouter>
        <DashboardLayout><div>content</div></DashboardLayout>
    </MemoryRouter>
);

describe('AssistantPanel lazy loading', () => {
    beforeEach(() => {
        // jsdom implements no scrolling, and the panel scrolls its transcript
        // to the bottom on mount. Real browsers have this; without the stub the
        // component throws here for reasons unrelated to what is being tested.
        Element.prototype.scrollTo = vi.fn();
        useAssistantStore.setState({ open: false });
    });

    it('renders the layout without mounting the panel while it is closed', async () => {
        mountLayout();
        // The layout's own content is present immediately — the lazy boundary
        // must not block first paint.
        expect(screen.getByText('content')).toBeInTheDocument();
        // Nothing from the panel is on screen while `open` is false.
        expect(screen.queryByRole('complementary', { name: /pulse/i })).toBeNull();
    });

    it('mounts the panel once it is opened', async () => {
        mountLayout();
        useAssistantStore.setState({ open: true });
        // Resolving the dynamic import is asynchronous, so this waits for the
        // panel's own landmark rather than reading the tree synchronously.
        await waitFor(() => {
            expect(screen.getByRole('complementary', { name: /pulse/i })).toBeInTheDocument();
        });
    });
});
