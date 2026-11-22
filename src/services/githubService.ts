import type {
  CommitItem,
  ContributorItem,
  PullRequestItem,
  ReleaseItem,
  RepoSnapshot,
  VelocityPoint,
} from '../types';

const GH_TOKEN_KEY = 'gitstory_github_token_v1';

export function getStoredGitHubToken(): string {
  try {
    return localStorage.getItem(GH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredGitHubToken(token: string) {
  try {
    if (token.trim()) {
      localStorage.setItem(GH_TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(GH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function parseRepoInput(raw: string): { owner: string; repo: string } | null {
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

interface CacheEntry<T> {
  etag?: string;
  data: T;
  fetchedAt: number;
  rateLimitRemaining: number | null;
}

const memoryGhCache = new Map<string, CacheEntry<unknown>>();
const snapshotCache = new Map<string, { snapshot: RepoSnapshot; fetchedAt: number }>();
const ENDPOINT_CACHE_TTL_MS = 180_000; // 3 minutes

async function githubFetch<T>(
  url: string,
  token?: string,
  forceConditionalCheck = false
): Promise<{ data: T; fromCache: boolean; notModified: boolean; rateLimitRemaining: number | null }> {
  const cached = memoryGhCache.get(url) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && !forceConditionalCheck && now - cached.fetchedAt < ENDPOINT_CACHE_TTL_MS) {
    return {
      data: cached.data,
      fromCache: true,
      notModified: false,
      rateLimitRemaining: cached.rateLimitRemaining,
    };
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };

  const activeToken = token || getStoredGitHubToken();
  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`;
  }
  if (cached?.etag && activeToken) {
    headers['If-None-Match'] = cached.etag;
  }

  const resp = await fetch(url, { headers });
  const remainingHeader = resp.headers.get('x-ratelimit-remaining');
  const rateLimitRemaining = remainingHeader !== null ? Number(remainingHeader) : null;

  if (resp.status === 304 && cached) {
    cached.fetchedAt = now;
    cached.rateLimitRemaining = rateLimitRemaining;
    return {
      data: cached.data,
      fromCache: true,
      notModified: true,
      rateLimitRemaining,
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
        };
      }
      const err = new Error(
        'GitHub API rate limit reached (60 req/hr). Add a free GitHub Personal Access Token in settings to get 5,000 req/hr.'
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
  memoryGhCache.set(url, {
    etag,
    data,
    fetchedAt: now,
    rateLimitRemaining,
  });

  return { data, fromCache: false, notModified: false, rateLimitRemaining };
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
          label: parsed.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          commits: vals.commits,
          mergedPRs: vals.mergedPRs,
        };
      });
  }

  return dayKeys.map((date) => {
    const counts = countsByDay.get(date) ?? { commits: 0, mergedPRs: 0 };
    const parsed = new Date(`${date}T12:00:00Z`);
    return {
      date,
      label: parsed.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      commits: counts.commits,
      mergedPRs: counts.mergedPRs,
    };
  });
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

export async function fetchRepoSnapshot(
  rawRepo: string,
  options?: { forceSync?: boolean; token?: string }
): Promise<RepoSnapshot> {
  const forceSync = Boolean(options?.forceSync);

  // 1. If backend server is available (local dev or Node proxy), use /api/github/repo
  if (!isStaticDeployment()) {
    try {
      const url = `/api/github/repo?repo=${encodeURIComponent(rawRepo)}${forceSync ? '&sync=1' : ''}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = (await resp.json()) as RepoSnapshot;
        if (data && data.repo && data.commits) {
          return data;
        }
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  // 2. Direct client-side browser fetch for static GitHub Pages hosting
  return fetchRepoSnapshotDirect(rawRepo, options);
}

export async function fetchRepoSnapshotDirect(
  rawRepo: string,
  options?: { forceSync?: boolean; token?: string }
): Promise<RepoSnapshot> {
  const parsed = parseRepoInput(rawRepo);
  if (!parsed) {
    throw new Error(
      'Please enter a valid GitHub URL (https://github.com/owner/repo) or owner/repo handle.'
    );
  }

  const { owner, repo } = parsed;
  const cacheKey = `${owner}/${repo}`.toLowerCase();
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const forceSync = Boolean(options?.forceSync);
  const token = options?.token;

  const existingSnap = snapshotCache.get(cacheKey);
  if (existingSnap && !forceSync && Date.now() - existingSnap.fetchedAt < ENDPOINT_CACHE_TTL_MS) {
    return { ...existingSnap.snapshot, cached: true };
  }

  // Lightweight auto-sync check: 1 conditional ETag request on latest commit!
  if (forceSync && existingSnap) {
    try {
      const headCheck = await githubFetch<Record<string, unknown>[]>(
        `${base}/commits?per_page=1`,
        token,
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
        return refreshed;
      }
    } catch {
      // Fall through to full fetch on failure
    }
  }

  const [repoRes, commitsRes, pullsRes, releasesRes, contribRes] = await Promise.all([
    githubFetch<Record<string, unknown>>(base, token, forceSync),
    githubFetch<Record<string, unknown>[]>(`${base}/commits?per_page=14`, token, forceSync),
    githubFetch<Record<string, unknown>[]>(
      `${base}/pulls?state=closed&sort=updated&direction=desc&per_page=16`,
      token,
      forceSync
    ).catch(() => ({
      data: [] as Record<string, unknown>[],
      fromCache: false,
      notModified: false,
      rateLimitRemaining: null,
    })),
    githubFetch<Record<string, unknown>[]>(`${base}/releases?per_page=5`, token, forceSync).catch(
      () => ({
        data: [] as Record<string, unknown>[],
        fromCache: false,
        notModified: false,
        rateLimitRemaining: null,
      })
    ),
    githubFetch<Record<string, unknown>[]>(
      `${base}/contributors?per_page=8`,
      token,
      forceSync
    ).catch(() => ({
      data: [] as Record<string, unknown>[],
      fromCache: false,
      notModified: false,
      rateLimitRemaining: null,
    })),
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
    },
    commits: allCommits.slice(0, 14),
    mergedPRs,
    releases,
    contributors,
    velocitySeries,
    syncedAt: new Date().toISOString(),
    rateLimitRemaining: repoRes.rateLimitRemaining,
    cached: repoRes.fromCache && commitsRes.fromCache,
  };

  snapshotCache.set(cacheKey, { snapshot, fetchedAt: Date.now() });
  return snapshot;
}
