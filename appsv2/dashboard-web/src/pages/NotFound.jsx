import { Link } from 'react-router-dom';
import { BarChart3, Home, ArrowLeft } from 'lucide-react';
import { useSeo } from '../hooks/useSeo';

/**
 * 404 — shown for any unknown route. Returns a real "page not found" screen
 * instead of silently redirecting, so deep links and crawlers get a clear signal.
 */
export default function NotFound() {
    // noindex: a 404 must never be indexed, and the static dist/404.html this
    // renders into is served for every unknown URL.
    useSeo({ title: 'Page not found', noindex: true });
    return (
        <div className="min-h-screen flex items-center justify-center bg-bg dark:bg-bg-dark px-4">
            <div className="text-center max-w-md">
                <div className="w-12 h-12 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600
                    flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <p className="text-6xl font-black bg-clip-text text-transparent mb-3"
                    style={{ backgroundImage: 'linear-gradient(135deg,#6366f1,#a855f7,#ec4899)' }}>
                    404
                </p>
                <h1 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                    Page not found
                </h1>
                <p className="text-sm text-text-muted dark:text-text-muted-dark mb-7">
                    The page you're looking for doesn't exist or may have moved.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <Link to="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl
                            bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                            shadow-md shadow-indigo-500/25 transition-all">
                        <Home className="w-4 h-4" /> Go to dashboard
                    </Link>
                    <Link to="/landing"
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl
                            border border-border dark:border-border-dark text-text-primary dark:text-text-primary-dark
                            hover:bg-card dark:hover:bg-card-dark transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
