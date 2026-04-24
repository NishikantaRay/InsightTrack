import { useState } from 'react';
import { useSiteStore } from '../store/useSiteStore';
import { Copy, Check, Code, Server } from 'lucide-react';
import AlertsPanel from '../components/charts/AlertsPanel';
import SiteManager from '../components/ui/SiteManager';
import ErrorBoundary from '../components/ui/ErrorBoundary';

const _raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = /^https?:\/\//i.test(_raw) ? _raw : `https://${_raw}`;

export default function Settings() {
    const { siteId } = useSiteStore();
    const [copied, setCopied] = useState(false);

    const trackingSnippet = `<script src="${API_BASE}/api/sites/${siteId}/script"></script>`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(trackingSnippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = trackingSnippet;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                    Manage your sites and configure tracking
                </p>
            </div>

            {/* Multi-site Manager */}
            <ErrorBoundary fallbackMessage="Failed to load site manager.">
                <SiteManager />
            </ErrorBoundary>

            {/* Tracking Script */}
            {siteId && (
                <div className="card space-y-4">
                    <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-semibold">Tracking Script</h3>
                    </div>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        Copy this snippet and paste it into the <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-[11px]">&lt;head&gt;</code> or before <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-[11px]">&lt;/body&gt;</code> of your website's HTML. Analytics data will appear here once visitors start browsing.
                    </p>

                    <div className="relative">
                        <pre className="px-4 py-3 pr-12 rounded-lg bg-gray-50 dark:bg-white/5 text-xs font-mono text-text-secondary dark:text-text-secondary-dark overflow-x-auto select-all">
                            {trackingSnippet}
                        </pre>
                        <button
                            onClick={handleCopy}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-white dark:bg-white/10 border border-border dark:border-border-dark
                                hover:bg-gray-100 dark:hover:bg-white/20 transition-colors"
                            title="Copy to clipboard"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-accent/5 dark:bg-accent/10 text-xs">
                        <Server className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            <div className="text-text-primary dark:text-text-primary-dark font-medium">
                                Active Site: <span className="font-mono">{siteId}</span>
                            </div>
                            <div className="text-text-muted dark:text-text-muted-dark">
                                API: {API_BASE}/api/analytics/{siteId}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts Section */}
            <ErrorBoundary fallbackMessage="Failed to load alerts.">
                <AlertsPanel />
            </ErrorBoundary>
        </div>
    );
}
