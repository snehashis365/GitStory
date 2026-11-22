import type { AiDigest, RepoSnapshot } from '../types';

const STORAGE_PREFIX = 'gitstory_digest_v1_';
const LEGACY_STORAGE_PREFIX = 'pulseisle_digest_v2_';

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
    const parsed = JSON.parse(raw) as { fingerprint: string; digest: AiDigest; savedAt: number };
    const currentFingerprint = getRepoActivityFingerprint(snapshot, provider, model);

    if (parsed && parsed.fingerprint === currentFingerprint && parsed.digest) {
      return parsed.digest;
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
    pruneOldDigests(20);
    const key = `${STORAGE_PREFIX}${snapshot.repo.fullName.toLowerCase()}`;
    const fingerprint = getRepoActivityFingerprint(snapshot, provider, model);
    localStorage.setItem(
      key,
      JSON.stringify({
        fingerprint,
        digest,
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
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
