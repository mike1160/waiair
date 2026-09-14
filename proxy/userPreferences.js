/** Per LINE user settings for the WaiAir OA chatbot (Railway Postgres). For now: the chat language. */

const LANGUAGES = ['th', 'en'];
/** New users get Thai until they send "EN". */
const DEFAULT_LANGUAGE = 'th';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS user_preferences (
    line_user_id TEXT PRIMARY KEY,
    language TEXT DEFAULT 'th',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

/** @param {{ query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }} pool */
function createUserPreferences(pool) {
  async function migrate() {
    await pool.query(CREATE_TABLE_SQL);
  }

  /** Stored language, or DEFAULT_LANGUAGE when the user never picked one. */
  async function getLanguage(lineUserId) {
    const { rows } = await pool.query('SELECT language FROM user_preferences WHERE line_user_id = $1', [lineUserId]);
    const language = rows[0] && rows[0].language;
    return LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  }

  async function setLanguage(lineUserId, language) {
    if (!lineUserId) throw new Error('missing_line_user_id');
    if (!LANGUAGES.includes(language)) throw new Error(`unsupported_language: ${language}`);
    await pool.query(
      `INSERT INTO user_preferences (line_user_id, language, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (line_user_id) DO UPDATE SET language = EXCLUDED.language, updated_at = NOW()`,
      [lineUserId, language],
    );
  }

  return { migrate, getLanguage, setLanguage };
}

module.exports = {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  CREATE_TABLE_SQL,
  createUserPreferences,
};
