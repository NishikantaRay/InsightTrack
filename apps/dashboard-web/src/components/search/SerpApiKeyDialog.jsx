import { useState, useEffect, useCallback } from 'react';
import { KeyRound, X, Loader2, ExternalLink, ShieldCheck, Trash2, Check, AlertCircle } from 'lucide-react';
import { serpapiKeyAPI } from '../../services/api';

/**
 * Connect a SerpApi key.
 *
 * The key is sent once, encrypted server-side (AES-256-GCM, the same path as
 * Sentry tokens), and never comes back — status reads return a masked hint only.
 * The UI states that plainly, because asking someone to paste a paid API key
 * without saying where it goes is not a reasonable thing to do.
 */
export default function SerpApiKeyDialog({ siteId, open, onClose, onChanged }) {
    const [status, setStatus] = useState(null);
    const [key, setKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    const load = useCallback(async () => {
        if (!siteId) return;
        try {
            const res = await serpapiKeyAPI.getStatus(siteId);
            setStatus(res?.data?.data ?? res?.data ?? null);
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        }
    }, [siteId]);

    useEffect(() => {
        if (open) { setError(null); setSaved(false); setKey(''); load(); }
    }, [open, load]);

    const save = async (e) => {
        e.preventDefault();
        if (!key.trim()) return;
        setBusy(true); setError(null);
        try {
            await serpapiKeyAPI.save(siteId, key.trim());
            setKey(''); setSaved(true);
            await load();
            onChanged?.();
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true); setError(null);
        try {
            await serpapiKeyAPI.remove(siteId);
            setSaved(false);
            await load();
            onChanged?.();
        } catch (err) {
            setError(err?.response?.data?.error || err.message);
        } finally {
            setBusy(false);
        }
    };

    if (!open) return null;

    const connected = status?.connected;
    const fromEnv = status?.source === 'env';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl">
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50">
                            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Connect SerpApi</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Fetches live Google rankings and AI Overview results.
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close"
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Current state, stated plainly */}
                    {connected ? (
                        <div className="flex items-start gap-2 rounded-lg border border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-950/30 p-3">
                            <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                            <div className="text-sm text-green-900 dark:text-green-200">
                                <strong>Connected.</strong> Using key <code className="font-mono">{status.keyHint}</code>
                                {fromEnv && <> from the server's <code className="font-mono">SERPAPI_KEY</code> environment variable.</>}
                                {!fromEnv && <> for this site.</>}
                                {fromEnv && (
                                    <p className="mt-1 text-xs opacity-80">
                                        Saving a key below overrides it for this site only.
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3 text-sm text-gray-700 dark:text-gray-300">
                            <strong>Not connected.</strong> Search Visibility is showing bundled sample
                            results so you can see how it works. Add a key to use real Google data.
                        </div>
                    )}

                    <form onSubmit={save} className="space-y-2">
                        <label htmlFor="serpapi-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {connected && !fromEnv ? 'Replace key' : 'SerpApi key'}
                        </label>
                        <input
                            id="serpapi-key"
                            type="password"
                            value={key}
                            onChange={(e) => { setKey(e.target.value); setSaved(false); }}
                            placeholder="Paste your key from serpapi.com"
                            autoComplete="off"
                            spellCheck="false"
                            className="w-full px-3 py-2 font-mono text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                        {error && (
                            <p className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                                <span>{error}</span>
                            </p>
                        )}
                        {saved && !error && (
                            <p className="text-sm text-green-600 dark:text-green-400">
                                Key saved. Rankings will refresh on the next lookup.
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button type="submit" disabled={busy || !key.trim()}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                Save key
                            </button>
                            {connected && !fromEnv && (
                                <button type="button" onClick={remove} disabled={busy}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 disabled:opacity-50">
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                </button>
                            )}
                        </div>
                    </form>

                    {/* Where the key goes — said before it is asked for, not after */}
                    <div className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            Your key is encrypted (AES-256-GCM) before it is stored, is never sent to the
                            browser again, and is only used to call serpapi.com. Results are cached for
                            24 hours, so repeat views don't spend credits.
                        </p>
                    </div>

                    <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 list-decimal list-inside">
                        <li>
                            Create a free account at{' '}
                            <a href="https://serpapi.com/users/sign_up" target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">
                                serpapi.com <ExternalLink className="w-3 h-3" />
                            </a>{' '}
                            — the free tier includes 100 searches a month.
                        </li>
                        <li>
                            Copy your key from{' '}
                            <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">
                                Manage API Key <ExternalLink className="w-3 h-3" />
                            </a>.
                        </li>
                        <li>Paste it above and save.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
