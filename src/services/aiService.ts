import type {
  AIProviderConfig,
  AIProviderType,
  AiDigest,
  ChatMessage,
  RepoSnapshot,
} from '../types';

export const DEFAULT_AI_MODELS: Record<AIProviderType, string> = {
  demo: 'openai/gpt-oss-120b',
  groq: 'openai/gpt-oss-120b',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  nvidia: 'meta/llama-3.1-70b-instruct',
  local: 'llama3',
};

export const CURATED_MODELS: Record<AIProviderType, string[]> = {
  demo: [
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ],
  groq: [
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'deepseek-r1-distill-llama-70b',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-flash',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
    'o1',
    'gpt-4-turbo',
  ],
  anthropic: [
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
  ],
  nvidia: [
    'meta/llama-3.3-70b-instruct',
    'meta/llama-3.1-70b-instruct',
    'meta/llama-3.1-405b-instruct',
    'meta/llama-3.1-8b-instruct',
    'mistralai/mistral-large-2-instruct',
    'mistralai/mixtral-8x22b-instruct-v0.1',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'nvidia/nemotron-4-340b-instruct',
    'deepseek-ai/deepseek-r1',
    'qwen/qwen2.5-72b-instruct',
  ],
  local: [
    'llama3',
    'mistral',
    'qwen2.5-coder',
  ],
};

export function getDemoAiProxyUrl(): string {
  const envUrl = (import.meta.env.VITE_DEMO_AI_PROXY_URL as string | undefined)?.trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  return 'https://gitstory-ai-proxy.workers.dev';
}

export function isStaticDeployment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host.endsWith('github.io') ||
    host.endsWith('pages.dev') ||
    window.location.protocol === 'file:'
  );
}

export async function fetchAvailableModels(
  provider: AIProviderType,
  apiKey: string,
  localEndpoint?: string
): Promise<string[]> {
  // 1. Try backend server if NOT on static hosting (e.g. GitHub Pages)
  if (!isStaticDeployment()) {
    try {
      const headers: Record<string, string> = {
        'x-ai-provider': provider,
        'x-ai-key': apiKey.trim(),
      };
      if (localEndpoint?.trim()) headers['x-ai-endpoint'] = localEndpoint.trim();

      const resp = await fetch('/api/ai/models', { headers });
      if (resp.ok) {
        const data = (await resp.json()) as { models?: string[] };
        if (Array.isArray(data.models) && data.models.length > 0) return data.models;
      }
    } catch {
      // Fall through to direct browser fetch
    }
  }

  try {
    return await fetchAvailableModelsDirect(provider, apiKey, localEndpoint);
  } catch {
    // If live fetch fails, fall back to rock-solid curated model list
    return CURATED_MODELS[provider] || [];
  }
}

export async function fetchAvailableModelsDirect(
  provider: AIProviderType,
  apiKey: string,
  localEndpoint?: string
): Promise<string[]> {
  if (provider === 'demo') {
    return CURATED_MODELS.demo;
  }

  if (provider === 'groq') {
    if (!apiKey.trim()) return CURATED_MODELS.groq;
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as { data?: { id: string }[] };
        if (Array.isArray(data.data) && data.data.length > 0) {
          return data.data.map((m) => m.id);
        }
      }
    } catch {
      // Fallback
    }
    return CURATED_MODELS.groq;
  }

  if (provider === 'anthropic') {
    return [
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
    ];
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const e = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(e.error?.message || `Gemini error ${resp.status}`);
    }
    const data = (await resp.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      .filter((n) => !n.includes('embedding') && !n.includes('aqa'));
  }

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
    throw new Error(e.error?.message || `${provider} error ${resp.status}`);
  }

  const data = (await resp.json()) as { data?: { id: string }[] };
  let models = (data.data ?? []).map((m) => m.id).sort();

  if (provider === 'openai') {
    const chatPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'o4'];
    const filtered = models.filter((id) => chatPrefixes.some((p) => id.startsWith(p)));
    if (filtered.length > 0) models = filtered;
  }

  return models;
}

const STORY_SYSTEM_PROMPT =
  'You are GitStory, a playful, warm community storyteller who transforms raw GitHub developer activity into clear, exciting, jargon-free progress reports for non-developers, project stakeholders, and fans. NEVER paste raw commit jargon, ticket IDs, or code syntax into headlines, chapter titles, or plain-English summaries. Always explain real-world user impact using friendly analogies, crisp everyday English, and cheerful emojis. Return ONLY valid JSON with no markdown code fences.';

export async function generateStoryDigest(
  snapshot: RepoSnapshot,
  cfg: AIProviderConfig
): Promise<AiDigest> {
  // 1. Try local/backend server endpoint if NOT on static hosting
  if (!isStaticDeployment()) {
    try {
      const resp = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': cfg.provider,
          'x-ai-key': cfg.apiKey.trim(),
          'x-ai-model': cfg.model ?? '',
          ...(cfg.localEndpoint ? { 'x-ai-endpoint': cfg.localEndpoint } : {}),
        },
        body: JSON.stringify({ snapshot }),
      });
      if (resp.ok) {
        const digest = (await resp.json()) as AiDigest;
        if (digest && digest.headline) return digest;
      }
    } catch {
      // Fall through to direct client-side fetch
    }
  }

  // 2. Direct browser fetch for static GitHub Pages hosting
  return generateStoryDigestDirect(snapshot, cfg);
}

export async function generateStoryDigestDirect(
  snapshot: RepoSnapshot,
  cfg: AIProviderConfig
): Promise<AiDigest> {
  const provider = cfg.provider;
  const apiKey = cfg.apiKey;
  const model = cfg.model || DEFAULT_AI_MODELS[provider] || 'gemini-2.5-flash';
  const localEndpoint = cfg.localEndpoint;

  const commitsPayload = snapshot.commits.slice(0, 15).map((c) => ({
    sha: c.shortSha,
    author: c.authorLogin,
    message: c.firstLine,
    date: c.date.slice(0, 10),
  }));

  const prsPayload = snapshot.mergedPRs.slice(0, 8).map((p) => ({
    number: p.number,
    title: p.title,
    author: p.userLogin,
    mergedAt: p.mergedAt.slice(0, 10),
  }));

  const latestRelease = snapshot.releases[0]
    ? {
        tagName: snapshot.releases[0].tagName,
        name: snapshot.releases[0].name,
        publishedAt: snapshot.releases[0].publishedAt.slice(0, 10),
        notes: snapshot.releases[0].body.slice(0, 1500),
      }
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

  let rawJson = '';

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${STORY_SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
    });
    if (!resp.ok) {
      const e = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(e.error?.message || `Gemini error ${resp.status}`);
    }
    const data = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 4096,
        system: STORY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err.error?.message || `Anthropic error ${resp.status}`);
    }
    const data = (await resp.json()) as { content?: { text: string }[] };
    rawJson = data.content?.[0]?.text || '';
  } else if (provider === 'demo') {
    const proxyUrl = getDemoAiProxyUrl();
    const resp = await fetch(`${proxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: STORY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
      if (resp.status === 429 || err.error?.code === 'demo_rate_limit_exceeded') {
        throw new Error(
          'Demo rate limit reached for this session. Please add your own free Gemini, Groq, or OpenAI key in settings to continue exploring!'
        );
      }
      throw new Error(err.error?.message || `Demo AI error ${resp.status}`);
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    rawJson = data.choices?.[0]?.message?.content || '';
  } else {
    // Groq, OpenAI, NVIDIA, or Local Endpoint
    const baseUrl =
      provider === 'groq'
        ? 'https://api.groq.com/openai/v1'
        : provider === 'nvidia'
          ? 'https://integrate.api.nvidia.com/v1'
          : provider === 'local'
            ? (localEndpoint?.replace(/\/$/, '') ?? 'http://localhost:11434/v1')
            : 'https://api.openai.com/v1';

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: STORY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err.error?.message || `${provider} API error ${resp.status}`);
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    rawJson = data.choices?.[0]?.message?.content || '';
  }

  const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const parsed = JSON.parse(cleaned) as Omit<AiDigest, 'generatedAt'>;

  return {
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
}

export async function streamAIChat(
  snapshot: RepoSnapshot,
  digest: AiDigest | null,
  chatHistory: ChatMessage[],
  cfg: AIProviderConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  // 1. Try local/backend server endpoint if NOT on static hosting
  if (!isStaticDeployment()) {
    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': cfg.provider,
          'x-ai-key': cfg.apiKey.trim(),
          'x-ai-model': cfg.model ?? '',
          ...(cfg.localEndpoint ? { 'x-ai-endpoint': cfg.localEndpoint } : {}),
        },
        body: JSON.stringify({
          snapshot,
          digest,
          messages: chatHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal,
      });

      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const ev of events) {
            const line = ev.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload) as { text?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) onChunk(parsed.text);
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                throw parseErr;
              }
            }
          }
        }
        return;
      }
    } catch {
      // Fall through to direct browser streaming
    }
  }

  // 2. Direct browser streaming for static GitHub Pages hosting
  return streamAIChatDirect(snapshot, digest, chatHistory, cfg, onChunk, signal);
}

export async function streamAIChatDirect(
  snapshot: RepoSnapshot,
  digest: AiDigest | null,
  chatHistory: ChatMessage[],
  cfg: AIProviderConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const provider = cfg.provider;
  const apiKey = cfg.apiKey;
  const model = cfg.model || DEFAULT_AI_MODELS[provider] || 'gemini-2.5-flash';
  const localEndpoint = cfg.localEndpoint;

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
- Translate every technical term into simple everyday analogies.
- Stay strictly grounded in the live repository facts below.
- Keep answers concise, scannable, and easy to read (short paragraphs or crisp bullet points).

${repoContext}`;

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey.trim())}`;
    const contents = chatHistory.slice(-10).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
      signal,
    });

    if (!resp.ok || !resp.body) {
      throw new Error(`Gemini stream error ${resp.status}`);
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
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onChunk(text);
        } catch {
          // ignore parsing error for chunk
        }
      }
    }
    return;
  }

  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-latest',
        max_tokens: 2048,
        system: systemPrompt,
        messages: chatHistory.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        stream: true,
      }),
      signal,
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
          const evt = JSON.parse(raw) as { type: string; delta?: { text?: string } };
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            onChunk(evt.delta.text);
          }
        } catch {
          // skip
        }
      }
    }
    return;
  }

  // OpenAI-compatible: Demo (Groq Gateway), Groq Cloud, OpenAI, NVIDIA, Local Endpoint
  const isDemo = provider === 'demo';
  const baseUrl = isDemo
    ? `${getDemoAiProxyUrl()}/v1`
    : provider === 'groq'
      ? 'https://api.groq.com/openai/v1'
      : provider === 'nvidia'
        ? 'https://integrate.api.nvidia.com/v1'
        : provider === 'local'
          ? (localEndpoint?.replace(/\/$/, '') ?? 'http://localhost:11434/v1')
          : 'https://api.openai.com/v1';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (!isDemo && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'openai/gpt-oss-120b',
      messages,
      stream: true,
    }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
    if (resp.status === 429 || err.error?.code === 'demo_rate_limit_exceeded') {
      throw new Error(
        'Demo rate limit reached. Add your own free Gemini, Groq, or OpenAI key in settings to continue chatting without limits!'
      );
    }
    throw new Error(err.error?.message || `${provider} stream error ${resp.status}`);
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
        if (text) onChunk(text);
      } catch {
        // skip
      }
    }
  }
}
