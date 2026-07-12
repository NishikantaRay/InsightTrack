import { useEffect, useState } from 'react';
import { Sparkles, Key, Check, Loader2, AlertCircle, Trash2, ShieldCheck } from 'lucide-react';
import { getAISettings, saveAISettings } from '../../services/aiSettings';

const PROVIDERS = [
    { id: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-…', help: 'Get a key at console.anthropic.com' },
    { id: 'openai', label: 'OpenAI (GPT)', placeholder: 'sk-…', help: 'Get a key at platform.openai.com' },
    { id: 'gemini', label: 'Google (Gemini)', placeholder: 'AIza…', help: 'Get a key at aistudio.google.com/apikey' },
];

const MODEL_PLACEHOLDERS = {
    anthropic: 'claude-sonnet-5',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.5-flash',
};

/**
 * Settings → AI. Lets a user pick the provider and paste their own API key
 * (stored encrypted server-side). Falls back to the server key when none is set.
 */
export default function AISettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [settings, setSettings] = useState(null); // server view
    const [provider, setProvider] = useState('anthropic');
    const [model, setModel] = useState('');
    const [keyInput, setKeyInput] = useState(''); // new key to store (write-only)

    useEffect(() => {
        getAISettings()
            .then((d) => {
                setSettings(d);
                setProvider(d.provider || d.serverProvider || 'anthropic');
                setModel(d.model || '');
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const refresh = (d) => { setSettings(d); setKeyInput(''); setSaved(true); setTimeout(() => setSaved(false), 2500); };

    const save = async () => {
        setSaving(true); setError('');
        try {
            const payload = { provider, model: model.trim() || undefined };
            if (keyInput.trim()) payload.key = keyInput.trim(); // only send when the user typed a new one
            const d = await saveAISettings(payload);
            refresh({ ...settings, ...d, usingOwnKey: d.hasKey, effectiveProvider: d.hasKey ? d.provider : settings?.serverProvider });
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    const clearKey = async () => {
        setSaving(true); setError('');
        try {
            const d = await saveAISettings({ provider, model: model.trim() || undefined, key: '' });
            refresh({ ...settings, ...d, usingOwnKey: false, effectiveProvider: settings?.serverProvider });
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    if (loading) {
        return <div className="flex items-center gap-2 text-sm text-text-muted dark:text-text-muted-dark p-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading AI settings…
        </div>;
    }

    const active = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
    const serverHasKey = !!settings?.serverProvider;

    return (
        <div className="space-y-6">
            {/* Status banner */}
            <div className="flex items-start gap-3 rounded-xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark p-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 text-sm">
                    {settings?.effectiveProvider ? (
                        <>
                            <p className="font-medium text-text-primary dark:text-text-primary-dark">
                                Pulse is active — using{' '}
                                <span className="text-accent capitalize">{settings.effectiveProvider}</span>
                                {settings.usingOwnKey
                                    ? <span className="text-text-muted dark:text-text-muted-dark"> (your key)</span>
                                    : <span className="text-text-muted dark:text-text-muted-dark"> (server key)</span>}
                            </p>
                            <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">
                                Ask questions from the “Ask Pulse” panel on any dashboard page.
                            </p>
                        </>
                    ) : (
                        <p className="text-text-primary dark:text-text-primary-dark">
                            No AI provider configured yet. Add your own key below to bring Pulse online.
                        </p>
                    )}
                </div>
            </div>

            {/* Provider */}
            <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">Provider</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PROVIDERS.map((p) => (
                        <button key={p.id} onClick={() => setProvider(p.id)}
                            className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                                provider === p.id
                                    ? 'border-accent bg-accent/5 text-accent'
                                    : 'border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark hover:border-accent/40'
                            }`}>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                {provider === p.id && <Check className="w-3.5 h-3.5" />}{p.label}
                            </div>
                            <p className="text-[11px] text-text-muted dark:text-text-muted-dark mt-0.5">{p.help}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* API key */}
            <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">
                    Your API key {settings?.usingOwnKey && <span className="text-green-600 dark:text-green-400 font-normal">— on file ({settings.keyHint})</span>}
                </label>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted dark:text-text-muted-dark" />
                        <input
                            type="password"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            placeholder={settings?.usingOwnKey ? 'Enter a new key to replace the current one' : active.placeholder}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border dark:border-border-dark
                                bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark font-mono
                                focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none placeholder:text-text-muted placeholder:font-sans"
                        />
                    </div>
                    {settings?.usingOwnKey && (
                        <button onClick={clearKey} disabled={saving} title="Remove stored key"
                            className="shrink-0 p-2 rounded-xl border border-border dark:border-border-dark text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-text-muted dark:text-text-muted-dark mt-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                    Stored encrypted (AES-256-GCM). Never shown again after saving.
                    {serverHasKey && !settings?.usingOwnKey && ' Leave blank to use the server key.'}
                </p>
            </div>

            {/* Model override (optional) */}
            <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">
                    Model <span className="font-normal text-text-muted dark:text-text-muted-dark">(optional override)</span>
                </label>
                <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={MODEL_PLACEHOLDERS[provider] || 'claude-sonnet-5'}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border dark:border-border-dark
                        bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark font-mono
                        focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none placeholder:text-text-muted placeholder:font-sans"
                />
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
            )}

            <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                        bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                        disabled:opacity-50 transition-all">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save settings
                </button>
                {saved && <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
            </div>
        </div>
    );
}
