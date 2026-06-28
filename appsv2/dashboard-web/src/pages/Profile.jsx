import { useState, useEffect, useCallback, useRef } from 'react';
import {
    User, Shield, Camera, Save, Key, Sliders,
    Eye, EyeOff, RotateCcw, Info, CheckCircle2,
    Users, UserPlus, Trash2, Crown, ShieldCheck, RefreshCw,
    Link2, X, Copy, AlertTriangle, Lock,
    Globe, Activity, Plus, Edit2, Palette, ChevronDown,
    LayoutGrid, Mail, Check, Star, Zap, Settings,
} from 'lucide-react';
import { useFeatureStore, ALL_NAV_FEATURES } from '../store/useFeatureStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSiteStore } from '../store/useSiteStore';
import { teamAPI } from '../services/api';

const PROFILE_KEY = 'analytics-user-profile';
const loadProfile  = () => { try { const s = localStorage.getItem(PROFILE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const saveProfile  = p  => localStorage.setItem(PROFILE_KEY, JSON.stringify(p));

const INPUT = 'w-full px-3 py-2.5 text-sm rounded-xl border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition-all';
const LABEL = 'block text-[10px] font-bold text-text-muted dark:text-text-muted-dark mb-1.5 uppercase tracking-wider';

// ── Pre-set role colors ──────────────────────────────────────────────────────
const ROLE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#14b8a6','#84cc16','#6b7280'];

// ── Built-in role config ─────────────────────────────────────────────────────
const BUILTIN_ROLE_CFG = {
    owner:  { icon: Crown,       label: 'Owner',  color: '#f59e0b', textColor: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-700/40' },
    admin:  { icon: ShieldCheck, label: 'Admin',  color: '#6366f1', textColor: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-700/40' },
    viewer: { icon: Eye,         label: 'Viewer', color: '#6b7280', textColor: 'text-gray-600 dark:text-gray-400',     bg: 'bg-gray-50 dark:bg-gray-800/40',     border: 'border-gray-200 dark:border-gray-700/40' },
};

// ── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role, customRole, size = 'sm' }) {
    if (customRole) {
        const color = customRole.color || '#6366f1';
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}
                style={{ color, background: color + '18', borderColor: color + '40' }}>
                <Star className="w-2.5 h-2.5" />
                {customRole.name}
            </span>
        );
    }
    const cfg = BUILTIN_ROLE_CFG[role] || BUILTIN_ROLE_CFG.viewer;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${size === 'sm' ? 'text-[10px]' : 'text-xs'} ${cfg.textColor} ${cfg.bg} ${cfg.border}`}>
            <Icon className="w-2.5 h-2.5" />{cfg.label}
        </span>
    );
}

// ── Feature permission matrix (used in custom role builder) ──────────────────
const GROUP_ORDER = ['Core', 'Content', 'Analytics', 'Conversions', 'Tools', 'System'];
const GROUP_META = {
    Core:        { color: 'text-indigo-500',  dot: 'bg-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-900/20'  },
    Content:     { color: 'text-emerald-500', dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    Analytics:   { color: 'text-blue-500',    dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20'      },
    Conversions: { color: 'text-amber-500',   dot: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20'    },
    Tools:       { color: 'text-purple-500',  dot: 'bg-purple-500',  bg: 'bg-purple-50 dark:bg-purple-900/20'  },
    System:      { color: 'text-gray-400',    dot: 'bg-gray-400',    bg: 'bg-gray-50 dark:bg-gray-800/40'      },
};

// ── Custom Role Builder Modal ─────────────────────────────────────────────────
function RoleBuilderModal({ siteId, existing, onClose, onSaved }) {
    const [name, setName]           = useState(existing?.name || '');
    const [color, setColor]         = useState(existing?.color || '#6366f1');
    const [description, setDesc]    = useState(existing?.description || '');
    const [permissions, setPerms]   = useState(existing?.permissions || {});
    const [saving, setSaving]       = useState(false);
    const [error, setError]         = useState('');
    const modalRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const fn = e => { if (modalRef.current && !modalRef.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [onClose]);

    const togglePerm = key => setPerms(p => ({ ...p, [key]: !p[key] }));
    const allInGroup = group => ALL_NAV_FEATURES.filter(f => f.group === group && !f.protected).every(f => permissions[f.key]);
    const toggleGroup = group => {
        const items = ALL_NAV_FEATURES.filter(f => f.group === group && !f.protected);
        const all = items.every(f => permissions[f.key]);
        setPerms(p => { const n = { ...p }; items.forEach(f => { n[f.key] = !all; }); return n; });
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Role name is required'); return; }
        setSaving(true); setError('');
        try {
            const payload = { name, color, description, permissions };
            let saved;
            if (existing?.id) {
                saved = await teamAPI.updateRole(siteId, existing.id, payload);
            } else {
                saved = await teamAPI.createRole(siteId, payload);
            }
            onSaved(saved?.data || saved);
            onClose();
        } catch (e) { setError(e.message); }
        finally { setSaving(false); }
    };

    const visibleCount = ALL_NAV_FEATURES.filter(f => !f.protected && permissions[f.key]).length;
    const totalCount   = ALL_NAV_FEATURES.filter(f => !f.protected).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div ref={modalRef} className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-border-dark shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>
                            <Star className="w-4.5 h-4.5" style={{ color }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">
                                {existing ? 'Edit Role' : 'Create Custom Role'}
                            </h2>
                            <p className="text-xs text-text-muted dark:text-text-muted-dark">{visibleCount}/{totalCount} pages accessible</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4 text-text-muted dark:text-text-muted-dark" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-sm text-red-700 dark:text-red-300">
                            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                        </div>
                    )}

                    {/* Name + Color + Description */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL}>Role name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                placeholder="e.g. Marketing Team, Read-only" className={INPUT} />
                        </div>
                        <div>
                            <label className={LABEL}>Description (optional)</label>
                            <input type="text" value={description} onChange={e => setDesc(e.target.value)}
                                placeholder="Short description" className={INPUT} />
                        </div>
                    </div>

                    {/* Color picker */}
                    <div>
                        <label className={LABEL}>Role color</label>
                        <div className="flex items-center gap-3 flex-wrap">
                            {ROLE_COLORS.map(c => (
                                <button key={c} onClick={() => setColor(c)}
                                    className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-offset-card dark:ring-offset-card-dark scale-110' : ''}`}
                                    style={{ background: c, ringColor: c }} />
                            ))}
                            <div className="flex items-center gap-2">
                                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                                    className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0" />
                                <span className="text-xs text-text-muted dark:text-text-muted-dark font-mono">{color}</span>
                            </div>
                        </div>
                    </div>

                    {/* Permission matrix */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className={LABEL}>Page access permissions</label>
                            <div className="flex gap-2">
                                <button onClick={() => setPerms(Object.fromEntries(ALL_NAV_FEATURES.filter(f=>!f.protected).map(f=>[f.key,true])))}
                                    className="text-[10px] px-2.5 py-1 rounded-lg border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-accent hover:border-accent transition-colors">
                                    Select all
                                </button>
                                <button onClick={() => setPerms({})}
                                    className="text-[10px] px-2.5 py-1 rounded-lg border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-red-500 hover:border-red-300 transition-colors">
                                    Clear all
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {GROUP_ORDER.map(group => {
                                const items = ALL_NAV_FEATURES.filter(f => f.group === group);
                                const meta  = GROUP_META[group] || GROUP_META.Tools;
                                const allOn = allInGroup(group);
                                return (
                                    <div key={group} className="rounded-xl border border-border dark:border-border-dark overflow-hidden">
                                        <button onClick={() => !items.every(f=>f.protected) && toggleGroup(group)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                                                <span className="text-xs font-bold text-text-muted dark:text-text-muted-dark uppercase tracking-wider">{group}</span>
                                                <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
                                                    {items.filter(f=>f.protected||permissions[f.key]).length}/{items.length}
                                                </span>
                                            </div>
                                            {!items.every(f=>f.protected) && (
                                                <div className={`w-8 h-4 rounded-full transition-colors ${allOn ? 'bg-accent' : 'bg-gray-200 dark:bg-gray-700'} flex items-center ${allOn ? 'justify-end pr-0.5' : 'justify-start pl-0.5'}`}>
                                                    <div className="w-3 h-3 rounded-full bg-white" />
                                                </div>
                                            )}
                                        </button>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y divide-border dark:divide-border-dark">
                                            {items.map(f => {
                                                const on = f.protected || !!permissions[f.key];
                                                return (
                                                    <button key={f.key} onClick={() => !f.protected && togglePerm(f.key)}
                                                        disabled={f.protected}
                                                        className={`flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors ${f.protected ? 'cursor-default opacity-60' : 'hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer'} ${on ? 'text-text-primary dark:text-text-primary-dark' : 'text-text-muted dark:text-text-muted-dark'}`}>
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${on ? 'border-accent bg-accent' : 'border-gray-300 dark:border-gray-600'}`}>
                                                            {on && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                                        </div>
                                                        <span className={on ? 'font-medium' : ''}>{f.label}</span>
                                                        {f.protected && <Lock className="w-2.5 h-2.5 ml-auto opacity-40 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border dark:border-border-dark shrink-0 bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: color + '20' }}>
                            <Star className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{name || 'Untitled role'}</span>
                        <span className="text-xs text-text-muted dark:text-text-muted-dark">· {visibleCount} pages</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving || !name.trim()}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl text-white disabled:opacity-50 transition-colors shadow-sm"
                            style={{ background: color }}>
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {saving ? 'Saving…' : existing ? 'Save changes' : 'Create role'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Member row ───────────────────────────────────────────────────────────────
function MemberRow({ m, isOwner, canManage, currentUserId, customRoles, siteId, onRefresh, onError }) {
    const [expanded, setExpanded]   = useState(false);
    const { isVisible, toggleVisible, showAll, hiddenCount } = useFeatureStore();
    const [featSaved, setFeatSaved] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const hidden = hiddenCount();

    const myCustomRole = m.custom_role_id
        ? customRoles.find(r => r.id === m.custom_role_id)
        : null;

    const handleRoleChange = async (newRole) => {
        try { await teamAPI.changeRole(siteId, m.user_id, newRole); onRefresh(); }
        catch (e) { onError(e.message); }
    };

    const handleCustomRoleAssign = async (customRoleId) => {
        setAssigning(true);
        try { await teamAPI.assignCustomRole(siteId, m.user_id, customRoleId === '' ? null : parseInt(customRoleId)); onRefresh(); }
        catch (e) { onError(e.message); }
        finally { setAssigning(false); }
    };

    const handleRemove = async () => {
        if (!confirm(`Remove ${m.name} from this site?`)) return;
        try { await teamAPI.removeMember(siteId, m.user_id); onRefresh(); }
        catch (e) { onError(e.message); }
    };

    const toggleFeat = (key) => { toggleVisible(key); setFeatSaved(true); setTimeout(() => setFeatSaved(false), 1500); };

    // Colour for avatar based on name hash
    const avatarColor = ['#6366f1','#8b5cf6','#10b981','#06b6d4','#f59e0b','#ef4444'][
        (m.name?.charCodeAt(0) || 0) % 6
    ];

    return (
        <div className="rounded-xl border border-border dark:border-border-dark overflow-hidden">
            {/* Main row */}
            <div className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white font-bold text-sm"
                    style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}99)` }}>
                    {m.name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{m.name}</span>
                        {m.user_id === currentUserId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-bold">You</span>
                        )}
                        <RoleBadge role={m.role} customRole={myCustomRole} />
                    </div>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">{m.email}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Built-in role selector (owner only, non-owner targets) */}
                    {isOwner && m.role !== 'owner' && m.user_id !== currentUserId && (
                        <select value={m.role} onChange={e => handleRoleChange(e.target.value)}
                            className="text-xs px-2 py-1.5 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/30">
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                        </select>
                    )}

                    {/* Custom role selector (owner/admin, non-owner targets) */}
                    {canManage && m.role !== 'owner' && m.user_id !== currentUserId && customRoles.length > 0 && (
                        <select value={m.custom_role_id || ''} onChange={e => handleCustomRoleAssign(e.target.value)} disabled={assigning}
                            className="text-xs px-2 py-1.5 rounded-lg border border-border dark:border-border-dark bg-bg dark:bg-bg-dark text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/30 max-w-[120px]">
                            <option value="">No custom role</option>
                            {customRoles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Feature manager expand */}
                    <button onClick={() => setExpanded(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${expanded ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:border-accent hover:text-accent'}`}
                        title="Manage sidebar visibility for this member">
                        <Sliders className="w-3 h-3" />
                        <span className="hidden sm:inline">Pages</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Remove */}
                    {isOwner && m.role !== 'owner' && (
                        <button onClick={handleRemove}
                            className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remove member">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded feature manager */}
            {expanded && (
                <div className="border-t border-border dark:border-border-dark bg-gray-50/50 dark:bg-white/[0.02] px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-text-primary dark:text-text-primary-dark">
                            Sidebar visibility
                            <span className="ml-1.5 font-normal text-text-muted dark:text-text-muted-dark">
                                — {m.user_id === currentUserId ? 'your view' : `${m.name}'s view`}
                            </span>
                        </p>
                        <div className="flex items-center gap-2">
                            {featSaved && <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="w-3 h-3" /> Saved</span>}
                            {hidden > 0 && (
                                <button onClick={() => { showAll(); setFeatSaved(true); setTimeout(()=>setFeatSaved(false),1500); }}
                                    className="text-[10px] px-2 py-1 rounded-lg border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-accent hover:border-accent transition-colors flex items-center gap-1">
                                    <RotateCcw className="w-2.5 h-2.5" /> Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Compact feature grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {ALL_NAV_FEATURES.map(f => {
                            const on = f.protected || isVisible(f.key);
                            const meta = GROUP_META[f.group] || GROUP_META.Tools;
                            return (
                                <button key={f.key} onClick={() => !f.protected && toggleFeat(f.key)} disabled={f.protected}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${on ? 'border-accent/20 bg-accent/5 text-text-primary dark:text-text-primary-dark font-medium' : 'border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark opacity-50 line-through'} ${f.protected ? 'cursor-default' : 'hover:opacity-100 cursor-pointer'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? meta.dot : 'bg-gray-300 dark:bg-gray-600'}`} />
                                    {f.label}
                                    {f.protected && <Lock className="w-2.5 h-2.5 ml-auto opacity-40 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// SECTION: Team
// ═══════════════════════════════════════════════════════
function TeamSection({ siteId, currentUser }) {
    const [data, setData]         = useState(null);
    const [loading, setLoading]   = useState(true);
    const [email, setEmail]       = useState('');
    const [role, setRole]         = useState('viewer');
    const [inviting, setInviting] = useState(false);
    const [inviteResult, setInviteResult] = useState(null);
    const [error, setError]       = useState('');
    const [roleModal, setRoleModal] = useState(null); // null | 'new' | {existing role}

    const load = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        try { const r = await teamAPI.listMembers(siteId); setData(r?.data || r); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [siteId]);

    useEffect(() => { load(); }, [load]);

    const members     = data?.members || [];
    const pending     = data?.pendingInvites || [];
    const customRoles = data?.customRoles || [];
    const currentUserId = currentUser?.id;
    const myRole      = members.find(m => m.user_id === currentUserId)?.role ?? 'viewer';
    const canManage   = myRole === 'owner' || myRole === 'admin';
    const isOwner     = myRole === 'owner';

    const handleInvite = async e => {
        e.preventDefault();
        setInviting(true); setInviteResult(null); setError('');
        try {
            const r = await teamAPI.invite(siteId, email.trim(), role);
            const d = r?.data || r;
            setInviteResult(d); setEmail('');
            if (d.type === 'direct') load();
        } catch (e) { setError(e.message || 'Failed'); }
        finally { setInviting(false); }
    };

    const handleDeleteRole = async (roleId) => {
        if (!confirm('Delete this custom role? Members assigned to it will be unassigned.')) return;
        try { await teamAPI.deleteRole(siteId, roleId); load(); }
        catch (e) { setError(e.message); }
    };

    if (!siteId) return (
        <div className="flex flex-col items-center justify-center h-64 text-text-muted dark:text-text-muted-dark">
            <Users className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Select a site to manage team access</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 text-sm text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{error}
                    <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* ── Your role card ── */}
            <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border border-border dark:border-border-dark bg-gradient-to-r from-accent/5 to-transparent">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Your access level</p>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5 truncate font-mono">{siteId}</p>
                </div>
                <RoleBadge role={myRole} size="md" />
            </div>

            {/* ── Custom Roles ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">Custom Roles</h3>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">Define roles with specific page permissions</p>
                    </div>
                    {canManage && (
                        <button onClick={() => setRoleModal('new')}
                            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm shadow-accent/20">
                            <Plus className="w-3.5 h-3.5" /> New Role
                        </button>
                    )}
                </div>

                {customRoles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-text-muted dark:text-text-muted-dark">
                        <Star className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No custom roles yet</p>
                        <p className="text-xs mt-1 opacity-70">Create roles like "Marketing" or "Analyst" with specific page access</p>
                        {canManage && (
                            <button onClick={() => setRoleModal('new')}
                                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-accent hover:border-accent transition-colors">
                                <Plus className="w-3 h-3" /> Create first role
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {customRoles.map(r => {
                            const assigned = members.filter(m => m.custom_role_id === r.id).length;
                            const permsCount = Object.values(r.permissions || {}).filter(Boolean).length;
                            return (
                                <div key={r.id} className="group rounded-xl border border-border dark:border-border-dark p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                                                style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}99)` }}>
                                                <Star className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark truncate" style={{ color: r.color }}>{r.name}</p>
                                                <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">
                                                    {permsCount} pages · {assigned} member{assigned !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button onClick={() => setRoleModal(r)}
                                                    className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                {isOwner && (
                                                    <button onClick={() => handleDeleteRole(r.id)}
                                                        className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {r.description && (
                                        <p className="text-xs text-text-muted dark:text-text-muted-dark mt-2 ml-12 line-clamp-1">{r.description}</p>
                                    )}
                                    {/* Permission chips preview */}
                                    <div className="flex flex-wrap gap-1 mt-2 ml-12">
                                        {Object.entries(r.permissions || {}).filter(([,v])=>v).slice(0,5).map(([k]) => (
                                            <span key={k} className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: r.color + '15', color: r.color }}>
                                                {ALL_NAV_FEATURES.find(f=>f.key===k)?.label || k}
                                            </span>
                                        ))}
                                        {permsCount > 5 && <span className="text-[9px] px-1.5 py-0.5 rounded text-text-muted dark:text-text-muted-dark bg-gray-100 dark:bg-gray-800">+{permsCount-5} more</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Invite form ── */}
            {canManage && (
                <div className="rounded-2xl border border-border dark:border-border-dark overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border dark:border-border-dark bg-gray-50/50 dark:bg-white/[0.02]">
                        <UserPlus className="w-4 h-4 text-accent" />
                        <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Invite a teammate</span>
                    </div>
                    <div className="p-5">
                        <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[180px]">
                                <label className={LABEL}>Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="teammate@company.com" required className={INPUT} />
                            </div>
                            <div className="w-32">
                                <label className={LABEL}>Base role</label>
                                <select value={role} onChange={e => setRole(e.target.value)} className={INPUT}>
                                    <option value="viewer">Viewer</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <button type="submit" disabled={inviting || !email.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-sm shadow-accent/20">
                                {inviting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                {inviting ? 'Sending…' : 'Send Invite'}
                            </button>
                        </form>

                        {inviteResult && (
                            <div className={`mt-4 rounded-xl border p-4 ${inviteResult.type === 'direct' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200'}`}>
                                {inviteResult.type === 'direct' ? (
                                    <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <strong>{inviteResult.email}</strong> added directly as <strong>{inviteResult.role}</strong>.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-2">
                                            <Link2 className="w-4 h-4" /> Invite link for <strong>{inviteResult.email}</strong>
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-700/50 text-xs font-mono text-indigo-700 dark:text-indigo-300 truncate">
                                                {inviteResult.inviteUrl}
                                            </code>
                                            <button onClick={() => navigator.clipboard?.writeText(inviteResult.inviteUrl)}
                                                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors">
                                                <Copy className="w-3.5 h-3.5" /> Copy
                                            </button>
                                        </div>
                                        <button onClick={() => setInviteResult(null)} className="text-xs text-indigo-500 hover:underline">Dismiss</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Members list ── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">
                        Members <span className="text-text-muted dark:text-text-muted-dark font-normal">({members.length})</span>
                    </h3>
                    <button onClick={load} className="p-1.5 rounded-lg text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading && !data && <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-text-muted dark:text-text-muted-dark" /></div>}

                <div className="space-y-2">
                    {members.map(m => (
                        <MemberRow key={m.user_id} m={m} isOwner={isOwner} canManage={canManage}
                            currentUserId={currentUserId} customRoles={customRoles} siteId={siteId}
                            onRefresh={load} onError={setError} />
                    ))}
                </div>

                {data && members.length === 0 && (
                    <div className="py-8 text-center text-text-muted dark:text-text-muted-dark text-sm">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />No members yet
                    </div>
                )}
            </div>

            {/* ── Pending invites ── */}
            {pending.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">
                        Pending Invites <span className="text-text-muted dark:text-text-muted-dark font-normal">({pending.length})</span>
                    </h3>
                    {pending.map(inv => (
                        <div key={inv.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10">
                            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">{inv.email}</span>
                                    <RoleBadge role={inv.role} />
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold">Pending</span>
                                </div>
                                <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">
                                    By {inv.invited_by_name} · Expires {new Date(inv.expires_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/join?token=${inv.token}`)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-accent hover:border-accent transition-colors">
                                    <Copy className="w-3 h-3" /> Copy
                                </button>
                                {canManage && (
                                    <button onClick={async () => { try { await teamAPI.cancelInvite(inv.token); load(); } catch(e){setError(e.message);} }}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Custom role modal */}
            {roleModal && (
                <RoleBuilderModal
                    siteId={siteId}
                    existing={roleModal === 'new' ? null : roleModal}
                    onClose={() => setRoleModal(null)}
                    onSaved={() => load()}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// SECTION: Feature Manager (personal)
// ═══════════════════════════════════════════════════════
function FeatureSection() {
    const { isVisible, toggleVisible, showAll, hiddenCount } = useFeatureStore();
    const [saved, setSaved] = useState(false);
    const hidden = hiddenCount();
    const toggle = key => { toggleVisible(key); setSaved(true); setTimeout(()=>setSaved(false),1500); };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">Navigation Visibility</h3>
                    <p className="text-xs text-text-muted dark:text-text-muted-dark mt-0.5">Control which pages appear in your sidebar</p>
                </div>
                <div className="flex items-center gap-2">
                    {saved && <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>}
                    {hidden > 0 && (
                        <button onClick={() => { showAll(); setSaved(true); setTimeout(()=>setSaved(false),2000); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border dark:border-border-dark text-text-muted dark:text-text-muted-dark hover:text-accent hover:border-accent transition-colors">
                            <RotateCcw className="w-3 h-3" /> Reset ({hidden} hidden)
                        </button>
                    )}
                </div>
            </div>

            <div className="rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-900/10 px-4 py-3 flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    <strong>This controls your personal sidebar.</strong> To set what your teammates see, use the <strong>Team tab</strong> and click the Pages button next to each member.
                </p>
            </div>

            {hidden > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {ALL_NAV_FEATURES.filter(f => !f.protected && !isVisible(f.key)).map(f => {
                        const meta = GROUP_META[f.group] || GROUP_META.Tools;
                        return (
                            <span key={f.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-current/20 ${meta.bg} ${meta.color}`}>
                                <EyeOff className="w-3 h-3" />{f.label}
                                <button onClick={() => toggle(f.key)} className="ml-0.5 hover:opacity-70">×</button>
                            </span>
                        );
                    })}
                </div>
            )}

            <div className="space-y-4">
                {GROUP_ORDER.map(group => {
                    const items   = ALL_NAV_FEATURES.filter(f => f.group === group);
                    const meta    = GROUP_META[group] || GROUP_META.Tools;
                    const visCount = items.filter(f => isVisible(f.key)).length;
                    const allVis  = items.every(f => f.protected || isVisible(f.key));
                    return (
                        <div key={group} className="rounded-xl border border-border dark:border-border-dark overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-white/[0.03]">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                                    <span className="text-xs font-bold text-text-muted dark:text-text-muted-dark uppercase tracking-wider">{group}</span>
                                    <span className="text-[10px] text-text-muted dark:text-text-muted-dark">{visCount}/{items.length}</span>
                                </div>
                                {!items.every(f=>f.protected) && (
                                    <button onClick={() => { items.filter(f=>!f.protected).forEach(f=>{ if(allVis?isVisible(f.key):!isVisible(f.key)) toggle(f.key); }); }}
                                        className="text-[10px] text-text-muted dark:text-text-muted-dark hover:text-accent px-2 py-0.5 rounded border border-border dark:border-border-dark transition-colors">
                                        {allVis ? 'Hide group' : 'Show group'}
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-border dark:divide-border-dark">
                                {items.map(f => {
                                    const on = f.protected || isVisible(f.key);
                                    return (
                                        <button key={f.key} onClick={() => !f.protected && toggle(f.key)} disabled={f.protected}
                                            className={`flex items-center gap-2.5 px-4 py-3 text-xs transition-colors ${f.protected ? 'cursor-default opacity-60' : 'hover:bg-gray-50 dark:hover:bg-white/5'} ${on ? 'text-text-primary dark:text-text-primary-dark font-medium' : 'text-text-muted dark:text-text-muted-dark'}`}>
                                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${on ? 'bg-accent border-accent' : 'border-gray-300 dark:border-gray-600'}`}>
                                                {on && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                            </div>
                                            {f.label}
                                            {f.protected && <Lock className="w-2.5 h-2.5 ml-auto opacity-40 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center gap-8 pt-4 border-t border-border dark:border-border-dark">
                {[
                    { label: 'Visible',   value: ALL_NAV_FEATURES.filter(f=>isVisible(f.key)).length, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Hidden',    value: hidden,                                               color: 'text-red-500 dark:text-red-400' },
                    { label: 'Protected', value: ALL_NAV_FEATURES.filter(f=>f.protected).length,      color: 'text-gray-400 dark:text-gray-500' },
                ].map(({ label, value, color }) => (
                    <div key={label}>
                        <div className={`text-2xl font-black ${color}`}>{value}</div>
                        <div className="text-[10px] text-text-muted dark:text-text-muted-dark uppercase tracking-wider">{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// Main Profile — full-screen sidebar layout
// ═══════════════════════════════════════════════════════
const NAV_ITEMS = [
    { id: 'general',  icon: User,        label: 'General'         },
    { id: 'security', icon: Shield,      label: 'Security'        },
    { id: 'team',     icon: Users,       label: 'Team'            },
    { id: 'features', icon: LayoutGrid,  label: 'Feature Manager' },
];

export default function Profile() {
    const user    = useAuthStore(s => s.user);
    const siteId  = useSiteStore(s => s.siteId);
    const sites   = useSiteStore(s => s.sites);

    const [profile, setProfile] = useState(() =>
        loadProfile() || { name: user?.name || 'User', email: user?.email || '', role: 'Owner', timezone: '', notifications: true }
    );
    const [saved, setSaved]         = useState(false);
    const [activeSection, setActive] = useState('general');

    useEffect(() => {
        if (user) setProfile(p => ({ ...p, name: p.name || user.name, email: p.email || user.email }));
        setProfile(p => ({ ...p, timezone: p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone }));
    }, [user?.id]);

    const initials   = (profile.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const handleSave = () => { saveProfile(profile); setSaved(true); setTimeout(() => setSaved(false), 2000); };
    const update     = (f, v) => setProfile(p => ({ ...p, [f]: v }));
    const { hiddenCount } = useFeatureStore.getState();
    const hiddenN = hiddenCount();
    const activeSite = sites?.find(s => s.id === siteId);

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 -mt-6">

            {/* ── Left sidebar ── */}
            <aside className="w-64 shrink-0 flex flex-col border-r border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-y-auto">

                {/* Profile card */}
                <div className="p-5 border-b border-border dark:border-border-dark">
                    <div className="relative mb-4">
                        {/* Cover */}
                        <div className="h-14 rounded-xl bg-gradient-to-br from-accent/40 via-purple-500/25 to-pink-500/10" />
                        {/* Avatar */}
                        <div className="absolute -bottom-5 left-3">
                            <div className="relative group">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white font-black text-base shadow-lg shadow-accent/30 ring-2 ring-card dark:ring-card-dark">
                                    {initials}
                                </div>
                                <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                    <Camera className="w-3.5 h-3.5 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-7">
                        <p className="text-sm font-bold text-text-primary dark:text-text-primary-dark truncate">{profile.name}</p>
                        <p className="text-xs text-text-muted dark:text-text-muted-dark truncate">{profile.email}</p>
                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/10 text-accent border border-accent/20 uppercase">
                            <Crown className="w-2.5 h-2.5" />{profile.role}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 border-b border-border dark:border-border-dark divide-x divide-border dark:divide-border-dark">
                    {[
                        { label: 'Sites',  value: sites?.length || 0,  color: '' },
                        { label: 'Team',   value: '—',                  color: '' },
                        { label: 'Hidden', value: hiddenN,              color: hiddenN > 0 ? 'text-amber-500' : '' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="py-3 text-center">
                            <div className={`text-base font-black text-text-primary dark:text-text-primary-dark ${color}`}>{value}</div>
                            <div className="text-[9px] text-text-muted dark:text-text-muted-dark uppercase tracking-wider">{label}</div>
                        </div>
                    ))}
                </div>

                {/* Site badge */}
                {activeSite && (
                    <div className="px-4 py-3 border-b border-border dark:border-border-dark">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark">
                            <Activity className="w-3.5 h-3.5 text-accent shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-text-muted dark:text-text-muted-dark">Active site</p>
                                <p className="text-xs font-semibold text-text-primary dark:text-text-primary-dark truncate">{activeSite.name}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-3 space-y-0.5">
                    {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
                        const active = activeSection === id;
                        return (
                            <button key={id} onClick={() => setActive(id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${active ? 'bg-accent/10 text-accent' : 'text-text-secondary dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-text-primary-dark'}`}>
                                <Icon className="w-4 h-4 shrink-0" />
                                {label}
                                {id === 'features' && hiddenN > 0 && (
                                    <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">{hiddenN}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Version tag */}
                <div className="p-4 border-t border-border dark:border-border-dark">
                    <p className="text-[10px] text-text-muted dark:text-text-muted-dark text-center">InsightsTrack · Profile settings</p>
                </div>
            </aside>

            {/* ── Main content ── */}
            <main className="flex-1 overflow-y-auto bg-bg dark:bg-bg-dark">
                <div className="max-w-3xl mx-auto p-6 sm:p-8 space-y-6">

                    {/* Section title */}
                    <div>
                        <h1 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                            {NAV_ITEMS.find(n => n.id === activeSection)?.label}
                        </h1>
                        <p className="text-sm text-text-muted dark:text-text-muted-dark mt-0.5">
                            {activeSection === 'general'  && 'Your account details and notification preferences'}
                            {activeSection === 'security' && 'Password and active sessions'}
                            {activeSection === 'team'     && 'Invite teammates, define custom roles, manage access'}
                            {activeSection === 'features' && 'Control which pages appear in your personal sidebar'}
                        </p>
                    </div>

                    {/* ── General ── */}
                    {activeSection === 'general' && (
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-6 space-y-4">
                                <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">Personal Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label className={LABEL}>Full Name</label><input type="text" value={profile.name} onChange={e => update('name', e.target.value)} className={INPUT} /></div>
                                    <div><label className={LABEL}>Email</label><input type="email" value={profile.email} onChange={e => update('email', e.target.value)} className={INPUT} /></div>
                                    <div><label className={LABEL}>Display Role</label>
                                        <select value={profile.role} onChange={e => update('role', e.target.value)} className={INPUT}>
                                            <option value="Owner">Owner</option>
                                            <option value="Admin">Admin</option>
                                            <option value="Viewer">Viewer</option>
                                        </select>
                                    </div>
                                    <div><label className={LABEL}>Timezone</label><input type="text" value={profile.timezone} onChange={e => update('timezone', e.target.value)} className={INPUT} /></div>
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm shadow-accent/20">
                                        <Save className="w-4 h-4" />{saved ? 'Saved!' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-6 space-y-1">
                                <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark mb-4">Notifications</h3>
                                {[
                                    { id: 'traffic_alerts',   label: 'Traffic Alerts',  desc: 'Spikes and drops in visitor traffic' },
                                    { id: 'weekly_reports',   label: 'Weekly Digest',   desc: 'Summary of your analytics each week' },
                                    { id: 'goal_completions', label: 'Goal Events',     desc: 'When conversion goals are reached' },
                                    { id: 'uptime',           label: 'Uptime Alerts',   desc: 'When tracked sites go down' },
                                ].map(item => (
                                    <div key={item.id} className="flex items-center justify-between py-3 border-b border-border dark:border-border-dark last:border-0">
                                        <div>
                                            <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark">{item.label}</p>
                                            <p className="text-xs text-text-muted dark:text-text-muted-dark">{item.desc}</p>
                                        </div>
                                        <label className="relative inline-flex cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-accent rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Security ── */}
                    {activeSection === 'security' && (
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-6 space-y-4">
                                <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">Change Password</h3>
                                <div className="space-y-3 max-w-sm">
                                    {['Current password', 'New password', 'Confirm new password'].map(p => (
                                        <input key={p} type="password" placeholder={p} className={INPUT} />
                                    ))}
                                    <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm shadow-accent/20">
                                        <Lock className="w-4 h-4" /> Update Password
                                    </button>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-6 space-y-4">
                                <h3 className="text-sm font-bold text-text-primary dark:text-text-primary-dark">Active Sessions</h3>
                                <div className="flex items-center justify-between p-4 rounded-xl bg-bg dark:bg-bg-dark border border-border dark:border-border-dark">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">Current Session</p>
                                            <p className="text-xs text-text-muted dark:text-text-muted-dark">{navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser'} · {navigator.platform}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">Active now</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Team ── */}
                    {activeSection === 'team' && (
                        <TeamSection siteId={siteId} currentUser={user} />
                    )}

                    {/* ── Feature Manager ── */}
                    {activeSection === 'features' && (
                        <div className="rounded-2xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-6">
                            <FeatureSection />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
