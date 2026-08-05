/**
 * Cloudflare Worker: serve /flight/:number as flight.html (path stays in the URL).
 * Static assets (docs/) are bound as ASSETS.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (/^\/flight\/[^/]+\/?$/i.test(url.pathname)) {
      const rewritten = new URL('/flight.html', url);
      return env.ASSETS.fetch(new Request(rewritten, request));
    }
    return env.ASSETS.fetch(request);
  },
};
