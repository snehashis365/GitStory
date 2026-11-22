import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Compass, Search, History, Sparkles, Layers, MessageCircle, Settings } from 'lucide-react';
import { CURATED_REPOS, normalizeRepoInput } from '../utils/format';
import type { AIProviderConfig } from '../types';
import {
  ReactFrameworkIcon,
  NextjsFrameworkIcon,
  ViteFrameworkIcon,
  ThreejsFrameworkIcon,
} from './BrandIcons';

const TECH_ICONS = {
  react: ReactFrameworkIcon,
  nextjs: NextjsFrameworkIcon,
  vite: ViteFrameworkIcon,
  threejs: ThreejsFrameworkIcon,
};

const PROVIDER_LABELS: Record<string, string> = {
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeRepoInput(input);
    if (!normalized) {
      setValidationError(
        'Try pasting a GitHub link like https://github.com/facebook/react or shorthand like facebook/react.'
      );
      return;
    }
    setValidationError(null);
    onSelectRepo(normalized);
  };

  const displayError = validationError || initialError;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* Clean 3-zone Top Bar Contract */}
      <header className="w-full border-b border-slate-200/80 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-xl font-extrabold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0"
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
            {/* AI provider pill */}
            {onChangeAI && (
              <button
                type="button"
                onClick={onChangeAI}
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  aiConfig
                    ? 'border-slate-200 bg-[#F8FAFC] text-slate-600 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F]'
                    : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
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
              className="rounded-xl bg-[#FF5A5F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E0484D] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Explore Demo Repo
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto w-full max-w-6xl flex-1 px-6 pt-14 pb-20 md:pt-20">
        {/* Sunlit Hero & Search Form */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-sm font-semibold text-[#0D9488]">
            Open-source progress made joyful &amp; jargon-free
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl md:text-[54px] leading-[1.08]">
            Turn any GitHub repo into a live plain-English story
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Paste a GitHub link or <span className="font-mono text-sm text-[#0F172A]">owner/repo</span>{' '}
            to get AI-synthesized progress chapters, decoded developer jargon, animated velocity
            charts, and an interactive Project Lifecycle Pipeline Flow.
          </p>

          {/* Primary Search Input */}
          <form onSubmit={handleSubmit} className="mt-9">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center focus-within:border-[#FF5A5F] focus-within:ring-4 focus-within:ring-[#FF5A5F]/12 transition-all">
              <div className="flex flex-1 items-center gap-3 px-3">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Paste github.com/owner/repo or type facebook/react"
                  aria-label="GitHub repository URL or owner/repo"
                  className="w-full bg-transparent py-2.5 text-base text-[#0F172A] placeholder:text-slate-400 focus:outline-none"
                  disabled={isLoading}
                />
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

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CURATED_REPOS.map((item, idx) => (
              <motion.button
                key={item.fullName}
                type="button"
                disabled={isLoading}
                onClick={() => onSelectRepo(item.fullName)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#0D9488]/50 hover:shadow-md hover:shadow-slate-900/5 disabled:opacity-60 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-[#F8FAFC] text-[#0F172A] p-2 shadow-xs group-hover:border-[#0D9488]/40 transition-colors">
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
          className="mt-16 grid grid-cols-1 gap-8 border-t border-slate-200/80 pt-12 md:grid-cols-3"
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

      <footer className="border-t border-slate-200/70 bg-white">
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
