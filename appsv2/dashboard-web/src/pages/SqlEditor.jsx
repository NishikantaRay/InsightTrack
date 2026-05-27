import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
    Play,
    Database,
    ChevronDown,
    ChevronRight,
    Copy,
    Download,
    Trash2,
    Clock,
    AlertCircle,
    CheckCircle2,
    History,
    X,
    Info,
    Columns,
    Table2,
    Save,
    BarChart3,
    Filter,
    Search,
    PauseCircle,
    FolderOpen,
    Folder,
} from 'lucide-react';
import SqlCodeEditor from '../components/SqlCodeEditor';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    LineChart,
    Line,
} from 'recharts';
import { sqlEditorAPI } from '../services/api';
import { useSiteStore } from '../store/useSiteStore';

const HISTORY_KEY = 'sql-editor-history';
const MAX_HISTORY = 50;

const EXAMPLE_QUERIES = [
    {
        label: 'Top pages this month',
        sql: `SELECT path, COUNT(*) AS pageviews
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
  AND timestamp >= NOW() - INTERVAL 30 DAYS
GROUP BY path
ORDER BY pageviews DESC
LIMIT 20`,
    },
    {
        label: 'Traffic by country',
        sql: `SELECT country, COUNT(*) AS visits
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
GROUP BY country
ORDER BY visits DESC
LIMIT 20`,
    },
    {
        label: 'Device breakdown',
        sql: `SELECT device, COUNT(*) AS sessions
FROM sessions
WHERE site_id = {{site_id}}
GROUP BY device
ORDER BY sessions DESC`,
    },
    {
        label: 'Daily pageviews (last 30 days)',
        sql: `SELECT CAST(timestamp AS DATE) AS date,
       COUNT(*) AS pageviews
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
  AND timestamp >= NOW() - INTERVAL 30 DAYS
GROUP BY date
ORDER BY date`,
    },
    {
        label: 'Top referrers',
        sql: `SELECT referrer, COUNT(*) AS visits
FROM events
WHERE site_id = {{site_id}}
  AND type = 'pageview'
  AND referrer IS NOT NULL
  AND referrer <> ''
GROUP BY referrer
ORDER BY visits DESC
LIMIT 20`,
    },
];

const SQL_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'WITH', 'COUNT', 'SUM'];

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveHistory(entries) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

function toCSV(columns, rows) {
    const escape = (v) => {
        if (v == null) return '';
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    return [
        columns.map(escape).join(','),
        ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n');
}

function downloadText(content, filename, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/** Minimal Parquet-like export: NDJSON wrapped as .parquet.json for tooling */
function toParquetJson(columns, rows) {
    return rows
        .map((row) => JSON.stringify(Object.fromEntries(columns.map((c, i) => [c, row[i]]))))
        .join('\n');
}

function extractTemplateVariables(sql) {
    const matches = [...sql.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)];
    return [...new Set(matches.map((m) => m[1]))];
}

function coerceVariableInput(value) {
    if (value == null || value.trim() === '') return null;
    if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
    if (!Number.isNaN(Number(value))) return Number(value);
    return value;
}

function DiagnosticsBanner({ error, onClose }) {
    if (!error) return null;

    const line = error?.diagnostics?.line;
    const column = error?.diagnostics?.column;

    return (
        <div className="m-4 flex gap-3 p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                    Query Error
                </p>
                <p className="text-xs font-mono text-red-600 dark:text-red-300 whitespace-pre-wrap break-all">
                    {error.message}
                </p>
                {(line || column) && (
                    <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
                        {line ? `Line ${line}` : 'Line ?'}{column ? `, Column ${column}` : ''}
                    </p>
                )}
                {error?.requestId && (
                    <p className="mt-1 text-[11px] text-red-700/80 dark:text-red-300/80">
                        Request ID: {error.requestId}
                    </p>
                )}
            </div>
            <button onClick={onClose} className="ml-auto text-red-400 hover:text-red-600 shrink-0">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

function SchemaTree({ schema, onInsertToken }) {
    const [open, setOpen] = useState({});

    const toggle = (name) => setOpen((p) => ({ ...p, [name]: !p[name] }));

    if (!schema || Object.keys(schema).length === 0) {
        return (
            <p className="px-3 py-4 text-xs text-text-secondary dark:text-text-secondary-dark">
                No schema available
            </p>
        );
    }

    return (
        <div className="text-xs">
            {Object.entries(schema).map(([table, cols]) => (
                <div key={table}>
                    <button
                        onClick={() => toggle(table)}
                        className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/5 text-left"
                    >
                        {open[table] ? (
                            <ChevronDown className="w-3 h-3 shrink-0 text-text-muted dark:text-text-muted-dark" />
                        ) : (
                            <ChevronRight className="w-3 h-3 shrink-0 text-text-muted dark:text-text-muted-dark" />
                        )}
                        <Table2 className="w-3.5 h-3.5 shrink-0 text-accent" />
                        <span
                            className="font-medium text-text-primary dark:text-text-primary-dark truncate"
                            onDoubleClick={() => onInsertToken(table)}
                            title="Double click to insert table name"
                        >
                            {table}
                        </span>
                        <span className="ml-auto text-text-muted dark:text-text-muted-dark">{cols.length}</span>
                    </button>
                    {open[table] && (
                        <div className="pl-8 pr-3 pb-1 space-y-px">
                            {cols.map((col) => (
                                <button
                                    key={col.name}
                                    onClick={() => onInsertToken(col.name)}
                                    className="w-full flex items-center gap-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-white/5 rounded"
                                >
                                    <Columns className="w-3 h-3 shrink-0 text-text-muted dark:text-text-muted-dark" />
                                    <span className="truncate text-text-secondary dark:text-text-secondary-dark">{col.name}</span>
                                    <span className="ml-auto text-text-muted dark:text-text-muted-dark text-[10px] shrink-0">{col.type}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function ChartPreview({ columns, rows }) {
    const numericColumn = useMemo(() => {
        if (!columns || columns.length < 2 || !rows?.length) return null;
        const idx = columns.findIndex((_, colIndex) => rows.every((r) => r[colIndex] == null || !Number.isNaN(Number(r[colIndex]))));
        return idx >= 0 ? idx : null;
    }, [columns, rows]);

    const categoryColumn = useMemo(() => {
        if (!columns?.length) return 0;
        return 0;
    }, [columns]);

    const chartData = useMemo(() => {
        if (numericColumn == null || categoryColumn == null) return [];
        return rows.slice(0, 50).map((row) => ({
            x: String(row[categoryColumn] ?? 'N/A'),
            y: Number(row[numericColumn] ?? 0),
        }));
    }, [rows, numericColumn, categoryColumn]);

    if (!chartData.length) {
        return (
            <div className="h-full flex items-center justify-center text-xs text-text-muted dark:text-text-muted-dark">
                Need at least one label column and one numeric column to chart.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 h-full overflow-auto">
            <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-3 h-80">
                <p className="text-xs font-medium text-text-primary dark:text-text-primary-dark mb-2">Bar</p>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="x" hide />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="y" fill="#3b82f6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-3 h-80">
                <p className="text-xs font-medium text-text-primary dark:text-text-primary-dark mb-2">Line</p>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="x" hide />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="y" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default function SqlEditor() {
    const { siteId } = useSiteStore();

    const [query, setQuery] = useState(
        `-- Write your SQL here. Use {{site_id}} plus custom variables.
SELECT path, COUNT(*) AS pageviews
FROM events
WHERE site_id = {{site_id}}
GROUP BY path
ORDER BY pageviews DESC
LIMIT 20`,
    );

    const [schema, setSchema] = useState(null);
    const [schemaLoading, setSchemaLoading] = useState(false);

    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);

    const [history, setHistory] = useState(loadHistory);
    const [showHistory, setShowHistory] = useState(false);
    const [showExamples, setShowExamples] = useState(false);

    const [savedQueries, setSavedQueries] = useState([]);
    const [showSavedQueries, setShowSavedQueries] = useState(true);
    const [saveName, setSaveName] = useState('');
    const [saveFolder, setSaveFolder] = useState('');
    const [openFolders, setOpenFolders] = useState({});

    const [variables, setVariables] = useState({});
    const [timeoutMs, setTimeoutMs] = useState(15000);
    const [explainMode, setExplainMode] = useState(false);

    const [gridFilter, setGridFilter] = useState('');
    const [sortBy, setSortBy] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const [viewMode, setViewMode] = useState('table'); // table|chart

    // CodeMirror EditorView ref — used for programmatic token insertion
    const editorViewRef = useRef(null);
    const abortRef = useRef(null);

    const templateVariables = useMemo(() => extractTemplateVariables(query), [query]);

    // Insert a token at the current cursor position in the CodeMirror editor
    const insertToken = useCallback((token) => {
        const view = editorViewRef.current;
        if (!view) {
            setQuery((q) => `${q} ${token}`);
            return;
        }
        const { from, to } = view.state.selection.main;
        view.dispatch({
            changes: { from, to, insert: token },
            selection: { anchor: from + token.length },
        });
        view.focus();
    }, []);

    const loadSchema = useCallback(async () => {
        if (!siteId) return;
        setSchemaLoading(true);
        try {
            const data = await sqlEditorAPI.getSchema(siteId);
            setSchema(data.schema ?? data);
        } catch {
            setSchema({});
        } finally {
            setSchemaLoading(false);
        }
    }, [siteId]);

    const loadSavedQueries = useCallback(async () => {
        if (!siteId) return;
        try {
            const data = await sqlEditorAPI.listSavedQueries(siteId);
            setSavedQueries(data.queries ?? []);
        } catch {
            setSavedQueries([]);
        }
    }, [siteId]);

    useEffect(() => {
        loadSchema();
        loadSavedQueries();
    }, [loadSchema, loadSavedQueries]);

    const runQuery = useCallback(async () => {
        if (!siteId || !query.trim() || running) return;

        const variablePayload = Object.fromEntries(
            templateVariables.map((name) => [name, coerceVariableInput(variables[name] ?? '')]),
        );

        setRunning(true);
        setError(null);
        setResult(null);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const data = await sqlEditorAPI.runQuery(
                siteId,
                {
                    query,
                    variables: variablePayload,
                    timeoutMs,
                    explain: explainMode,
                },
                { signal: controller.signal },
            );

            setResult(data);

            const entry = { query, ts: Date.now() };
            const updated = [entry, ...history.filter((h) => h.query !== query)];
            setHistory(updated);
            saveHistory(updated);
        } catch (err) {
            if (err.code === 'ERR_CANCELED') {
                setError(new Error('Query cancelled by user.'));
            } else {
                setError(err);
            }
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    }, [siteId, query, running, history, variables, templateVariables, timeoutMs, explainMode]);

    const cancelRun = () => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
    };

    const saveCurrentQuery = async () => {
        if (!siteId || !query.trim()) return;
        const name = saveName.trim() || query.split('\n')[0].slice(0, 80) || 'Untitled query';
        const tags = saveFolder.trim() ? [saveFolder.trim()] : [];
        await sqlEditorAPI.createSavedQuery(siteId, { name, query, tags });
        setSaveName('');
        setSaveFolder('');
        await loadSavedQueries();
    };

    const deleteSaved = async (id) => {
        if (!siteId) return;
        await sqlEditorAPI.deleteSavedQuery(siteId, id);
        await loadSavedQueries();
    };

    const exportCSV = () => {
        if (!result) return;
        const content = toCSV(result.columns, result.rows);
        downloadText(content, 'sql-results.csv', 'text/csv');
    };

    const exportJSON = () => {
        if (!result) return;
        const payload = result.rows.map((row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])));
        downloadText(JSON.stringify(payload, null, 2), 'sql-results.json', 'application/json');
    };

    const exportParquet = () => {
        if (!result) return;
        // Exports as NDJSON (newline-delimited JSON) — compatible with DuckDB COPY FROM, pandas read_json, etc.
        downloadText(toParquetJson(result.columns, result.rows), 'sql-results.ndjson', 'application/x-ndjson');
    };

    const exportMetadata = () => {
        if (!result) return;
        downloadText(
            JSON.stringify(
                {
                    rowCount: result.rowCount,
                    duration: result.duration,
                    truncated: result.truncated,
                    columns: result.columns,
                    exportedAt: new Date().toISOString(),
                    explain: result.explain,
                    requestId: result.requestId,
                },
                null,
                2,
            ),
            'sql-results-meta.json',
            'application/json',
        );
    };

    const displayedRows = useMemo(() => {
        if (!result?.rows) return [];

        let rows = result.rows;

        if (gridFilter.trim()) {
            const q = gridFilter.toLowerCase();
            rows = rows.filter((r) => r.some((cell) => String(cell ?? '').toLowerCase().includes(q)));
        }

        if (sortBy != null && result.columns[sortBy]) {
            const dir = sortDir === 'asc' ? 1 : -1;
            rows = [...rows].sort((a, b) => {
                const av = a[sortBy];
                const bv = b[sortBy];
                const an = Number(av);
                const bn = Number(bv);
                if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * dir;
                return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
            });
        }

        return rows;
    }, [result, gridFilter, sortBy, sortDir]);

    const onHeaderSort = (idx) => {
        if (sortBy === idx) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(idx);
            setSortDir('asc');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-0 -m-4 md:-m-6">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border dark:border-border-dark bg-card dark:bg-card-dark shrink-0">
                <Database className="w-4 h-4 text-accent shrink-0" />
                <h1 className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">SQL Editor</h1>
                <span className="ml-1 text-xs text-text-muted dark:text-text-muted-dark">DuckDB · read-only</span>

                <div className="flex-1" />

                <button
                    onClick={() => setExplainMode((v) => !v)}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${explainMode
                            ? 'bg-accent/10 border-accent/30 text-accent'
                            : 'border-border dark:border-border-dark text-text-secondary dark:text-text-secondary-dark'
                        }`}
                >
                    EXPLAIN
                </button>

                <div className="relative">
                    <button
                        onClick={() => {
                            setShowExamples((v) => !v);
                            setShowHistory(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5 text-text-secondary dark:text-text-secondary-dark"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                        Examples
                    </button>
                    {showExamples && (
                        <div className="absolute right-0 top-full mt-1 z-30 w-72 rounded-xl shadow-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden max-h-80 overflow-y-auto">
                            {EXAMPLE_QUERIES.map((ex) => (
                                <button
                                    key={ex.label}
                                    onClick={() => {
                                        setQuery(ex.sql);
                                        setShowExamples(false);
                                    }}
                                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-100 dark:hover:bg-white/5 text-text-primary dark:text-text-primary-dark"
                                >
                                    {ex.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        onClick={() => {
                            setShowHistory((v) => !v);
                            setShowExamples(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5 text-text-secondary dark:text-text-secondary-dark"
                    >
                        <History className="w-3.5 h-3.5" />
                        History
                    </button>
                    {showHistory && (
                        <div className="absolute right-0 top-full mt-1 z-30 w-96 max-h-80 flex flex-col rounded-xl shadow-lg border border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-border-dark shrink-0">
                                <span className="text-xs font-medium text-text-primary dark:text-text-primary-dark">Local History</span>
                                <button
                                    onClick={() => {
                                        setHistory([]);
                                        saveHistory([]);
                                    }}
                                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Clear
                                </button>
                            </div>
                            <div className="overflow-y-auto">
                                {history.map((entry, i) => (
                                    <button
                                        key={`${entry.ts}-${i}`}
                                        onClick={() => {
                                            setQuery(entry.query);
                                            setShowHistory(false);
                                        }}
                                        className="w-full text-left px-3 py-2 border-b border-border/50 dark:border-border-dark/50 last:border-0 hover:bg-gray-100 dark:hover:bg-white/5"
                                    >
                                        <p className="text-xs text-text-primary dark:text-text-primary-dark font-mono truncate">
                                            {entry.query.split('\n')[0]}
                                        </p>
                                        <p className="text-[10px] text-text-muted dark:text-text-muted-dark mt-0.5">
                                            {new Date(entry.ts).toLocaleString()}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {running ? (
                    <button
                        onClick={cancelRun}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                    >
                        <PauseCircle className="w-3.5 h-3.5" />
                        Cancel
                    </button>
                ) : (
                    <button
                        onClick={runQuery}
                        disabled={!siteId}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Play className="w-3.5 h-3.5" />
                        Run
                        <span className="text-white/60 hidden sm:inline">⌘↵</span>
                    </button>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-72 shrink-0 border-r border-border dark:border-border-dark bg-card dark:bg-card-dark overflow-y-auto hidden lg:block">
                    <div className="px-3 py-2 border-b border-border dark:border-border-dark">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">Schema & Saved</p>
                    </div>

                    <div className="p-2 border-b border-border dark:border-border-dark">
                        <p className="text-[11px] mb-1 text-text-muted dark:text-text-muted-dark">Quick tokens</p>
                        <div className="flex flex-wrap gap-1">
                            {SQL_KEYWORDS.map((k) => (
                                <button
                                    key={k}
                                    onClick={() => insertToken(`${k} `)}
                                    className="text-[10px] px-2 py-1 rounded border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5"
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-3 py-2 border-b border-border dark:border-border-dark">
                        <button
                            onClick={() => setShowSavedQueries((v) => !v)}
                            className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark"
                        >
                            <span>Saved Queries</span>
                            {showSavedQueries ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                    </div>

                    {showSavedQueries && (
                        <div className="px-3 py-2 border-b border-border dark:border-border-dark space-y-2">
                            <div className="space-y-1">
                                <input
                                    value={saveName}
                                    onChange={(e) => setSaveName(e.target.value)}
                                    placeholder="Query name"
                                    className="w-full px-2 py-1.5 text-xs rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark"
                                />
                                <div className="flex gap-1">
                                    <input
                                        value={saveFolder}
                                        onChange={(e) => setSaveFolder(e.target.value)}
                                        placeholder="Folder (optional)"
                                        className="flex-1 px-2 py-1.5 text-xs rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark"
                                    />
                                    <button
                                        onClick={saveCurrentQuery}
                                        className="px-2 py-1.5 text-xs rounded bg-accent text-white hover:bg-accent/90"
                                        title="Save query"
                                    >
                                        <Save className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Folder-grouped saved queries */}
                            <div className="space-y-1 max-h-52 overflow-auto">
                                {savedQueries.length === 0 ? (
                                    <p className="text-[11px] text-text-muted dark:text-text-muted-dark">No saved queries yet</p>
                                ) : (() => {
                                    // Group by first tag (folder name) or 'Uncategorized'
                                    const groups = {};
                                    savedQueries.forEach((sq) => {
                                        const folder = sq.tags?.[0] || '';
                                        if (!groups[folder]) groups[folder] = [];
                                        groups[folder].push(sq);
                                    });
                                    return Object.entries(groups).map(([folder, items]) => (
                                        <div key={folder}>
                                            {folder && (
                                                <button
                                                    onClick={() => setOpenFolders((p) => ({ ...p, [folder]: !p[folder] }))}
                                                    className="w-full flex items-center gap-1 py-1 text-[11px] font-medium text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                                                >
                                                    {openFolders[folder] === false
                                                        ? <Folder className="w-3 h-3 shrink-0" />
                                                        : <FolderOpen className="w-3 h-3 shrink-0" />}
                                                    {folder}
                                                </button>
                                            )}
                                            {(openFolders[folder] !== false) && items.map((sq) => (
                                                <div key={sq.id} className={`flex items-center gap-2 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/5 ${folder ? 'pl-5' : ''}`}>
                                                    <button
                                                        onClick={() => setQuery(sq.query)}
                                                        className="flex-1 text-left text-[11px] truncate"
                                                        title={sq.name}
                                                    >
                                                        {sq.name}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSaved(sq.id)}
                                                        className="text-red-500 hover:text-red-600 shrink-0"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    <div className="px-3 py-2 border-b border-border dark:border-border-dark">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted dark:text-text-muted-dark">Schema</p>
                    </div>

                    {schemaLoading ? (
                        <div className="px-3 py-3 text-xs text-text-muted dark:text-text-muted-dark">Loading schema…</div>
                    ) : (
                        <SchemaTree schema={schema} onInsertToken={insertToken} />
                    )}
                </aside>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-3 py-2 border-b border-border dark:border-border-dark bg-card dark:bg-card-dark">
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-[11px] text-text-muted dark:text-text-muted-dark mb-1">Timeout (ms)</label>
                                <input
                                    type="number"
                                    min={1000}
                                    step={1000}
                                    value={timeoutMs}
                                    onChange={(e) => setTimeoutMs(Number(e.target.value || 15000))}
                                    className="w-28 px-2 py-1 text-xs rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark"
                                />
                            </div>

                            {templateVariables.map((name) => (
                                <div key={name}>
                                    <label className="block text-[11px] text-text-muted dark:text-text-muted-dark mb-1">{name}</label>
                                    <input
                                        value={variables[name] ?? ''}
                                        onChange={(e) => setVariables((p) => ({ ...p, [name]: e.target.value }))}
                                        placeholder={name === 'site_id' ? String(siteId ?? '') : 'value'}
                                        disabled={name === 'site_id'}
                                        className="w-36 px-2 py-1 text-xs rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark disabled:opacity-70"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative border-b border-border dark:border-border-dark" style={{ minHeight: '200px', maxHeight: '45%' }}>
                        <SqlCodeEditor
                            ref={editorViewRef}
                            value={query}
                            onChange={setQuery}
                            schema={schema}
                            onRun={runQuery}
                            minHeight="200px"
                            maxHeight="45vh"
                        />
                        <button
                            onClick={() => navigator.clipboard.writeText(query)}
                            title="Copy query"
                            className="absolute top-2 right-2 z-10 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden bg-surface dark:bg-surface-dark">
                        {!result && !error && !running && (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted dark:text-text-muted-dark gap-2">
                                <Database className="w-10 h-10 opacity-30" />
                                <p className="text-sm">Press <kbd className="px-1.5 py-0.5 rounded border border-border dark:border-border-dark text-xs">⌘ Enter</kbd> to run</p>
                            </div>
                        )}

                        {running && (
                            <div className="flex items-center justify-center h-full gap-3 text-text-muted dark:text-text-muted-dark">
                                <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                                <span className="text-sm">Executing query…</span>
                            </div>
                        )}

                        <DiagnosticsBanner error={error} onClose={() => setError(null)} />

                        {result && !running && (
                            <div className="flex flex-col h-full">
                                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border dark:border-border-dark bg-card dark:bg-card-dark shrink-0 flex-wrap">
                                    <span className="flex items-center gap-1 text-xs text-text-secondary dark:text-text-secondary-dark">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                        {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-text-secondary dark:text-text-secondary-dark">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(result.duration)}
                                    </span>
                                    {result.truncated && (
                                        <span className="flex items-center gap-1 text-xs text-amber-500">
                                            <Info className="w-3 h-3" />
                                            Limited to 1 000 rows
                                        </span>
                                    )}

                                    <div className="flex-1" />

                                    <button
                                        onClick={() => setViewMode((v) => (v === 'table' ? 'chart' : 'table'))}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5"
                                    >
                                        <BarChart3 className="w-3 h-3" />
                                        {viewMode === 'table' ? 'Chart' : 'Table'}
                                    </button>

                                    <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5">
                                        <Download className="w-3 h-3" /> CSV
                                    </button>
                                    <button onClick={exportJSON} className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5">
                                        <Download className="w-3 h-3" /> JSON
                                    </button>
                                    <button onClick={exportParquet} className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5" title="Export as NDJSON (Parquet-compatible)">
                                        <Download className="w-3 h-3" /> NDJSON
                                    </button>
                                    <button onClick={exportMetadata} className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-border dark:border-border-dark hover:bg-gray-100 dark:hover:bg-white/5">
                                        <Download className="w-3 h-3" /> Meta
                                    </button>

                                    <button
                                        onClick={() => setResult(null)}
                                        className="p-1 rounded-lg text-text-muted dark:text-text-muted-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-white/5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {viewMode === 'table' ? (
                                    <>
                                        <div className="px-4 py-2 border-b border-border dark:border-border-dark bg-card dark:bg-card-dark flex items-center gap-2">
                                            <Filter className="w-3.5 h-3.5 text-text-muted dark:text-text-muted-dark" />
                                            <div className="relative">
                                                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted dark:text-text-muted-dark" />
                                                <input
                                                    value={gridFilter}
                                                    onChange={(e) => setGridFilter(e.target.value)}
                                                    placeholder="Filter rows"
                                                    className="pl-7 pr-2 py-1 text-xs rounded border border-border dark:border-border-dark bg-surface dark:bg-surface-dark"
                                                />
                                            </div>
                                        </div>

                                        {result.columns.length === 0 ? (
                                            <div className="flex items-center justify-center flex-1 text-text-muted dark:text-text-muted-dark text-sm">
                                                Query returned no rows.
                                            </div>
                                        ) : (
                                            <div className="flex-1 overflow-auto">
                                                <table className="w-full text-xs border-collapse">
                                                    <thead className="sticky top-0 z-10">
                                                        <tr className="bg-gray-50 dark:bg-gray-800/60">
                                                            <th className="px-3 py-2 text-right text-text-muted dark:text-text-muted-dark font-normal border-b border-border dark:border-border-dark w-10 select-none">#</th>
                                                            {result.columns.map((col, idx) => (
                                                                <th
                                                                    key={col}
                                                                    onClick={() => onHeaderSort(idx)}
                                                                    className="px-3 py-2 text-left font-semibold text-text-primary dark:text-text-primary-dark border-b border-border dark:border-border-dark whitespace-nowrap cursor-pointer"
                                                                    title="Click to sort"
                                                                >
                                                                    {col}
                                                                    {sortBy === idx ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {displayedRows.map((row, i) => (
                                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] border-b border-border/50 dark:border-border-dark/50 last:border-0">
                                                                <td className="px-3 py-1.5 text-right text-text-muted dark:text-text-muted-dark select-none">{i + 1}</td>
                                                                {row.map((cell, j) => (
                                                                    <td key={j} className="px-3 py-1.5 text-text-primary dark:text-text-primary-dark whitespace-nowrap max-w-xs" title={cell == null ? 'NULL' : String(cell)}>
                                                                        {cell == null ? (
                                                                            <span className="text-text-muted dark:text-text-muted-dark italic">NULL</span>
                                                                        ) : (
                                                                            String(cell)
                                                                        )}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <ChartPreview columns={result.columns} rows={displayedRows} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {(showHistory || showExamples) && (
                <div
                    className="fixed inset-0 z-20"
                    onClick={() => {
                        setShowHistory(false);
                        setShowExamples(false);
                    }}
                />
            )}
        </div>
    );
}
