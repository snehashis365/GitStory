import type { CommitItem, PullRequestItem } from '../types';

export interface CadenceInfo {
  intervalSeconds: number;
  cadenceLabel: 'Rapid Active' | 'Daily Momentum' | 'Steady Cadence' | 'Calm / Periodic';
  explanation: string;
  distinctSessionsCount: number;
  medianHoursBetweenPushes: number;
}

/**
 * Distinguishes between mass merges/batch pushes and separated merges,
 * and calculates a smart, adaptive sync interval.
 *
 * Rules:
 * - Mass merges (commits/PRs within 15 minutes of each other) are grouped into a single session.
 * - Minimum sync interval: 180s (3 minutes) to protect unauthenticated GitHub rate limits.
 * - Maximum sync interval: 3600s (60 minutes) for quiet/dormant repositories.
 */
export function calculateAdaptiveSyncInterval(
  commits: CommitItem[],
  mergedPRs: PullRequestItem[]
): CadenceInfo {
  const timestamps: number[] = [];

  for (const c of commits) {
    if (c.date) {
      const t = new Date(c.date).getTime();
      if (!Number.isNaN(t)) timestamps.push(t);
    }
  }

  for (const pr of mergedPRs) {
    if (pr.mergedAt) {
      const t = new Date(pr.mergedAt).getTime();
      if (!Number.isNaN(t)) timestamps.push(t);
    }
  }

  // Fallback for empty or unknown repo history
  if (timestamps.length === 0) {
    return {
      intervalSeconds: 600, // 10 minutes
      cadenceLabel: 'Steady Cadence',
      explanation: 'No recent activity timestamps found; defaulting to a gentle 10-minute check.',
      distinctSessionsCount: 0,
      medianHoursBetweenPushes: 24,
    };
  }

  // Sort chronologically ascending
  timestamps.sort((a, b) => a - b);

  // Group timestamps into distinct push/merge sessions
  // Any commits within 15 minutes (900,000 ms) of each other are considered part of the same mass merge/push train
  const MASS_MERGE_THRESHOLD_MS = 15 * 60 * 1000;
  const sessions: number[] = [];
  let currentSessionEnd = timestamps[0];

  for (let i = 1; i < timestamps.length; i++) {
    const t = timestamps[i];
    if (t - currentSessionEnd > MASS_MERGE_THRESHOLD_MS) {
      // Separated merge event!
      sessions.push(currentSessionEnd);
      currentSessionEnd = t;
    } else {
      // Part of the same mass merge / batch commit train
      currentSessionEnd = t;
    }
  }
  sessions.push(currentSessionEnd);

  // Calculate gaps between distinct sessions (in hours)
  const gapsHours: number[] = [];
  for (let i = 1; i < sessions.length; i++) {
    const gapH = (sessions[i] - sessions[i - 1]) / (1000 * 60 * 60);
    if (gapH > 0) gapsHours.push(gapH);
  }

  gapsHours.sort((a, b) => a - b);
  const medianGapHours =
    gapsHours.length > 0 ? gapsHours[Math.floor(gapsHours.length / 2)] : 12;

  // Recency: how long ago was the absolute latest commit/PR?
  const latestTimestamp = timestamps[timestamps.length - 1];
  const hoursSinceLatest = Math.max(0, (Date.now() - latestTimestamp) / (1000 * 60 * 60));

  let intervalSeconds = 600;
  let cadenceLabel: CadenceInfo['cadenceLabel'] = 'Steady Cadence';
  let explanation = '';

  if (hoursSinceLatest < 2) {
    // Very active right now! Check every 3 to 5 minutes
    intervalSeconds = 300; // 5 mins
    cadenceLabel = 'Rapid Active';
    explanation = 'Fresh code landed in the last 2 hours. Syncing every 5 minutes.';
  } else if (hoursSinceLatest < 24) {
    // Active in past day. Check every 10 minutes
    intervalSeconds = 600; // 10 mins
    cadenceLabel = 'Daily Momentum';
    explanation = `Last push was ~${Math.round(hoursSinceLatest)}h ago. Syncing every 10 minutes.`;
  } else if (hoursSinceLatest < 72) {
    // Steady cadence (2-3 days). Check every 20 minutes
    intervalSeconds = 1200; // 20 mins
    cadenceLabel = 'Steady Cadence';
    explanation = `Commits arrive every ~${Math.round(medianGapHours)}h. Syncing every 20 minutes.`;
  } else if (hoursSinceLatest < 168) {
    // Within last week. Check every 30 minutes
    intervalSeconds = 1800; // 30 mins
    cadenceLabel = 'Calm / Periodic';
    explanation = `Last code push was ~${Math.round(hoursSinceLatest / 24)} days ago. Syncing every 30 minutes.`;
  } else {
    // Older than a week: peaceful / maintenance mode. Check once per hour
    intervalSeconds = 3600; // 60 mins
    cadenceLabel = 'Calm / Periodic';
    explanation = `Stable repository with separated milestones. Checking every 60 minutes.`;
  }

  return {
    intervalSeconds,
    cadenceLabel,
    explanation,
    distinctSessionsCount: sessions.length,
    medianHoursBetweenPushes: Math.round(medianGapHours * 10) / 10,
  };
}
