import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Globe, Check, Plus } from 'lucide-react';
import { useSiteStore } from '../../store/useSiteStore';
import { sitesAPI } from '../../services/api';

export default function SiteSwitcher() {
    const { siteId, setSiteId, sites, setSites } = useSiteStore();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const fetchSites = useCallback(async () => {
        try {
            const result = await sitesAPI.list();
            const list = result?.data || result || [];
            setSites(list);
        } catch {
            // silent
        }
    }, [setSites]);

    useEffect(() => { fetchSites(); }, [fetchSites]);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const activeSite = sites.find(s => s.id === siteId);
    const displayName = activeSite?.name || siteId;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                    text-sm font-medium text-text-primary dark:text-text-primary-dark
                    hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
                <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="max-w-[140px] truncate hidden sm:block">{displayName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-1.5 w-56 py-1.5 rounded-xl border
                    border-border dark:border-border-dark
                    bg-card dark:bg-card-dark shadow-xl shadow-black/5 dark:shadow-black/20 z-50">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider
                        text-text-muted dark:text-text-muted-dark">
                        Your Sites
                    </div>

                    {sites.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-text-muted dark:text-text-muted-dark">
                            No sites found
                        </div>
                    )}

                    {sites.map((site) => (
                        <button
                            key={site.id}
                            onClick={() => { setSiteId(site.id); setOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors
                                ${site.id === siteId
                                    ? 'bg-accent/10 text-accent font-medium'
                                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0
                                ${site.id === siteId ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="truncate font-medium text-sm">{site.name}</div>
                                {site.domain && (
                                    <div className="truncate text-[11px] text-text-muted dark:text-text-muted-dark">
                                        {site.domain}
                                    </div>
                                )}
                            </div>
                            {site.id === siteId && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                        </button>
                    ))}

                    <div className="border-t border-border dark:border-border-dark mx-2 my-1.5" />

                    <a
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium
                            text-text-muted dark:text-text-muted-dark
                            hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Manage Sites</span>
                    </a>
                </div>
            )}
        </div>
    );
}
