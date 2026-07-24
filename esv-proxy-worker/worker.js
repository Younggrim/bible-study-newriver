/**
 * Cloudflare Worker — ESV API Proxy
 * 
 * Proxies requests to the ESV API, adding the auth token
 * and returning proper CORS headers so browser-side fetch works.
 * 
 * Deploy: npx wrangler deploy
 * 
 * Usage from client:
 *   fetch('https://esv-proxy.<your-subdomain>.workers.dev/?q=John+3:16')
 */

const ESV_API_URL = 'https://api.esv.org/v3/passage/html/';

// Allowed origins (add your domain here)
const ALLOWED_ORIGINS = [
  'https://bible.macdwellings.com',
  'http://localhost',
  'http://127.0.0.1'
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.find(o => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    // Only allow GET
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Only allow requests whose Origin (or, failing that, Referer) actually
    // matches one of our allowed origins — a bare presence check doesn't
    // stop anyone from spoofing an arbitrary header value with curl/script.
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    const originOk = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const refererOk = !origin && referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o));
    if (!originOk && !refererOk) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the passage query from URL params
    const url = new URL(request.url);
    const passage = url.searchParams.get('q');

    if (!passage) {
      return new Response(JSON.stringify({ error: 'Missing ?q= parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
      });
    }

    // Edge-cache by passage (not by requesting origin) so repeat requests
    // for the same chapter — from any visitor, on either site — are served
    // from Cloudflare's cache instead of spending ESV API quota.
    const cache = caches.default;
    const cacheKey = new Request(`https://esv-proxy-cache.internal/?q=${encodeURIComponent(passage)}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
      });
    }

    // Build ESV API request
    const esvParams = new URLSearchParams({
      'q': passage,
      'include-passage-references': 'false',
      'include-verse-numbers': 'true',
      'include-first-verse-numbers': 'true',
      'include-footnotes': 'false',
      'include-footnote-body': 'false',
      'include-headings': 'true',
      'include-short-copyright': 'true',
      'include-audio-link': 'false',
      'include-css-link': 'false',
      'inline-styles': 'false',
      'wrapping-div': 'false',
      'include-book-titles': 'false',
      'include-crossrefs': 'false'
    });

    try {
      const esvResponse = await fetch(`${ESV_API_URL}?${esvParams.toString()}`, {
        headers: {
          'Authorization': `Token ${env.ESV_API_TOKEN}`
        }
      });

      if (!esvResponse.ok) {
        return new Response(JSON.stringify({ error: `ESV API returned ${esvResponse.status}` }), {
          status: esvResponse.status,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
        });
      }

      const data = await esvResponse.json();

      await cache.put(cacheKey, new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
      }));

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // 'private', not 'public': this response is gated by the origin
          // check above, so it must not be cacheable by Cloudflare's shared
          // edge/CDN cache — that would let anyone fetch a cached passage
          // without ever going through the check. The passage-level cache
          // above (via caches.default with a synthetic key) already gives
          // us the request-reduction benefit safely, since it's read only
          // after the origin check runs on every request.
          'Cache-Control': 'private, max-age=3600',
          ...getCorsHeaders(request)
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy fetch failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) }
      });
    }
  }
};
