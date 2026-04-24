import { useState, useEffect } from 'react';
import { User, Mail, Shield, Camera, Save, Key } from 'lucide-react';

const PROFILE_KEY = 'analytics-user-profile';

function loadProfile() {
    try {
        const stored = localStorage.getItem(PROFILE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch { return null; }
}

function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export default function Profile() {
    const [profile, setProfile] = useState(() =>
        loadProfile() || { name: 'Admin User', email: 'admin@analytics.io', role: 'Owner', timezone: '', notifications: true }
    );
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const handleSave = () => {
        saveProfile(profile);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const update = (field, value) => setProfile(prev => ({ ...prev, [field]: value }));

    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    useEffect(() => {
        if (!profile.timezone) update('timezone', detectedTimezone);
    }, []);

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-sm text-text-muted dark:text-text-muted-dark mt-1">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Profile header card */}
            <div className="card">
                <div className="flex items-center gap-5">
                    <div className="relative group">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-purple-500
                            flex items-center justify-center shadow-lg">
                            <span className="text-2xl font-bold text-white">{initials}</span>
                        </div>
                        <button className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100
                            flex items-center justify-center transition-opacity">
                            <Camera className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{profile.name}</h2>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark">{profile.email}</p>
                        <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold
                            bg-accent/10 text-accent uppercase tracking-wider">
                            {profile.role}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border dark:border-border-dark">
                {[
                    { id: 'general', label: 'General', icon: User },
                    { id: 'security', label: 'Security', icon: Key },
                    { id: 'notifications', label: 'Notifications', icon: Mail },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                            ${activeTab === tab.id
                                ? 'border-accent text-accent'
                                : 'border-transparent text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* General tab */}
            {activeTab === 'general' && (
                <div className="card space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-text-muted dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={(e) => update('name', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark
                                    bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                                    focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">
                                Email
                            </label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={(e) => update('email', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark
                                    bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                                    focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-text-muted dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">
                                Role
                            </label>
                            <select
                                value={profile.role}
                                onChange={(e) => update('role', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark
                                    bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                                    focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                            >
                                <option value="Owner">Owner</option>
                                <option value="Admin">Admin</option>
                                <option value="Viewer">Viewer</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-text-muted dark:text-text-muted-dark mb-1.5 uppercase tracking-wider">
                                Timezone
                            </label>
                            <input
                                type="text"
                                value={profile.timezone || detectedTimezone}
                                onChange={(e) => update('timezone', e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark
                                    bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                                    focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg
                                bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {saved ? 'Saved!' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {/* Security tab */}
            {activeTab === 'security' && (
                <div className="card space-y-5">
                    <div>
                        <h3 className="text-sm font-semibold mb-1">Change Password</h3>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark mb-4">
                            Update your password to keep your account secure
                        </p>
                        <div className="space-y-3 max-w-sm">
                            <input
                                type="password"
                                placeholder="Current password"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark
                                    bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                                    focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                            />
                            <input
                                type="password"
                                placeholder="New password"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark
                                    bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                                    focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                            />
                            <input
                                type="password"
                                placeholder="Confirm new password"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark
                                    bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark
                                    focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all"
                            />
                            <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white
                                hover:bg-accent/90 transition-colors">
                                Update Password
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-border dark:border-border-dark pt-5">
                        <h3 className="text-sm font-semibold mb-1">Active Sessions</h3>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
                            Manage your active sessions across devices
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-bg dark:bg-bg-dark">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                                        <Shield className="w-4 h-4 text-success" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">Current Session</div>
                                        <div className="text-xs text-text-muted dark:text-text-muted-dark">
                                            {navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser'} · {navigator.platform}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs text-success font-medium px-2 py-0.5 bg-success/10 rounded-full">Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications tab */}
            {activeTab === 'notifications' && (
                <div className="card space-y-4">
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        Choose which notifications you'd like to receive
                    </p>

                    {[
                        { id: 'traffic_alerts', label: 'Traffic Alerts', desc: 'Get notified about traffic spikes and drops' },
                        { id: 'weekly_reports', label: 'Weekly Reports', desc: 'Receive a weekly summary of your analytics' },
                        { id: 'goal_completions', label: 'Goal Completions', desc: 'Notifications when conversion goals are met' },
                        { id: 'uptime_monitoring', label: 'Uptime Monitoring', desc: 'Alert when your tracked sites go down' },
                    ].map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-bg dark:bg-bg-dark">
                            <div>
                                <div className="text-sm font-medium">{item.label}</div>
                                <div className="text-xs text-text-muted dark:text-text-muted-dark">{item.desc}</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-accent
                                    rounded-full peer-focus:ring-2 peer-focus:ring-accent/30 transition-colors
                                    after:content-[''] after:absolute after:top-0.5 after:left-0.5
                                    after:bg-white after:rounded-full after:h-4 after:w-4
                                    after:transition-transform peer-checked:after:translate-x-4" />
                            </label>
                        </div>
                    ))}

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg
                                bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {saved ? 'Saved!' : 'Save Preferences'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
