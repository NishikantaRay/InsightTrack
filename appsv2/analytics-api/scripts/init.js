import { duckRun, closeDuck } from '../src/db/duckdb.js';
import { SCHEMA_SQL } from '../src/schema/schema.js';

async function main() {
    console.log('🦆 Initialising DuckDB analytics database…\n');

    const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
        const label = stmt.match(/CREATE TABLE IF NOT EXISTS (\S+)/)?.[1] ?? '(meta)';
        await duckRun(stmt);
        console.log(`  ✓  ${label}`);
    }

    await closeDuck();
    console.log('\n✅ DuckDB ready at duckdb/analytics.duckdb');
}

main().catch(err => { console.error('❌ Init failed:', err); process.exit(1); });
