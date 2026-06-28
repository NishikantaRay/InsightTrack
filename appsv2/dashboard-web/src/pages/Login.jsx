import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Eye, EyeOff, ArrowRight, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const setAuth = useAuthStore((s) => s.setAuth);
    const isDark = useThemeStore((s) => s.theme) === 'dark';

    const validate = () => {
        if (!email.trim()) { toast.error('Email is required'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Please enter a valid email'); return false; }
        if (!password) { toast.error('Password is required'); return false; }
        if (password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!validate()) return;
        setLoading(true);
        try {
            const res = await authAPI.login({ email, password });
            setAuth(res.data.user, res.data.token);
            toast.success('Welcome back!');
            // If we arrived here via an invite redirect, go back there
            const redirect = searchParams.get('redirect');
            navigate(redirect || '/', { replace: true });
        } catch (err) {
            const msg = err.message || 'Login failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left panel - branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800
                flex-col justify-between p-12 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">InsightsTrack</span>
                    </div>
                    <p className="text-white/70 text-sm mt-1">Privacy-first web analytics</p>
                </div>
                <div className="relative z-10 space-y-6">
                    <h2 className="text-3xl font-bold leading-tight">
                        Understand your audience<br />without compromising privacy.
                    </h2>
                    <div className="space-y-3">
                        {['Real-time visitor tracking', 'Conversion funnels & user flows', 'Multi-site management', 'Lightweight tracking script'].map((f) => (
                            <div key={f} className="flex items-center gap-2 text-sm text-white/80">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {f}
                            </div>
                        ))}
                    </div>
                </div>
                <p className="relative z-10 text-xs text-white/40">
                    &copy; {new Date().getFullYear()} InsightsTrack. Open-source analytics.
                </p>
            </div>

            {/* Right panel - form */}
            <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">InsightsTrack</span>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Sign in to your dashboard
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    required
                                    autoComplete="email"
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700
                                        bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                                        focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all
                                        placeholder:text-gray-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        autoComplete="current-password"
                                        className="w-full px-4 py-2.5 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-700
                                            bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                                            focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all
                                            placeholder:text-gray-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                    bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold
                                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                                {!loading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Don't have an account?{' '}
                            <Link to={`/register${searchParams.get('redirect') ? `?redirect=${encodeURIComponent(searchParams.get('redirect'))}` : ''}`} className="text-indigo-600 hover:text-indigo-500 font-semibold">
                                Create one
                            </Link>
                        </p>

                        <div className="mt-5 flex flex-col items-center gap-4">
                            <a href="https://www.producthunt.com/products/insightstrack?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-insightstrack"
                                target="_blank" rel="noopener noreferrer">
                                <img
                                    src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1183103&theme=${isDark ? 'dark' : 'light'}`}
                                    alt="InsightsTrack on Product Hunt" width="200" height="43"
                                    style={{ width: 200, height: 43 }}
                                />
                            </a>
                            <a href="https://github.com/sponsors/NishikantaRay" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                    border border-pink-200 dark:border-pink-500/30 text-pink-600 dark:text-pink-400
                                    hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-colors">
                                <Heart className="w-3.5 h-3.5" /> Sponsor InsightsTrack
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
