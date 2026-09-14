/**
 * Joins identical upstream work that is already running instead of starting it again: parallel requests for the same
 * FIDS board (one user's searches, or several users) share one AeroDataBox fetch and one budget charge.
 */

/**
 * @param {{ onJoin?: (key: string) => void }} [opts]
 */
function createInflight({ onJoin } = {}) {
  /** @type {Map<string, Promise<any>>} */
  const pending = new Map();
  let started = 0;
  let joined = 0;

  /**
   * Runs `fn` unless the same key is already running, then returns that promise.
   * `shareError(e)` false → a joiner runs its own `fn` instead of taking the error (e.g. the starter's per-IP limit).
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @param {{ shareError?: (e: unknown) => boolean }} [opts]
   * @returns {Promise<T>}
   */
  function run(key, fn, { shareError = () => true } = {}) {
    const hit = pending.get(key);
    if (hit) {
      joined += 1;
      if (onJoin) onJoin(key);
      return hit.catch((e) => (shareError(e) ? Promise.reject(e) : fn()));
    }
    started += 1;
    const promise = Promise.resolve()
      .then(fn)
      .finally(() => { pending.delete(key); });
    pending.set(key, promise);
    return promise;
  }

  /** started = upstream work begun, joined = requests that shared it (each one a saved fetch). */
  function stats() {
    return { started, joined, pending: pending.size };
  }

  return { run, stats };
}

module.exports = { createInflight };
