const test = require('node:test');
const assert = require('node:assert/strict');
const { LIVE_MAP_UNIT_CAP, MIGRATION_SQL, createApiUsageStore } = require('./apiUsage');

function memoryPool() {
  const rows = new Map();
  return {
    rows,
    async query(sql, params = []) {
      const q = sql.replace(/\s+/g, ' ').trim();
      if (/CREATE TABLE/.test(q)) return { rows: [] };
      if (/INSERT INTO api_usage/.test(q)) {
        const key = `${params[0]}-${params[1]}`;
        const prev = rows.get(key) || 0;
        rows.set(key, prev + params[2]);
        return { rows: [] };
      }
      if (/SELECT units_used/.test(q)) {
        const key = `${params[0]}-${params[1]}`;
        const units = rows.get(key);
        return { rows: units == null ? [] : [{ units_used: units }] };
      }
      throw new Error(q);
    },
  };
}

test('api_usage table has month, year, units_used', () => {
  assert.match(MIGRATION_SQL[0], /CREATE TABLE IF NOT EXISTS api_usage/);
  assert.match(MIGRATION_SQL[0], /month INTEGER NOT NULL/);
  assert.match(MIGRATION_SQL[0], /year INTEGER NOT NULL/);
  assert.match(MIGRATION_SQL[0], /units_used INTEGER NOT NULL DEFAULT 0/);
});

test('units accumulate; live map disables after 500000; a new month starts at 0', async () => {
  const pool = memoryPool();
  const store = createApiUsageStore(pool);
  await store.migrate();
  const sept = new Date(Date.UTC(2026, 8, 16));
  await store.record(500_001, sept);
  const over = await store.snapshot(sept);
  assert.equal(over.unitsUsed, 500_001);
  assert.equal(over.liveMapAllowed, false);
  assert.equal(over.cap, LIVE_MAP_UNIT_CAP);

  const oct = await store.snapshot(new Date(Date.UTC(2026, 9, 1)));
  assert.equal(oct.unitsUsed, 0);
  assert.equal(oct.liveMapAllowed, true);
  assert.equal(oct.month, 10);
});
