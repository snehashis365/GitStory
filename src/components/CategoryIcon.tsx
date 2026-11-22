import type { ReactNode } from 'react';
import {
  Sparkles,
  GitCommitHorizontal,
  GitPullRequest,
  GitMerge,
  Rocket,
  Users2,
  Bug,
  Zap,
  BookOpen,
  FileText,
  ShieldCheck,
  Wrench,
  Palette,
  CheckCircle2,
  Bell,
  PartyPopper,
  Code2,
  Languages,
  Package,
  Layers,
  HeartHandshake,
  ArrowUpRight,
} from 'lucide-react';

interface CategoryBadgeProps {
  /** Keyword, category label, or fallback emoji to interpret */
  category?: string;
  kind?: 'commit' | 'pr' | 'release' | 'community' | 'feature' | 'fix' | 'speed' | 'docs' | 'polish' | 'alert';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function CategoryBadge({
  category = '',
  kind,
  size = 'md',
  className = '',
}: CategoryBadgeProps) {
  const norm = (category || kind || '').toLowerCase().trim();

  let icon: ReactNode = <Sparkles className="h-full w-full" />;
  let colorClass = 'bg-[#FF5A5F]/10 text-[#FF5A5F] border-[#FF5A5F]/20';

  // Specific kind / category mappings
  if (norm.includes('commit') || norm === 'commits' || norm.includes('code')) {
    icon = <GitCommitHorizontal className="h-full w-full" />;
    colorClass = 'bg-rose-50 text-rose-600 border-rose-200/60';
  } else if (norm.includes('pr') || norm.includes('pull') || norm.includes('merge') || norm === 'prs') {
    icon = <GitMerge className="h-full w-full" />;
    colorClass = 'bg-teal-50 text-teal-600 border-teal-200/60';
  } else if (norm.includes('release') || norm.includes('ship') || norm.includes('tag')) {
    icon = <Rocket className="h-full w-full" />;
    colorClass = 'bg-amber-50 text-amber-600 border-amber-200/60';
  } else if (norm.includes('community') || norm.includes('contributor') || norm.includes('builder')) {
    icon = <Users2 className="h-full w-full" />;
    colorClass = 'bg-indigo-50 text-indigo-600 border-indigo-200/60';
  } else if (norm.includes('fix') || norm.includes('bug') || norm.includes('patch') || norm.includes('repair')) {
    icon = <Bug className="h-full w-full" />;
    colorClass = 'bg-red-50 text-red-600 border-red-200/60';
  } else if (norm.includes('speed') || norm.includes('fast') || norm.includes('perf') || norm.includes('boost') || norm.includes('optim')) {
    icon = <Zap className="h-full w-full" />;
    colorClass = 'bg-amber-50 text-amber-600 border-amber-200/60';
  } else if (norm.includes('doc') || norm.includes('guide') || norm.includes('readme')) {
    icon = <BookOpen className="h-full w-full" />;
    colorClass = 'bg-sky-50 text-sky-600 border-sky-200/60';
  } else if (norm.includes('polish') || norm.includes('clean') || norm.includes('ui') || norm.includes('style')) {
    icon = <Palette className="h-full w-full" />;
    colorClass = 'bg-violet-50 text-violet-600 border-violet-200/60';
  } else if (norm.includes('feature') || norm.includes('add') || norm.includes('new') || norm.includes('win')) {
    icon = <Layers className="h-full w-full" />;
    colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-200/60';
  } else if (norm.includes('security') || norm.includes('safe') || norm.includes('guard')) {
    icon = <ShieldCheck className="h-full w-full" />;
    colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-200/60';
  } else if (norm.includes('jargon') || norm.includes('term') || norm.includes('mean')) {
    icon = <Languages className="h-full w-full" />;
    colorClass = 'bg-teal-50 text-teal-600 border-teal-200/60';
  } else if (norm.includes('celebration') || norm.includes('party')) {
    icon = <PartyPopper className="h-full w-full" />;
    colorClass = 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200/60';
  } else if (norm.includes('alert') || norm.includes('bell')) {
    icon = <Bell className="h-full w-full" />;
    colorClass = 'bg-amber-50 text-amber-600 border-amber-200/60';
  }

  const sizeClasses = {
    xs: 'h-6 w-6 p-1 rounded-md border',
    sm: 'h-8 w-8 p-1.5 rounded-lg border',
    md: 'h-10 w-10 p-2 rounded-xl border',
    lg: 'h-12 w-12 p-2.5 rounded-2xl border',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${sizeClasses} ${colorClass} ${className}`}
      aria-hidden="true"
    >
      {icon}
    </div>
  );
}
