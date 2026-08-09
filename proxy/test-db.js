const { Pool } = require('pg');
console.log('Starting...');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});
pool.query('SELECT NOW()')
  .then(r => { console.log('DB OK:', r.rows[0]); process.exit(0); })
  .catch(e => { console.log('DB FAIL:', e.message); process.exit(1); });
