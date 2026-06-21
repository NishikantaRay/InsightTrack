import { useState, useEffect } from 'react';
import {
    User, Mail, Shield, Camera, Save, Key,
    Sliders, Eye, EyeOff, RotateCcw, Info, CheckCircle2,
} from 'lucide-react';
import { useFeatureStore, ALL_NAV_FEATURES } from '../store/useFeatureStore';

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

// ── Feature Manager Tab ──────────────────────────────────────────────────────

const GROUP_ORDER = ['Core', 'Content', 'Analytics', 'Conversions', 'Tools', 'System'];

const GROUP_META = {
    Core:        { color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-900/20',  dot: 'bg-indigo-500'  },
    Content:     { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', dot: 'bg-emerald-500' },
    Analytics:   { color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20',       dot: 'bg-blue-500'    },
    Conversions: { color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     dot: 'bg-amber-500'   },
    Tools:       { color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/20',   dot: 'bg-purple-500'  },
    System:      { color: 'text-gray-500 dark:text-gray-400',       bg: 'bg-gray-50 dark:bg-gray-800/50',       dot: 'bg-gray-400'    },
};

function FeatureToggle({ feature, visible, onToggle }) {
    const meta = GROUP_META[feature.group] || GROUP_META.Tools;

    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150
            ${visible
                ? 'border-border dark:border-border-dark bg-white dark:bg-card-dark'
                : 'border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 opacity-60'
            }`}>
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${visible ? meta.dot : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div>
                    <span className={`text-sm font-medium ${visible ? 'text-text-primary dark:text-text-primary-dark' : 'text-text-muted dark:text-text-muted-dark line-through'}`}>
                        {feature.label}
                    </span>
                    {feature.protected && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-400 font-medium uppercase tracking-wide">
                            Always on
                        </span>
                    )}
                </div>
            </div>

            {feature.protected ? (
                <div className="w-10 h-5 rounded-full bg-accent/30 flex items-center justify-end pr-0.5 cursor-not-allowed" title="This item cannot be hidden">
                    <div className="w-4 h-4 rounded-full bg-accent/50" />
                </div>
            ) : (
                <button
                    onClick={() => onToggle(feature.key)}
                    title={visible ? 'Hide from sidebar' : 'Show in sidebar'}
                    className={`relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 shrink-0
                        ${visible ? 'bg-accent' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200
                        ${visible ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
            )}
        </div>
    );
}

function FeatureManagerTab() {
    const { visibility, isVisible, toggleVisible, showAll, hiddenCount } = useFeatureStore();
    const [saved, setSaved] = useState(false);
    const hidden = hiddenCount();

    const grouped = GROUP_ORDER.reduce((acc, g) => {
        acc[g] = ALL_NAV_FEATURES.filter(f => f.group === g);
        return acc;
    }, {});

    const handleShowAll = () => {
        showAll();
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleToggle = (key) => {
        toggleVisible(key);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
                        Navigation Visibility
                    </h3>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">
                        Control which pages appear in the sidebar. Hidden pages remain accessible via direct URL — only the nav link is removed.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {saved && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                        </span>
                    )}
                    {hidden > 0 && (
                        <button
                            onClick={handleShowAll}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                                border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark
                                hover:border-accent hover:text-accent transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Show all ({hidden} hidden)
                        </button>
                    )}
                </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    <strong>Use this when sharing access with your team.</strong> Hide pages you don't want them to see at a glance — like SQL Editor, Privacy settings, or raw Reporting tools. Changes apply instantly and persist across sessions.
                </p>
            </div>

            {/* Hidden summary bar */}
            {hidden > 0 && (
                <div className="flex flex-wrap gap-2">
                    {ALL_NAV_FEATURES.filter(f => !f.protected && !isVisible(f.key)).map(f => {
                        const meta = GROUP_META[f.group] || GROUP_META.Tools;
                        return (
                            <span key={f.key}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.color} border-current/20`}>
                                <EyeOff className="w-3 h-3" />
                                {f.label}
                                <button onClick={() => handleToggle(f.key)} className="ml-0.5 hover:opacity-70 transition-opacity" title="Show">
                                    ×
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Groups */}
            <div className="space-y-5">
                {GROUP_ORDER.map(group => {
                    const items = grouped[group];
                    if (!items?.length) return null;
                    const meta = GROUP_META[group] || GROUP_META.Tools;
                    const groupVisible = items.filter(f => isVisible(f.key)).length;
                    return (
                        <div key={group}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                    <span className="text-xs font-semibold text-text-muted dark:text-text-muted-dark uppercase tracking-wider">
                                        {group}
                                    </span>
                                    <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
                                        {groupVisible}/{items.length} visible
                                    </span>
                                </div>
                                {/* Group show/hide all toggle */}
                                {!items.every(f => f.protected) && (
                                    <button
                                        onClick={() => {
                                            const allVisible = items.every(f => f.protected || isVisible(f.key));
                                            items.filter(f => !f.protected).forEach(f => {
                                                const currentlyVisible = isVisible(f.key);
                                                if (allVisible ? currentlyVisible : !currentlyVisible) {
                                                    toggleVisible(f.key);
                                                }
                                            });
                                            setSaved(true);
                                            setTimeout(() => setSaved(false), 1500);
                                        }}
                                        className="text-[10px] text-text-muted dark:text-text-muted-dark hover:text-accent transition-colors px-2 py-0.5 rounded border border-border dark:border-border-dark"
                                    >
                                        {items.every(f => f.protected || isVisible(f.key)) ? 'Hide group' : 'Show group'}
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {items.map(feature => (
                                    <FeatureToggle
                                        key={feature.key}
                                        feature={feature}
                                        visible={isVisible(feature.key)}
                                        onToggle={handleToggle}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Stats footer */}
            <div className="flex items-center gap-6 pt-4 border-t border-border dark:border-border-dark">
                {[
                    { label: 'Visible', value: ALL_NAV_FEATURES.filter(f => isVisible(f.key)).length, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Hidden', value: hidden, color: 'text-red-500 dark:text-red-400' },
                    { label: 'Always on', value: ALL_NAV_FEATURES.filter(f => f.protected).length, color: 'text-gray-400 dark:text-gray-500' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                        <div className={`text-xl font-bold ${color}`}>{value}</div>
                        <div className="text-[10px] text-text-muted dark:text-text-muted-dark uppercase tracking-wider">{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Profile Component ───────────────────────────────────────────────────

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

    const tabs = [
        { id: 'general',  label: 'General',         icon: User },
        { id: 'security', label: 'Security',         icon: Key },
        { id: 'features', label: 'Feature Manager',  icon: Sliders },
        { id: 'notifications', label: 'Notifications', icon: Mail },
    ];

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
            <div className="flex gap-1 border-b border-border dark:border-border-dark overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'border-accent text-accent'
                                : 'border-transparent text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.id === 'features' && (() => {
                            const { hiddenCount } = useFeatureStore.getState();
                            const n = hiddenCount();
                            return n > 0 ? (
                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                    {n}
                                </span>
                            ) : null;
                        })()}
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
                            <input type="password" placeholder="Current password"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all" />
                            <input type="password" placeholder="New password"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all" />
                            <input type="password" placeholder="Confirm new password"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all" />
                            <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors">
                                Update Password
                            </button>
                        </div>
                    </div>
                    <div className="border-t border-border dark:border-border-dark pt-5">
                        <h3 className="text-sm font-semibold mb-1">Active Sessions</h3>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark mb-3">
                            Manage your active sessions across devices
                        </p>
                        <div className="p-3 rounded-lg bg-bg dark:bg-bg-dark flex items-center justify-between">
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
            )}

            {/* Feature Manager tab */}
            {activeTab === 'features' && (
                <div className="card">
                    <FeatureManagerTab />
                </div>
            )}

            {/* Notifications tab */}
            {activeTab === 'notifications' && (
                <div className="card space-y-4">
                    <p className="text-xs text-text-muted dark:text-text-muted-dark">
                        Choose which notifications you'd like to receive
                    </p>
                    {[
                        { id: 'traffic_alerts',    label: 'Traffic Alerts',    desc: 'Get notified about traffic spikes and drops' },
                        { id: 'weekly_reports',    label: 'Weekly Reports',    desc: 'Receive a weekly summary of your analytics' },
                        { id: 'goal_completions',  label: 'Goal Completions',  desc: 'Notifications when conversion goals are met' },
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
                        <button onClick={handleSave}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm">
                            <Save className="w-4 h-4" />
                            {saved ? 'Saved!' : 'Save Preferences'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
