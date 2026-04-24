import { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, HelpCircle, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

function getProfile() {
    const authUser = useAuthStore.getState().user;
    if (authUser) return { name: authUser.name, email: authUser.email, role: authUser.role || 'Owner' };
    try {
        const stored = localStorage.getItem('analytics-user-profile');
        return stored ? JSON.parse(stored) : { name: 'User', email: '', role: 'Owner' };
    } catch {
        return { name: 'User', email: '', role: 'Owner' };
    }
}

export default function UserMenu() {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const navigate = useNavigate();
    const logout = useAuthStore((s) => s.logout);
    const profile = getProfile();
    const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-sm">
                    <span className="text-[11px] font-bold text-white">{initials}</span>
                </div>
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-1.5 w-64 rounded-xl border
                    border-border dark:border-border-dark
                    bg-card dark:bg-card-dark shadow-xl shadow-black/5 dark:shadow-black/20 z-50">

                    {/* Profile header */}
                    <div className="px-4 py-3 border-b border-border dark:border-border-dark">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-purple-500
                                flex items-center justify-center shadow-sm flex-shrink-0">
                                <span className="text-sm font-bold text-white">{initials}</span>
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-text-primary dark:text-text-primary-dark truncate">
                                    {profile.name}
                                </div>
                                <div className="text-xs text-text-muted dark:text-text-muted-dark truncate">
                                    {profile.email}
                                </div>
                            </div>
                        </div>
                        <div className="mt-2">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold
                                bg-accent/10 text-accent uppercase tracking-wider">
                                {profile.role}
                            </span>
                        </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                        <button
                            onClick={() => { navigate('/profile'); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm
                                text-text-secondary dark:text-text-secondary-dark
                                hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <User className="w-4 h-4" />
                            <span>Your Profile</span>
                        </button>
                        <button
                            onClick={() => { navigate('/settings'); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm
                                text-text-secondary dark:text-text-secondary-dark
                                hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                        </button>
                        <button
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm
                                text-text-secondary dark:text-text-secondary-dark
                                hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <HelpCircle className="w-4 h-4" />
                            <span>Help & Support</span>
                        </button>
                    </div>

                    <div className="border-t border-border dark:border-border-dark">
                        <button
                            onClick={() => { logout(); navigate('/login'); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                                text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors rounded-b-xl"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
