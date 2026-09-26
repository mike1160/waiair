/**
 * WaiAir Briefing [T/1]: the questions the app cannot answer from what it already knows.
 *
 * Most of them it can — whether the flight is on time, what the weather is at the other end, whether a delay
 * is worth money — and those never reach this file. What arrives here is the rest: how busy the road to the
 * airport is, what to do with three unexpected hours, how to get from the terminal into town.
 *
 * Two things matter more than the answer.
 *
 * The first is that the prompt is *built here*, from a fixed list of fields, and never from what the caller
 * sends. A request may carry any JSON it likes; only the flight number, the route, the times, the status, the
 * delay, the weather, the destination city, the phase and the language are ever read. There is no field a
 * caller could add — a mail body, a hotel address, a passenger name — that would find its way into the
 * prompt, because nothing copies the request wholesale. That is a property of the code, not a promise, and
 * lib/briefingContext.ts on the app side keeps the same list.
 *
 * The second is that nothing is written down. No question, no answer, no flight number reaches a log or a
 * database. Failures are logged as a status code and nothing else.
 *
 * Eight seconds, and then it is over: a traveller staring at a spinner in a departure hall is worse served by
 * a slow right answer than by a quick "try again".
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/** Fast and cheap: these are short, factual answers, not essays. */
const MODEL = 'claude-haiku-4-5-20251001';
/** A traveller will not wait longer than this, so neither do we. */
const TIMEOUT_MS = 8000;
/** Three sentences, which is what the prompt asks for; the ceiling is only there to stop a runaway. */
const MAX_TOKENS_DEFAULT = 150;
const MAX_TOKENS_LIMIT = 200;
/** Consistent rather than imaginative: the same question on the same flight should not wander. */
const TEMPERATURE = 0.3;
/** Long enough for any real question, short enough that nobody can paste a document into it. */
const QUESTION_MAX_CHARS = 300;

const LANGUAGE_NAMES = {
  en: 'English', nl: 'Dutch', zh: 'Chinese', th: 'Thai', de: 'German', ru: 'Russian',
  ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', id: 'Indonesian', es: 'Spanish',
};

function str(v, max = 120) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The only fields that exist as far as the prompt is concerned. Anything else in the request body is not
 * rejected — it is simply never read.
 */
function safeContext(body) {
  const b = (body && typeof body === 'object') ? body : {};
  const f = (b.flight && typeof b.flight === 'object') ? b.flight : {};
  const w = (b.weather && typeof b.weather === 'object') ? b.weather : {};
  const lang = str(b.language, 5).toLowerCase();
  return {
    number: str(f.number, 10).toUpperCase(),
    origin: str(f.origin, 4).toUpperCase(),
    destination: str(f.destination, 4).toUpperCase(),
    departureTime: str(f.departureTime, 40),
    arrivalTime: str(f.arrivalTime, 40),
    status: str(f.status, 24),
    delayMinutes: num(f.delayMinutes) || 0,
    temp: num(w.temp),
    condition: str(w.condition, 40),
    destinationCity: str(b.destinationCity, 60),
    phase: str(b.phase, 24).toUpperCase(),
    language: LANGUAGE_NAMES[lang] ? lang : 'en',
  };
}

/** The prompt, assembled from the context above and nothing else. */
function systemPrompt(c) {
  const weather = c.temp == null && !c.condition
    ? 'unknown'
    : `${c.temp == null ? '' : `${c.temp}°`}${c.temp != null && c.condition ? ', ' : ''}${c.condition}`;
  return [
    'You are a travel assistant for WaiAir.',
    "You know the user's flight details and answer questions about their journey concisely.",
    'Answer in maximum 3 sentences.',
    `Answer in the user's language (${LANGUAGE_NAMES[c.language] || 'English'}).`,
    'Never mention that you are an AI.',
    'Only answer questions related to this journey.',
    '',
    `Flight: ${c.number || 'unknown'} ${c.origin || '?'} → ${c.destination || '?'}`,
    `Departure: ${c.departureTime || 'unknown'}`,
    `Arrival: ${c.arrivalTime || 'unknown'}`,
    `Status: ${c.status || 'unknown'}`,
    `Delay: ${c.delayMinutes} minutes`,
    `Weather at destination: ${weather}`,
    `Destination city: ${c.destinationCity || 'unknown'}`,
    `Current phase: ${c.phase || 'unknown'}`,
  ].join('\n');
}

/** The answer text out of whatever shape the API returned, or '' when there is none. */
function answerFrom(json) {
  const parts = (json && Array.isArray(json.content)) ? json.content : [];
  const text = parts
    .filter(p => p && p.type === 'text' && typeof p.text === 'string')
    .map(p => p.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

/**
 * @param {object} opts
 * @param {string} [opts.apiKey] ANTHROPIC_API_KEY; without it every question answers 'unavailable'
 * @param {(url: string, init?: object) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} opts.fetchImpl
 */
function createBriefing({ apiKey, fetchImpl, log = console, timeoutMs = TIMEOUT_MS }) {
  /**
   * Answers one question. Resolves to { answer, source } or { error }, and never throws: a briefing that
   * fails is a card that says "try again", not a crash in the hub.
   */
  async function ask(body) {
    const question = str(body && body.question, QUESTION_MAX_CHARS);
    if (!question) return { error: 'no_question' };
    if (!apiKey) return { error: 'unavailable' };

    const context = safeContext(body);
    const maxTokens = Math.min(num(body && body.maxTokens) || MAX_TOKENS_DEFAULT, MAX_TOKENS_LIMIT);

    // Eight seconds, hard. AbortController rather than a race, so the request is actually dropped.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(ANTHROPIC_API, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          temperature: TEMPERATURE,
          system: systemPrompt(context),
          messages: [{ role: 'user', content: question }],
        }),
      });
      if (!res.ok) {
        // The status and nothing else: no question, no answer, no flight.
        log.warn('[briefing] HTTP', res.status);
        return { error: 'upstream' };
      }
      const answer = answerFrom(await res.json());
      if (!answer) return { error: 'empty' };
      return { answer, source: 'ai' };
    } catch (e) {
      const aborted = e && (e.name === 'AbortError' || e.name === 'TimeoutError');
      log.warn('[briefing]', aborted ? 'timeout' : 'failed');
      return { error: aborted ? 'timeout' : 'failed' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ask };
}

module.exports = {
  MODEL,
  TIMEOUT_MS,
  MAX_TOKENS_DEFAULT,
  MAX_TOKENS_LIMIT,
  TEMPERATURE,
  QUESTION_MAX_CHARS,
  safeContext,
  systemPrompt,
  answerFrom,
  createBriefing,
};
