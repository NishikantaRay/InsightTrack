import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, ArrowUp, Loader2, Trash2, AlertCircle, Plus, HelpCircle,
    Copy, Check, FileText, Globe, Filter, Users, CornerDownLeft,
    History, Maximize2, Minimize2, RotateCcw,
} from 'lucide-react';
import { useAssistantStore } from '../../store/useAssistantStore';
import { useSiteStore } from '../../store/useSiteStore';
import {
    streamChat, loadThreadFromServer, getAssistantStatus, listThreads, deleteThread,
} from '../../services/assistantStream';
import ResultCard from './ResultCard';
import Markdown from './Markdown';

// Quiet, grouped starter prompts. Icons are muted; nothing shouts.
const SUGGESTIONS = [
    { icon: FileText, label: 'Top pages last 7 days', prompt: 'What were my top pages in the last 7 days?' },
    { icon: Globe, label: 'Where does my traffic come from?', prompt: 'Where does my traffic come from? Break it down by source.' },
    { icon: Filter, label: 'How is my conversion funnel doing?', prompt: 'How is my conversion funnel doing?' },
    { icon: Users, label: 'Audience by country', prompt: 'Show me my audience broken down by country.' },
];

/**
 * Pulse's brand mark: a tiny live waveform. Bars breathe when `active`
 * (thinking / streaming), and rest at low amplitude when idle.
 * Keyframes live in index.css (`pulse-wave`).
 */
const Waveform = ({ active = true, size = 'sm', className = '' }) => {
    const heights = size === 'lg' ? [14, 28, 42, 28, 14] : [5, 9, 13, 9, 5];
    const barW = size === 'lg' ? 'w-[5px]' : 'w-[3px]';
    return (
        <span className={`inline-flex items-end gap-[3px] ${className}`} aria-hidden="true">
            {heights.map((h, i) => (
                <span
                    key={i}
                    className={`${barW} rounded-full origin-bottom bg-gradient-to-t from-accent via-violet-500 to-emerald-400
                        ${active ? '' : 'opacity-40'}`}
                    style={{
                        height: h,
                        animation: active ? `pulse-wave 1.15s ease-in-out ${i * 0.12}s infinite` : 'none',
                    }}
                />
            ))}
        </span>
    );
};

/**
 * Live connection badge — a green dot that pulses while a provider is
 * connected (shows which one), or a muted "offline" pill that links to setup.
 */
const LiveBadge = ({ status, onConfigure }) => {
    const on = Boolean(status?.available);
    const provider = status?.effectiveProvider || status?.serverProvider;
    const providerLabel = { anthropic: 'Claude', openai: 'GPT', gemini: 'Gemini' }[provider] || provider;
    if (on) {
        return (
            <span className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                title={`Connected${providerLabel ? ` — ${providerLabel}` : ''} · live data`}>
                <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-semibold tracking-wide">
                    Live{providerLabel ? ` · ${providerLabel}` : ''}
                </span>
            </span>
        );
    }
    return (
        <button onClick={onConfigure} title="No AI provider connected — click to configure"
            className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-0.5 rounded-full
                bg-gray-100 dark:bg-white/[0.06] text-text-muted dark:text-text-muted-dark hover:text-accent transition-colors">
            <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-white/25" />
            <span className="text-[11px] font-medium">Offline</span>
        </button>
    );
};

// Group sessions into Today / Yesterday / Previous 7 days / Earlier by updated_at.
function groupSessions(threads) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = 86400000;
    const buckets = { Today: [], Yesterday: [], 'Previous 7 days': [], Earlier: [] };
    for (const t of threads) {
        const ts = new Date(t.updated_at).getTime();
        if (ts >= startOfToday) buckets.Today.push(t);
        else if (ts >= startOfToday - day) buckets.Yesterday.push(t);
        else if (ts >= startOfToday - 7 * day) buckets['Previous 7 days'].push(t);
        else buckets.Earlier.push(t);
    }
    return Object.entries(buckets).filter(([, list]) => list.length > 0);
}

// Compact clock time / short date for a session row.
function sessionTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
        ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AssistantPanel() {
    const { open, width, setWidth, closePanel, messages, addMessage, updateMessage, busy, setBusy,
        clear, newThread, threadId, setThreadId, loadThread, maximized, toggleMaximize } = useAssistantStore();
    const siteId = useSiteStore((s) => s.siteId);
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [status, setStatus] = useState(null); // { available, serverProvider, toolCount }
    const [copiedId, setCopiedId] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [threads, setThreads] = useState(null); // null = not loaded, [] = empty
    const abortRef = useRef(null);
    const scrollRef = useRef(null);
    const taRef = useRef(null);
    const resizing = useRef(false);
    const loadedRef = useRef(false);
    const historyRef = useRef(null);
    const lastQuestionRef = useRef('');

    // autoscroll on new content
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, busy]);

    // auto-grow the textarea
    useEffect(() => {
        const ta = taRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }, [input]);

    // drag-to-resize (flexible width)
    useEffect(() => {
        const onMove = (e) => { if (resizing.current) setWidth(window.innerWidth - e.clientX); };
        const onUp = () => { resizing.current = false; document.body.style.userSelect = ''; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [setWidth]);

    // Esc closes the panel
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape' && !busy) closePanel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, busy, closePanel]);

    // On open: check provider status + hydrate the last conversation from the server.
    useEffect(() => {
        if (!open) return;
        getAssistantStatus().then(setStatus);
        if (loadedRef.current) return;
        loadedRef.current = true;
        if (!threadId || useAssistantStore.getState().messages.length > 0) return;
        loadThreadFromServer(threadId).then((data) => {
            if (data) loadThread(data.thread.id, data.messages);
            else setThreadId(null); // thread gone — start fresh
        }).catch(() => {});
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // `resend` re-runs the last question after an error: it does NOT add a new
    // user bubble (reusing the one already on screen) and streams a fresh reply.
    const send = (text, { resend = false } = {}) => {
        const q = (text ?? input).trim();
        if (!q || busy || !siteId) return;
        setError('');
        if (!resend) {
            setInput('');
            addMessage({ role: 'user', text: q });
        }
        lastQuestionRef.current = q;
        const assistantId = addMessage({ role: 'assistant', text: '', streaming: true });
        setBusy(true);

        // build the message history for the API (plain user/assistant text turns).
        // The just-added empty streaming turn and any prior empty assistant turns
        // are excluded (they carry no text).
        const history = [...useAssistantStore.getState().messages]
            .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text))
            .map((m) => ({ role: m.role, content: m.text }));

        abortRef.current = streamChat({ siteId, messages: history, threadId }, (event, data) => {
            if (event === 'thread') setThreadId(data.threadId);
            else if (event === 'text') updateMessage(assistantId, { appendText: data.delta });
            else if (event === 'tool') updateMessage(assistantId, { addCard: data.envelope });
            else if (event === 'error') { setError(data.message); updateMessage(assistantId, { streaming: false, failed: true }); setBusy(false); }
            else if (event === 'done') { updateMessage(assistantId, { streaming: false }); setBusy(false); }
        });
    };

    // Retry the last question: drop the failed empty assistant turn, then resend.
    const retry = () => {
        const msgs = useAssistantStore.getState().messages;
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant' && !last.text) {
            loadThread(threadId, msgs.slice(0, -1).map((m) => ({ role: m.role, text: m.text, cards: m.cards })));
        }
        if (lastQuestionRef.current) send(lastQuestionRef.current, { resend: true });
    };

    const stop = () => { abortRef.current?.abort(); setBusy(false); };
    const startNew = () => { abortRef.current?.abort(); setBusy(false); setError(''); setInput(''); newThread(); };
    // The help / "Setup & guide" affordances open the Documentation page (Pulse section).
    const goToGuide = () => { closePanel(); navigate('/docs'); };
    // The "configure AI" affordance opens Settings → AI tab.
    const goToSettings = () => { closePanel(); navigate('/settings?tab=ai'); };

    // ── Thread history (P2.2) ──
    const toggleHistory = async () => {
        const next = !historyOpen;
        setHistoryOpen(next);
        if (next) setThreads(await listThreads());   // refresh each open
    };
    const openThread = async (id) => {
        setHistoryOpen(false);
        if (id === threadId) return;
        abortRef.current?.abort(); setBusy(false); setError('');
        const data = await loadThreadFromServer(id);
        if (data) loadThread(data.thread.id, data.messages);
        else { setThreadId(null); setThreads(await listThreads()); } // gone — refresh
    };
    const removeThread = async (e, id) => {
        e.stopPropagation();
        if (!(await deleteThread(id))) return;
        setThreads((ts) => (ts || []).filter((t) => t.id !== id));
        if (id === threadId) newThread(); // deleted the open one → reset
    };

    // Close the history dropdown on outside click / Esc.
    useEffect(() => {
        if (!historyOpen) return;
        const onDown = (e) => { if (!historyRef.current?.contains(e.target)) setHistoryOpen(false); };
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [historyOpen]);

    const copyMessage = async (id, text) => {
        try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
        setCopiedId(id); setTimeout(() => setCopiedId(null), 1500);
    };

    if (!open) return null;

    const noProvider = status && !status.available;
    const empty = messages.length === 0;
    // In full-page mode the content sits in a centered reading column.
    const centered = maximized ? 'max-w-3xl mx-auto w-full' : '';

    // Minimal, quiet icon button used across the header.
    const IconBtn = ({ onClick, disabled, title, danger, children }) => (
        <button onClick={onClick} disabled={disabled} title={title} aria-label={title}
            className={`w-8 h-8 grid place-items-center rounded-lg text-text-muted dark:text-text-muted-dark
                hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent
                ${danger ? 'hover:text-red-500' : 'hover:text-text-primary dark:hover:text-text-primary-dark'} transition-colors`}>
            {children}
        </button>
    );

    return (
        <>
            {/* Mobile backdrop */}
            <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40 lg:hidden" onClick={closePanel} aria-hidden="true" />

            <aside
                className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-card dark:bg-card-dark
                    border-l border-border dark:border-border-dark shadow-[-8px_0_40px_-16px_rgba(0,0,0,0.25)]
                    w-full ${maximized ? 'sm:w-full' : 'sm:w-[var(--w)]'}`}
                style={{ '--w': `${width}px` }}
                role="complementary"
                aria-label="Pulse — AI analyst"
            >
                {/* Resize handle (desktop, hidden in full-page mode) */}
                {!maximized && (
                    <div
                        onMouseDown={() => { resizing.current = true; document.body.style.userSelect = 'none'; }}
                        className="hidden sm:block absolute left-0 top-0 h-full w-1 -ml-0.5 cursor-col-resize group z-10"
                        aria-hidden="true"
                    >
                        <div className="absolute inset-y-0 left-0 w-px bg-transparent group-hover:bg-accent/50 transition-colors" />
                    </div>
                )}

                {/* Header — brand mark + gradient hairline */}
                <header className="shrink-0">
                    <div className="h-[52px] flex items-center gap-2.5 pl-4 pr-2">
                        <Waveform active={busy} />
                        <h2 className="text-[15px] font-semibold text-text-primary dark:text-text-primary-dark tracking-tight">
                            Pulse
                        </h2>
                        <LiveBadge status={status} onConfigure={goToSettings} />
                        <div className="flex-1" />

                        {/* Thread history (P2.2) — dropdown of saved conversations */}
                        <div className="relative" ref={historyRef}>
                            <IconBtn onClick={toggleHistory} title="Session history">
                                <History className="w-[18px] h-[18px]" />
                            </IconBtn>
                            {historyOpen && (
                                <div className="absolute right-0 top-10 z-20 w-80 max-h-[26rem] overflow-y-auto rounded-xl
                                    border border-border dark:border-border-dark bg-card dark:bg-card-dark shadow-lg">
                                    <div className="sticky top-0 px-3 py-2 bg-card dark:bg-card-dark border-b border-border dark:border-border-dark">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted dark:text-text-muted-dark">
                                            Sessions
                                        </span>
                                    </div>
                                    {threads == null ? (
                                        <div className="px-3 py-6 flex items-center justify-center text-text-muted dark:text-text-muted-dark">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        </div>
                                    ) : threads.length === 0 ? (
                                        <p className="px-3 py-6 text-xs text-text-muted dark:text-text-muted-dark text-center">
                                            No sessions yet — ask Pulse a question to start one.
                                        </p>
                                    ) : (
                                        <div className="py-1">
                                            {groupSessions(threads).map(([label, list]) => (
                                                <div key={label}>
                                                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">
                                                        {label}
                                                    </div>
                                                    {list.map((t) => (
                                                        <button key={t.id} onClick={() => openThread(t.id)}
                                                            className={`group w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors
                                                                hover:bg-gray-100 dark:hover:bg-white/[0.06]
                                                                ${t.id === threadId ? 'bg-accent/5' : ''}`}>
                                                            <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${t.id === threadId ? 'bg-accent' : 'bg-gray-300 dark:bg-white/20'}`} />
                                                            <span className="flex-1 min-w-0">
                                                                <span className="block truncate text-[13px] font-medium text-text-primary dark:text-text-primary-dark">
                                                                    {t.title || t.first_prompt || 'Untitled session'}
                                                                </span>
                                                                <span className="block truncate text-[11px] text-text-muted dark:text-text-muted-dark mt-0.5">
                                                                    {sessionTime(t.updated_at)}
                                                                    {t.message_count ? ` · ${t.message_count} message${t.message_count === 1 ? '' : 's'}` : ''}
                                                                </span>
                                                            </span>
                                                            <span
                                                                role="button" tabIndex={0} aria-label="Delete session"
                                                                onClick={(e) => removeThread(e, t.id)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') removeThread(e, t.id); }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md shrink-0 self-center
                                                                    text-text-muted dark:text-text-muted-dark hover:text-red-500 transition">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <IconBtn onClick={startNew} disabled={empty && !busy} title="New chat">
                            <Plus className="w-[18px] h-[18px]" />
                        </IconBtn>
                        <IconBtn onClick={toggleMaximize} title={maximized ? 'Exit full page' : 'Full page'}>
                            {maximized
                                ? <Minimize2 className="w-[17px] h-[17px]" />
                                : <Maximize2 className="w-[17px] h-[17px]" />}
                        </IconBtn>
                        <IconBtn onClick={goToGuide} title="Setup & guide">
                            <HelpCircle className="w-[18px] h-[18px]" />
                        </IconBtn>
                        {!empty && (
                            <IconBtn onClick={clear} title="Clear conversation" danger>
                                <Trash2 className="w-4 h-4" />
                            </IconBtn>
                        )}
                        <IconBtn onClick={closePanel} title="Close">
                            <X className="w-[18px] h-[18px]" />
                        </IconBtn>
                    </div>
                    {/* Signal hairline — Pulse's signature line */}
                    <div className="h-px bg-gradient-to-r from-accent/70 via-violet-500/40 to-emerald-400/50" />
                </header>

                {/* Body */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                    {/* No AI provider */}
                    {noProvider && empty && (
                        <div className={`px-5 pt-8 ${centered}`}>
                            <div className="rounded-xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark p-5">
                                <Waveform active={false} className="mb-3" />
                                <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1">Bring Pulse online</p>
                                <p className="text-[13px] text-text-muted dark:text-text-muted-dark leading-relaxed mb-4">
                                    Pulse needs an Anthropic, OpenAI, or Google (Gemini) key. Add your own — it’s stored encrypted and never leaves your server.
                                </p>
                                <button onClick={goToSettings}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
                                    Add a key in Settings <CornerDownLeft className="w-3.5 h-3.5 rotate-90" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Empty state — the pulse of your site */}
                    {!noProvider && empty && (
                        <div className={`px-5 pt-10 pb-4 ${centered}`}>
                            <Waveform size="lg" className="mb-5" />
                            <h3 className="text-[22px] font-semibold text-text-primary dark:text-text-primary-dark tracking-tight leading-snug">
                                What’s the pulse of your site?
                            </h3>
                            <p className="text-[14px] text-text-muted dark:text-text-muted-dark mt-1.5 leading-relaxed">
                                Ask in plain English — Pulse answers with live charts, tables, and CSVs from this site’s data.
                            </p>

                            <div className="mt-7 grid gap-2">
                                {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                                    <button key={label} onClick={() => send(prompt)} disabled={!siteId}
                                        className="group w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left
                                            border border-border dark:border-border-dark
                                            hover:border-accent/50 hover:bg-accent/[0.04] disabled:opacity-40 transition-colors">
                                        <span className="w-7 h-7 grid place-items-center rounded-lg bg-accent/10 text-accent shrink-0">
                                            <Icon className="w-4 h-4" />
                                        </span>
                                        <span className="flex-1 text-[14px] text-text-secondary dark:text-text-secondary-dark group-hover:text-text-primary dark:group-hover:text-text-primary-dark transition-colors">
                                            {label}
                                        </span>
                                        <ArrowUp className="w-4 h-4 rotate-45 text-accent opacity-0 group-hover:opacity-70 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conversation */}
                    {!empty && (
                        <div className={`px-4 py-5 space-y-5 ${centered}`}>
                            {messages.map((m) => (
                                m.role === 'user' ? (
                                    <div key={m.id} className="group flex justify-end items-center gap-1.5">
                                        <button onClick={() => send(m.text, { resend: true })} disabled={busy || !siteId}
                                            title="Ask again" aria-label="Ask this again"
                                            className="opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 grid place-items-center rounded-lg
                                                text-text-muted dark:text-text-muted-dark hover:text-accent hover:bg-gray-100 dark:hover:bg-white/[0.06]
                                                disabled:opacity-0 transition-all">
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/[0.08] dark:bg-accent/[0.14]
                                            text-text-primary dark:text-text-primary-dark px-3.5 py-2 text-[14px] leading-relaxed">
                                            {m.text}
                                        </div>
                                    </div>
                                ) : (
                                    <div key={m.id} className="group">
                                        <div className="text-[14px] text-text-primary dark:text-text-primary-dark leading-relaxed">
                                            <Markdown text={m.text} />
                                            {m.streaming && !m.text && (
                                                <span className="inline-flex items-center gap-2 text-text-muted dark:text-text-muted-dark">
                                                    <Waveform /> Reading your data…
                                                </span>
                                            )}
                                            {m.streaming && m.text && <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-accent/70 animate-pulse rounded-sm" />}
                                        </div>
                                        {(m.cards || []).map((c, i) => <ResultCard key={i} envelope={c} />)}
                                        {m.text && !m.streaming && (
                                            <button onClick={() => copyMessage(m.id, m.text)}
                                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-text-muted dark:text-text-muted-dark
                                                    opacity-0 group-hover:opacity-100 hover:text-text-primary dark:hover:text-text-primary-dark transition-all">
                                                {copiedId === m.id ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                                            </button>
                                        )}
                                    </div>
                                )
                            ))}

                            {error && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-900/40 text-[13px] text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <span>{error}</span>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            {lastQuestionRef.current && !busy && (
                                                <button onClick={retry}
                                                    className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400 hover:underline">
                                                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                                                </button>
                                            )}
                                            {noProvider && (
                                                <button onClick={goToSettings} className="font-medium underline hover:no-underline">Configure AI in Settings →</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Composer — single rounded field, quiet */}
                <div className={`shrink-0 px-3 pt-2 pb-3 ${centered}`}>
                    <div className="flex items-end gap-1.5 rounded-2xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark
                        focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10 transition-all pl-3 pr-1.5 py-1.5">
                        <textarea
                            ref={taRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                            placeholder={siteId ? 'Ask Pulse about your analytics…' : 'Select a site first'}
                            rows={1}
                            disabled={!siteId}
                            aria-label="Message Pulse"
                            className="flex-1 resize-none max-h-40 py-1 text-[14px] bg-transparent leading-relaxed
                                text-text-primary dark:text-text-primary-dark outline-none placeholder:text-text-muted"
                        />
                        {busy ? (
                            <button onClick={stop} title="Stop" aria-label="Stop generating"
                                className="shrink-0 w-8 h-8 grid place-items-center rounded-xl bg-text-primary dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-opacity">
                                <span className="w-2.5 h-2.5 rounded-[3px] bg-current" />
                            </button>
                        ) : (
                            <button onClick={() => send()} disabled={!input.trim() || !siteId} title="Send" aria-label="Send message"
                                className="shrink-0 w-8 h-8 grid place-items-center rounded-xl text-white
                                    bg-gradient-to-br from-accent to-violet-600 enabled:hover:brightness-110
                                    disabled:bg-none disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-text-muted transition-all">
                                <ArrowUp className="w-[18px] h-[18px]" />
                            </button>
                        )}
                    </div>
                    <p className="text-[11px] text-text-muted dark:text-text-muted-dark mt-2 text-center">
                        Pulse answers from live data — verify big decisions. <button onClick={goToGuide} className="underline hover:text-text-secondary dark:hover:text-text-secondary-dark">Guide</button>
                    </p>
                </div>
            </aside>
        </>
    );
}
