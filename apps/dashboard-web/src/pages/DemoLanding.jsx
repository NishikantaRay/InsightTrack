import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Loader2, AlertTriangle } from 'lucide-react';
import { demoAPI } from '../services/api';
import { useSiteStore } from '../store/useSiteStore';

/**
 * /demo — "Open live dashboard with dummy data".
 *
 * Rendered inside ProtectedRoute, so an unauthenticated visitor is redirected
 * to /landing first (where they log in or sign up). Once authenticated, this
 * page grants the user viewer access to the pre-seeded demo site, selects it
 * as the active site, and forwards to the main dashboard — which then shows
 * the dummy analytics data.
 */
export default function DemoLanding() {
    const navigate = useNavigate();
    const setSiteId = useSiteStore((s) => s.setSiteId);
    const [error, setError] = useState('');
    const ran = useRef(false);

    useEffect(() => {
        // Run the join exactly once. We intentionally do NOT use a `cancelled`
        // flag that suppresses navigation: under StrictMode the effect mounts,
        // cleans up, then re-mounts — a cancel-on-cleanup would abort the only
        // run and we'd never navigate, leaving the user to fall through to
        // onboarding. The ran-ref makes the network call idempotent; the join
        // endpoint itself is idempotent server-side too.
        if (ran.current) return;
        ran.current = true;

        (async () => {
            try {
                const res = await demoAPI.join();
                const siteId = res?.data?.data?.siteId ?? res?.data?.siteId;
                if (!siteId) throw new Error('No demo site returned');
                setSiteId(siteId);
                // Land on the dashboard; the demo site is already the active site.
                navigate('/', { replace: true });
            } catch (err) {
                const msg =
                    err?.response?.data?.error ||
                    'The demo site is not available on this instance yet.';
                setError(msg);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg dark:bg-bg-dark px-4">
            <div className="text-center max-w-md">
                <div className="w-12 h-12 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600
                    flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <BarChart3 className="w-6 h-6 text-white" />
                </div>

                {error ? (
                    <>
                        <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                            <AlertTriangle className="w-5 h-5" />
                            <h1 className="text-lg font-bold">Demo unavailable</h1>
                        </div>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark mb-6">{error}</p>
                        <button
                            onClick={() => navigate('/', { replace: true })}
                            className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl
                                bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                                shadow-md shadow-indigo-500/25 transition-all">
                            Go to dashboard
                        </button>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-center gap-2 text-text-primary dark:text-text-primary-dark mb-2">
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                            <h1 className="text-lg font-bold">Loading the live demo…</h1>
                        </div>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark">
                            Setting up your demo dashboard with sample analytics data.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
