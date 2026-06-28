import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Eye, EyeOff, ArrowRight, Check, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const setAuth = useAuthStore((s) => s.setAuth);

    const passwordChecks = [
        { label: 'At least 6 characters', valid: password.length >= 6 },
        { label: 'Passwords match', valid: password && confirmPassword && password === confirmPassword },
    ];

    const validate = () => {
        if (!name.trim()) { toast.error('Full name is required'); return false; }
        if (name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return false; }
        if (!email.trim()) { toast.error('Email is required'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Please enter a valid email'); return false; }
        if (!password) { toast.error('Password is required'); return false; }
        if (password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
        if (password !== confirmPassword) { toast.error('Passwords do not match'); return false; }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!validate()) return;

        setLoading(true);
        try {
            const res = await authAPI.register({ name, email, password });
            setAuth(res.data.user, res.data.token);
            toast.success('Account created successfully!');
            const redirect = searchParams.get('redirect');
            navigate(redirect || '/', { replace: true });
        } catch (err) {
            const msg = err.message || 'Registration failed';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left panel - branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700
                flex-col justify-between p-12 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-32 left-16 w-64 h-64 bg-white rounded-full blur-3xl" />
                    <div className="absolute bottom-16 right-24 w-80 h-80 bg-teal-300 rounded-full blur-3xl" />
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
                        Get started in minutes.<br />No credit card needed.
                    </h2>
                    <div className="space-y-4">
                        {[
                            { step: '1', text: 'Create your account' },
                            { step: '2', text: 'Add your website' },
                            { step: '3', text: 'Copy the tracking script' },
                            { step: '4', text: 'View your analytics' },
                        ].map(({ step, text }) => (
                            <div key={step} className="flex items-center gap-3 text-sm text-white/80">
                                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                                    {step}
                                </div>
                                {text}
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
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">InsightsTrack</span>
                    </div>

                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create your account</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Start tracking your website analytics
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
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    autoComplete="name"
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700
                                        bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                                        focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all
                                        placeholder:text-gray-400"
                                />
                            </div>
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
                                        focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all
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
                                        placeholder="Create a password"
                                        required
                                        autoComplete="new-password"
                                        className="w-full px-4 py-2.5 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-700
                                            bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                                            focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all
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
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                                    Confirm Password
                                </label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    required
                                    autoComplete="new-password"
                                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700
                                        bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                                        focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all
                                        placeholder:text-gray-400"
                                />
                            </div>

                            {/* Password strength */}
                            {password && (
                                <div className="space-y-1.5">
                                    {passwordChecks.map(({ label, valid }) => (
                                        <div key={label} className={`flex items-center gap-2 text-xs ${valid ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            <Check className={`w-3 h-3 ${valid ? '' : 'opacity-30'}`} />
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                    bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                                {!loading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            Already have an account?{' '}
                            <Link to={`/login${searchParams.get('redirect') ? `?redirect=${encodeURIComponent(searchParams.get('redirect'))}` : ''}`} className="text-emerald-600 hover:text-emerald-500 font-semibold">
                                Sign in
                            </Link>
                        </p>

                        <div className="mt-5 flex items-center justify-center">
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
