/**
 * GitStory AI Edge Gateway (Cloudflare Worker)
 * 
 * Proxies OpenAI-compatible requests to Groq Cloud using a secret GROQ_API_KEY.
 * Protects the key from browser exposure while providing zero-config AI demos
 * for GitStory visitors on GitHub Pages with built-in rate limiting and CORS protection.
 */

// Model to use for GitStory demos
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const ALLOWED_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
]);

// Rate limiting settings: 6 requests per 60 seconds per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;

// Fast SHA-256 helper for Cache API keys
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// In-memory sliding window rate limiter
// Note: In Cloudflare Workers, global memory persists across warm requests on the same edge node.
const ipRequestHistory = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = ipRequestHistory.get(ip) || [];

  // Clean up timestamps outside the active window
  const activeTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (activeTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    ipRequestHistory.set(ip, activeTimestamps);
    return false; // Rate limit exceeded
  }

  activeTimestamps.push(now);
  ipRequestHistory.set(ip, activeTimestamps);

  // Periodically sweep old IPs if memory grows
  if (ipRequestHistory.size > 2000) {
    for (const [key, list] of ipRequestHistory.entries()) {
      if (list.length === 0 || now - list[list.length - 1] > RATE_LIMIT_WINDOW_MS) {
        ipRequestHistory.delete(key);
      }
    }
  }

  return true;
}

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with, if-none-match',
    'Access-Control-Expose-Headers': 'Link, x-ratelimit-remaining, x-ratelimit-limit, x-proxy-cache',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    // 2. Health & Status check endpoint
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'GitStory AI & GitHub Proxy',
          defaultModel: DEFAULT_MODEL,
          allowedModels: Array.from(ALLOWED_MODELS),
          rateLimit: `${MAX_REQUESTS_PER_WINDOW} req / ${RATE_LIMIT_WINDOW_MS / 1000}s per IP`,
          features: {
            aiGateway: true,
            githubProxy: true,
            githubTokenConfigured: Boolean(env.GITHUB_TOKEN),
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // --------------------------------------------------------------------------
    // 3. GitHub API Proxy with Edge Caching & GITHUB_TOKEN Injection
    // --------------------------------------------------------------------------
    if (url.pathname.startsWith('/github/')) {
      // Security: Only allow safe GET requests
      if (request.method !== 'GET') {
        return new Response(
          JSON.stringify({ error: 'Method Not Allowed. Only GET requests are permitted.' }),
          { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Extract subpath (e.g. /github/repos/facebook/react/commits -> /repos/facebook/react/commits)
      const subPath = url.pathname.replace(/^\/github/, '');

      // Security: Only allow /repos/* or /search/* endpoints
      if (!subPath.startsWith('/repos/') && !subPath.startsWith('/search/')) {
        return new Response(
          JSON.stringify({ error: 'Forbidden endpoint. Only /repos/* and /search/* can be queried.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const targetUrl = new URL(`https://api.github.com${subPath}${url.search}`);

      // Check Cloudflare Edge Cache first
      const cache = caches.default;
      const cacheKey = new Request(targetUrl.toString(), {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        headers.set('x-proxy-cache', 'HIT');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers,
        });
      }

      // Build GitHub API request headers
      const ghHeaders = {
        'User-Agent': 'GitStory-Gateway/1.0',
        Accept: 'application/vnd.github.v3+json',
      };
      if (env.GITHUB_TOKEN) {
        ghHeaders['Authorization'] = `Bearer ${env.GITHUB_TOKEN.trim()}`;
      }

      try {
        const ghResp = await fetch(targetUrl.toString(), {
          headers: ghHeaders,
        });

        const respHeaders = new Headers(ghResp.headers);
        for (const [k, v] of Object.entries(corsHeaders)) {
          respHeaders.set(k, v);
        }
        respHeaders.set('x-proxy-cache', 'MISS');

        // Cache 200 responses at Cloudflare Edge for 60 seconds
        if (ghResp.status === 200) {
          respHeaders.set('Cache-Control', 'public, max-age=60');
          const cacheableResponse = new Response(ghResp.clone().body, {
            status: ghResp.status,
            statusText: ghResp.statusText,
            headers: respHeaders,
          });
          ctx.waitUntil(cache.put(cacheKey, cacheableResponse));
        }

        return new Response(ghResp.body, {
          status: ghResp.status,
          statusText: ghResp.statusText,
          headers: respHeaders,
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: `GitHub upstream error: ${err.message || 'fetch failed'}` }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // 3. Only accept POST to /v1/chat/completions (matches OpenAI client path)
    if (request.method !== 'POST' || !url.pathname.endsWith('/chat/completions')) {
      return new Response(
        JSON.stringify({ error: { message: 'Not Found. Use POST /v1/chat/completions' } }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 4. Verify Secret Key exists in Cloudflare Environment
    const groqApiKey = env.GROQ_API_KEY;
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Worker misconfigured: GROQ_API_KEY secret is missing in Cloudflare environment.',
            code: 'missing_secret',
          },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 5. In-Memory IP Rate Limiting
    const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Demo rate limit reached (${MAX_REQUESTS_PER_WINDOW} req/min). Please add your own free Gemini, Groq, or OpenAI API key in settings to continue without limits.`,
            code: 'demo_rate_limit_exceeded',
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '30',
            ...corsHeaders,
          },
        }
      );
    }

    // 6. Parse and sanitize payload
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid JSON request body.' } }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Enforce allowed model (defaulting to openai/gpt-oss-120b)
    const requestedModel = body.model;
    const modelToUse = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;

    // Build payload to forward to Groq
    const groqPayload = {
      model: modelToUse,
      messages: Array.isArray(body.messages) ? body.messages : [],
      temperature: typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1) : 0.7,
      max_tokens: Math.min(Number(body.max_completion_tokens || body.max_tokens) || 4096, 4096),
      stream: Boolean(body.stream),
    };

    if (body.response_format) {
      groqPayload.response_format = body.response_format;
      // Groq requires reasoning_format: 'parsed' or 'hidden' when JSON mode is active on reasoning models
      groqPayload.reasoning_format = body.reasoning_format || 'parsed';
    } else if (body.reasoning_format) {
      groqPayload.reasoning_format = body.reasoning_format;
    }

    // 7. Check Cloudflare Edge Cache for non-streaming completions (0 tokens burned on hit!)
    const cache = caches.default;
    let aiCacheKey = null;
    if (!groqPayload.stream) {
      const cacheHash = await sha256(
        JSON.stringify({
          model: modelToUse,
          messages: groqPayload.messages,
          response_format: groqPayload.response_format,
        })
      );
      aiCacheKey = new Request(`https://gitstory-ai-cache.internal/completions/${cacheHash}`, {
        method: 'GET',
      });

      const cachedAiResp = await cache.match(aiCacheKey);
      if (cachedAiResp) {
        const headers = new Headers(cachedAiResp.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        headers.set('x-ai-cache', 'HIT');
        return new Response(cachedAiResp.body, {
          status: cachedAiResp.status,
          statusText: cachedAiResp.statusText,
          headers,
        });
      }
    }

    // 8. Call Groq Cloud API with resilient fallback on JSON validation errors
    try {
      let groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groqPayload),
      });

      // If Groq's server-side JSON validator fails (json_validate_failed), retry once with reasoning hidden and unconstrained JSON
      if (!groqResponse.ok && groqPayload.response_format) {
        const errorBody = await groqResponse.clone().json().catch(() => ({}));
        if (
          errorBody?.error?.code === 'json_validate_failed' ||
          errorBody?.error?.message?.includes('validate JSON')
        ) {
          const fallbackPayload = {
            ...groqPayload,
            reasoning_format: 'hidden',
          };
          delete fallbackPayload.response_format;

          const retryResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fallbackPayload),
          });
          if (retryResponse.ok) {
            groqResponse = retryResponse;
          }
        }
      }

      // Forward headers with CORS
      const responseHeaders = new Headers(groqResponse.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }

      // Cache successful non-streaming AI completions at Cloudflare Edge for 1 hour
      if (!groqPayload.stream && aiCacheKey && groqResponse.status === 200) {
        responseHeaders.set('Cache-Control', 'public, max-age=3600');
        const cacheable = new Response(groqResponse.clone().body, {
          status: groqResponse.status,
          statusText: groqResponse.statusText,
          headers: responseHeaders,
        });
        ctx.waitUntil(cache.put(aiCacheKey, cacheable));
      }
      responseHeaders.set('x-ai-cache', 'MISS');

      return new Response(groqResponse.body, {
        status: groqResponse.status,
        statusText: groqResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Failed to reach Groq API: ${err.message || 'Network error'}`,
            code: 'upstream_error',
          },
        }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  },
};
