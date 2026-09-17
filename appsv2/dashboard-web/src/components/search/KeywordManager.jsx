import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { searchKeywordsAPI } from '../../services/api';

/**
 * Map pages → target keywords. This mapping is the JOIN KEY of the whole
 * feature: without it there is nothing to correlate a traffic change against.
 */
export default function KeywordManager({ siteId, open, onClose, onChanged }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [form, setForm] = useState({ path: '', keyword: '' });
    const [suggested, setSuggested] = useState(null);   // null = not loaded yet
    const [suggesting, setSuggesting] = useState(false);

    const load = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await searchKeywordsAPI.list(siteId);
            setRows(res?.data?.data ?? res?.data ?? []);
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    // Suggest keywords for the site's busiest unmapped pages, so the panel is
    // useful immediately instead of presenting a blank form.
    const loadSuggestions = useCallback(async (expand = false) => {
        if (!siteId) return;
        setSuggesting(true);
        try {
            const res = await searchKeywordsAPI.suggest(siteId, expand ? { expand: 1 } : {});
            const data = res?.data?.data ?? res?.data ?? {};
            setSuggested(data.pages ?? []);
        } catch {
            setSuggested([]);   // suggestions are a bonus; never block the form
        } finally {
            setSuggesting(false);
        }
    }, [siteId]);

    useEffect(() => { if (open) { load(); loadSuggestions(); } }, [open, load, loadSuggestions]);

    /** Accept a suggestion — one click maps it. */
    const accept = async (path, keyword) => {
        setError(null);
        try {
            await searchKeywordsAPI.add(siteId, { path, keyword, isPrimary: true });
            await load();
            await loadSuggestions();
            onChanged?.();
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        }
    };

    const add = async (e) => {
        e.preventDefault();
        if (!form.path.trim() || !form.keyword.trim()) return;
        setSaving(true);
        setError(null);
        try {
            await searchKeywordsAPI.add(siteId, {
                path: form.path.trim(),
                keyword: form.keyword.trim(),
                isPrimary: true,
            });
            setForm({ path: '', keyword: '' });
            await load();
            onChanged?.();
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (row) => {
        setError(null);
        try {
            await searchKeywordsAPI.remove(siteId, { path: row.path, keyword: row.keyword, location: row.location });
            await load();
            onChanged?.();
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
            <div className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-xl sm:rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Manage keywords</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Map each page to the keyword it targets — that link is what lets a traffic change be explained.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={add} className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                        value={form.path}
                        onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                        placeholder="/guides/email-templates"
                        aria-label="Page path"
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <input
                        value={form.keyword}
                        onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
                        placeholder="free email templates"
                        maxLength={200}
                        aria-label="Target keyword"
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add
                    </button>
                </form>

                {error && <p className="px-4 pb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

                {/* Suggestions — the answer to "what do I even type here?" */}
                {suggested && suggested.length > 0 && (
                    <div className="px-4 pb-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                                Suggested for your top pages
                            </div>
                            <button type="button" onClick={() => loadSuggestions(true)} disabled={suggesting}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                                {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                More ideas
                            </button>
                        </div>
                        <div className="space-y-2">
                            {suggested.map((p) => (
                                <div key={p.path} className="rounded-lg border border-gray-200 dark:border-gray-800 p-2.5">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={p.path}>
                                        {p.path}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {p.suggestions.map((sg) => (
                                            <button
                                                key={sg.keyword}
                                                type="button"
                                                onClick={() => accept(p.path, sg.keyword)}
                                                title={sg.reason}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs
                                                           border border-indigo-200 dark:border-indigo-800
                                                           text-indigo-700 dark:text-indigo-300
                                                           hover:bg-indigo-50 dark:hover:bg-indigo-900/40"
                                            >
                                                <Plus className="w-3 h-3" aria-hidden="true" />
                                                {sg.keyword}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="px-4 pb-4">
                    {loading ? (
                        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
                    ) : rows.length === 0 ? (
                        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            No keywords mapped yet.
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                            {rows.map((r) => (
                                <li key={`${r.path}-${r.keyword}-${r.location}`} className="flex items-center justify-between gap-3 py-2">
                                    <div className="min-w-0">
                                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{r.path}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            “{r.keyword}” · {r.location}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => remove(r)}
                                        aria-label={`Remove ${r.keyword}`}
                                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
