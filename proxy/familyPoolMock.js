/**
 * In-memory stand-in for the Postgres pool, for the familyPush tests. Same idea as the memoryPool in
 * expoPush.test.js: it recognises the handful of statements familyPush.js actually issues and keeps the
 * rows in a Map, so the store's behaviour is tested without a database.
 *
 * Rows are held in the shape pg returns them: snake_case columns, BIGINT as a string, JSONB already parsed.
 */
function createFamilyPoolMock() {
  /** @type {Map<string, any>} */
  const rows = new Map();

  function row(token) {
    return rows.get(token) || null;
  }

  async function query(sql, params = []) {
    const q = String(sql).replace(/\s+/g, ' ').trim();

    if (/^CREATE TABLE|^CREATE INDEX/i.test(q)) return { rows: [] };

    if (/^DELETE FROM family_shares WHERE expires_ms < \$1/i.test(q)) {
      const cut = Number(params[0]);
      for (const [k, r] of rows) if (Number(r.expires_ms) < cut) rows.delete(k);
      return { rows: [] };
    }

    // The 24h sent-marker prune, applied to every row.
    if (/^UPDATE family_shares SET sent_keys = COALESCE/i.test(q)) {
      const cut = Number(params[0]);
      for (const r of rows.values()) {
        r.sent_keys = (r.sent_keys || []).filter(k => k && Number(k.sentMs) > cut);
      }
      return { rows: [] };
    }

    if (/^INSERT INTO family_shares/i.test(q)) {
      const [token, flightKey, name, created, expires] = params;
      const existing = rows.get(token);
      const next = {
        token,
        flight_key: flightKey,
        traveler_name: name,
        // pg hands BIGINT back as a string; the store has to cope with that.
        created_ms: String(existing ? existing.created_ms : created),
        expires_ms: String(expires),
        followers: existing ? existing.followers : [],
        moments: existing ? existing.moments : [],
        sent_keys: existing ? existing.sent_keys : [],
      };
      rows.set(token, next);
      return { rows: [next] };
    }

    if (/^SELECT \* FROM family_shares WHERE token = \$1 AND expires_ms >= \$2/i.test(q)) {
      const r = row(params[0]);
      if (!r || Number(r.expires_ms) < Number(params[1])) return { rows: [] };
      return { rows: [r] };
    }

    if (/^SELECT \* FROM family_shares WHERE expires_ms >= \$1/i.test(q)) {
      const cut = Number(params[0]);
      return { rows: [...rows.values()].filter(r => Number(r.expires_ms) >= cut) };
    }

    if (/^UPDATE family_shares SET followers = \$1 WHERE token = \$2/i.test(q)) {
      const r = row(params[1]);
      if (r) r.followers = JSON.parse(params[0]);
      return { rows: [] };
    }

    if (/^UPDATE family_shares SET followers = followers \|\| \$1::jsonb WHERE token = \$2/i.test(q)) {
      const r = row(params[1]);
      if (r) r.followers = [...(r.followers || []), ...JSON.parse(params[0])];
      return { rows: [] };
    }

    if (/^UPDATE family_shares SET moments = \$1 WHERE token = \$2/i.test(q)) {
      const r = row(params[1]);
      if (r) r.moments = JSON.parse(params[0]);
      return { rows: [] };
    }

    if (/^UPDATE family_shares SET sent_keys = sent_keys \|\| \$1::jsonb WHERE token = \$2/i.test(q)) {
      const r = row(params[1]);
      if (r) r.sent_keys = [...(r.sent_keys || []), ...JSON.parse(params[0])];
      return { rows: [] };
    }

    if (/^DELETE FROM family_shares WHERE token = \$1 RETURNING token/i.test(q)) {
      const token = params[0];
      const had = rows.has(token);
      rows.delete(token);
      return { rows: had ? [{ token }] : [] };
    }

    throw new Error(`familyPoolMock: no handler for: ${q}`);
  }

  return { query, rows };
}

module.exports = { createFamilyPoolMock };
