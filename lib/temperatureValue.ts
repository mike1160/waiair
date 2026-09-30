/**
 * A temperature, or the honest absence of one [W/12].
 *
 * The briefing told a traveller in Bangkok it was 0 degrees. Not a conversion bug and not bad data — the
 * proxy was returning 26.4°C at the time. The producer and the consumer simply disagreed about how to say
 * "unknown". screens/HomeTrackedScreen.tsx reports absence correctly:
 *
 *     temp: hubWeatherNow?.dest?.temp ?? null
 *
 * and lib/briefingClient.ts then undid it:
 *
 *     const temp = Number(facts.temp);
 *     weather: { temp: Number.isFinite(temp) ? temp : null, … }
 *
 * because `Number(null)` is **0**, and `Number.isFinite(0)` is **true**. The guard written to catch a missing
 * value waves it through as a real reading. It works for `undefined`, which becomes NaN, and fails for
 * `null` — which is exactly what the facts use. The proxy then put "0°" in the prompt, quite correctly, since
 * zero is a real temperature in Snow, and the model repeated it.
 *
 * So the check lives in one place and is used by everything that reads a temperature, because the same
 * mistake was in three files with three slightly different spellings of it.
 *
 * Pure, and unit-tested in lib/temperatureValue.test.ts.
 */

/**
 * The number, or null when there is no reading.
 *
 * null, undefined, an empty or blank string and anything non-finite are all *absences* — none of them is
 * zero degrees. A real 0 passes through untouched, because Helsinki in January is a thing.
 */
export function knownTemperature(raw: unknown): number | null {
  // A whitelist, not a blacklist: Number([]) is 0 as surely as Number(null) is, and so is Number(false).
  // Only a finite number, or a string that parses to one, counts as a reading.
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    if (!raw.trim()) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Is there a reading at all? Reads better than `!== null` at the call sites. */
export function hasTemperature(raw: unknown): boolean {
  return knownTemperature(raw) !== null;
}
