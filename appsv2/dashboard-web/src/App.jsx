import { lazy, Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DashboardLayout from './components/layout/DashboardLayout';
import LoadingSkeleton from './components/ui/LoadingSkeleton';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useThemeStore } from './store/useThemeStore';
import { useAuthStore } from './store/useAuthStore';
import { useSiteStore } from './store/useSiteStore';
import { sitesAPI } from './services/api';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const PagesView = lazy(() => import('./pages/PagesView'));
const Funnels = lazy(() => import('./pages/Funnels'));
const Realtime = lazy(() => import('./pages/Realtime'));
const UserFlow = lazy(() => import('./pages/UserFlow'));
const Engagement = lazy(() => import('./pages/Engagement'));
const Conversions = lazy(() => import('./pages/Conversions'));
const Audience = lazy(() => import('./pages/Audience'));
const Content = lazy(() => import('./pages/Content'));
const Acquisition = lazy(() => import('./pages/Acquisition'));
const Performance = lazy(() => import('./pages/Performance'));
const Reporting = lazy(() => import('./pages/Reporting'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Documentation = lazy(() => import('./pages/Documentation'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

function ProtectedRoute({ children }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    if (!isAuthenticated) return <Navigate to="/landing" replace />;
    return children;
}

function GuestRoute({ children }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    if (isAuthenticated) return <Navigate to="/" replace />;
    return children;
}

function SiteGate({ children }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const { siteId, setSiteId, setSites } = useSiteStore();
    const [checking, setChecking] = useState(true);
    const [hasSites, setHasSites] = useState(false);
    const [apiError, setApiError] = useState(false);
    const retryRef = useRef(0);

    const fetchSites = useCallback(() => {
        if (!isAuthenticated) { setChecking(false); return; }

        setApiError(false);
        sitesAPI.list()
            .then((result) => {
                const sites = result?.data || result || [];
                setSites(sites);
                retryRef.current = 0;
                if (sites.length > 0) {
                    setHasSites(true);
                    if (!siteId || !sites.find((s) => s.id === siteId)) {
                        setSiteId(sites[0].id);
                    }
                } else {
                    setHasSites(false);
                }
            })
            .catch((err) => {
                const is429 = err.message?.includes('429') || err.message?.includes('Too Many');
                // If we already have a siteId in localStorage, trust it
                // instead of redirecting to onboarding on a transient failure
                const savedSiteId = localStorage.getItem('analytics-site-id');
                if (savedSiteId) {
                    setHasSites(true);
                    if (!siteId) setSiteId(savedSiteId);
                } else if (retryRef.current < 3) {
                    retryRef.current += 1;
                    // Longer backoff for rate limiting
                    const delay = is429 ? 3000 * retryRef.current : 1000;
                    setTimeout(fetchSites, delay);
                    return; // don't clear checking yet
                } else {
                    setApiError(true);
                    setHasSites(false);
                }
            })
            .finally(() => setChecking(false));
    }, [isAuthenticated, siteId, setSites, setSiteId]);

    useEffect(() => { fetchSites(); }, [fetchSites]);

    if (checking) return <LoadingSkeleton type="page" />;

    if (apiError && !hasSites) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg dark:bg-bg-dark">
                <div className="text-center p-8">
                    <p className="text-text-muted dark:text-text-muted-dark mb-4">
                        Failed to load your sites. Please check your connection.
                    </p>
                    <button
                        onClick={() => { setChecking(true); retryRef.current = 0; fetchSites(); }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!hasSites) return <Navigate to="/onboarding" replace />;
    return children;
}

function AppContent() {
    const theme = useThemeStore((s) => s.theme);

    return (
        <div className={theme === 'dark' ? 'dark' : ''}>
            <div className="min-h-screen bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark">
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: theme === 'dark' ? '#1E2130' : '#fff',
                            color: theme === 'dark' ? '#E2E8F0' : '#1E293B',
                            border: `1px solid ${theme === 'dark' ? '#2D3348' : '#E2E8F0'}`,
                            borderRadius: '12px',
                            fontSize: '14px',
                        },
                        success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
                        error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
                    }}
                />
                <BrowserRouter>
                    <Suspense fallback={<LoadingSkeleton type="page" />}>
                        <Routes>
                            {/* Public landing page */}
                            <Route path="/landing" element={<GuestRoute><Landing /></GuestRoute>} />

                            {/* Auth routes (no layout) */}
                            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

                            {/* Onboarding — add first website */}
                            <Route path="/onboarding" element={
                                <ProtectedRoute>
                                    <Onboarding />
                                </ProtectedRoute>
                            } />

                            {/* Protected dashboard routes — require at least one site */}
                            <Route path="/*" element={
                                <ProtectedRoute>
                                    <SiteGate>
                                        <DashboardLayout>
                                            <ErrorBoundary fallbackMessage="Failed to load the page. Please try again.">
                                                <Suspense fallback={<LoadingSkeleton type="page" />}>
                                                    <Routes>
                                                        <Route path="/" element={<Dashboard />} />
                                                        <Route path="/pages" element={<PagesView />} />
                                                        <Route path="/funnels" element={<Funnels />} />
                                                        <Route path="/realtime" element={<Realtime />} />
                                                        <Route path="/user-flow" element={<UserFlow />} />
                                                        <Route path="/engagement" element={<Engagement />} />
                                                        <Route path="/conversions" element={<Conversions />} />
                                                        <Route path="/audience" element={<Audience />} />
                                                        <Route path="/content" element={<Content />} />
                                                        <Route path="/acquisition" element={<Acquisition />} />
                                                        <Route path="/performance" element={<Performance />} />
                                                        <Route path="/reporting" element={<Reporting />} />
                                                        <Route path="/privacy" element={<Privacy />} />
                                                        <Route path="/settings" element={<Settings />} />
                                                        <Route path="/profile" element={<Profile />} />
                                                        <Route path="/docs" element={<Documentation />} />
                                                        <Route path="*" element={<Navigate to="/" replace />} />
                                                    </Routes>
                                                </Suspense>
                                            </ErrorBoundary>
                                        </DashboardLayout>
                                    </SiteGate>
                                </ProtectedRoute>
                            } />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </div>
        </div>
    );
}

export default function App() {
    return <AppContent />;
}
