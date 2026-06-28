import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { BarChart3, CheckCircle, AlertCircle, RefreshCw, Users, Globe } from 'lucide-react';
import { teamAPI } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

export default function JoinSite() {
    const [searchParams]       = useSearchParams();
    const navigate             = useNavigate();
    const token                = searchParams.get('token');
    const isAuthenticated      = useAuthStore(s => s.isAuthenticated);
    const theme                = useThemeStore(s => s.theme);

    const [invite, setInvite]  = useState(null);   // invite info from GET /api/invite/:token
    const [loading, setLoading]= useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError]    = useState('');
    const [success, setSuccess]= useState(null);   // { siteName, role }

    // 1. Load invite info (public endpoint — no auth needed)
    useEffect(() => {
        if (!token) { setError('Missing invite token.'); setLoading(false); return; }
        teamAPI.getInviteInfo(token)
            .then(res => { setInvite(res?.data || res); setLoading(false); })
            .catch(e  => { setError(e.message || 'Invalid or expired invite link.'); setLoading(false); });
    }, [token]);

    // 2. Accept the invite
    const handleAccept = async () => {
        if (!isAuthenticated) {
            // Redirect to login, then come back here after
            navigate(`/login?redirect=/join?token=${token}`);
            return;
        }
        setAccepting(true);
        try {
            const res = await teamAPI.acceptInvite(token);
            const d   = res?.data || res;
            setSuccess({ siteName: d.siteName, role: d.role, siteId: d.siteId });
        } catch (e) {
            setError(e.message || 'Failed to accept invite.');
        } finally {
            setAccepting(false);
        }
    };

    const roleBg = {
        owner:  'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/40',
        admin:  'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/40',
        viewer: 'bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700/40',
    };

    return (
        <div className={theme === 'dark' ? 'dark' : ''}>
            <div className="min-h-screen bg-bg dark:bg-bg-dark flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Logo */}
                    <div className="flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-lg shadow-accent/30">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-text-primary dark:text-text-primary-dark tracking-tight">InsightsTrack</span>
                    </div>

                    <div className="card text-center space-y-6">

                        {/* Loading */}
                        {loading && (
                            <div className="py-8 flex flex-col items-center gap-3 text-text-muted dark:text-text-muted-dark">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                <p className="text-sm">Checking invite…</p>
                            </div>
                        )}

                        {/* Error */}
                        {!loading && error && (
                            <div className="py-6 flex flex-col items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                                    <AlertCircle className="w-7 h-7 text-red-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-1">Invite problem</h2>
                                    <p className="text-sm text-text-muted dark:text-text-muted-dark">{error}</p>
                                </div>
                                <Link to="/" className="text-sm text-accent hover:underline">Go to dashboard →</Link>
                            </div>
                        )}

                        {/* Success */}
                        {!loading && !error && success && (
                            <div className="py-6 flex flex-col items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                    <CheckCircle className="w-7 h-7 text-green-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-1">You're in! 🎉</h2>
                                    <p className="text-sm text-text-muted dark:text-text-muted-dark">
                                        You joined <strong className="text-text-primary dark:text-text-primary-dark">{success.siteName}</strong> as{' '}
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${roleBg[success.role] || roleBg.viewer}`}>
                                            {success.role}
                                        </span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/')}
                                    className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors shadow-md shadow-accent/20"
                                >
                                    Open dashboard →
                                </button>
                            </div>
                        )}

                        {/* Invite info + accept */}
                        {!loading && !error && !success && invite && (
                            <div className="py-2 flex flex-col items-center gap-5">
                                {/* Site icon */}
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-accent/20 flex items-center justify-center">
                                    <Globe className="w-8 h-8 text-accent" />
                                </div>

                                <div>
                                    <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-1">
                                        You're invited!
                                    </h2>
                                    <p className="text-sm text-text-muted dark:text-text-muted-dark">
                                        <strong className="text-text-primary dark:text-text-primary-dark">{invite.inviterName}</strong> invited you to join
                                    </p>
                                </div>

                                {/* Site card */}
                                <div className="w-full rounded-xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark p-4 text-left space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-text-muted dark:text-text-muted-dark shrink-0" />
                                        <span className="text-base font-bold text-text-primary dark:text-text-primary-dark">{invite.siteName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-text-muted dark:text-text-muted-dark">
                                        <Globe className="w-3.5 h-3.5 shrink-0" />
                                        <span className="font-mono text-xs">{invite.domain}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="text-xs text-text-muted dark:text-text-muted-dark">Your role:</span>
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${roleBg[invite.role] || roleBg.viewer}`}>
                                            {invite.role}
                                        </span>
                                    </div>
                                </div>

                                {!isAuthenticated ? (
                                    <div className="w-full space-y-3">
                                        <p className="text-xs text-text-muted dark:text-text-muted-dark">
                                            You need an InsightsTrack account to accept this invite.
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Link to={`/login?redirect=/join?token=${token}`}
                                                className="py-2.5 rounded-xl border border-border dark:border-border-dark text-sm font-semibold text-text-primary dark:text-text-primary-dark hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-center">
                                                Sign in
                                            </Link>
                                            <Link to={`/register?redirect=/join?token=${token}`}
                                                className="py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors text-center shadow-md shadow-accent/20">
                                                Create account
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleAccept}
                                        disabled={accepting}
                                        className="w-full py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-md shadow-accent/20 flex items-center justify-center gap-2"
                                    >
                                        {accepting
                                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Accepting…</>
                                            : <><CheckCircle className="w-4 h-4" /> Accept invite</>
                                        }
                                    </button>
                                )}

                                <p className="text-[11px] text-text-muted dark:text-text-muted-dark">
                                    Invite expires {new Date(invite.expiresAt).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
