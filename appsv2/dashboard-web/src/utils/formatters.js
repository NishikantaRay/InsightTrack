export function formatNumber(num) {
    if (num == null) return '—';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
}

export function formatDuration(seconds) {
    if (seconds == null) return '—';
    const s = Math.round(seconds);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return `${m}m ${rem}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

export function formatPercent(value) {
    if (value == null) return '—';
    return `${Number(value).toFixed(1)}%`;
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateFull(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export const CHART_COLORS = ['#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

export const DATE_RANGES = [
    { label: 'Today', value: '1d' },
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'Custom Range', value: 'custom' },
];
