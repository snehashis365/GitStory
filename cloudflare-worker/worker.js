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
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
]);

// Rate limiting settings: 6 requests per 60 seconds per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 6;

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
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
          service: 'GitStory AI Proxy',
          defaultModel: DEFAULT_MODEL,
          rateLimit: `${MAX_REQUESTS_PER_WINDOW} req / ${RATE_LIMIT_WINDOW_MS / 1000}s per IP`,
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
      max_tokens: Math.min(Number(body.max_tokens) || 2048, 2048), // Hard cap to prevent abuse
      stream: Boolean(body.stream),
    };

    if (body.response_format) {
      groqPayload.response_format = body.response_format;
    }

    // 7. Call Groq Cloud API
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groqPayload),
      });

      // Forward headers with CORS
      const responseHeaders = new Headers(groqResponse.headers);
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }

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
