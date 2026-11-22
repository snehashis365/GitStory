import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2,
  GitCommitHorizontal,
  GitMerge,
  Users2,
  Rocket,
  ArrowRight,
  Sparkles,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  CheckCircle2,
  Play,
  Pause,
} from 'lucide-react';
import type { AiDigest, LifecycleStageId, RepoSnapshot } from '../types';
import { formatCompactNumber, formatRelativeTime } from '../utils/format';

interface ProjectLifecyclePipelineProps {
  snapshot: RepoSnapshot;
  digest: AiDigest | null;
  isAiLoading: boolean;
  celebrationSignal: number;
  onAskAboutStage: (prompt: string, contextLabel: string) => void;
}

interface StageConfig {
  id: LifecycleStageId;
  step: number;
  label: string;
  sublabel: string;
  icon: typeof GitCommitHorizontal;
  accent: {
    bg: string;
    text: string;
    border: string;
    ring: string;
    glow: string;
    badge: string;
  };
  metrics: { label: string; value: string }[];
  description: string;
}

export function ProjectLifecyclePipeline({
  snapshot,
  digest,
  isAiLoading,
  onAskAboutStage,
}: ProjectLifecyclePipelineProps) {
  const [selectedStageId, setSelectedStageId] = useState<LifecycleStageId>('commits');
  const [isFlowPlaying, setIsFlowPlaying] = useState(true);

  const stages: StageConfig[] = [
    {
      id: 'commits',
      step: 1,
      label: 'Active Coding',
      sublabel: 'Fresh commits crafted daily',
      icon: GitCommitHorizontal,
      accent: {
        bg: 'bg-rose-50',
        text: 'text-rose-600',
        border: 'border-rose-200',
        ring: 'ring-rose-500/20',
        glow: 'from-rose-500/20 to-transparent',
        badge: 'bg-rose-500 text-white',
      },
      metrics: [
        {
          label: 'Total Commits',
          value: snapshot.repo.totalCommits
            ? formatCompactNumber(snapshot.repo.totalCommits)
            : `${snapshot.commits.length}+`,
        },
        { label: 'Latest Batch', value: `${snapshot.commits.length} synced` },
      ],
      description:
        digest?.lifecycleStageBriefs?.commits ||
        'Engineers are actively committing clean code updates and refining core project components.',
    },
    {
      id: 'prs',
      step: 2,
      label: 'Review & Integration',
      sublabel: 'Pull requests checked & merged',
      icon: GitMerge,
      accent: {
        bg: 'bg-teal-50',
        text: 'text-teal-600',
        border: 'border-teal-200',
        ring: 'ring-teal-500/20',
        glow: 'from-teal-500/20 to-transparent',
        badge: 'bg-teal-600 text-white',
      },
      metrics: [
        {
          label: 'Total PRs',
          value: snapshot.repo.totalPRs
            ? formatCompactNumber(snapshot.repo.totalPRs)
            : `${snapshot.mergedPRs.length}+`,
        },
        { label: 'Latest Merged', value: `${snapshot.mergedPRs.length} synced` },
      ],
      description:
        digest?.lifecycleStageBriefs?.prs ||
        'Proposed features and fixes are thoroughly peer-reviewed, tested, and cleanly merged into the primary branch.',
    },
    {
      id: 'community',
      step: 3,
      label: 'Community Engine',
      sublabel: 'Builders & collaborative momentum',
      icon: Users2,
      accent: {
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        border: 'border-indigo-200',
        ring: 'ring-indigo-500/20',
        glow: 'from-indigo-500/20 to-transparent',
        badge: 'bg-indigo-600 text-white',
      },
      metrics: [
        { label: 'Active Contributors', value: `${snapshot.contributors.length}+` },
        { label: 'Stars & Remixes', value: `${formatCompactNumber(snapshot.repo.stars)} ★` },
      ],
      description:
        digest?.lifecycleStageBriefs?.community ||
        'Global open-source community members test, share feedback, report issues, and celebrate project progress.',
    },
    {
      id: 'release',
      step: 4,
      label: 'Shipped Milestone',
      sublabel: 'Production releases in users hands',
      icon: Rocket,
      accent: {
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        border: 'border-amber-200',
        ring: 'ring-amber-500/20',
        glow: 'from-amber-500/20 to-transparent',
        badge: 'bg-amber-500 text-white',
      },
      metrics: [
        { label: 'Release Tag', value: snapshot.releases[0]?.tagName || 'Rolling' },
        { label: 'Published', value: formatRelativeTime(snapshot.releases[0]?.publishedAt) },
      ],
      description:
        digest?.lifecycleStageBriefs?.release ||
        'Stable, tested code packages are packaged and distributed for users, apps, and ecosystems worldwide.',
    },
  ];

  const activeStage = stages.find((s) => s.id === selectedStageId) || stages[0];

  return (
    <section className="space-y-4">
      {/* Visual Pipeline Container */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
        {/* Subtle decorative background grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'radial-gradient(#0F172A 1px, transparent 1px), radial-gradient(#0F172A 1px, #ffffff 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />

        {/* Top Controls Bar */}
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#0D9488] animate-pulse" />
            <span className="font-display text-sm font-bold text-[#0F172A]">
              Interactive 4-Stage Lifecycle Flow
            </span>
            <span className="text-xs text-slate-400">· Click any stage to inspect live data</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFlowPlaying((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isFlowPlaying ? (
                <>
                  <Pause className="h-3 w-3 text-slate-500" />
                  <span>Pause Pulse</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 text-[#0D9488]" />
                  <span>Play Pulse</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Interactive Stages Track */}
        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-4">
          {stages.map((stage, idx) => {
            const isSelected = stage.id === selectedStageId;
            const IconComponent = stage.icon;

            return (
              <motion.button
                key={stage.id}
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.18 }}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all cursor-pointer ${
                  isSelected
                    ? `border-slate-300 bg-white ring-4 ${stage.accent.ring} shadow-lg shadow-slate-900/5`
                    : 'border-slate-200/90 bg-[#F8FAFC] hover:border-slate-300 hover:bg-white'
                }`}
              >
                {/* Connecting animated arrow for intermediate stages on desktop */}
                {idx < stages.length - 1 && (
                  <div className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden md:block">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-xs">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                )}

                <div>
                  {/* Step header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${stage.accent.bg} ${stage.accent.text} ${stage.accent.border}`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-400">
                        0{stage.step}
                      </span>
                    </div>

                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#0F172A] px-2 py-0.5 text-[10px] font-semibold text-white">
                        Viewing
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-display text-base font-bold text-[#0F172A]">
                    {stage.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 leading-snug">{stage.sublabel}</p>
                </div>

                {/* Primary Metric Pill */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{stage.metrics[0].label}</span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      {stage.metrics[0].value}
                    </span>
                  </div>
                </div>

                {/* Pulsing bottom active line */}
                {isSelected && (
                  <motion.div
                    layoutId="activeStageGlow"
                    className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl bg-[#FF5A5F]"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Dynamic Animated Flow Wire with particle pulses */}
        {isFlowPlaying && (
          <div className="relative mt-3 hidden md:block">
            <svg className="h-3 w-full" fill="none">
              <line
                x1="4%"
                y1="50%"
                x2="96%"
                y2="50%"
                stroke="#E2E8F0"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <motion.circle
                cx="10%"
                cy="50%"
                r="3.5"
                fill="#FF5A5F"
                animate={{ cx: ['10%', '90%'] }}
                transition={{
                  repeat: Infinity,
                  duration: 3.5,
                  ease: 'easeInOut',
                }}
              />
              <motion.circle
                cx="35%"
                cy="50%"
                r="3"
                fill="#0D9488"
                animate={{ cx: ['10%', '90%'] }}
                transition={{
                  repeat: Infinity,
                  duration: 3.5,
                  delay: 1.2,
                  ease: 'easeInOut',
                }}
              />
            </svg>
          </div>
        )}

        {/* Selected Stage Detail Inspection Deck */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-6 rounded-2xl border border-slate-200/90 bg-[#F8FAFC] p-5 sm:p-6"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left Stage Overview */}
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0D9488]">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF5A5F]" />
                  <span>Stage 0{activeStage.step} Deep-Dive</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-slate-600">{activeStage.label}</span>
                </div>

                <h4 className="mt-1.5 font-display text-xl font-bold text-[#0F172A]">
                  {activeStage.label}: {activeStage.sublabel}
                </h4>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {activeStage.description}
                </p>
              </div>

              {/* Metrics Pills & Ask AI Action */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-slate-500">
                      {activeStage.metrics[0].label}
                    </p>
                    <p className="font-mono text-sm font-bold text-[#0F172A]">
                      {activeStage.metrics[0].value}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-slate-500">
                      {activeStage.metrics[1].label}
                    </p>
                    <p className="font-mono text-sm font-bold text-[#0F172A]">
                      {activeStage.metrics[1].value}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onAskAboutStage(
                      `Explain what is happening in the "${activeStage.label}" stage of ${snapshot.repo.fullName}. How does code move from commits into merged PRs and releases?`,
                      activeStage.label
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-[#FF5A5F]" />
                  <span>Ask AI About {activeStage.label}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
