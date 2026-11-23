import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  ExternalLink,
  GitCommitHorizontal,
  GitMerge,
  ListFilter,
  MessageCircle,
  Search,
  Sparkles,
  Tag,
  Layers,
  RefreshCw,
} from 'lucide-react';
import type { AiDigest, RepoSnapshot } from '../types';
import { formatRelativeTime, formatShortDate } from '../utils/format';
import { CategoryBadge } from './CategoryIcon';
import { StoryGenerationProgress } from './StoryGenerationProgress';

interface ActivityFeedProps {
  snapshot: RepoSnapshot;
  digest: AiDigest | null;
  isAiLoading: boolean;
  aiProvider?: string;
  aiModel?: string;
  onRetryAi: () => void;
  onRegenerateAi?: () => void;
  onAskAboutItem: (prompt: string, contextLabel: string) => void;
}

type PrimaryViewMode = 'ai-story' | 'simplified-log';
type LogFilterTab = 'all' | 'prs' | 'commits';

interface SimplifiedEntry {
  id: string;
  kind: 'commit' | 'pr';
  emoji: string;
  plainTitle: string;
  whyItMatters: string;
  category: string;
  rawTitle: string;
  rawCodeLabel: string;
  author: string;
  timestamp: string;
  url: string;
}

export function ActivityFeed({
  snapshot,
  digest,
  isAiLoading,
  aiProvider,
  aiModel,
  onRetryAi,
  onRegenerateAi,
  onAskAboutItem,
}: ActivityFeedProps) {
  // AI Progress Story is ALWAYS the default mode of seeing progress!
  const [viewMode, setViewMode] = useState<PrimaryViewMode>('ai-story');
  const [logFilter, setLogFilter] = useState<LogFilterTab>('all');
  const [query, setQuery] = useState('');
  const [expandedTechIds, setExpandedTechIds] = useState<Record<string, boolean>>({});
  const [showRawRelease, setShowRawRelease] = useState(false);

  const toggleTechDetails = (id: string) => {
    setExpandedTechIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const latestRelease = snapshot.releases[0] || null;
  const releaseAi = digest?.releaseTranslation || null;

  // Map individual translated commits & PRs cleanly (preferring AI translations over raw text)
  const simplifiedEntries = useMemo<SimplifiedEntry[]>(() => {
    const commitMap = new Map(
      (digest?.commitTranslations || []).map((t) => [t.sha.toLowerCase(), t])
    );
    const prMap = new Map((digest?.prTranslations || []).map((t) => [t.number, t]));

    const commits: SimplifiedEntry[] = snapshot.commits.map((c) => {
      const tr = commitMap.get(c.shortSha.toLowerCase());
      return {
        id: `commit-${c.sha}`,
        kind: 'commit',
        emoji: tr?.emoji || '✨',
        plainTitle: tr?.plainTitle || `Project improvement by @${c.authorLogin}`,
        whyItMatters:
          tr?.whyItMatters ||
          'Part of the team’s ongoing updates improving stability and user experience.',
        category: tr?.category || 'Polish',
        rawTitle: c.firstLine,
        rawCodeLabel: `commit ${c.shortSha}`,
        author: c.authorLogin,
        timestamp: c.date,
        url: c.htmlUrl,
      };
    });

    const prs: SimplifiedEntry[] = snapshot.mergedPRs.map((p) => {
      const tr = prMap.get(p.number);
      return {
        id: `pr-${p.number}`,
        kind: 'pr',
        emoji: tr?.emoji || '🎉',
        plainTitle: tr?.plainTitle || `Community contribution merged by @${p.userLogin}`,
        whyItMatters:
          tr?.whyItMatters ||
          'Reviewed by maintainers and integrated into the main codebase.',
        category: tr?.category || 'Feature',
        rawTitle: p.title,
        rawCodeLabel: `PR #${p.number}`,
        author: p.userLogin,
        timestamp: p.mergedAt,
        url: p.htmlUrl,
      };
    });

    return [...prs, ...commits].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [snapshot, digest]);

  const filteredLogEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return simplifiedEntries.filter((item) => {
      if (logFilter === 'commits' && item.kind !== 'commit') return false;
      if (logFilter === 'prs' && item.kind !== 'pr') return false;
      if (!q) return true;
      return (
        item.plainTitle.toLowerCase().includes(q) ||
        item.whyItMatters.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q)
      );
    });
  }, [simplifiedEntries, logFilter, query]);

  return (
    <section id="updates" className="space-y-6">
      {/* Section Header + Default AI Story vs Simplified Changelog Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A] dark:text-slate-100">
            What Changed Recently?
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            AI synthesizes recent commits, merged pull requests, and release notes into clear
            community updates—no developer jargon required.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {onRegenerateAi && digest && (
            <button
              type="button"
              onClick={onRegenerateAi}
              disabled={isAiLoading}
              title="Re-run AI synthesis on recent commits and PRs"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F] disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#FF5A5F] ${isAiLoading ? 'animate-spin' : ''}`} />
              <span>{isAiLoading ? 'Synthesizing...' : 'Regenerate Story'}</span>
            </button>
          )}

          {/* Clean Segmented Mode Switcher */}
          <div
            role="tablist"
            aria-label="Progress view mode"
            className="inline-flex w-full sm:w-auto items-center gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 dark:border dark:border-slate-800 p-1"
          >
            <button
              role="tab"
              type="button"
              aria-selected={viewMode === 'ai-story'}
              onClick={() => setViewMode('ai-story')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'ai-story'
                  ? 'bg-white dark:bg-slate-800 text-[#0F172A] dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-[#FF5A5F]" />
              <span className="hidden sm:inline">AI Progress Story</span>
              <span className="sm:hidden">AI Story</span>
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={viewMode === 'simplified-log'}
              onClick={() => setViewMode('simplified-log')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'simplified-log'
                  ? 'bg-white dark:bg-slate-800 text-[#0F172A] dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5 text-[#0D9488]" />
              <span className="hidden sm:inline">Per-Change Breakdown</span>
              <span className="sm:hidden">Per-Change</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Re-generation Banner if digest already exists */}
      {isAiLoading && digest && (
        <StoryGenerationProgress
          snapshot={snapshot}
          isAiLoading={isAiLoading}
          isRegenerating={true}
          provider={aiProvider}
          model={aiModel}
        />
      )}

      {/* Primary Loading State: Multi-stage progress bar & live status stepper */}
      {isAiLoading && !digest ? (
        <StoryGenerationProgress
          snapshot={snapshot}
          isAiLoading={isAiLoading}
          isRegenerating={false}
          provider={aiProvider}
          model={aiModel}
        />
      ) : !digest ? (
        <div className="rounded-3xl border border-amber-200 bg-white p-8 text-center">
          <span className="text-3xl" aria-hidden="true">
            ✨
          </span>
          <h3 className="mt-3 font-display text-lg font-bold text-[#0F172A]">
            AI Story Summary Ready to Generate
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Click below to synthesize {snapshot.repo.fullName}&apos;s recent activity into a friendly
            progress report.
          </p>
          <button
            type="button"
            onClick={onRetryAi}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#FF5A5F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#E0484D] transition-colors cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate AI Summary</span>
          </button>
        </div>
      ) : viewMode === 'ai-story' ? (
        /* DEFAULT MODE: AI Story Chapters + Translated Release Notes + Jargon Decoder */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left / Main Column: Thematic AI Progress Chapters */}
          <div className="space-y-5 lg:col-span-7">
            {digest.progressChapters.map((chapter, idx) => (
              <article
                key={`${chapter.title}-${idx}`}
                className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <CategoryBadge category={chapter.title} size="lg" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-slate-500">
                        <span className="font-semibold text-[#0D9488]">{chapter.impactLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Synthesizes ~{chapter.relatedCount} updates
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
                        {chapter.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-600">{chapter.summary}</p>

                {chapter.keyWins.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {chapter.keyWins.map((win, wIdx) => (
                      <li
                        key={wIdx}
                        className="flex items-start gap-2.5 text-sm leading-snug text-slate-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />
                        <span>{win}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3.5">
                  <button
                    type="button"
                    onClick={() =>
                      onAskAboutItem(
                        `Tell me more about "${chapter.title}" in ${snapshot.repo.fullName}. Why does this matter for regular users?`,
                        chapter.title
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF5A5F] hover:text-[#E0484D] transition-colors cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Ask AI to dive deeper</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Right Column: Latest Release Spotlight + Jargon Decoder */}
          <div className="space-y-6 lg:col-span-5">
            {/* Release Notes Translated */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#0F172A]">
                    Latest Release Highlights
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Official release notes translated for everyone.
                  </p>
                </div>
                <Tag className="h-5 w-5 text-[#FF5A5F] shrink-0" />
              </div>

              {!latestRelease ? (
                <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 border border-teal-200/60 text-teal-600">
                    <Layers className="h-5 w-5" />
                  </div>
                  <p className="mt-2.5 font-display text-sm font-bold text-[#0F172A]">
                    Continuous Rolling Updates
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    This project ships improvements continuously without formal version tags—all
                    recent progress is captured in the story chapters on the left!
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
                    <span className="font-mono font-semibold text-[#FF5A5F]">
                      {latestRelease.tagName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Shipped {formatShortDate(latestRelease.publishedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>by @{latestRelease.authorLogin}</span>
                  </div>

                  <h4 className="mt-3 font-display text-lg font-bold text-[#0F172A]">
                    {releaseAi?.cheerfulTitle || latestRelease.name}
                  </h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {releaseAi?.summary ||
                      `Version ${latestRelease.tagName} is live for the community!`}
                  </p>

                  {releaseAi && releaseAi.highlights.length > 0 && (
                    <ul className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                      {releaseAi.highlights.map((hl, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />
                          <span className="leading-snug">{hl.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() =>
                        onAskAboutItem(
                          `Walk me through release ${latestRelease.tagName} of ${snapshot.repo.fullName} in super simple terms.`,
                          `Release ${latestRelease.tagName}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF5A5F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#E0484D] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Ask AI about {latestRelease.tagName}</span>
                    </button>

                    {latestRelease.body && (
                      <button
                        type="button"
                        onClick={() => setShowRawRelease((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Code2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{showRawRelease ? 'Hide Dev Notes' : 'Original Notes'}</span>
                      </button>
                    )}

                    <a
                      href={latestRelease.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:text-[#0F172A] transition-colors whitespace-nowrap"
                    >
                      <span>GitHub</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {showRawRelease && latestRelease.body && (
                    <pre className="mt-4 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3.5 font-mono text-xs leading-relaxed text-slate-600 border border-slate-200/80">
                      {latestRelease.body}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Jargon Decoder Card */}
            {digest.jargonDecoder.length > 0 && (
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#0F172A]">
                      Jargon Decoder
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Developer buzzwords spotted in this repo, explained simply.
                    </p>
                  </div>
                  <BookOpen className="h-5 w-5 text-[#0D9488] shrink-0" />
                </div>

                <div className="mt-4 divide-y divide-slate-100">
                  {digest.jargonDecoder.map((item, idx) => (
                    <div key={idx} className="py-3.5 first:pt-1 last:pb-0">
                      <div className="flex items-center gap-2.5">
                        <CategoryBadge category="jargon" size="xs" />
                        <span className="font-mono text-xs font-bold text-[#0F172A]">
                          {item.term}
                        </span>
                      </div>
                      <p className="mt-1 pl-8 text-sm leading-relaxed text-slate-600">
                        {item.plainMeaning}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SECONDARY MODE: Per-Change AI-Translated Breakdown (with optional raw commit toggle) */
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/90 px-3.5 py-2 focus-within:border-[#0D9488] focus-within:bg-white dark:focus-within:bg-slate-900 transition-colors">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search simplified updates by topic or contributor..."
                aria-label="Search simplified updates"
                className="w-full bg-transparent text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="inline-flex items-center gap-1 self-start rounded-xl bg-slate-100 dark:bg-slate-900 dark:border dark:border-slate-800 p-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'prs', label: `Merged PRs (${snapshot.mergedPRs.length})` },
                  { id: 'commits', label: `Commits (${snapshot.commits.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLogFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    logFilter === tab.id
                      ? 'bg-white dark:bg-slate-800 text-[#0F172A] dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {filteredLogEntries.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No simplified updates match that search.
              </div>
            ) : (
              filteredLogEntries.map((item) => {
                const isTechOpen = Boolean(expandedTechIds[item.id]);
                return (
                  <article key={item.id} className="py-4 first:pt-2 last:pb-1">
                    <div className="flex items-start gap-3.5">
                      <CategoryBadge category={item.category} kind={item.kind} size="md" />

                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-[15px] font-bold leading-snug text-[#0F172A]">
                          {item.plainTitle}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {item.whyItMatters}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            {item.kind === 'pr' ? (
                              <GitMerge className="h-3.5 w-3.5 text-[#0D9488]" />
                            ) : (
                              <GitCommitHorizontal className="h-3.5 w-3.5 text-[#FF5A5F]" />
                            )}
                            {item.kind === 'pr' ? 'Merged PR' : 'Commit'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-[#0D9488]">{item.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>@{item.author}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatRelativeTime(item.timestamp)}</span>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              onAskAboutItem(
                                `Explain this ${item.kind === 'pr' ? 'merged pull request' : 'commit'} in simple everyday terms: "${item.rawTitle}" (${item.rawCodeLabel}).`,
                                item.plainTitle
                              )
                            }
                            className="inline-flex items-center gap-1 font-semibold text-[#FF5A5F] hover:text-[#E0484D] transition-colors cursor-pointer"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Explain with AI</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleTechDetails(item.id)}
                            className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-[#0F172A] transition-colors cursor-pointer"
                          >
                            {isTechOpen ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {isTechOpen ? 'Hide Developer Commit' : 'Peek at Developer Commit'}
                            </span>
                          </button>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-[#0D9488] transition-colors"
                          >
                            <span className="font-mono">{item.rawCodeLabel}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>

                        {isTechOpen && (
                          <div className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 border border-slate-200/70">
                            {item.rawTitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
