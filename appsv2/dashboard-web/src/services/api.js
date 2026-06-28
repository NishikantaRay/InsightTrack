import axios from 'axios';

function buildBaseURL() {
    let url = import.meta.env.VITE_API_URL;
    if (!url) return '/api';
    // Ensure the URL has a protocol — guard against Cloudflare env vars missing https://
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return `${url}/api`;
}

const api = axios.create({
    baseURL: buildBaseURL(),
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('analytics-token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        // Auto-logout on 401 — token expired or invalidated server-side.
        // Import is deferred to avoid a circular dependency at module init time.
        if (error.response?.status === 401) {
            // Clear auth state and redirect to login without a full page reload.
            // We use a custom event so the Zustand store (loaded separately) can react.
            localStorage.removeItem('analytics-token');
            localStorage.removeItem('analytics-user-profile');
            window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'session_expired' } }));
        }
        const payload = error.response?.data || {};
        const message = payload.error || error.message || 'Request failed';
        const enriched = new Error(message);
        enriched.status = error.response?.status;
        // SQL editor diagnostics are intentional developer-facing details (line/col info)
        // Only attach them when the response explicitly includes them — not for all errors
        if (payload.diagnostics) enriched.diagnostics = payload.diagnostics;
        if (payload.requestId)   enriched.requestId   = payload.requestId;
        if (error.code === 'ERR_CANCELED') enriched.code = 'ERR_CANCELED';
        // Never forward raw stack traces, file paths, or env var names to the UI
        // (The backend's safeError utility ensures these aren't sent, but double-check)
        delete enriched.stack;
        return Promise.reject(enriched);
    }
);

// Analytics endpoints
export const analyticsAPI = {
    getKPIs: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/kpi`, { params: { dateRange } }),

    getTraffic: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/traffic`, { params: { dateRange } }),

    getBounceRateTrend: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/bounce-rate-trend`, { params: { dateRange } }),

    getAvgSessionTrend: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/avg-session-trend`, { params: { dateRange } }),

    getPageviews: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/pageviews`, { params: { dateRange } }),

    getTopPages: (siteId, dateRange, limit = 10) =>
        api.get(`/analytics/${siteId}/top-pages`, { params: { dateRange, limit } }),

    getSources: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/sources`, { params: { dateRange } }),

    getDevices: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/devices`, { params: { dateRange } }),

    getCountries: (siteId, dateRange, limit = 10) =>
        api.get(`/analytics/${siteId}/countries`, { params: { dateRange, limit } }),

    getSessions: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/sessions`, { params: { dateRange } }),

    getFunnelSteps: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/funnel/steps`, { params: { dateRange } }),

    getFunnel: (siteId, dateRange, steps) => {
        const params = { dateRange };
        if (steps && steps.length > 0) params.steps = JSON.stringify(steps);
        return api.get(`/analytics/${siteId}/funnel`, { params });
    },

    getRealtime: (siteId) =>
        api.get(`/analytics/${siteId}/realtime`),

    getRealtimeEventStream: (siteId, limit = 50) =>
        api.get(`/analytics/${siteId}/realtime/event-stream`, { params: { limit } }),

    getUTM: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/utm`, { params: { dateRange } }),
    getUTMLinkStats: (siteId, source, medium, campaign) =>
        api.get(`/analytics/${siteId}/utm-link-stats`, { params: { source, medium, campaign, dateRange: 'all' } }),

    getComparison: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/comparison`, { params: { dateRange } }),

    getUserFlow: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/user-flow`, { params: { dateRange } }),

    getAlerts: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/alerts`, { params: { dateRange } }),

    getAll: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/all`, { params: { dateRange } }),

    // Engagement endpoints
    getEngagementSummary: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/engagement/summary`, { params: { dateRange } }),

    getScrollDepth: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/engagement/scroll-depth`, { params: { dateRange } }),

    getHeatmap: (siteId, dateRange, path = '/') =>
        api.get(`/analytics/${siteId}/engagement/heatmap`, { params: { dateRange, path } }),

    getHeatmapSummary: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/engagement/heatmap-summary`, { params: { dateRange } }),

    getPageActions: (siteId, dateRange, path = '/') =>
        api.get(`/analytics/${siteId}/page-actions`, { params: { dateRange, path } }),

    getRageClicks: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/engagement/rage-clicks`, { params: { dateRange } }),

    getTimeOnPage: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/engagement/time-on-page`, { params: { dateRange } }),

    // Conversion & Goals endpoints
    getGoalConversions: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/goals/conversions`, { params: { dateRange } }),

    getGoalConversionsOverTime: (siteId, dateRange, goalId) =>
        api.get(`/analytics/${siteId}/goals/conversions-over-time`, { params: { dateRange, goalId } }),

    getABTestResults: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/ab-tests/results`, { params: { dateRange } }),

    // Audience endpoints
    getNewVsReturning: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/audience/new-vs-returning`, { params: { dateRange } }),

    getCohorts: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/audience/cohorts`, { params: { dateRange } }),

    getSegments: (siteId, dateRange, filters = {}) =>
        api.get(`/analytics/${siteId}/audience/segments`, { params: { dateRange, ...filters } }),

    // Revenue endpoint
    getRevenue: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/revenue`, { params: { dateRange } }),

    // Content endpoints
    getEntryPages: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/content/entry-pages`, { params: { dateRange } }),
    getExitPages: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/content/exit-pages`, { params: { dateRange } }),
    getSiteSearch: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/content/site-search`, { params: { dateRange } }),

    // Acquisition endpoints
    getCampaigns: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/acquisition/campaigns`, { params: { dateRange } }),
    getSocialMedia: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/acquisition/social`, { params: { dateRange } }),
    getSearchKeywords: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/acquisition/keywords`, { params: { dateRange } }),

    // Performance endpoints
    getWebVitals: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/performance/web-vitals`, { params: { dateRange } }),
    getWebVitalsOverview: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/performance/web-vitals-overview`, { params: { dateRange } }),
    getJSErrors: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/performance/errors`, { params: { dateRange } }),
    getJSErrorsOverTime: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/performance/errors-over-time`, { params: { dateRange } }),

    // Annotations
    getAnnotations: (siteId, dateRange) =>
        api.get(`/analytics/${siteId}/annotations`, { params: { dateRange } }),
};

// Sites endpoints
export const sitesAPI = {
    list: () => api.get('/sites'),
    get: (siteId) => api.get(`/sites/${siteId}`),
    create: (data) => api.post('/sites', data),
    update: (siteId, data) => api.put(`/sites/${siteId}`, data),
    delete: (siteId) => api.delete(`/sites/${siteId}`),
};

// Goals & A/B Tests endpoints (write operations)
export const goalsAPI = {
    list: (siteId) => api.get(`/goals/${siteId}`),
    create: (siteId, data) => api.post(`/goals/${siteId}`, data),
    delete: (siteId, goalId) => api.delete(`/goals/${siteId}/${goalId}`),
    listABTests: (siteId) => api.get(`/goals/${siteId}/ab-tests`),
    createABTest: (siteId, data) => api.post(`/goals/${siteId}/ab-tests`, data),
    updateABTestStatus: (siteId, testId, status) => api.put(`/goals/${siteId}/ab-tests/${testId}/status`, { status }),
    deleteABTest: (siteId, testId) => api.delete(`/goals/${siteId}/ab-tests/${testId}`),
};

// Reporting endpoints (write operations via the unified analytics API)
export const reportingAPI = {
    // Annotations
    listAnnotations: (siteId) => api.get(`/reporting/${siteId}/annotations`),
    createAnnotation: (siteId, data) => api.post(`/reporting/${siteId}/annotations`, data),
    deleteAnnotation: (siteId, id) => api.delete(`/reporting/${siteId}/annotations/${id}`),

    // Scheduled Reports
    listReports: (siteId) => api.get(`/reporting/${siteId}/reports`),
    createReport: (siteId, data) => api.post(`/reporting/${siteId}/reports`, data),
    updateReport: (siteId, id, data) => api.put(`/reporting/${siteId}/reports/${id}`, data),
    deleteReport: (siteId, id) => api.delete(`/reporting/${siteId}/reports/${id}`),

    // Custom Dashboards
    listDashboards: (siteId) => api.get(`/reporting/${siteId}/dashboards`),
    createDashboard: (siteId, data) => api.post(`/reporting/${siteId}/dashboards`, data),
    updateDashboard: (siteId, id, data) => api.put(`/reporting/${siteId}/dashboards/${id}`, data),
    deleteDashboard: (siteId, id) => api.delete(`/reporting/${siteId}/dashboards/${id}`),

    // Data Retention
    getRetention: (siteId) => api.get(`/reporting/${siteId}/retention`),
    upsertRetention: (siteId, data) => api.put(`/reporting/${siteId}/retention`, data),
    runCleanup: (siteId) => api.post(`/reporting/${siteId}/retention/cleanup`),

    // UTM link builder saved links
    listUtmLinks: (siteId) => api.get(`/reporting/${siteId}/utm-links`),
    saveUtmLink: (siteId, data) => api.post(`/reporting/${siteId}/utm-links`, data),
    deleteUtmLink: (siteId, linkId) => api.delete(`/reporting/${siteId}/utm-links/${linkId}`),
};

// Auth endpoints
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    me: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/me', data),
};

// SQL Editor endpoints
export const sqlEditorAPI = {
    getSchema: (siteId) => api.get(`/sql-editor/${siteId}/schema`),
    runQuery: (siteId, payload, options = {}) => {
        const body = typeof payload === 'string' ? { query: payload } : payload;
        return api.post(`/sql-editor/${siteId}/run`, body, {
            signal: options.signal,
        });
    },
    listSavedQueries: (siteId) => api.get(`/sql-editor/${siteId}/saved`),
    createSavedQuery: (siteId, data) => api.post(`/sql-editor/${siteId}/saved`, data),
    updateSavedQuery: (siteId, savedId, data) => api.put(`/sql-editor/${siteId}/saved/${savedId}`, data),
    deleteSavedQuery: (siteId, savedId) => api.delete(`/sql-editor/${siteId}/saved/${savedId}`),
};

// Team management endpoints
export const teamAPI = {
    listMembers:      (siteId)                               => api.get(`/team/${siteId}/members`),
    invite:           (siteId, email, role)                  => api.post(`/team/${siteId}/invite`, { email, role }),
    changeRole:       (siteId, userId, role)                 => api.put(`/team/${siteId}/members/${userId}`, { role }),
    removeMember:     (siteId, userId)                       => api.delete(`/team/${siteId}/members/${userId}`),
    cancelInvite:     (token)                                => api.delete(`/invite/${token}`),
    getInviteInfo:    (token)                                => api.get(`/invite/${token}`),
    acceptInvite:     (token)                                => api.post(`/invite/${token}/accept`),
    // Custom roles
    listRoles:        (siteId)                               => api.get(`/team/${siteId}/roles`),
    createRole:       (siteId, data)                         => api.post(`/team/${siteId}/roles`, data),
    updateRole:       (siteId, roleId, data)                 => api.put(`/team/${siteId}/roles/${roleId}`, data),
    deleteRole:       (siteId, roleId)                       => api.delete(`/team/${siteId}/roles/${roleId}`),
    assignCustomRole: (siteId, userId, customRoleId)         => api.put(`/team/${siteId}/members/${userId}/custom-role`, { customRoleId }),
};

// Demo — grant the current user access to the public demo site
export const demoAPI = {
    join: () => api.post('/demo/join'),
};

export default api;
