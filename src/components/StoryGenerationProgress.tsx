import { useEffect, useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Compass,
  GitCommitHorizontal,
  GitMerge,
  Loader2,
  Sparkles,
  BookOpen,
  Cpu,
} from 'lucide-react';
import type { RepoSnapshot } from '../types';

interface StoryGenerationProgressProps {
  snapshot: RepoSnapshot;
  isAiLoading: boolean;
  isRegenerating?: boolean;
  provider?: string;
  model?: string;
}

interface StepInfo {
  id: number;
  label: string;
  subtitle: string;
  threshold: number;
  icon: typeof Sparkles;
}

const STEPS: StepInfo[] = [
  {
    id: 1,
    label: 'Ingesting Activity',
    subtitle: 'Clustering latest commits & merged pull requests',
    threshold: 25,
    icon: GitCommitHorizontal,
  },
  {
    id: 2,
    label: 'Decoding Engineering Diffs',
    subtitle: 'Translating code syntax and developer jargon',
    threshold: 55,
    icon: Cpu,
  },
  {
    id: 3,
    label: 'Composing Story Chapters',
    subtitle: 'Synthesizing plain-English impact & milestones',
    threshold: 85,
    icon: BookOpen,
  },
  {
    id: 4,
    label: 'Polishing Community Digest',
    subtitle: 'Structuring cheerfulness score & glossary',
    threshold: 98,
    icon: Sparkles,
  },
];

export function StoryGenerationProgress({
  snapshot,
  isAiLoading,
  isRegenerating = false,
  provider,
  model,
}: StoryGenerationProgressProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isAiLoading) {
      setElapsedMs(0);
      return;
    }

    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);

    return () => clearInterval(timer);
  }, [isAiLoading]);

  // Smooth realistic asymptotic curve simulating AI generation progress
  const progressPct = useMemo(() => {
    if (!isAiLoading) return 100;
    const sec = elapsedMs / 1000;
    if (sec <= 1.2) {
      // 0 to 25% in first 1.2s
      return Math.min(25, Math.round((sec / 1.2) * 25));
    }
    if (sec <= 3.5) {
      // 25% to 58% in next 2.3s
      return Math.min(58, 25 + Math.round(((sec - 1.2) / 2.3) * 33));
    }
    if (sec <= 7.0) {
      // 58% to 88% in next 3.5s
      return Math.min(88, 58 + Math.round(((sec - 3.5) / 3.5) * 30));
    }
    // Asymptotic creep towards 96%
    const extra = (sec - 7.0) * 0.8;
    return Math.min(96, 88 + Math.round(extra));
  }, [elapsedMs, isAiLoading]);

  const activeStep = useMemo(() => {
    for (let i = 0; i < STEPS.length; i++) {
      if (progressPct <= STEPS[i].threshold) {
        return STEPS[i];
      }
    }
    return STEPS[STEPS.length - 1];
  }, [progressPct]);

  const elapsedSecondsFormatted = (elapsedMs / 1000).toFixed(1);

  // If this is a background regeneration and existing digest is displayed,
  // show a sleek, non-blocking floating banner above the story:
  if (isRegenerating) {
    return (
      <div className="rounded-2xl border border-[#FF5A5F]/30 bg-gradient-to-r from-[#FF5A5F]/5 via-amber-500/5 to-[#0D9488]/5 p-4 shadow-sm mb-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Loader2 className="h-4 w-4 animate-spin text-[#FF5A5F] shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0F172A]">
                  Regenerating Story Analysis
                </span>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  Step {activeStep.id}/4
                </span>
              </div>
              <p className="text-xs text-slate-600 truncate mt-0.5">
                {activeStep.label}: {activeStep.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              {elapsedSecondsFormatted}s
            </span>
            <span className="font-mono text-xs font-bold text-[#FF5A5F]">
              {progressPct}%
            </span>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF5A5F] via-[#F59E0B] to-[#0D9488] transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    );
  }

  // Full-page / In-feed Generation State when no prior digest exists:
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      {/* Top Header & Live Timer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF5A5F]/10 text-[#FF5A5F]">
            <Sparkles className="h-5 w-5 animate-spin" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <span>Synthesizing GitStory Community Digest</span>
              <span className="inline-flex items-center rounded-full bg-[#0D9488]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0D9488]">
                AI Active
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Transforming latest {snapshot.commits.length} commits &amp; {snapshot.mergedPRs.length} PRs
              {snapshot.repo.totalCommits ? ` (out of ${snapshot.repo.totalCommits.toLocaleString()} total commits)` : ''} into plain-English stories
              {provider ? ` via ${provider}${model ? ` (${model})` : ''}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{elapsedSecondsFormatted}s elapsed</span>
          </div>
          <span className="font-mono text-sm font-bold text-[#FF5A5F] min-w-[3rem] text-right">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Main Animated Progress Bar */}
      <div className="mt-6 space-y-2">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF5A5F] via-[#F59E0B] to-[#0D9488] transition-all duration-300 ease-out shadow-xs"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] font-medium text-slate-400">
          <span>Starting</span>
          <span className="text-[#0D9488] font-semibold">{activeStep.label}</span>
          <span>Ready</span>
        </div>
      </div>

      {/* 4-Stage Stepper Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STEPS.map((step) => {
          const isDone = progressPct > step.threshold;
          const isCurrent = activeStep.id === step.id;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className={`relative rounded-2xl border p-4 transition-all ${
                isDone
                  ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/15 text-emerald-950 dark:text-emerald-300'
                  : isCurrent
                    ? 'border-[#FF5A5F]/40 bg-[#FF5A5F]/5 dark:bg-[#FF5A5F]/15 text-[#0F172A] dark:text-slate-100 ring-2 ring-[#FF5A5F]/20'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Step 0{step.id}
                </span>
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#FF5A5F]" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                )}
              </div>

              <div className="flex items-start gap-2">
                <StepIcon
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    isDone
                      ? 'text-emerald-600'
                      : isCurrent
                        ? 'text-[#FF5A5F]'
                        : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold leading-tight">{step.label}</h4>
                  <p className="mt-1 text-[11px] text-slate-500 leading-normal line-clamp-2">
                    {step.subtitle}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cheerful Real-Time Snippet Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-600">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="h-4 w-4 text-[#0D9488] shrink-0" />
          <span className="truncate">
            Recent highlight:{' '}
            <strong className="text-[#0F172A]">
              {snapshot.commits[0]?.firstLine || 'Refining repository'}
            </strong>{' '}
            by @{snapshot.commits[0]?.authorLogin || 'contributor'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 shrink-0">
          Responses cached for subsequent loads
        </span>
      </div>
    </div>
  );
}
