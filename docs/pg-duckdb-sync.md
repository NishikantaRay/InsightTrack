# PostgreSQL → DuckDB Sync

This post dives into the heart of InsightTrack's dual-database architecture: how data flows from the PostgreSQL write store into the embedded DuckDB read store, ensuring analytics queries are lightning fast while tracking writes stay reliable.

## Why sync?

- **Separation of concerns** – PostgreSQL handles high-volume writes (events, sessions, auth), while DuckDB is optimized for columnar analytical workloads. By copying only new rows, the backend can serve complex queries without contention.
- **Performance** – reads in DuckDB are 10‑100× faster than equivalent SQL on a row-store. The sync keeps the read database only a minute or two behind the write store.
- **Simplicity** – DuckDB is embedded in the same process as the Node server; no separate database server to manage.

## How it works

1. **High-water mark (`_sync_meta` table)**
   - Each syncable table (`events`, `sessions`, `sites`, `funnels`, `daily_stats`, `users`) has an entry recording the last `timestamp` or `id` that was successfully copied.
2. **Incremental batches**
   - The sync script queries PostgreSQL for rows newer than the mark, in batches of `SYNC_BATCH_SIZE` (default 5 000).
   - For each batch it performs an `upsert` into DuckDB (delete existing IDs then insert) to handle late-arriving updates.
3. **Periodic scheduling**
   - On server startup the script runs once (non-silent) and then continues every `SYNC_INTERVAL_MS` (default 60 000 ms).
   - A manual POST `/api/sync?full=true` endpoint allows forcing a full rebuild.
4. **Full sync mode**
   - Passing `--full` or using the `full=true` query param truncates DuckDB tables and reimports everything from PostgreSQL. Use during migrations or when recovering from corruption.

## Configuration

All relevant options live in the `.env` file:

```env
# sync.js options
SYNC_BATCH_SIZE=5000        # rows per round
SYNC_INTERVAL_MS=60000      # how often to run
``` 

(The script will also read PG connection settings from the usual env vars.)

## Internals

The sync code (`src/sync/sync.js`) is intentionally simple and synchronous:

```js
const client = await pgPool.connect();
const duck = new DuckDB();

for (const table of syncableTables) {
  const last = await getLastSync(table);
  const rows = await client.query(
    `SELECT * FROM ${table} WHERE ts > $1 ORDER BY ts ASC LIMIT $2`,
    [last, batchSize]
  );

  if (rows.length) {
    await duck.run(`DELETE FROM ${table} WHERE id IN (${rows.map(r=>r.id).join(',')})`);
    await duck.insert(table, rows);
    await updateSyncMeta(table, rows[rows.length-1].ts);
  }
}
```

Errors are caught and logged but do not crash the server. A simple mutex (`_syncRunning`) prevents overlapping runs.

## Troubleshooting

- If analytics appear stale, check the server logs for sync errors.
- Running with `DEBUG=sync` prints helpful diagnostics.
- A missing or misconfigured `SYNC_INTERVAL_MS` may prevent periodic syncs; the initial sync always runs on startup.

## Future directions

- Push-based replication using PostgreSQL logical decoding would eliminate polling.
- Provide a UI in `/settings` to view sync status and manually trigger.


With this mechanism in place, InsightTrack delivers both reliability and speed: developers can continue writing to PostgreSQL without worrying about slow analytical queries impacting production performance.