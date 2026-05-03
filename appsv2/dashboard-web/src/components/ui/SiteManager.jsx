import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, Globe, Copy, Code, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { sitesAPI } from '../../services/api';
import { useSiteStore } from '../../store/useSiteStore';

const _raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = /^https?:\/\//i.test(_raw) ? _raw : `https://${_raw}`;

function CopyInline({ value, label = 'Copy' }) {
    const [copied, setCopied] = useState(false);
    const handle = async (e) => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(value); }
        catch {
            const ta = document.createElement('textarea');
            ta.value = value; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handle}
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border dark:border-border-dark bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 transition-colors text-text-muted dark:text-text-muted-dark"
            title={label}>
            {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
            {copied ? 'Copied' : label}
        </button>
    );
}

export default function SiteManager() {
    const { siteId, setSiteId, sites, setSites } = useSiteStore();
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDomain, setNewDomain] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [newSiteScript, setNewSiteScript] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const fetchSites = useCallback(async () => {
        try {
            setLoading(true);
            const result = await sitesAPI.list();
            setSites(result?.data || result || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [setSites]);

    useEffect(() => { fetchSites(); }, [fetchSites]);

    const validateSite = () => {
        if (!newName.trim()) { toast.error('Site name is required'); return false; }
        if (newName.trim().length < 2) { toast.error('Name must be at least 2 characters'); return false; }
        if (!newDomain.trim()) { toast.error('Domain is required'); return false; }
        const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        if (!domainRegex.test(newDomain.trim())) { toast.error('Please enter a valid domain (e.g. example.com)'); return false; }
        return true;
    };

    const handleAddSite = async () => {
        if (!validateSite()) return;
        setSaving(true);
        setError(null);
        try {
            const result = await sitesAPI.create({ name: newName.trim(), domain: newDomain.trim() });
            const createdSite = result?.data || result;
            const snippet = `<script src="${API_BASE}/api/sites/${createdSite.id}/script"></script>`;
            setNewSiteScript({ id: createdSite.id, name: newName.trim(), snippet });
            setSiteId(createdSite.id);
            setExpandedId(createdSite.id);
            setNewName('');
            setNewDomain('');
            setShowAdd(false);
            await fetchSites();
            toast.success(`Site "${createdSite.name || newName.trim()}" added!`);
        } catch (err) {
            const msg = err.message;
            setError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSite = async (e, id) => {
        e.stopPropagation();
        if (id === siteId) { toast.error('Cannot delete the active site'); return; }
        setError(null);
        try {
            await sitesAPI.delete(id);
            if (expandedId === id) setExpandedId(null);
            await fetchSites();
            toast.success('Site deleted');
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        }
    };

    return (
        <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-border-dark">
                <div>
                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Websites</h3>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">
                        {sites.length} site{sites.length !== 1 ? 's' : ''} configured · click a site to switch or view its tracking snippet
                    </p>
                </div>
                <button onClick={() => { setShowAdd(!showAdd); setError(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-light transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    Add Site
                </button>
            </div>

            <div className="p-4 space-y-3">
                {error && (
                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                {/* New site confirmation banner */}
                {newSiteScript && (
                    <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/15 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                                    ✅ "{newSiteScript.name}" created successfully!
                                </span>
                            </div>
                            <button onClick={() => setNewSiteScript(null)}
                                className="text-xs text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark">
                                Dismiss
                            </button>
                        </div>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark">
                            Paste this script in the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono">&lt;head&gt;</code> of every page on your website:
                        </p>
                        <div className="relative">
                            <pre className="px-3 py-2.5 pr-24 rounded-lg bg-gray-900 text-green-400 text-xs font-mono overflow-x-auto select-all">
                                {newSiteScript.snippet}
                            </pre>
                            <div className="absolute top-2 right-2">
                                <CopyInline value={newSiteScript.snippet} label="Copy snippet" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Add site form */}
                {showAdd && (
                    <div className="border border-border dark:border-border-dark rounded-xl p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
                        <p className="text-xs font-semibold text-text-primary dark:text-text-primary-dark">New Site</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-text-muted dark:text-text-muted-dark mb-1">Site Name</label>
                                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                    placeholder="My Awesome Website"
                                    className="w-full px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-sm
                                        focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs text-text-muted dark:text-text-muted-dark mb-1">Domain <span className="text-text-muted dark:text-text-muted-dark font-normal">(without https://)</span></label>
                                <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)}
                                    placeholder="example.com"
                                    className="w-full px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-sm
                                        focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddSite} disabled={saving || !newName.trim() || !newDomain.trim()}
                                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {saving ? 'Adding…' : 'Add Site'}
                            </button>
                            <button onClick={() => { setShowAdd(false); setNewName(''); setNewDomain(''); setError(null); }}
                                className="px-4 py-2 rounded-lg border border-border dark:border-border-dark text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-text-secondary dark:text-text-secondary-dark">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Sites list */}
                {loading ? (
                    <div className="py-8 text-center text-sm text-text-muted dark:text-text-muted-dark">
                        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-2" />
                        Loading sites…
                    </div>
                ) : sites.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                        <Globe className="w-10 h-10 text-text-muted dark:text-text-muted-dark mx-auto opacity-40" />
                        <p className="text-sm font-medium text-text-muted dark:text-text-muted-dark">No sites yet</p>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark">Click <strong>Add Site</strong> to register your first website</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sites.map((site) => {
                            const isActive = site.id === siteId;
                            const isExpanded = expandedId === site.id;
                            const snippet = `<script src="${API_BASE}/api/sites/${site.id}/script"></script>`;
                            return (
                                <div key={site.id}
                                    className={`rounded-xl border transition-colors overflow-hidden
                                        ${isActive
                                            ? 'border-accent bg-accent/5 dark:bg-accent/10'
                                            : 'border-border dark:border-border-dark hover:bg-gray-50 dark:hover:bg-white/5'}`}>

                                    {/* Site row */}
                                    <div className="flex items-center gap-3 p-3 cursor-pointer"
                                        onClick={() => { setSiteId(site.id); setExpandedId(isExpanded ? null : site.id); }}>
                                        <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-accent/10' : 'bg-gray-100 dark:bg-white/5'}`}>
                                            <Globe className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-muted dark:text-text-muted-dark'}`} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{site.name}</span>
                                                {isActive && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-xs text-text-muted dark:text-text-muted-dark">{site.domain}</span>
                                                <span className="text-[10px] font-mono text-text-muted dark:text-text-muted-dark opacity-60">{site.id}</span>
                                                <CopyInline value={site.id} label="Copy ID" />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {/* Toggle snippet */}
                                            <button onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : site.id); }}
                                                className="p-1.5 rounded-md text-text-muted dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                                title={isExpanded ? 'Hide snippet' : 'Show tracking snippet'}>
                                                <Code className="w-3.5 h-3.5" />
                                            </button>
                                            {/* Delete (non-active only) */}
                                            {!isActive && (
                                                <button onClick={e => handleDeleteSite(e, site.id)}
                                                    className="p-1.5 rounded-md text-text-muted dark:text-text-muted-dark hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                                                    title="Delete site">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {isActive && <Check className="w-4 h-4 text-accent" />}
                                            {isExpanded
                                                ? <ChevronUp className="w-3.5 h-3.5 text-text-muted dark:text-text-muted-dark" />
                                                : <ChevronDown className="w-3.5 h-3.5 text-text-muted dark:text-text-muted-dark" />}
                                        </div>
                                    </div>

                                    {/* Expanded: snippet + quick info */}
                                    {isExpanded && (
                                        <div className="border-t border-border dark:border-border-dark bg-gray-50 dark:bg-gray-800/30 px-4 py-3 space-y-3">
                                            <p className="text-xs text-text-muted dark:text-text-muted-dark">
                                                Paste this inside <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded font-mono">&lt;head&gt;</code> on every page of <strong>{site.domain}</strong>:
                                            </p>
                                            <div className="relative">
                                                <pre className="px-3 py-2.5 pr-24 rounded-lg bg-gray-900 text-green-400 text-[11px] font-mono overflow-x-auto select-all">
                                                    {snippet}
                                                </pre>
                                                <div className="absolute top-2 right-2">
                                                    <CopyInline value={snippet} label="Copy" />
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-[10px] text-text-muted dark:text-text-muted-dark">
                                                <span>Site ID: <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{site.id}</code></span>
                                                <span>Created: {site.created_at ? new Date(site.created_at).toLocaleDateString() : '—'}</span>
                                                <span>Endpoint: <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{API_BASE}/api/analytics/{site.id}</code></span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

