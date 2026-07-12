import { useEffect, useState } from 'react';
import { Plug, Plus, Copy, Check, Loader2, AlertCircle, Trash2, Terminal, Globe } from 'lucide-react';
import { listConnections, createConnection, revokeConnection } from '../../services/aiSettings';

/**
 * Settings → AI → Connect a client. Issues revocable connect tokens users paste
 * into Claude Desktop / Cursor to use InsightTrack's tools over MCP.
 */
export default function MCPConnect() {
    const [conns, setConns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [label, setLabel] = useState('');
    const [fresh, setFresh] = useState(null); // freshly-issued { token, config, apiUrl }
    const [copied, setCopied] = useState('');

    const load = () => listConnections().then(setConns).catch((e) => setError(e.message)).finally(() => setLoading(false));
    useEffect(() => { load(); }, []);

    const create = async () => {
        setCreating(true); setError('');
        try {
            const d = await createConnection(label.trim() || 'MCP client');
            setFresh(d); setLabel('');
            load();
        } catch (e) { setError(e.message); }
        finally { setCreating(false); }
    };

    const revoke = async (jti) => {
        try { await revokeConnection(jti); load(); if (fresh?.jti === jti) setFresh(null); }
        catch (e) { setError(e.message); }
    };

    const copy = async (text, which) => {
        try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
        setCopied(which); setTimeout(() => setCopied(''), 2000);
    };

    const configText = fresh ? JSON.stringify(fresh.config, null, 2) : '';
    const remoteText = fresh?.remoteConfig ? JSON.stringify(fresh.remoteConfig, null, 2) : '';

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark p-4">
                <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0"><Plug className="w-4 h-4 text-indigo-500" /></div>
                <div className="text-sm">
                    <p className="font-medium text-text-primary dark:text-text-primary-dark">Use InsightTrack in Claude Desktop &amp; Cursor</p>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">
                        Generate a connect token and paste the config into your MCP client. The same read-only
                        analytics tools become available there. Revoke anytime.
                    </p>
                </div>
            </div>

            {/* Create */}
            <div className="flex items-center gap-2">
                <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Label (e.g. My laptop — Claude Desktop)"
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-border dark:border-border-dark
                        bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                        focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none placeholder:text-text-muted"
                />
                <button onClick={create} disabled={creating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                        bg-accent hover:bg-accent/90 disabled:opacity-50 transition-colors shrink-0">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Connect
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
            )}

            {/* Freshly-issued config (shown once) */}
            {fresh && (
                <div className="rounded-xl border border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
                        <Check className="w-4 h-4" /> Connection created — copy this now, the token won’t be shown again.
                    </div>

                    {/* Remote (recommended) — URL + bearer token, no local install (N1) */}
                    {remoteText && (
                        <div className="relative">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted dark:text-text-muted-dark mb-1">
                                <Globe className="w-3.5 h-3.5" /> Remote (recommended — connects over HTTP, no install)
                            </div>
                            <pre className="text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg bg-gray-900 text-gray-100 font-mono">{remoteText}</pre>
                            <button onClick={() => copy(remoteText, 'remote')}
                                className="absolute top-7 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]
                                    bg-white/10 hover:bg-white/20 text-gray-100 transition-colors">
                                {copied === 'remote' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copied === 'remote' ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                    )}

                    <div className="relative">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted dark:text-text-muted-dark mb-1">
                            <Terminal className="w-3.5 h-3.5" /> Local (stdio) — for clients without remote MCP support
                        </div>
                        <pre className="text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg bg-gray-900 text-gray-100 font-mono">{configText}</pre>
                        <button onClick={() => copy(configText, 'config')}
                            className="absolute top-7 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]
                                bg-white/10 hover:bg-white/20 text-gray-100 transition-colors">
                            {copied === 'config' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied === 'config' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    {fresh.note && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{fresh.note}</span>
                        </div>
                    )}
                    <button onClick={() => copy(fresh.token, 'token')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg
                            border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark
                            hover:bg-white dark:hover:bg-white/5 transition-colors">
                        {copied === 'token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy token only
                    </button>
                </div>
            )}

            {/* Existing connections */}
            <div>
                <p className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">Your connections</p>
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-text-muted dark:text-text-muted-dark"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                ) : conns.length === 0 ? (
                    <p className="text-sm text-text-muted dark:text-text-muted-dark">No connections yet.</p>
                ) : (
                    <div className="space-y-2">
                        {conns.map((c) => (
                            <div key={c.jti} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark truncate">
                                        {c.label || 'MCP client'}
                                        {c.revoked_at && <span className="ml-2 text-[11px] text-red-500">revoked</span>}
                                    </p>
                                    <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                                        Created {new Date(c.created_at).toLocaleDateString()}
                                        {c.last_used_at && ` · last used ${new Date(c.last_used_at).toLocaleDateString()}`}
                                    </p>
                                </div>
                                {!c.revoked_at && (
                                    <button onClick={() => revoke(c.jti)} title="Revoke"
                                        className="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
