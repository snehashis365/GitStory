import type {
  AiDigest,
  ProgressChapter,
  JargonTerm,
  ReleaseTranslation,
  CommitTranslation,
  PrTranslation,
  RepoSnapshot,
  ChangeCategory,
} from '../types';

const STORAGE_PREFIX = 'gitstory_digest_v1_';
const LEGACY_STORAGE_PREFIX = 'pulseisle_digest_v2_';
const README_OVERVIEW_PREFIX = 'gitstory_readme_overview_v1_';
const CHAT_PREFIX = 'gitstory_chat_';

const VALID_CATEGORIES: ChangeCategory[] = ['Feature', 'Fix', 'Speed', 'Docs', 'Polish'];

function sanitizeCategory(val: unknown): ChangeCategory {
  if (typeof val === 'string' && VALID_CATEGORIES.includes(val as ChangeCategory)) {
    return val as ChangeCategory;
  }
  return 'Polish';
}

/**
 * Validates, repairs, and guarantees structural integrity of an AiDigest object.
 * Prevents runtime TypeError (e.g. `undefined.length`) caused by partial LLM responses
 * or corrupted cache payloads.
 */
export function sanitizeDigest(raw: unknown): AiDigest | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;

  // Headline & summary fallbacks
  const headline = typeof d.headline === 'string' && d.headline.trim()
    ? d.headline.trim()
    : 'Recent project activity synthesized';
  const playfulSummary = typeof d.playfulSummary === 'string' && d.playfulSummary.trim()
    ? d.playfulSummary.trim()
    : 'New updates and improvements are being made across this repository.';

  const momentumMood = typeof d.momentumMood === 'string' && d.momentumMood.trim()
    ? d.momentumMood.trim()
    : 'Steady Progress';
  const momentumEmoji = typeof d.momentumEmoji === 'string' && d.momentumEmoji.trim()
    ? d.momentumEmoji.trim()
    : '🚀';

  const nextMilestoneEstimate = typeof d.nextMilestoneEstimate === 'string' && d.nextMilestoneEstimate.trim()
    ? d.nextMilestoneEstimate.trim()
    : 'Upcoming improvements';
  const milestoneProgressPct = Math.min(98, Math.max(15, Number(d.milestoneProgressPct) || 68));

  // Sanitize progress chapters
  const progressChapters: ProgressChapter[] = Array.isArray(d.progressChapters)
    ? d.progressChapters
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          emoji: typeof c.emoji === 'string' && c.emoji.trim() ? c.emoji : '✨',
          title: typeof c.title === 'string' && c.title.trim() ? c.title : 'Project Update',
          summary: typeof c.summary === 'string' && c.summary.trim() ? c.summary : 'Work completed in recent updates.',
          impactLabel: typeof c.impactLabel === 'string' && c.impactLabel.trim() ? c.impactLabel : 'Polish',
          keyWins: Array.isArray(c.keyWins)
            ? c.keyWins.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
            : [],
          relatedCount: typeof c.relatedCount === 'number' && !isNaN(c.relatedCount) ? c.relatedCount : 1,
        }))
    : [];

  // Sanitize jargon terms
  const jargonDecoder: JargonTerm[] = Array.isArray(d.jargonDecoder)
    ? d.jargonDecoder
        .filter((j): j is Record<string, unknown> => !!j && typeof j === 'object')
        .map((j) => ({
          term: typeof j.term === 'string' && j.term.trim() ? j.term : 'Terminology',
          plainMeaning: typeof j.plainMeaning === 'string' && j.plainMeaning.trim() ? j.plainMeaning : 'Technical concept explained simply.',
          emoji: typeof j.emoji === 'string' && j.emoji.trim() ? j.emoji : '💡',
        }))
    : [];

  // Lifecycle stage briefs
  const briefsRaw = d.lifecycleStageBriefs && typeof d.lifecycleStageBriefs === 'object'
    ? (d.lifecycleStageBriefs as Record<string, unknown>)
    : {};
  const lifecycleStageBriefs = {
    commits: typeof briefsRaw.commits === 'string' && briefsRaw.commits.trim()
      ? briefsRaw.commits
      : 'Developers are actively crafting fresh improvements behind the scenes.',
    prs: typeof briefsRaw.prs === 'string' && briefsRaw.prs.trim()
      ? briefsRaw.prs
      : 'Reviewed community improvements are smoothly merging into the main project.',
    community: typeof briefsRaw.community === 'string' && briefsRaw.community.trim()
      ? briefsRaw.community
      : 'Contributors are collaborating steadily to keep momentum high.',
    release: typeof briefsRaw.release === 'string' && briefsRaw.release.trim()
      ? briefsRaw.release
      : 'Preparing the latest tested improvements for the wider community.',
  };

  // Release translation
  let releaseTranslation: ReleaseTranslation | null = null;
  if (d.releaseTranslation && typeof d.releaseTranslation === 'object') {
    const r = d.releaseTranslation as Record<string, unknown>;
    releaseTranslation = {
      tagName: typeof r.tagName === 'string' ? r.tagName : '',
      cheerfulTitle: typeof r.cheerfulTitle === 'string' ? r.cheerfulTitle : 'Latest Release',
      summary: typeof r.summary === 'string' ? r.summary : 'The latest package is published.',
      highlights: Array.isArray(r.highlights)
        ? r.highlights
            .filter((hl): hl is Record<string, unknown> => !!hl && typeof hl === 'object')
            .map((hl) => ({
              emoji: typeof hl.emoji === 'string' && hl.emoji.trim() ? hl.emoji : '✨',
              text: typeof hl.text === 'string' ? hl.text : '',
            }))
            .filter((hl) => hl.text.length > 0)
        : [],
    };
  }

  // Commit translations
  const commitTranslations: CommitTranslation[] = Array.isArray(d.commitTranslations)
    ? d.commitTranslations
        .filter((ct): ct is Record<string, unknown> => !!ct && typeof ct === 'object')
        .map((ct) => ({
          sha: typeof ct.sha === 'string' ? ct.sha : '',
          emoji: typeof ct.emoji === 'string' ? ct.emoji : '🔧',
          plainTitle: typeof ct.plainTitle === 'string' ? ct.plainTitle : 'Code enhancement',
          whyItMatters: typeof ct.whyItMatters === 'string' ? ct.whyItMatters : 'Improves project quality.',
          category: sanitizeCategory(ct.category),
        }))
        .filter((ct) => ct.sha.length > 0)
    : [];

  // PR translations
  const prTranslations: PrTranslation[] = Array.isArray(d.prTranslations)
    ? d.prTranslations
        .filter((pt): pt is Record<string, unknown> => !!pt && typeof pt === 'object')
        .map((pt) => ({
          number: typeof pt.number === 'number' ? pt.number : 0,
          emoji: typeof pt.emoji === 'string' ? pt.emoji : '📦',
          plainTitle: typeof pt.plainTitle === 'string' ? pt.plainTitle : 'Community improvement',
          whyItMatters: typeof pt.whyItMatters === 'string' ? pt.whyItMatters : 'Enhances codebase features.',
          category: sanitizeCategory(pt.category),
        }))
        .filter((pt) => pt.number > 0)
    : [];

  return {
    headline,
    playfulSummary,
    momentumMood,
    momentumEmoji,
    nextMilestoneEstimate,
    milestoneProgressPct,
    progressChapters,
    jargonDecoder,
    lifecycleStageBriefs,
    releaseTranslation,
    commitTranslations,
    prTranslations,
    generatedAt: typeof d.generatedAt === 'string' ? d.generatedAt : new Date().toISOString(),
  };
}

export function getRepoActivityFingerprint(snapshot: RepoSnapshot, provider = 'default', model = ''): string {
  const repo = snapshot.repo.fullName.toLowerCase();
  const commitSha = snapshot.commits[0]?.sha || 'no-commit';
  const prNum = snapshot.mergedPRs[0]?.number || 0;
  const prMergedAt = snapshot.mergedPRs[0]?.mergedAt || 'no-pr';
  const releaseTag = snapshot.releases[0]?.tagName || 'no-release';
  return `${repo}::${commitSha}::${prNum}_${prMergedAt}::${releaseTag}::${provider}::${model}`;
}

export function loadCachedDigest(
  snapshot: RepoSnapshot,
  provider = 'default',
  model = ''
): AiDigest | null {
  try {
    const repoKey = snapshot.repo.fullName.toLowerCase();
    const primaryKey = `${STORAGE_PREFIX}${repoKey}`;
    const legacyKey = `${LEGACY_STORAGE_PREFIX}${repoKey}`;
    const raw = localStorage.getItem(primaryKey) || localStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fingerprint: string; digest: unknown; savedAt: number };
    const currentFingerprint = getRepoActivityFingerprint(snapshot, provider, model);

    if (parsed && parsed.fingerprint === currentFingerprint && parsed.digest) {
      const sanitized = sanitizeDigest(parsed.digest);
      if (sanitized) return sanitized;
      // If cached data was unrecoverable, purge it
      localStorage.removeItem(primaryKey);
      localStorage.removeItem(legacyKey);
    }
    return null;
  } catch {
    return null;
  }
}

function pruneOldDigests(maxEntries = 20) {
  try {
    const keys: { key: string; savedAt: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(STORAGE_PREFIX) || k.startsWith(LEGACY_STORAGE_PREFIX))) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw) as { savedAt?: number };
            keys.push({ key: k, savedAt: parsed.savedAt || 0 });
          }
        } catch {
          localStorage.removeItem(k);
        }
      }
    }
    if (keys.length > maxEntries) {
      keys.sort((a, b) => a.savedAt - b.savedAt);
      const toRemove = keys.slice(0, keys.length - maxEntries);
      for (const item of toRemove) {
        localStorage.removeItem(item.key);
      }
    }
  } catch {
    // Ignore
  }
}

export function saveCachedDigest(
  snapshot: RepoSnapshot,
  digest: AiDigest,
  provider = 'default',
  model = ''
) {
  try {
    const sanitized = sanitizeDigest(digest);
    if (!sanitized) return;
    pruneOldDigests(20);
    const key = `${STORAGE_PREFIX}${snapshot.repo.fullName.toLowerCase()}`;
    const fingerprint = getRepoActivityFingerprint(snapshot, provider, model);
    localStorage.setItem(
      key,
      JSON.stringify({
        fingerprint,
        digest: sanitized,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage quota limits gracefully
  }
}

export function clearRepoCachedDigest(fullName: string) {
  try {
    const key = `${STORAGE_PREFIX}${fullName.toLowerCase()}`;
    const legacyKey = `${LEGACY_STORAGE_PREFIX}${fullName.toLowerCase()}`;
    localStorage.removeItem(key);
    localStorage.removeItem(legacyKey);
  } catch {
    // Ignore
  }
}

/**
 * Wipes all cached AI digests, README primers, and conversation sessions for a specific repo.
 */
export function clearAllRepoCache(fullName: string) {
  try {
    const lower = fullName.toLowerCase();
    localStorage.removeItem(`${STORAGE_PREFIX}${lower}`);
    localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${lower}`);
    localStorage.removeItem(`${README_OVERVIEW_PREFIX}${lower}`);
    localStorage.removeItem(`${CHAT_PREFIX}${lower}`);
  } catch {
    // Ignore
  }
}

/**
 * Wipes all GitStory cached data across all repositories stored in the browser.
 */
export function clearEntireGitStoryCache(): number {
  try {
    let clearedCount = 0;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(STORAGE_PREFIX) ||
          key.startsWith(LEGACY_STORAGE_PREFIX) ||
          key.startsWith(README_OVERVIEW_PREFIX) ||
          key.startsWith(CHAT_PREFIX))
      ) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
      clearedCount++;
    }
    return clearedCount;
  } catch {
    return 0;
  }
}
