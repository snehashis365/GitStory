import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Compass, Search, History, Sparkles, Layers, MessageCircle, Settings, Star, Loader2 } from 'lucide-react';
import { CURATED_REPOS, formatCompactNumber, normalizeRepoInput } from '../utils/format';
import type { AIProviderConfig, GitHubRepoSearchResult } from '../types';
import { searchGitHubRepos } from '../services/githubService';
import {
  ReactFrameworkIcon,
  NextjsFrameworkIcon,
  ViteFrameworkIcon,
  ThreejsFrameworkIcon,
} from './BrandIcons';
import { ThemeToggle } from './ThemeToggle';

const TECH_ICONS = {
  react: ReactFrameworkIcon,
  nextjs: NextjsFrameworkIcon,
  vite: ViteFrameworkIcon,
  threejs: ThreejsFrameworkIcon,
};

const PROVIDER_LABELS: Record<string, string> = {
  demo: 'Demo AI (Groq)',
  groq: 'Groq',
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  nvidia: 'NVIDIA',
  local: 'Local',
};

interface RepoLauncherProps {
  onSelectRepo: (repoFullName: string) => void;
  recentRepos: string[];
  initialError: string | null;
  isLoading: boolean;
  onChangeAI?: () => void;
  aiConfig?: AIProviderConfig | null;
}

export function RepoLauncher({
  onSelectRepo,
  recentRepos,
  initialError,
  isLoading,
  onChangeAI,
  aiConfig,
}: RepoLauncherProps) {
  const [input, setInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GitHubRepoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced GitHub search effect
  useEffect(() => {
    const trimmed = input.trim();

    // If input is short or empty, clear results and close dropdown
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      return;
    }

    // Cancel previous search in flight
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await searchGitHubRepos(trimmed, {
          signal: controller.signal,
          limit: 6,
        });
        if (!controller.signal.aborted) {
          setSearchResults(results);
          setIsSearching(false);
          setIsDropdownOpen(true);
          setSelectedIndex(-1);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [input]);

  // Click outside listener to dismiss search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (fullName: string) => {
    setInput(fullName);
    setIsDropdownOpen(false);
    setValidationError(null);
    onSelectRepo(fullName);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || searchResults.length === 0) {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < searchResults.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // 1. If an item in dropdown is actively selected with arrow keys, launch that
    if (isDropdownOpen && selectedIndex >= 0 && searchResults[selectedIndex]) {
      handleSelectResult(searchResults[selectedIndex].fullName);
      return;
    }

    // 2. Direct normalization (e.g. user pasted full URL or typed owner/repo)
    const normalized = normalizeRepoInput(input);
    if (normalized) {
      setIsDropdownOpen(false);
      setValidationError(null);
      onSelectRepo(normalized);
      return;
    }

    // 3. If keyword search has matching results, pick the top relevance match
    if (searchResults.length > 0) {
      handleSelectResult(searchResults[0].fullName);
      return;
    }

    setValidationError(
      'Try searching a project name (e.g. "react" or "tailwind"), pasting a GitHub link, or owner/repo format.'
    );
  };

  const displayError = validationError || initialError;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* Clean 3-zone Top Bar Contract */}
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 sm:gap-8 px-4 py-3 sm:px-6 sm:py-4">
          <a
            href="#top"
            className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0"
          >
            GitStory
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#featured-repos"
              className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
            >
              Featured Repos
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
            >
              AI Summaries
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
            >
              Lifecycle Flow
            </a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {/* 3-Step Theme Toggle: Light > Auto > Dark */}
            <ThemeToggle />

            {/* AI provider pill */}
            {onChangeAI && (
              <button
                type="button"
                onClick={onChangeAI}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  aiConfig
                    ? 'border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F]'
                    : 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span>{aiConfig ? PROVIDER_LABELS[aiConfig.provider] ?? aiConfig.provider : 'Set AI Key'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectRepo('facebook/react')}
              disabled={isLoading}
              className="hidden sm:inline-flex rounded-xl bg-[#FF5A5F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E0484D] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Explore Demo Repo
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-14 md:pt-20">
        {/* Sunlit Hero & Search Form */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-4xl text-center"
        >
          <p className="text-sm font-semibold text-[#0D9488]">
            Open-source progress made joyful &amp; jargon-free
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl md:text-[54px] leading-[1.12] sm:leading-[1.08]">
            Turn any GitHub repo into a live progress story
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Paste a GitHub link or <span className="font-mono text-sm text-[#0F172A]">owner/repo</span>{' '}
            to get AI-synthesized progress chapters, decoded developer jargon, animated velocity
            charts, and an interactive Project Lifecycle Pipeline Flow.
          </p>

          {/* Primary Search Input with Autocomplete Dropdown */}
          <div ref={containerRef} className="relative mt-9">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 shadow-sm sm:flex-row sm:items-center focus-within:border-[#FF5A5F] focus-within:ring-4 focus-within:ring-[#FF5A5F]/12 transition-all">
                <div className="flex flex-1 items-center gap-3 px-3">
                  {isSearching ? (
                    <Loader2 className="h-5 w-5 shrink-0 text-[#FF5A5F] animate-spin" />
                  ) : (
                    <Search className="h-5 w-5 shrink-0 text-slate-400" />
                  )}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) setIsDropdownOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search repos (e.g. react, tailwind) or paste owner/repo"
                    aria-label="Search GitHub repository or owner/repo"
                    className="w-full bg-transparent py-2.5 text-base text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                    disabled={isLoading}
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {input && (
                    <button
                      type="button"
                      onClick={() => {
                        setInput('');
                        setSearchResults([]);
                        setIsDropdownOpen(false);
                      }}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#FF5A5F] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E0484D] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{isLoading ? 'Loading Repo...' : 'Track Repository'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {displayError && (
                <p
                  role="alert"
                  className="mt-3 text-left text-sm font-medium text-[#DC2626] px-2"
                >
                  {displayError}
                </p>
              )}
            </form>

            {/* Relevance Dropdown */}
            {isDropdownOpen && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xl backdrop-blur-md text-left divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>GitHub results sorted by relevance</span>
                  <span className="text-[11px] font-normal text-slate-400">Use ↑↓ keys &amp; Enter</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  {searchResults.map((repo, idx) => (
                    <button
                      key={repo.fullName}
                      type="button"
                      onClick={() => handleSelectResult(repo.fullName)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                        selectedIndex === idx
                          ? 'bg-[#FF5A5F]/10 dark:bg-[#FF5A5F]/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {repo.ownerAvatarUrl ? (
                          <img
                            src={repo.ownerAvatarUrl}
                            alt={repo.ownerLogin}
                            className="h-7 w-7 rounded-full border border-slate-200 dark:border-slate-700 shrink-0 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 truncate">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              @{repo.ownerLogin}
                            </span>
                            <span className="text-slate-400 dark:text-slate-600">/</span>
                            <span className="font-bold text-sm text-[#0F172A] dark:text-slate-100">
                              {repo.name}
                            </span>
                          </div>
                          {repo.description && (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {repo.language && (
                          <span className="hidden sm:inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            {repo.language}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {formatCompactNumber(repo.stars)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isDropdownOpen && !isSearching && searchResults.length === 0 && input.trim().length >= 2 && !normalizeRepoInput(input) && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-left text-sm text-slate-500 dark:text-slate-400">
                No matching repositories found on GitHub for &quot;<span className="font-medium text-slate-700 dark:text-slate-200">{input.trim()}</span>&quot;.
              </div>
            )}
          </div>

          {/* Recently Tracked Quick Links */}
          {recentRepos.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <History className="h-3.5 w-3.5" />
                Recent:
              </span>
              {recentRepos.map((repo) => (
                <button
                  key={repo}
                  type="button"
                  onClick={() => onSelectRepo(repo)}
                  className="font-mono text-xs font-medium text-[#0D9488] hover:text-[#0F172A] underline decoration-[#0D9488]/30 underline-offset-4 transition-colors cursor-pointer"
                >
                  {repo}
                </button>
              ))}
            </div>
          )}

          {/* Animated Interactive Product Preview Banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="mt-10 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-[#0B0F19] shadow-xl shadow-slate-900/10"
          >
            <img
              src="./banner.svg"
              alt="GitStory Live Progress & Lifecycle Flow"
              className="w-full h-auto object-cover select-none"
              loading="eager"
            />
          </motion.div>
        </motion.section>

        {/* Curated Open-Source Starter Cards */}
        <section id="featured-repos" className="mt-16">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0F172A]">
                Pick a lively open-source community
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Jump straight into AI-summarized progress stories, velocity charts, and the
                lifecycle flow view.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Live GitHub data · Auto-syncs every 60s
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CURATED_REPOS.map((item, idx) => (
              <motion.button
                key={item.fullName}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectRepo(item.fullName)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#0D9488]/50 hover:shadow-md hover:shadow-slate-900/5 disabled:opacity-60 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-[#F8FAFC] dark:bg-slate-800 text-[#0F172A] dark:text-white p-2 shadow-xs group-hover:border-[#0D9488]/40 transition-colors">
                      {(() => {
                        const IconComponent = TECH_ICONS[item.techIcon];
                        return <IconComponent className="h-full w-full" />;
                      })()}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{item.category}</span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-[#0F172A] group-hover:text-[#FF5A5F] transition-colors">
                    {item.fullName}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.tagline}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs font-semibold text-[#0D9488]">
                  <span>View AI pulse</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Three Clear Value Highlights */}
        <section
          id="how-it-works"
          className="mt-12 sm:mt-16 grid grid-cols-1 gap-6 sm:gap-8 border-t border-slate-200/80 pt-8 sm:pt-12 md:grid-cols-3"
        >
          <div className="space-y-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5A5F]/10 text-[#FF5A5F]">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#0F172A]">
              AI Story Summaries First
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Instead of dumping cryptic git logs, AI groups commits, PRs, and release notes into
              clear thematic progress chapters with a built-in Jargon Decoder.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#0F172A]">
              Interactive Lifecycle Pipeline Flow
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Watch how code moves from Active Coding through Reviewed &amp; Merged PRs, Community
              Velocity, and Shipped Releases in a responsive, animated lifecycle pipeline.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/12 text-[#D97706]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#0F172A]">
              Live Auto-Sync &amp; Community Chat
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Automatically checks GitHub every 60 seconds, pops real-time milestone alerts, and lets
              anyone chat with AI to ask questions about project progress.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#0D9488]" />
            <span>GitStory · Community Open-Source Tracker</span>
          </div>
          <span>Works with any public GitHub repository</span>
        </div>
      </footer>
    </div>
  );
}
