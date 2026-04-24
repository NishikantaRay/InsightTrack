import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, Globe, Copy, Code } from 'lucide-react';
import toast from 'react-hot-toast';
import { sitesAPI } from '../../services/api';
import { useSiteStore } from '../../store/useSiteStore';

const _raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = /^https?:\/\//i.test(_raw) ? _raw : `https://${_raw}`;

export default function SiteManager() {
    const { siteId, setSiteId, sites, setSites } = useSiteStore();
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDomain, setNewDomain] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [newSiteScript, setNewSiteScript] = useState(null);
    const [copied, setCopied] = useState(false);

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

    useEffect(() => {
        fetchSites();
    }, [fetchSites]);

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

    const handleCopySnippet = async (snippet) => {
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = snippet;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDeleteSite = async (id) => {
        if (id === siteId) { toast.error('Cannot delete the active site'); return; }
        setError(null);
        try {
            await sitesAPI.delete(id);
            await fetchSites();
            toast.success('Site deleted');
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        }
    };

    return (
        <div className="card space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">Manage Sites</h3>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">
                        Add and manage multiple websites
                    </p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium
                        hover:bg-accent-light transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Site
                </button>
            </div>

            {error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            {/* Tracking script for newly created site */}
            {newSiteScript && (
                <div className="border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                            Site "{newSiteScript.name}" created!
                        </span>
                    </div>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        Add this tracking script to your website's HTML to start collecting analytics:
                    </p>
                    <div className="relative">
                        <pre className="px-3 py-2 pr-10 rounded-lg bg-white dark:bg-white/5 border border-border dark:border-border-dark text-xs font-mono text-text-secondary dark:text-text-secondary-dark overflow-x-auto select-all">
                            {newSiteScript.snippet}
                        </pre>
                        <button
                            onClick={() => handleCopySnippet(newSiteScript.snippet)}
                            className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-gray-100 dark:bg-white/10
                                hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                            title="Copy"
                        >
                            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                    </div>
                    <button
                        onClick={() => setNewSiteScript(null)}
                        className="text-xs text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Add site form */}
            {showAdd && (
                <div className="border border-border dark:border-border-dark rounded-lg p-4 space-y-3">
                    <div>
                        <label className="block text-xs text-text-muted dark:text-text-muted-dark mb-1">
                            Site Name
                        </label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="My Website"
                            className="w-full px-3 py-2 rounded-lg border border-border dark:border-border-dark
                                bg-bg dark:bg-bg-dark text-sm
                                focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
                                transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-text-muted dark:text-text-muted-dark mb-1">
                            Domain
                        </label>
                        <input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder="example.com"
                            className="w-full px-3 py-2 rounded-lg border border-border dark:border-border-dark
                                bg-bg dark:bg-bg-dark text-sm
                                focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
                                transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleAddSite}
                            disabled={saving || !newName.trim() || !newDomain.trim()}
                            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium
                                hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? 'Adding...' : 'Add Site'}
                        </button>
                        <button
                            onClick={() => { setShowAdd(false); setNewName(''); setNewDomain(''); }}
                            className="px-4 py-2 rounded-lg border border-border dark:border-border-dark text-sm
                                hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Sites list */}
            {loading ? (
                <div className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">
                    Loading sites...
                </div>
            ) : sites.length === 0 ? (
                <div className="py-4 text-center text-sm text-text-muted dark:text-text-muted-dark">
                    No sites configured
                </div>
            ) : (
                <div className="space-y-2">
                    {sites.map((site) => {
                        const isActive = site.id === siteId;
                        return (
                            <div
                                key={site.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                                    ${isActive
                                        ? 'border-accent bg-accent/5 dark:bg-accent/10'
                                        : 'border-border dark:border-border-dark hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                onClick={() => setSiteId(site.id)}
                            >
                                <div className={`p-2 rounded-lg ${isActive ? 'bg-accent/10' : 'bg-gray-100 dark:bg-white/5'}`}>
                                    <Globe className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-muted dark:text-text-muted-dark'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
                                            {site.name}
                                        </span>
                                        {isActive && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark truncate">
                                            {site.domain}
                                        </span>
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark font-mono">
                                            ({site.id})
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {isActive && <Check className="w-4 h-4 text-accent" />}
                                    {!isActive && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteSite(site.id); }}
                                            className="p-1.5 rounded-md text-text-muted dark:text-text-muted-dark
                                                hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                                            title="Delete site"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
