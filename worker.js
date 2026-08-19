/**
 * Cloudflare Worker: serve /flight/:number as flight.html (path stays in the URL).
 * Static assets (docs/) are bound as ASSETS.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (/^\/flight\/([^/]+)\/?$/i.test(url.pathname)) {
      const number = url.pathname.match(/^\/flight\/([^/]+)\/?$/i)[1];
      const rewritten = new URL('/flight.html', url);
      rewritten.searchParams.set('f', number);
      return env.ASSETS.fetch(new Request(rewritten, request));
    }
    if (/^\/live\/([^/]+)\/?$/i.test(url.pathname)) {
      const code = url.pathname.match(/^\/live\/([^/]+)\/?$/i)[1];
      const rewritten = new URL('/live.html', url);
      rewritten.searchParams.set('c', code);
      return env.ASSETS.fetch(new Request(rewritten, request));
    }
    return env.ASSETS.fetch(request);
  },
};
