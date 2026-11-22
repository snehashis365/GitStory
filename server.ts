import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AiDigest,
  CommitItem,
  ContributorItem,
  PullRequestItem,
  ReleaseItem,
  RepoSnapshot,
  VelocityPoint,
  AIProviderType,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Multi-Provider AI Adapter ───────────────────────────────────────────────

interface AIRequestConfig {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  localEndpoint?: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  /** For streaming chat responses */
  streaming?: boolean;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

/** Returns the full text response (non-streaming). */
async function callAI(cfg: AIRequestConfig): Promise<string> {
  const { provider, apiKey, model, localEndpoint, systemPrompt, userPrompt } = cfg;

  if (provider === 'gemini') {
    const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: systemPrompt,
        ...(cfg.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });
    return response.text || '';
  }

  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err.error?.message || `Anthropic error ${resp.status}`);
    }
    const data = (await resp.json()) as { content: { text: string }[] };
    return data.content?.[0]?.text || '';
  }

  // OpenAI-compatible: openai, nvidia, local
  const baseUrl =
    provider === 'nvidia'
      ? 'https://integrate.api.nvidia.com/v1'
      : provider === 'local'
        ? (localEndpoint?.replace(/\/$/, '') ?? 'http://localhost:11434/v1')
        : 'https://api.openai.com/v1';

  const defaultModels: Record<string, string> = {
    openai: 'gpt-4o-mini',
    nvidia: 'meta/llama-3.1-70b-instruct',
    local: 'llama3',
  };

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || defaultModels[provider] || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...(cfg.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || `${provider} API error ${resp.status}`);
  }
  const data = (await resp.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content || '';
}

/** Stream tokens to the response for chat. Writes SSE `data:` lines. */
async function streamAI(
  cfg: AIRequestConfig,
  res: Response
): Promise<void> {
  const { provider, apiKey, model, localEndpoint, systemPrompt, chatHistory = [] } = cfg;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];

  if (provider === 'gemini') {
    const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const contents = chatHistory.slice(-10).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const stream = await ai.models.generateContentStream({
      model: model || 'gemini-2.5-flash',
      contents,
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, systemInstruction: systemPrompt },
    });
    for await (const chunk of stream) {
      if (chunk.text) res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  if (provider === 'anthropic') {
    const anthropicMessages = chatHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 2048,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`Anthropic stream error ${resp.status}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw) as { type: string; delta?: { type: string; text?: string } };
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            res.write(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`);
          }
        } catch { /* skip malformed */ }
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // OpenAI-compatible streaming
  const baseUrl =
    provider === 'nvidia'
      ? 'https://integrate.api.nvidia.com/v1'
      : provider === 'local'
        ? (localEndpoint?.replace(/\/$/, '') ?? 'http://localhost:11434/v1')
        : 'https://api.openai.com/v1';

  const defaultModels: Record<string, string> = {
    openai: 'gpt-4o-mini',
    nvidia: 'meta/llama-3.1-70b-instruct',
    local: 'llama3',
  };

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || defaultModels[provider] || 'gpt-4o-mini',
      messages,
      stream: true,
    }),
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`${provider} stream error ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const evt = JSON.parse(raw) as { choices?: { delta?: { content?: string } }[] };
        const text = evt.choices?.[0]?.delta?.content;
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch { /* skip */ }
    }
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

/** Extract provider config from request headers. */
function getProviderConfig(req: Request): { provider: AIProviderType; apiKey: string; model: string; localEndpoint?: string } {
  const provider = (req.headers['x-ai-provider'] as AIProviderType) || 'gemini';
  const apiKey = (req.headers['x-ai-key'] as string) || process.env.GEMINI_API_KEY || '';
  const model = (req.headers['x-ai-model'] as string) || '';
  const localEndpoint = (req.headers['x-ai-endpoint'] as string) || undefined;
  return { provider, apiKey, model, localEndpoint };
}

function parseRepoInput(raw: string): { owner: string; repo: string } | null {
  const cleaned = raw.trim().replace(/^@/, '');
  if (!cleaned) return null;

  const urlMatch = cleaned.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/.*)?$/i
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2].replace(/\.git$/i, ''),
    };
  }

  const shortMatch = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2].replace(/\.git$/i, ''),
    };
  }

  return null;
}

// Smart ETag + snapshot cache to stay fast & protect unauthenticated GitHub rate limits
interface CacheEntry<T> {
  etag?: string;
  data: T;
  fetchedAt: number;
  rateLimitRemaining: number | null;
  linkHeader?: string | null;
}

const ghCache = new Map<string, CacheEntry<unknown>>();
const snapshotCache = new Map<string, { snapshot: RepoSnapshot; fetchedAt: number }>();
const digestCache = new Map<string, { digest: AiDigest; generatedAt: number }>();

const ENDPOINT_CACHE_TTL_MS = 180_000; // 3 minutes
const DIGEST_CACHE_TTL_MS = 600_000; // 10 minutes

function parseLastPage(linkHeader: string | null | undefined): number | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    if (part.includes('rel="last"')) {
      const match = part.match(/[?&]page=(\d+)/);
      if (match && match[1]) {
        const parsed = parseInt(match[1], 10);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }
  return null;
}

async function githubFetch<T>(
  url: string,
  forceConditionalCheck = false
): Promise<{
  data: T;
  fromCache: boolean;
  notModified: boolean;
  rateLimitRemaining: number | null;
  linkHeader: string | null;
}> {
  const cached = ghCache.get(url) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && !forceConditionalCheck && now - cached.fetchedAt < ENDPOINT_CACHE_TTL_MS) {
    return {
      data: cached.data,
      fromCache: true,
      notModified: false,
      rateLimitRemaining: cached.rateLimitRemaining,
      linkHeader: cached.linkHeader ?? null,
    };
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GitStory-Repo-Tracker',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const resp = await fetch(url, { headers });
  const remainingHeader = resp.headers.get('x-ratelimit-remaining');
  const rateLimitRemaining = remainingHeader !== null ? Number(remainingHeader) : null;
  const linkHeader = resp.headers.get('link');

  if (resp.status === 304 && cached) {
    cached.fetchedAt = now;
    cached.rateLimitRemaining = rateLimitRemaining;
    return {
      data: cached.data,
      fromCache: true,
      notModified: true,
      rateLimitRemaining,
      linkHeader: cached.linkHeader ?? null,
    };
  }

  if (!resp.ok) {
    if (resp.status === 404) {
      const err = new Error(
        'Repository not found or is private. Double-check the owner/repo name.'
      ) as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    if (resp.status === 403 || resp.status === 429) {
      if (cached) {
        return {
          data: cached.data,
          fromCache: true,
          notModified: false,
          rateLimitRemaining: 0,
          linkHeader: cached.linkHeader ?? null,
        };
      }
      const err = new Error(
        'GitHub API rate limit reached for this IP. Try again in a few minutes or configure GITHUB_TOKEN.'
      ) as Error & { status?: number };
      err.status = 429;
      throw err;
    }
    const err = new Error(
      `GitHub returned status ${resp.status}. Please try again shortly.`
    ) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }

  const data = (await resp.json()) as T;
  const etag = resp.headers.get('etag') ?? undefined;
  ghCache.set(url, {
    etag,
    data,
    fetchedAt: now,
    rateLimitRemaining,
    linkHeader,
  });

  return {
    data,
    fromCache: false,
    notModified: false,
    rateLimitRemaining,
    linkHeader,
  };
}

function buildVelocitySeries(commits: CommitItem[], mergedPRs: PullRequestItem[]): VelocityPoint[] {
  const countsByDay = new Map<string, { commits: number; mergedPRs: number }>();

  const allDates: Date[] = [];
  for (const c of commits) {
    if (c.date) allDates.push(new Date(c.date));
  }
  for (const pr of mergedPRs) {
    if (pr.mergedAt) allDates.push(new Date(pr.mergedAt));
  }

  const anchor =
    allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : new Date();
  anchor.setHours(0, 0, 0, 0);

  const dayKeys: string[] = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayKeys.push(key);
    countsByDay.set(key, { commits: 0, mergedPRs: 0 });
  }

  for (const c of commits) {
    const key = c.date?.slice(0, 10);
    if (key && countsByDay.has(key)) {
      countsByDay.get(key)!.commits += 1;
    }
  }
  for (const pr of mergedPRs) {
    const key = pr.mergedAt?.slice(0, 10);
    if (key && countsByDay.has(key)) {
      countsByDay.get(key)!.mergedPRs += 1;
    }
  }

  const totalInWindow = Array.from(countsByDay.values()).reduce(
    (acc, v) => acc + v.commits + v.mergedPRs,
    0
  );

  if (totalInWindow < 3 && allDates.length > 0) {
    const sparse = new Map<string, { commits: number; mergedPRs: number }>();
    for (const c of commits) {
      const k = c.date.slice(0, 10);
      const entry = sparse.get(k) ?? { commits: 0, mergedPRs: 0 };
      entry.commits += 1;
      sparse.set(k, entry);
    }
    for (const pr of mergedPRs) {
      const k = pr.mergedAt.slice(0, 10);
      const entry = sparse.get(k) ?? { commits: 0, mergedPRs: 0 };
      entry.mergedPRs += 1;
      sparse.set(k, entry);
    }
    return Array.from(sparse.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([date, vals]) => {
        const parsed = new Date(`${date}T12:00:00Z`);
        return {
          date,
          label: parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          commits: vals.commits,
          mergedPRs: vals.mergedPRs,
        };
      });
  }

  return dayKeys.map((date) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    const vals = countsByDay.get(date)!;
    return {
      date,
      label: parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      commits: vals.commits,
      mergedPRs: vals.mergedPRs,
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 0. AI Model List — proxied to avoid CORS, provider-specific fetching
  app.get('/api/ai/models', async (req: Request, res: Response) => {
    const { provider, apiKey, localEndpoint } = getProviderConfig(req);

    try {
      // Anthropic doesn't expose a public list-models endpoint — return a curated hardcoded list
      if (provider === 'anthropic') {
        return res.json({
          models: [
            'claude-opus-4-5',
            'claude-sonnet-4-5',
            'claude-haiku-4-5',
            'claude-3-7-sonnet-latest',
            'claude-3-5-sonnet-latest',
            'claude-3-5-haiku-latest',
            'claude-3-opus-latest',
          ],
        });
      }

      if (provider === 'gemini') {
        if (!apiKey) return res.status(400).json({ error: 'API key required' });
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`
        );
        if (!resp.ok) {
          const e = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
          return res.status(resp.status).json({ error: e.error?.message || `Gemini error ${resp.status}` });
        }
        const data = (await resp.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
        const models = (data.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => m.name.replace('models/', ''))
          .filter((n) => !n.includes('embedding') && !n.includes('aqa'));
        return res.json({ models });
      }

      // OpenAI-compatible: openai, nvidia, local
      const baseUrl =
        provider === 'nvidia'
          ? 'https://integrate.api.nvidia.com/v1'
          : provider === 'local'
            ? (localEndpoint?.replace(/\/$/, '') ?? 'http://localhost:11434/v1')
            : 'https://api.openai.com/v1';

      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!resp.ok) {
        const e = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        return res.status(resp.status).json({ error: e.error?.message || `${provider} error ${resp.status}` });
      }
      const data = (await resp.json()) as { data?: { id: string }[] };
      let models = (data.data ?? []).map((m) => m.id).sort();

      // For OpenAI, filter to just chat-capable models for a cleaner list
      if (provider === 'openai') {
        const chatPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4'];
        const filtered = models.filter((id) => chatPrefixes.some((p) => id.startsWith(p)));
        if (filtered.length > 0) models = filtered;
      }

      return res.json({ models });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Model list error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to fetch model list.' });
    }
  });

  // 1. Live GitHub Repo Aggregator with lightweight 1-call ETag delta sync
  app.get('/api/github/repo', async (req: Request, res: Response) => {
    try {
      const rawRepo = String(req.query.repo || '');
      const forceSync = req.query.sync === '1';
      const parsed = parseRepoInput(rawRepo);

      if (!parsed) {
        res.status(400).json({
          error:
            'Please enter a valid GitHub URL (https://github.com/owner/repo) or owner/repo handle.',
        });
        return;
      }

      const { owner, repo } = parsed;
      const cacheKey = `${owner}/${repo}`.toLowerCase();
      const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const existingSnap = snapshotCache.get(cacheKey);

      // Fast path for non-sync loads within TTL
      if (existingSnap && !forceSync && Date.now() - existingSnap.fetchedAt < ENDPOINT_CACHE_TTL_MS) {
        res.json({ ...existingSnap.snapshot, cached: true });
        return;
      }

      // Ultra-lightweight 60s auto-sync check: 1 conditional ETag request on latest commit!
      if (forceSync && existingSnap) {
        try {
          const headCheck = await githubFetch<Record<string, unknown>[]>(
            `${base}/commits?per_page=1`,
            true
          );
          const latestHeadSha = String(headCheck.data?.[0]?.sha || '');
          const prevHeadSha = existingSnap.snapshot.commits[0]?.sha || '';
          if (headCheck.notModified || (latestHeadSha && latestHeadSha === prevHeadSha)) {
            const refreshed: RepoSnapshot = {
              ...existingSnap.snapshot,
              syncedAt: new Date().toISOString(),
              rateLimitRemaining: headCheck.rateLimitRemaining,
              cached: true,
            };
            snapshotCache.set(cacheKey, { snapshot: refreshed, fetchedAt: Date.now() });
            res.json(refreshed);
            return;
          }
        } catch {
          // If rate limited during background sync, keep serving the cached snapshot smoothly
          res.json({
            ...existingSnap.snapshot,
            syncedAt: new Date().toISOString(),
            cached: true,
          });
          return;
        }
      }

      const [
        repoRes,
        commitsRes,
        pullsRes,
        releasesRes,
        contribRes,
        totalCommitsRes,
        totalPullsRes,
      ] = await Promise.all([
        githubFetch<Record<string, unknown>>(base, forceSync),
        githubFetch<Record<string, unknown>[]>(`${base}/commits?per_page=25`, forceSync).catch(
          () => ({
            data: [] as Record<string, unknown>[],
            fromCache: false,
            notModified: false,
            rateLimitRemaining: null,
            linkHeader: null,
          })
        ),
        githubFetch<Record<string, unknown>[]>(
          `${base}/pulls?state=closed&sort=updated&direction=desc&per_page=18`,
          forceSync
        ).catch(() => ({
          data: [] as Record<string, unknown>[],
          fromCache: false,
          notModified: false,
          rateLimitRemaining: null,
          linkHeader: null,
        })),
        githubFetch<Record<string, unknown>[]>(`${base}/releases?per_page=5`, forceSync).catch(
          () => ({
            data: [] as Record<string, unknown>[],
            fromCache: false,
            notModified: false,
            rateLimitRemaining: null,
            linkHeader: null,
          })
        ),
        githubFetch<Record<string, unknown>[]>(
          `${base}/contributors?per_page=8`,
          forceSync
        ).catch(() => ({
          data: [] as Record<string, unknown>[],
          fromCache: false,
          notModified: false,
          rateLimitRemaining: null,
          linkHeader: null,
        })),
        githubFetch<Record<string, unknown>[]>(`${base}/commits?per_page=1`, forceSync).catch(
          () => ({
            data: [] as Record<string, unknown>[],
            fromCache: false,
            notModified: false,
            rateLimitRemaining: null,
            linkHeader: null,
          })
        ),
        githubFetch<Record<string, unknown>[]>(`${base}/pulls?state=all&per_page=1`, forceSync).catch(
          () => ({
            data: [] as Record<string, unknown>[],
            fromCache: false,
            notModified: false,
            rateLimitRemaining: null,
            linkHeader: null,
          })
        ),
      ]);

      const r = repoRes.data;
      const ownerObj = (r.owner as Record<string, unknown>) || {};
      const licenseObj = (r.license as Record<string, unknown>) || null;

      const allCommits: CommitItem[] = (commitsRes.data || []).map((item) => {
        const commitObj = (item.commit as Record<string, unknown>) || {};
        const commitAuthor = (commitObj.author as Record<string, unknown>) || {};
        const ghAuthor = (item.author as Record<string, unknown>) || {};
        const msg = String(commitObj.message || 'Update repository');
        const sha = String(item.sha || '');
        return {
          sha,
          shortSha: sha.slice(0, 7),
          message: msg,
          firstLine: msg.split('\n')[0].trim(),
          authorName: String(commitAuthor.name || ghAuthor.login || 'Contributor'),
          authorLogin: String(ghAuthor.login || commitAuthor.name || 'contributor'),
          authorAvatar: String(ghAuthor.avatar_url || ''),
          date: String(commitAuthor.date || new Date().toISOString()),
          htmlUrl: String(item.html_url || ''),
        };
      });

      const mergedPRs: PullRequestItem[] = (pullsRes.data || [])
        .filter((pr) => Boolean(pr.merged_at))
        .slice(0, 10)
        .map((pr) => {
          const user = (pr.user as Record<string, unknown>) || {};
          const labels = Array.isArray(pr.labels)
            ? pr.labels.map((l) => String((l as Record<string, unknown>).name || '')).filter(Boolean)
            : [];
          return {
            number: Number(pr.number || 0),
            title: String(pr.title || 'Merged Pull Request'),
            userLogin: String(user.login || 'contributor'),
            userAvatar: String(user.avatar_url || ''),
            mergedAt: String(pr.merged_at),
            htmlUrl: String(pr.html_url || ''),
            labels: labels.slice(0, 3),
          };
        });

      const totalCommitsParsed = parseLastPage(totalCommitsRes.linkHeader);
      const totalCommits =
        totalCommitsParsed ??
        (totalCommitsRes.data?.length ? totalCommitsRes.data.length : allCommits.length);

      const totalPRsParsed = parseLastPage(totalPullsRes.linkHeader);
      const totalPRs =
        totalPRsParsed ??
        (totalPullsRes.data?.length ? totalPullsRes.data.length : mergedPRs.length);

      const releases: ReleaseItem[] = (releasesRes.data || []).slice(0, 5).map((rel) => {
        const author = (rel.author as Record<string, unknown>) || {};
        return {
          id: Number(rel.id || 0),
          tagName: String(rel.tag_name || 'v0.0.0'),
          name: String(rel.name || rel.tag_name || 'Latest Release'),
          publishedAt: String(rel.published_at || rel.created_at || new Date().toISOString()),
          body: String(rel.body || '').slice(0, 2200),
          htmlUrl: String(rel.html_url || ''),
          authorLogin: String(author.login || 'maintainer'),
        };
      });

      const contributors: ContributorItem[] = (contribRes.data || []).slice(0, 8).map((c) => ({
        login: String(c.login || 'contributor'),
        avatarUrl: String(c.avatar_url || ''),
        contributions: Number(c.contributions || 0),
        htmlUrl: String(c.html_url || ''),
      }));

      const velocitySeries = buildVelocitySeries(allCommits, mergedPRs);

      const snapshot: RepoSnapshot = {
        repo: {
          owner: String(ownerObj.login || owner),
          name: String(r.name || repo),
          fullName: String(r.full_name || `${owner}/${repo}`),
          description: String(r.description || 'An active open-source project on GitHub.'),
          stars: Number(r.stargazers_count || 0),
          forks: Number(r.forks_count || 0),
          openIssues: Number(r.open_issues_count || 0),
          watchers: Number(r.subscribers_count || r.watchers_count || 0),
          language: String(r.language || 'Open Source'),
          defaultBranch: String(r.default_branch || 'main'),
          pushedAt: String(r.pushed_at || new Date().toISOString()),
          updatedAt: String(r.updated_at || new Date().toISOString()),
          createdAt: String(r.created_at || new Date().toISOString()),
          htmlUrl: String(r.html_url || `https://github.com/${owner}/${repo}`),
          avatarUrl: String(ownerObj.avatar_url || ''),
          topics: Array.isArray(r.topics) ? (r.topics as string[]).slice(0, 6) : [],
          license: licenseObj ? String(licenseObj.spdx_id || licenseObj.name || '') : null,
          totalCommits: Math.max(totalCommits, allCommits.length),
          totalPRs: Math.max(totalPRs, mergedPRs.length),
        },
        commits: allCommits.slice(0, 15),
        mergedPRs,
        releases,
        contributors,
        velocitySeries,
        syncedAt: new Date().toISOString(),
        rateLimitRemaining: repoRes.rateLimitRemaining,
        cached: repoRes.fromCache && commitsRes.fromCache,
      };

      snapshotCache.set(cacheKey, { snapshot, fetchedAt: Date.now() });
      res.json(snapshot);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      const status = error.status || 500;
      res.status(status).json({ error: error.message || 'Failed to fetch repository data.' });
    }
  });

  // 2. Multi-Provider AI Story-First Community Progress Digest & Jargon Decoder
  app.post('/api/ai/summarize', async (req: Request, res: Response) => {
    try {
      const { snapshot } = req.body as { snapshot?: RepoSnapshot };
      if (!snapshot?.repo?.fullName) {
        res.status(400).json({ error: 'Missing repository snapshot for AI summary.' });
        return;
      }

      const { provider, apiKey, model, localEndpoint } = getProviderConfig(req);
      if (!apiKey && provider !== 'local') {
        res.status(400).json({ error: 'No API key provided. Please configure your AI provider.' });
        return;
      }

      const forceRefresh = req.headers['x-force-ai'] === '1' || req.query.force === '1';
      const latestSha = snapshot.commits[0]?.sha || snapshot.commits[0]?.shortSha || 'none';
      const latestPr = snapshot.mergedPRs[0]?.number || 0;
      const latestTag = snapshot.releases[0]?.tagName || 'none';
      const dCacheKey = `${snapshot.repo.fullName.toLowerCase()}::${latestSha}::${latestPr}::${latestTag}::${provider}::${model}`;
      const cachedDigest = digestCache.get(dCacheKey);

      // Only re-generate if new activity detected or if user clicked manual regenerate
      if (!forceRefresh && cachedDigest) {
        res.json(cachedDigest.digest);
        return;
      }

      const commitsPayload = snapshot.commits.slice(0, 15).map((c) => ({
        sha: c.shortSha, author: c.authorLogin, message: c.firstLine, date: c.date.slice(0, 10),
      }));
      const prsPayload = snapshot.mergedPRs.slice(0, 8).map((p) => ({
        number: p.number, title: p.title, author: p.userLogin, mergedAt: p.mergedAt.slice(0, 10),
      }));
      const latestRelease = snapshot.releases[0]
        ? { tagName: snapshot.releases[0].tagName, name: snapshot.releases[0].name, publishedAt: snapshot.releases[0].publishedAt.slice(0, 10), notes: snapshot.releases[0].body.slice(0, 1500) }
        : null;

      const userPrompt = `Repository: ${snapshot.repo.fullName}
Description: ${snapshot.repo.description}
Primary language: ${snapshot.repo.language}
Stars: ${snapshot.repo.stars} | Forks: ${snapshot.repo.forks} | Open Issues: ${snapshot.repo.openIssues}
Top Contributors: ${snapshot.contributors.slice(0, 5).map((c) => `${c.login} (${c.contributions})`).join(', ')}

Recent Commits:
${JSON.stringify(commitsPayload, null, 2)}

Recently Merged Pull Requests:
${JSON.stringify(prsPayload, null, 2)}

Latest Release:
${latestRelease ? JSON.stringify(latestRelease, null, 2) : 'No formal GitHub releases yet.'}

Respond with ONLY a valid JSON object (no markdown, no code fences) matching exactly this schema:
{
  "headline": "string (under 14 words)",
  "playfulSummary": "string (2-3 sentences non-technical overview)",
  "momentumMood": "string (2-3 words)",
  "momentumEmoji": "string (single emoji)",
  "nextMilestoneEstimate": "string",
  "milestoneProgressPct": number (25-95),
  "progressChapters": [{ "emoji": "string", "title": "string", "summary": "string", "impactLabel": "string", "keyWins": ["string"], "relatedCount": number }],
  "jargonDecoder": [{ "term": "string", "plainMeaning": "string", "emoji": "string" }],
  "lifecycleStageBriefs": { "commits": "string", "prs": "string", "community": "string", "release": "string" },
  "releaseTranslation": { "tagName": "string", "cheerfulTitle": "string", "summary": "string", "highlights": [{ "emoji": "string", "text": "string" }] } or null,
  "commitTranslations": [{ "sha": "string", "emoji": "string", "plainTitle": "string", "whyItMatters": "string", "category": "string" }],
  "prTranslations": [{ "number": number, "emoji": "string", "plainTitle": "string", "whyItMatters": "string", "category": "string" }]
}`;

      const systemPrompt = 'You are GitStory, a playful, warm community storyteller who transforms raw GitHub developer activity into clear, exciting, jargon-free progress reports for non-developers, project stakeholders, and fans. NEVER paste raw commit jargon, ticket IDs, or code syntax into headlines, chapter titles, or plain-English summaries. Always explain real-world user impact using friendly analogies, crisp everyday English, and cheerful emojis. Return ONLY valid JSON with no markdown code fences.';

      const rawText = await callAI({ provider, apiKey, model, localEndpoint, systemPrompt, userPrompt, jsonMode: true });

      // Strip markdown code fences if model wrapped output anyway
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned) as Omit<AiDigest, 'generatedAt'>;

      const digest: AiDigest = {
        ...parsed,
        milestoneProgressPct: Math.min(98, Math.max(15, Number(parsed.milestoneProgressPct) || 68)),
        progressChapters: Array.isArray(parsed.progressChapters) ? parsed.progressChapters : [],
        jargonDecoder: Array.isArray(parsed.jargonDecoder) ? parsed.jargonDecoder : [],
        lifecycleStageBriefs: parsed.lifecycleStageBriefs || {
          commits: 'Developers are actively crafting fresh improvements behind the scenes.',
          prs: 'Reviewed community improvements are smoothly merging into the main project.',
          community: 'Contributors are collaborating steadily to keep momentum high.',
          release: 'Preparing the latest tested improvements for the wider community.',
        },
        releaseTranslation: latestRelease ? parsed.releaseTranslation ?? null : null,
        commitTranslations: Array.isArray(parsed.commitTranslations) ? parsed.commitTranslations : [],
        prTranslations: Array.isArray(parsed.prTranslations) ? parsed.prTranslations : [],
        generatedAt: new Date().toISOString(),
      };

      digestCache.set(dCacheKey, { digest, generatedAt: Date.now() });
      res.json(digest);
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      console.error('AI summarize error:', error);
      res.status(error.status || 500).json({
        error: error.message || 'Could not generate the AI community summary right now. Please try again.',
      });
    }
  });

  // 3. Multi-Provider AI Streaming Community Q&A Chat
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { snapshot, digest, messages } = req.body as {
        snapshot?: RepoSnapshot;
        digest?: AiDigest | null;
        messages?: { role: 'user' | 'assistant'; content: string }[];
      };

      if (!snapshot?.repo?.fullName || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Missing repository context or chat messages.' });
        return;
      }

      const { provider, apiKey, model, localEndpoint } = getProviderConfig(req);
      if (!apiKey && provider !== 'local') {
        res.status(400).json({ error: 'No API key provided. Please configure your AI provider.' });
        return;
      }

      const repoContext = `ACTIVE REPOSITORY: ${snapshot.repo.fullName}
Description: ${snapshot.repo.description}
Stats: ${snapshot.repo.stars.toLocaleString()} stars, ${snapshot.repo.forks.toLocaleString()} forks, ${snapshot.repo.openIssues.toLocaleString()} open issues, ${snapshot.repo.totalCommits ? `${snapshot.repo.totalCommits.toLocaleString()} total commits, ` : ''}${snapshot.repo.totalPRs ? `${snapshot.repo.totalPRs.toLocaleString()} total PRs, ` : ''}primary language: ${snapshot.repo.language}.
Latest Release: ${snapshot.releases[0] ? `${snapshot.releases[0].tagName} (${snapshot.releases[0].name}) on ${snapshot.releases[0].publishedAt.slice(0, 10)}\nNotes: ${snapshot.releases[0].body.slice(0, 900)}` : 'None published yet.'}
Top Contributors: ${snapshot.contributors.map((c) => `${c.login} (${c.contributions} contributions)`).join(', ')}
Recent Commits:
${snapshot.commits.slice(0, 15).map((c) => `- [${c.shortSha}] (${c.date.slice(0, 10)}) by ${c.authorLogin}: ${c.firstLine}`).join('\n')}
Recently Merged PRs:
${snapshot.mergedPRs.slice(0, 8).map((p) => `- #${p.number} (${p.mergedAt.slice(0, 10)}) by ${p.userLogin}: ${p.title}`).join('\n')}
${digest ? `Current AI Community Briefing: ${digest.headline} — ${digest.playfulSummary}` : ''}`;

      const systemPrompt = `You are GitStory's friendly open-source tour guide! Your job is to answer questions from non-technical community members, stakeholders, and curious fans about the GitHub repository below.

Style rules:
- Use a warm, playful, encouraging tone with tasteful emojis.
- Translate every technical term into simple everyday analogies (e.g., explain what a pull request, dependency bump, refactor, or compiler fix means in human terms).
- Stay strictly grounded in the live repository facts below. If asked about something not in the recent data, be transparent and explain what the recent activity *does* show.
- Keep answers concise, scannable, and easy to read (short paragraphs or crisp bullet points).

${repoContext}`;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      await streamAI({ provider, apiKey, model, localEndpoint, systemPrompt, userPrompt: '', chatHistory: messages.slice(-10), streaming: true }, res);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('AI chat error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Unable to reach GitStory AI chat right now.' });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message || 'Stream interrupted.' })}\n\n`);
        res.end();
      }
    }
  });

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GitStory server running at http://localhost:${PORT}`);
  });
}

startServer();
