const test = require('node:test');
const assert = require('node:assert/strict');
const { CREATE_TABLE_SQL, DEFAULT_LANGUAGE, createUserPreferences } = require('./userPreferences');

/** Records queries; answers SELECTs from `stored` (line_user_id → language). */
function fakePool(stored = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/^SELECT/i.test(sql.trim())) {
        return { rows: params[0] in stored ? [{ language: stored[params[0]] }] : [] };
      }
      if (/^INSERT/i.test(sql.trim())) stored[params[0]] = params[1];
      return { rows: [] };
    },
  };
}

test('migrate creates user_preferences with Thai as the column default', async () => {
  const pool = fakePool();
  await createUserPreferences(pool).migrate();
  assert.equal(pool.queries.length, 1);
  assert.match(pool.queries[0].sql, /CREATE TABLE IF NOT EXISTS user_preferences \( line_user_id TEXT PRIMARY KEY, language TEXT DEFAULT 'th', updated_at TIMESTAMPTZ DEFAULT NOW\(\) \)/);
  assert.equal(CREATE_TABLE_SQL.includes('user_preferences'), true);
});

test('getLanguage: stored value, Thai for new users and unknown values', async () => {
  const prefs = createUserPreferences(fakePool({ Uen: 'en', Uth: 'th', Uodd: 'nl' }));
  assert.equal(DEFAULT_LANGUAGE, 'th');
  assert.equal(await prefs.getLanguage('Uen'), 'en');
  assert.equal(await prefs.getLanguage('Uth'), 'th');
  assert.equal(await prefs.getLanguage('Unew'), 'th');
  assert.equal(await prefs.getLanguage('Uodd'), 'th');
});

test('setLanguage upserts per LINE user and rejects anything but th/en', async () => {
  const stored = {};
  const pool = fakePool(stored);
  const prefs = createUserPreferences(pool);
  await prefs.setLanguage('U1', 'en');
  await prefs.setLanguage('U1', 'th');
  assert.deepEqual(stored, { U1: 'th' });
  assert.match(pool.queries[0].sql, /ON CONFLICT \(line_user_id\) DO UPDATE SET language = EXCLUDED\.language, updated_at = NOW\(\)/);
  assert.deepEqual(pool.queries[0].params, ['U1', 'en']);
  await assert.rejects(prefs.setLanguage('U1', 'nl'), /unsupported_language/);
  await assert.rejects(prefs.setLanguage('', 'en'), /missing_line_user_id/);
  assert.equal(pool.queries.length, 2);
});
