/**
 * Monthly AeroDataBox unit counter. Live map turns static after 500_000 units in the calendar month.
 */

const LIVE_MAP_UNIT_CAP = 500_000;

const MIGRATION_SQL = [
  `CREATE TABLE IF NOT EXISTS api_usage (
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    units_used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (year, month)
  )`,
];

function monthKey(now = new Date()) {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** @param {{ query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }} pool */
function createApiUsageStore(pool) {
  async function migrate() {
    for (const sql of MIGRATION_SQL) await pool.query(sql);
  }

  async function record(units = 1, now = new Date()) {
    const n = Math.max(0, Math.floor(Number(units) || 0));
    if (!n) return;
    const { year, month } = monthKey(now);
    await pool.query(
      `INSERT INTO api_usage (year, month, units_used)
       VALUES ($1, $2, $3)
       ON CONFLICT (year, month)
       DO UPDATE SET units_used = api_usage.units_used + EXCLUDED.units_used`,
      [year, month, n],
    );
  }

  async function snapshot(now = new Date()) {
    const { year, month } = monthKey(now);
    const { rows } = await pool.query(
      'SELECT units_used FROM api_usage WHERE year = $1 AND month = $2',
      [year, month],
    );
    const unitsUsed = rows[0] ? Number(rows[0].units_used) || 0 : 0;
    return {
      year,
      month,
      unitsUsed,
      cap: LIVE_MAP_UNIT_CAP,
      liveMapAllowed: unitsUsed <= LIVE_MAP_UNIT_CAP,
    };
  }

  return { migrate, record, snapshot };
}

module.exports = {
  LIVE_MAP_UNIT_CAP,
  MIGRATION_SQL,
  monthKey,
  createApiUsageStore,
};
