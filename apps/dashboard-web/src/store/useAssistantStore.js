import { create } from 'zustand';

/**
 * AI Analyst panel state. The panel is a flexible, resizable right-side drawer.
 * Conversations persist server-side (Phase 4): `threadId` ties the session to a
 * saved thread; the server returns/creates it on the first turn via the 'thread'
 * SSE event. The last-used thread id is remembered in localStorage so reopening
 * the panel resumes the conversation.
 *
 * A message: { id, role: 'user'|'assistant', text, cards?: [envelope], streaming? }
 */
const WIDTH_KEY = 'assistant-panel-width';
const MAX_KEY = 'assistant-panel-maximized';
const THREAD_KEY = 'assistant-thread-id';
const clampWidth = (w) => Math.max(320, Math.min(720, w));

export const useAssistantStore = create((set, get) => ({
    open: false,
    width: clampWidth(parseInt(localStorage.getItem(WIDTH_KEY)) || 400),
    maximized: localStorage.getItem(MAX_KEY) === '1',
    messages: [],
    busy: false,
    threadId: (() => { const v = localStorage.getItem(THREAD_KEY); return v ? Number(v) : null; })(),

    toggle: () => set((s) => ({ open: !s.open })),
    openPanel: () => set({ open: true }),
    closePanel: () => set({ open: false }),

    // Full-page mode — the drawer expands to cover the whole viewport.
    toggleMaximize: () =>
        set((s) => {
            const maximized = !s.maximized;
            localStorage.setItem(MAX_KEY, maximized ? '1' : '0');
            return { maximized };
        }),

    setWidth: (w) => {
        const width = clampWidth(w);
        localStorage.setItem(WIDTH_KEY, String(width));
        set({ width });
    },

    // Record the server-side thread id (from the 'thread' SSE event).
    setThreadId: (id) => {
        if (id == null) localStorage.removeItem(THREAD_KEY);
        else localStorage.setItem(THREAD_KEY, String(id));
        set({ threadId: id ?? null });
    },

    // Load a saved thread's messages into the panel.
    loadThread: (id, messages) =>
        set({
            threadId: id,
            messages: (messages || []).map((m) => ({
                id: crypto.randomUUID(),
                role: m.role,
                text: m.text || '',
                cards: Array.isArray(m.cards) ? m.cards : [],
            })),
        }),

    // Start a fresh conversation (drops thread + messages).
    newThread: () => { localStorage.removeItem(THREAD_KEY); set({ threadId: null, messages: [] }); },

    setBusy: (busy) => set({ busy }),
    clear: () => { localStorage.removeItem(THREAD_KEY); set({ messages: [], threadId: null }); },

    // Add a message, returns its id.
    addMessage: (msg) => {
        const id = crypto.randomUUID();
        set((s) => ({ messages: [...s.messages, { id, cards: [], ...msg }] }));
        return id;
    },

    // Patch a message in place (append text, add a card, flip streaming off…).
    updateMessage: (id, patch) =>
        set((s) => ({
            messages: s.messages.map((m) =>
                m.id === id
                    ? {
                          ...m,
                          ...patch,
                          text: patch.appendText != null ? (m.text || '') + patch.appendText : patch.text ?? m.text,
                          cards: patch.addCard ? [...(m.cards || []), patch.addCard] : patch.cards ?? m.cards,
                      }
                    : m
            ),
        })),
}));
