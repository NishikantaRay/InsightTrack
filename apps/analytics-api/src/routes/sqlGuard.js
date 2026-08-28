/**
 * SQL Editor guard — the server-side security boundary for user-supplied SQL.
 *
 * Extracted from routes/sqlEditor.js so the rules are testable in isolation and
 * shared by validation and execution.
 *
 * Model: ALLOWLIST, not denylist. The previous keyword denylist blocked the 20
 * mutating verbs but silently permitted DuckDB's table functions — read_csv,
 * read_parquet, read_json, read_text, read_blob, glob — which read arbitrary
 * files, and duckdb_settings(), which discloses configured S3 credentials
 * (audit F-01/F-03/F-06). A denylist cannot enumerate a moving target, so both
 * the functions a query may call and the tables it may touch are now allowlisted;
 * anything unrecognised is rejected by default.
 *
 * NOTE ON enable_external_access: the audit's suggested engine-level fix is not
 * usable here. The setting is database-wide (not per-connection) and DuckDB
 * refuses to change it once the database is running, while the app's own cold
 * storage path (storage/s3.js, queries.js) legitimately calls read_parquet on
 * the same instance. Disabling it globally would break S3 archiving, so the
 * boundary is enforced at this layer instead.
 */

import pkg from 'node-sql-parser';

const { Parser } = pkg;
const sqlParser = new Parser();

// node-sql-parser has no DuckDB grammar; PostgreSQL is the closest dialect and
// parses the analytics subset the editor exposes. It is used as a STRUCTURAL
// check layered on top of the textual checks below — never as a replacement.
//
// KNOWN COST: because the grammar is PostgreSQL, DuckDB-specific syntax that
// PostgreSQL does not accept is rejected as unparseable. Measured examples:
//   SELECT * EXCLUDE (col) …      SELECT * REPLACE (… AS col) …
//   SELECT path[1:3] …            SELECT {'a': 1} …
//   FROM events SELECT path       … QUALIFY …
//   SELECT COLUMNS('^utm') …
// These are valid DuckDB and a user may reasonably try them. Failing closed is
// the deliberate choice: a rejected legitimate query is an inconvenience, an
// accepted malicious one is a breach. Widening support means a DuckDB grammar,
// not relaxing this check.
const PARSER_DIALECT = { database: 'postgresql' };

export const MAX_SQL_LENGTH = 20_000;
export const MAX_RESULT_ROWS = 1000;
export const MAX_TIMEOUT_MS = Number(process.env.SQL_EDITOR_MAX_TIMEOUT_MS || 30_000);

// Retained as a fast, explicit first check. The allowlists below are the real
// boundary, but keeping this gives a clearer error for the common mistake of
// pasting a write statement, and is a second layer if an allowlist gap appears.
export const DANGEROUS_PATTERN =
    /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|PRAGMA|ATTACH|DETACH|COPY|EXPORT|IMPORT|LOAD|INSTALL|CHECKPOINT|VACUUM|CALL|EXECUTE|GRANT|REVOKE)\b/i;

/**
 * Tables the SQL Editor may read. Deliberately excludes `users` (bcrypt password
 * hashes — audit F-02), the assistant/* and mcp_* tables, and information_schema
 * / duckdb_* catalogues used for reconnaissance.
 */
export const ALLOWED_TABLES = new Set([
    'events', 'sessions', 'daily_stats', 'sites',
    'goals', 'funnels', 'annotations', 'ab_tests',
    'sentry_issues', 'sentry_stats',
    // hot/cold physical tables, when the Parquet architecture is active
    'events_hot', 'sessions_hot',
]);

/** Tables that carry a site_id and are therefore tenant-scoped before execution. */
export const SCOPED_TABLES = new Set([
    'events', 'sessions', 'daily_stats', 'goals', 'funnels',
    'annotations', 'ab_tests', 'sentry_issues', 'sentry_stats',
    'events_hot', 'sessions_hot',
]);

/**
 * Functions a query may call. Covers ordinary analytics: aggregates, window
 * functions, string/date/math scalars, JSON accessors. Anything that touches the
 * filesystem, the network, or engine configuration is absent by construction.
 */
export const ALLOWED_FUNCTIONS = new Set([
    // aggregates
    'count', 'sum', 'avg', 'min', 'max', 'median', 'mode', 'stddev', 'stddev_pop',
    'stddev_samp', 'variance', 'var_pop', 'var_samp', 'approx_count_distinct',
    'quantile', 'quantile_cont', 'quantile_disc', 'first', 'last', 'any_value',
    'arg_max', 'arg_min', 'bool_and', 'bool_or', 'product', 'entropy', 'kurtosis',
    'skewness', 'corr', 'covar_pop', 'covar_samp',
    // math
    'round', 'floor', 'ceil', 'ceiling', 'abs', 'sqrt', 'cbrt', 'pow', 'power',
    'exp', 'ln', 'log', 'log2', 'log10', 'sign', 'mod', 'greatest', 'least',
    'trunc', 'random', 'pi', 'degrees', 'radians', 'sin', 'cos', 'tan', 'asin',
    'acos', 'atan', 'atan2', 'even', 'factorial', 'gcd', 'lcm',
    // conditional / cast
    'cast', 'try_cast', 'coalesce', 'nullif', 'ifnull', 'nvl', 'if', 'typeof',
    // string
    'lower', 'upper', 'trim', 'ltrim', 'rtrim', 'length', 'strlen', 'substr',
    'substring', 'replace', 'concat', 'concat_ws', 'split_part', 'string_split',
    'str_split', 'left', 'right', 'lpad', 'rpad', 'reverse', 'repeat',
    'starts_with', 'ends_with', 'contains', 'prefix', 'suffix', 'instr', 'position',
    'regexp_matches', 'regexp_replace', 'regexp_extract', 'regexp_full_match',
    'regexp_split_to_array', 'like_escape', 'levenshtein', 'jaccard',
    'lcase', 'ucase', 'initcap', 'ascii', 'chr', 'bit_length', 'octet_length',
    'string_to_array', 'array_to_string', 'md5', 'sha256', 'hash',
    // date / time
    'strftime', 'strptime', 'date_trunc', 'datetrunc', 'date_part', 'datepart',
    'date_diff', 'datediff', 'date_sub', 'datesub', 'extract', 'age', 'century',
    'now', 'current_date', 'current_timestamp', 'today', 'epoch', 'epoch_ms',
    'to_timestamp', 'to_date', 'make_date', 'make_time', 'make_timestamp',
    'last_day', 'monthname', 'dayname', 'dayofweek', 'dayofmonth', 'dayofyear',
    'weekofyear', 'isodow', 'isoyear', 'quarter', 'year', 'month', 'day', 'hour',
    'minute', 'second', 'millisecond', 'microsecond', 'timezone', 'time_bucket',
    // window
    'row_number', 'rank', 'dense_rank', 'ntile', 'lag', 'lead', 'first_value',
    'last_value', 'nth_value', 'percent_rank', 'cume_dist',
    // list / aggregation helpers
    'array_agg', 'list', 'list_value', 'string_agg', 'group_concat', 'unnest',
    'len', 'array_length', 'list_sort', 'list_distinct', 'array_slice',
    'list_contains', 'list_extract', 'element_at',
    // json (read-only accessors over the properties column)
    'json_extract', 'json_extract_string', 'json_value', 'json_type',
    'json_array_length', 'json_keys',
    // formatting / misc
    'histogram', 'bar', 'printf', 'format', 'nextval_placeholder',
]);

/**
 * SQL keywords that can appear immediately before `(` and would otherwise be
 * misread as function calls by the extractor below.
 */
const SQL_KEYWORDS_BEFORE_PAREN = new Set([
    'select', 'from', 'where', 'group', 'order', 'by', 'having', 'limit', 'offset',
    'join', 'on', 'and', 'or', 'not', 'in', 'as', 'when', 'then', 'else', 'end',
    'case', 'over', 'partition', 'union', 'except', 'intersect', 'all', 'distinct',
    'with', 'asc', 'desc', 'using', 'between', 'like', 'ilike', 'similar', 'is',
    'null', 'cross', 'inner', 'left', 'right', 'full', 'outer', 'natural', 'filter',
    'within', 'interval', 'exists', 'values', 'row', 'rows', 'range', 'groups',
    'preceding', 'following', 'unbounded', 'current', 'nulls', 'recursive',
    'lateral', 'returning', 'qualify', 'sample', 'tablesample', 'anti', 'semi',
    'positional', 'asof', 'if', 'array', 'struct', 'map', 'union_by_name',
]);

/**
 * Replace string literals with placeholders so their contents are never parsed
 * as identifiers. Without this, a path inside a quoted string could be mistaken
 * for a table or function name (and vice versa).
 */
function blankStringLiterals(sql) {
    return sql.replace(/'(?:[^']|'')*'/g, "''");
}

/**
 * Unwrap double-quoted identifiers so `"users"` and `"main"."users"` normalise to
 * the same text the allowlists match against. Without this, quoting is a trivial
 * bypass: DuckDB treats "users" and users as the same table, but a raw regex
 * does not. Applied AFTER string literals are blanked so a quote inside a string
 * is never mistaken for an identifier delimiter.
 */
function unquoteIdentifiers(sql) {
    return sql.replace(/"([^"]*)"/g, '$1');
}

/** Normalised view of a query used by every extractor below. */
function normalise(sql) {
    return unquoteIdentifiers(blankStringLiterals(sql));
}

/** Strip -- and block comments. Done before every other check. */
export function stripComments(sql) {
    return sql
        .replace(/--[^\n]*/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .trim();
}

/** Names bound by CTEs (WITH x AS ...) — legitimate table references. */
function cteNames(sql) {
    const names = new Set();
    const re = /\b(?:WITH|,)\s+(?:RECURSIVE\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+AS\s*\(/gi;
    let m;
    while ((m = re.exec(sql)) !== null) names.add(m[1].toLowerCase());
    return names;
}

/** Aliases introduced after a table reference (FROM events e) — not tables. */
function aliasNames(sql) {
    const names = new Set();
    const re = /\b(?:FROM|JOIN)\s+[A-Za-z_][A-Za-z0-9_]*\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*)/gi;
    let m;
    while ((m = re.exec(sql)) !== null) {
        const a = m[1].toLowerCase();
        if (!SQL_KEYWORDS_BEFORE_PAREN.has(a)) names.add(a);
    }
    return names;
}

/**
 * Every identifier used in call position, lowercased. Keywords that precede a
 * parenthesis for syntactic reasons are filtered out.
 */
export function extractFunctions(sql) {
    const cleaned = normalise(sql);
    const out = new Set();
    const re = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    let m;
    while ((m = re.exec(cleaned)) !== null) {
        const name = m[1].toLowerCase();
        if (!SQL_KEYWORDS_BEFORE_PAREN.has(name)) out.add(name);
    }
    return [...out];
}

/** Table references following FROM/JOIN, lowercased, excluding CTEs and aliases. */
export function extractTables(sql) {
    const cleaned = normalise(sql);
    const ctes = cteNames(cleaned);
    const aliases = aliasNames(cleaned);
    const out = new Set();
    // Capture an optional schema qualifier so `main.events` is seen and rejected,
    // and walk comma-separated FROM lists so `FROM events, users` is not missed.
    const refs = [];
    const clauseRe = /\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_.]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_.]*)*)/gi;
    let cm;
    while ((cm = clauseRe.exec(cleaned)) !== null) {
        for (const part of cm[1].split(',')) {
            const t = part.trim();
            if (t) refs.push(t);
        }
    }
    for (const raw of refs) {
        const ref = raw.toLowerCase();
        // A function call in table position (e.g. read_csv(...)) is handled by
        // the function allowlist; skip it here.
        if (new RegExp(`\\b${ref.replace(/\./g, '\\.')}\\s*\\(`, 'i').test(cleaned)) continue;
        if (ctes.has(ref) || aliases.has(ref)) continue;
        out.add(ref);
    }
    return [...out];
}

/**
 * Validate a user-supplied query. Returns an error string, or null when valid.
 *
 * Order matters: structural checks first (cheap, clearest errors), then the
 * allowlists. Called BOTH before template substitution and again afterwards, so
 * an injected value cannot smuggle a disallowed construct past an approved query.
 */
export function validateQuery(sql) {
    if (!sql || typeof sql !== 'string') return 'Query must be a non-empty string.';
    if (sql.length > MAX_SQL_LENGTH) return `Query exceeds the ${MAX_SQL_LENGTH} character limit.`;

    const stripped = stripComments(sql);
    if (!stripped) return 'Query is empty after stripping comments.';

    if (!/^(SELECT|WITH|EXPLAIN)\b/i.test(stripped)) {
        return 'Only SELECT / WITH / EXPLAIN queries are permitted.';
    }

    // EXPLAIN ANALYZE actually RUNS the statement (and prints timings), so it is
    // not the read-only planner output it looks like. Only plain EXPLAIN is allowed.
    if (/^EXPLAIN\s+ANALYZE\b/i.test(stripped)) {
        return 'EXPLAIN ANALYZE is not permitted (it executes the query). Use plain EXPLAIN.';
    }

    const normalized = stripped.replace(/;+\s*$/, '').trim();
    if (normalise(normalized).includes(';')) {
        return 'Only a single SQL statement is allowed.';
    }

    if (DANGEROUS_PATTERN.test(normalise(stripped))) {
        return 'Query contains a disallowed keyword (INSERT, UPDATE, DELETE, DROP, etc.). Only read-only SELECT queries are permitted.';
    }

    // Allowlist: functions. Blocks read_csv/read_parquet/read_json/read_text/
    // read_blob/glob (arbitrary file read) and duckdb_settings (secret disclosure).
    const fns = extractFunctions(stripped);
    const badFns = fns.filter((f) => !ALLOWED_FUNCTIONS.has(f));
    if (badFns.length > 0) {
        return `Query uses a function that is not permitted in the SQL Editor: ${badFns.join(', ')}. Only analytical functions may be used — file, network, and engine-configuration functions are blocked.`;
    }

    // Allowlist: tables. Blocks `users` (password hashes), the assistant/MCP
    // tables, information_schema, and schema-qualified bypasses like main.events.
    const tables = extractTables(stripped);
    const badTables = tables.filter((t) => !ALLOWED_TABLES.has(t));
    if (badTables.length > 0) {
        return `Query references a table that is not available in the SQL Editor: ${badTables.join(', ')}. Available tables: ${[...ALLOWED_TABLES].sort().join(', ')}.`;
    }

    // Structural (AST) layer. The regex checks above are approximate — they were
    // bypassed in testing by quoted identifiers ("users"), comma-separated FROM
    // lists, and functions nested in scalar subqueries. Parsing resolves those
    // forms properly: the parser normalises quoting and schema qualification, and
    // an AST walk finds every function call wherever it appears. Both layers must
    // agree, so a gap in either one alone is not sufficient to get a query through.
    const astError = validateAst(stripped);
    if (astError) return astError;

    return null;
}

/**
 * Parse the query and re-check tables and functions against the allowlists using
 * the AST rather than regex.
 *
 * A query the parser cannot understand is REJECTED, not waved through: the
 * dialect is PostgreSQL rather than DuckDB, so some valid DuckDB syntax may fail
 * to parse, and refusing it is the safe direction. The one deliberate exception
 * is EXPLAIN, which this parser does not accept — its inner statement is
 * validated instead (plain EXPLAIN only; EXPLAIN ANALYZE is rejected earlier).
 */
export function validateAst(sql) {
    let target = sql;
    const explainMatch = /^EXPLAIN\s+/i.exec(target);
    if (explainMatch) target = target.slice(explainMatch[0].length);

    // `{{var}}` placeholders are not SQL, so the parser cannot see them. Swap in a
    // neutral literal purely for the structural check — the real substitution
    // happens later in the route, and validateQuery runs again on the result.
    target = target.replace(/\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/g, "'0'");

    let ast;
    try {
        ast = sqlParser.astify(target, PARSER_DIALECT);
    } catch {
        return 'Query could not be parsed. The SQL Editor accepts a single analytical SELECT statement; check the syntax.';
    }

    const statements = Array.isArray(ast) ? ast : [ast];
    if (statements.length !== 1) return 'Only a single SQL statement is allowed.';
    if (statements[0]?.type && statements[0].type !== 'select') {
        return 'Only SELECT / WITH / EXPLAIN queries are permitted.';
    }

    // Functions, from a full walk of the tree.
    const fns = collectAstFunctions(statements[0]);
    const badFns = [...fns].filter((f) => !ALLOWED_FUNCTIONS.has(f));
    if (badFns.length > 0) {
        return `Query uses a function that is not permitted in the SQL Editor: ${badFns.join(', ')}. Only analytical functions may be used — file, network, and engine-configuration functions are blocked.`;
    }

    // Tables, via the parser's own resolution (handles quoting, schemas, CTEs).
    let refs = [];
    try {
        refs = sqlParser.tableList(target, PARSER_DIALECT);
    } catch {
        return 'Query could not be analysed for table access.';
    }
    const ctes = collectCteNames(statements[0]);
    const badRefs = [];
    for (const ref of refs) {
        // format: "<operation>::<schema|null>::<table>"
        const parts = String(ref).split('::');
        const schema = parts[1] === 'null' ? null : parts[1];
        const table = (parts[2] || '').toLowerCase();
        if (!table || ctes.has(table)) continue;
        // Any explicit schema qualifier is a bypass attempt (main.events).
        if (schema) { badRefs.push(`${schema}.${table}`); continue; }
        if (!ALLOWED_TABLES.has(table)) badRefs.push(table);
    }
    if (badRefs.length > 0) {
        return `Query references a table that is not available in the SQL Editor: ${[...new Set(badRefs)].join(', ')}. Available tables: ${[...ALLOWED_TABLES].sort().join(', ')}.`;
    }

    return null;
}

/** Every function name in the tree, lowercased — including window/aggregate forms. */
export function collectAstFunctions(node, out = new Set()) {
    if (node == null || typeof node !== 'object') return out;
    if (Array.isArray(node)) {
        for (const item of node) collectAstFunctions(item, out);
        return out;
    }
    if (node.type === 'function' || node.type === 'aggr_func' || node.type === 'window_func') {
        const n = node.name;
        if (typeof n === 'string') {
            out.add(n.toLowerCase());
        } else if (n && Array.isArray(n.name)) {
            for (const seg of n.name) if (seg?.value) out.add(String(seg.value).toLowerCase());
        } else if (n?.value) {
            out.add(String(n.value).toLowerCase());
        }
    }
    for (const key of Object.keys(node)) collectAstFunctions(node[key], out);
    return out;
}

/** CTE names bound by the statement's WITH clause. */
function collectCteNames(stmt) {
    const names = new Set();
    const withClause = stmt?.with;
    if (!Array.isArray(withClause)) return names;
    for (const cte of withClause) {
        const n = cte?.name;
        const v = typeof n === 'string' ? n : (n?.value ?? n?.name?.value);
        if (v) names.add(String(v).toLowerCase());
    }
    return names;
}

/** Clamp a client-supplied timeout into a sane range (floor AND ceiling). */
export function clampTimeout(requested, fallback) {
    const n = Number(requested) || fallback;
    return Math.min(Math.max(1000, n), MAX_TIMEOUT_MS);
}

/**
 * Bind a validated query to one site and enforce a hard row cap.
 *
 * Tenant scoping: each scoped table referenced by the query is replaced with a
 * per-request TEMP VIEW filtered to the caller's site, so an unfiltered
 * `SELECT * FROM events` can only ever see that site's rows (audit F-05).
 * Returns the setup statements and the rewritten query.
 */
export function scopeQueryToSite(sql, siteId) {
    const tables = extractTables(sql).filter((t) => SCOPED_TABLES.has(t));
    const suffix = String(siteId).replace(/[^A-Za-z0-9_]/g, '_');
    const views = [];
    let rewritten = sql;

    // DuckDB cannot bind parameters inside CREATE VIEW ("Unexpected prepared
    // parameter"), so the site id is embedded as an escaped literal. siteId comes
    // from the ownership-verified sites row rather than raw user input, and
    // single quotes are doubled, so this cannot break out of the literal.
    const siteLiteral = `'${String(siteId).replace(/'/g, "''")}'`;

    for (const table of tables) {
        const viewName = `_sqled_${suffix}_${table}`;
        const createSql =
            `CREATE OR REPLACE TEMP VIEW ${viewName} AS ` +
            `SELECT * FROM main.${table} WHERE site_id = ${siteLiteral}`;
        views.push({ viewName, table, createSql });
        // Rewrite the table wherever it appears as a source: after FROM/JOIN, and
        // also after a comma in a FROM list (`FROM events, sessions`), which the
        // FROM/JOIN-only form missed and which leaked the second table's other
        // tenants. Quoted forms are handled too, since DuckDB treats "events"
        // and events as the same relation.
        rewritten = rewritten.replace(
            new RegExp(`\\b(FROM|JOIN)(\\s+)"?${table}"?`, 'gi'),
            (_m, kw, ws) => `${kw}${ws}${viewName}`,
        );
        rewritten = rewritten.replace(
            new RegExp(`(,\\s*)"?${table}"?(?![A-Za-z0-9_])`, 'gi'),
            (_m, sep) => `${sep}${viewName}`,
        );
    }
    return { views, rewritten };
}

/**
 * Wrap in an outer LIMIT so the cap binds even when the user wrote their own
 * larger LIMIT (audit F-07). EXPLAIN is not wrappable, so it is prefixed instead.
 */
export function applyRowCap(sql, { explain = false, max = MAX_RESULT_ROWS } = {}) {
    if (explain) return `EXPLAIN ${sql}`;
    return `SELECT * FROM (${sql}) AS _capped LIMIT ${max}`;
}
