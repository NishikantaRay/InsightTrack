import { useState, useEffect, useCallback } from 'react';
import { Bug, Check, AlertTriangle, Loader2, Trash2, ExternalLink, Zap, Copy, Plus, Pencil, X } from 'lucide-react';
import { useSiteStore } from '../../store/useSiteStore';
import { sitesAPI } from '../../services/api';

const _raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = /^https?:\/\//i.test(_raw) ? _raw : `https://${_raw}`;
const WEBHOOK_URL = `${API_BASE}/api/integrations/sentry/webhook`;

function CopyField({ label, value }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(value); } catch { /* clipboard blocked */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div>
            <label className="block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1">{label}</label>
            <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate px-3 py-2 text-xs rounded-lg border border-border dark:border-border-dark bg-gray-50 dark:bg-gray-800 text-text-primary dark:text-text-primary-dark font-mono">{value}</code>
                <button type="button" onClick={copy} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border dark:border-border-dark text-xs text-text-secondary dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
        </div>
    );
}

const STATUS_BADGE = {
    ok: { label: 'Connected', cls: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20', Icon: Check },
    pending: { label: 'Pending first poll', cls: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20', Icon: Loader2 },
    error: { label: 'Error', cls: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20', Icon: AlertTriangle },
};

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-white dark:bg-gray-800 text-text-primary dark:text-text-primary-dark placeholder:text-text-muted focus:outline-none focus:border-accent';
const labelCls = 'block text-xs font-medium text-text-secondary dark:text-text-secondary-dark mb-1';

function Feedback({ feedback }) {
    if (!feedback) return null;
    const ok = feedback.type === 'success';
    return (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
            ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-300'
               : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'}`}>
            {ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{feedback.text}</span>
        </div>
    );
}

// A form for connecting a new project or editing an existing one.
function ProjectForm({ siteId, initial, onSaved, onCancel }) {
    const editing = !!initial?.id;
    const [form, setForm] = useState({
        org: initial?.org || '',
        project: initial?.project || '',
        baseUrl: initial?.baseUrl && initial.baseUrl !== 'https://sentry.io' ? initial.baseUrl : '',
        token: '',
    });
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const canSave = form.org.trim() && form.project.trim() && (editing || form.token.trim());

    const save = async () => {
        setSaving(true); setFeedback(null);
        try {
            const payload = { org: form.org.trim(), project: form.project.trim(), baseUrl: form.baseUrl.trim() || undefined };
            if (editing) payload.id = initial.id;
            if (form.token.trim()) payload.token = form.token.trim();
            await sitesAPI.saveSentryIntegration(siteId, payload);
            onSaved(`${editing ? 'Updated' : 'Connected'} ${form.project.trim()}. Issues appear after the next poll.`);
        } catch (err) {
            setFeedback({ type: 'error', text: err?.response?.data?.error || 'Could not save the project.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-lg border border-border dark:border-border-dark p-4 space-y-4 bg-white dark:bg-gray-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Sentry organization slug</label>
                    <input value={form.org} onChange={update('org')} placeholder="my-org" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Project slug</label>
                    <input value={form.project} onChange={update('project')} placeholder="frontend" className={inputCls} />
                </div>
            </div>
            <div>
                <label className={labelCls}>
                    Auth token {editing && <span className="text-text-muted font-normal">(leave blank to keep the current token)</span>}
                </label>
                <input type="password" value={form.token} onChange={update('token')} placeholder={editing ? '•••••••• (stored, encrypted)' : 'sntrys_… from Sentry → Settings → Auth Tokens'} className={inputCls} autoComplete="off" />
                <p className="text-xs text-text-muted dark:text-text-muted-dark mt-1">
                    Needs <code>project:read</code> and <code>event:read</code> scopes. Stored encrypted (AES-256-GCM); never shown again.
                </p>
            </div>
            <div>
                <label className={labelCls}>Instance URL <span className="text-text-muted font-normal">(only for self-hosted Sentry)</span></label>
                <input value={form.baseUrl} onChange={update('baseUrl')} placeholder="https://sentry.io" className={inputCls} />
            </div>
            <Feedback feedback={feedback} />
            <div className="flex items-center gap-2">
                <button onClick={save} disabled={!canSave || saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:opacity-90 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bug className="w-4 h-4" />}
                    {editing ? 'Save changes' : 'Connect project'}
                </button>
                {onCancel && (
                    <button onClick={onCancel} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors">
                        <X className="w-4 h-4" /> Cancel
                    </button>
                )}
            </div>
        </div>
    );
}

// One connected project: status, webhook, edit/test/remove.
function ProjectRow({ siteId, integration, onChanged }) {
    const [editing, setEditing] = useState(false);
    const [testing, setTesting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const badge = STATUS_BADGE[integration.status] || STATUS_BADGE.pending;

    const test = async () => {
        setTesting(true); setFeedback(null);
        try {
            const res = await sitesAPI.testSentryIntegration(siteId, integration.id);
            const n = res?.data?.data?.sampleCount ?? 0;
            setFeedback({ type: 'success', text: `Connection works — Sentry returned ${n} issue(s).` });
            onChanged();
        } catch (err) {
            setFeedback({ type: 'error', text: err?.response?.data?.error || 'Connection test failed.' });
        } finally {
            setTesting(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Disconnect ${integration.project}? Already-synced issues remain until they age out.`)) return;
        setBusy(true);
        try {
            await sitesAPI.deleteSentryIntegration(siteId, integration.id);
            onChanged();
        } catch {
            setFeedback({ type: 'error', text: 'Could not remove the project.' });
            setBusy(false);
        }
    };

    if (editing) {
        return (
            <ProjectForm siteId={siteId} initial={integration}
                onSaved={(msg) => { setEditing(false); onChanged(msg); }}
                onCancel={() => setEditing(false)} />
        );
    }

    return (
        <div className="rounded-lg border border-border dark:border-border-dark p-4 space-y-3 bg-white dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark font-mono">{integration.org}/{integration.project}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}>
                            <badge.Icon className={`w-3 h-3 ${integration.status === 'pending' ? 'animate-spin' : ''}`} />
                            {badge.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted dark:text-text-muted-dark flex-wrap">
                        {integration.tokenHint && <span className="font-mono">token {integration.tokenHint}</span>}
                        {integration.lastSyncedAt && <span>last poll {new Date(integration.lastSyncedAt).toLocaleString()}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={test} disabled={testing} className="p-1.5 rounded-lg border border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors" title="Test connection">{testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}</button>
                    <button onClick={remove} disabled={busy} className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors" title="Disconnect"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {integration.status === 'error' && integration.lastError && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{integration.lastError}</span>
                </div>
            )}
            <Feedback feedback={feedback} />

            {integration.webhookSecret && (
                <details className="group">
                    <summary className="cursor-pointer text-xs text-text-secondary dark:text-text-secondary-dark inline-flex items-center gap-1.5 select-none">
                        <Zap className="w-3.5 h-3.5 text-amber-500" /> Real-time webhook (optional)
                    </summary>
                    <div className="mt-3 space-y-3 pl-1">
                        <p className="text-xs text-text-muted dark:text-text-muted-dark">
                            Add an <strong>Internal Integration webhook</strong> in Sentry (subscribed to <em>issue</em> events) pointed at the URL below, with its secret set to the value below. New/regressed issues then appear within seconds instead of waiting for the poll.
                        </p>
                        <CopyField label="Webhook URL" value={WEBHOOK_URL} />
                        <CopyField label="Webhook secret" value={integration.webhookSecret} />
                    </div>
                </details>
            )}
        </div>
    );
}

export default function SentryIntegration() {
    const siteId = useSiteStore((s) => s.siteId);
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [banner, setBanner] = useState(null);

    const load = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        try {
            const res = await sitesAPI.getSentryIntegrations(siteId);
            const list = res?.data?.data ?? res?.data ?? [];
            setIntegrations(Array.isArray(list) ? list : []);
        } catch {
            setIntegrations([]);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => { setBanner(null); load(); }, [load]);

    const afterChange = (msg) => { setAdding(false); if (msg) setBanner({ type: 'success', text: msg }); load(); };

    if (!siteId) {
        return <p className="text-sm text-text-muted dark:text-text-muted-dark">Select a site first to connect Sentry.</p>;
    }
    if (loading) {
        return <div className="animate-pulse h-40 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    }

    return (
        <div className="space-y-4">
            {banner && <Feedback feedback={banner} />}

            {integrations.length === 0 && !adding && (
                <p className="text-sm text-text-muted dark:text-text-muted-dark">
                    No Sentry projects connected yet. Connect one to see its errors on the Errors page.
                </p>
            )}

            {integrations.map((integration) => (
                <ProjectRow key={integration.id} siteId={siteId} integration={integration} onChanged={afterChange} />
            ))}

            {adding ? (
                <ProjectForm siteId={siteId} onSaved={afterChange} onCancel={() => setAdding(false)} />
            ) : (
                <button onClick={() => { setAdding(true); setBanner(null); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border dark:border-border-dark text-sm font-medium text-text-secondary dark:text-text-secondary-dark hover:border-accent hover:text-accent transition-colors">
                    <Plus className="w-4 h-4" /> {integrations.length ? 'Add another project' : 'Connect a Sentry project'}
                </button>
            )}

            <a href="https://docs.sentry.io/product/accounts/auth-tokens/" target="_blank" rel="noopener noreferrer"
                className="block w-fit inline-flex items-center gap-1 text-xs text-accent hover:opacity-80">
                How to create a Sentry auth token <ExternalLink className="w-3 h-3" />
            </a>
        </div>
    );
}
