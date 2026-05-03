import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ArrowRight, BarChart3, Code, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { sitesAPI } from '../services/api';
import { useSiteStore } from '../store/useSiteStore';

const _raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_BASE = /^https?:\/\//i.test(_raw) ? _raw : `https://${_raw}`;

export default function Onboarding() {
    const navigate = useNavigate();
    const { setSiteId, setSites } = useSiteStore();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [createdSite, setCreatedSite] = useState(null);
    const [copied, setCopied] = useState(false);

    const validateSite = () => {
        if (!name.trim()) { toast.error('Website name is required'); return false; }
        if (name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return false; }
        if (!domain.trim()) { toast.error('Domain is required'); return false; }
        const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain.trim())) { toast.error('Please enter a valid domain (e.g. example.com)'); return false; }
        return true;
    };

    const handleAddSite = async () => {
        if (!validateSite()) return;
        setSaving(true);
        setError(null);
        try {
            const result = await sitesAPI.create({ name: name.trim(), domain: domain.trim() });
            const site = result?.data || result;
            setSiteId(site.id);

            const sitesResult = await sitesAPI.list();
            setSites(sitesResult?.data || sitesResult || []);

            setCreatedSite(site);
            setStep(2);
            toast.success('Site created successfully!');
        } catch (err) {
            const msg = err.message;
            setError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const goToDashboard = () => {
        navigate('/', { replace: true });
    };

    const snippet = createdSite
        ? `<script src="${API_BASE}/api/sites/${createdSite.id}/script"></script>`
        : '';

    return (
        <div className="min-h-screen bg-bg dark:bg-bg-dark flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-text-primary dark:text-text-primary-dark">
                        InsightTrack
                    </span>
                </div>

                {step === 1 && (
                    <div className="bg-card dark:bg-card-dark rounded-2xl border border-border dark:border-border-dark p-8 shadow-sm">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center mx-auto mb-4">
                                <Globe className="w-7 h-7 text-accent" />
                            </div>
                            <h1 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                Add your website
                            </h1>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                                Start tracking your website analytics in under a minute.
                            </p>
                        </div>

                        {error && (
                            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/10 px-4 py-3 rounded-xl mb-4">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1.5">
                                    Website Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="My Website"
                                    autoFocus
                                    className="w-full px-4 py-2.5 rounded-xl border border-border dark:border-border-dark
                                        bg-bg dark:bg-bg-dark text-sm
                                        focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
                                        transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-primary dark:text-text-primary-dark mb-1.5">
                                    Domain
                                </label>
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="example.com"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                                    className="w-full px-4 py-2.5 rounded-xl border border-border dark:border-border-dark
                                        bg-bg dark:bg-bg-dark text-sm
                                        focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
                                        transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleAddSite}
                                disabled={saving || !name.trim() || !domain.trim()}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                    bg-accent text-white text-sm font-medium
                                    hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-colors"
                            >
                                {saving ? 'Creating...' : 'Continue'}
                                {!saving && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && createdSite && (
                    <div className="bg-card dark:bg-card-dark rounded-2xl border border-border dark:border-border-dark p-8 shadow-sm">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                                <Code className="w-7 h-7 text-green-600 dark:text-green-400" />
                            </div>
                            <h1 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                Add tracking script
                            </h1>
                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                                Paste this code into your website's <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-xs">&lt;head&gt;</code> tag to start collecting data.
                            </p>
                        </div>

                        <div className="relative mb-6">
                            <pre className="px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-white/5 border border-border dark:border-border-dark text-xs font-mono text-text-secondary dark:text-text-secondary-dark overflow-x-auto select-all whitespace-pre-wrap break-all">
                                {snippet}
                            </pre>
                            <button
                                onClick={() => handleCopy(snippet)}
                                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white dark:bg-white/10
                                    border border-border dark:border-border-dark
                                    hover:bg-gray-100 dark:hover:bg-white/20 transition-colors"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        <div className="space-y-3 mb-6 text-xs text-text-secondary dark:text-text-secondary-dark">
                            <div className="flex items-start gap-2">
                                <span className="font-mono text-accent font-bold mt-px">1</span>
                                <span>Copy the script tag above</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="font-mono text-accent font-bold mt-px">2</span>
                                <span>Paste it inside your website's <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10">&lt;head&gt;</code> tag</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="font-mono text-accent font-bold mt-px">3</span>
                                <span>Data will appear in the dashboard as visitors browse your site</span>
                            </div>
                        </div>

                        <button
                            onClick={goToDashboard}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                bg-accent text-white text-sm font-medium
                                hover:bg-accent-light transition-colors"
                        >
                            Go to Dashboard
                            <ArrowRight className="w-4 h-4" />
                        </button>

                        <button
                            onClick={goToDashboard}
                            className="w-full mt-2 text-xs text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark text-center py-2"
                        >
                            I'll add the script later
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
