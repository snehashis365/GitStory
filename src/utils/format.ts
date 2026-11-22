export interface CuratedRepo {
  fullName: string;
  tagline: string;
  category: string;
  techIcon: 'react' | 'nextjs' | 'vite' | 'threejs';
  accent: 'coral' | 'teal' | 'marigold' | 'indigo';
}

export const CURATED_REPOS: CuratedRepo[] = [
  {
    fullName: 'facebook/react',
    tagline: 'The UI library powering millions of modern web apps.',
    category: 'Web Interfaces',
    techIcon: 'react',
    accent: 'teal',
  },
  {
    fullName: 'vercel/next.js',
    tagline: 'Full-stack React framework built for fast, lively websites.',
    category: 'App Framework',
    techIcon: 'nextjs',
    accent: 'coral',
  },
  {
    fullName: 'vitejs/vite',
    tagline: 'Lightning-fast toolkit that makes building web apps feel instant.',
    category: 'Build Engine',
    techIcon: 'vite',
    accent: 'marigold',
  },
  {
    fullName: 'mrdoob/three.js',
    tagline: 'Creative 3D graphics library bringing worlds to life in your browser.',
    category: '3D Graphics',
    techIcon: 'threejs',
    accent: 'teal',
  },
];

export function normalizeRepoInput(raw: string): string | null {
  const cleaned = raw.trim().replace(/^@/, '');
  if (!cleaned) return null;

  const urlMatch = cleaned.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\/.*)?$/i
  );
  if (urlMatch) {
    return `${urlMatch[1]}/${urlMatch[2].replace(/\.git$/i, '')}`;
  }

  const shortMatch = cleaned.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shortMatch) {
    return `${shortMatch[1]}/${shortMatch[2].replace(/\.git$/i, '')}`;
  }

  return null;
}

export function formatCompactNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${Math.round(num / 1_000)}k`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

export function formatRelativeTime(isoDate: string): string {
  if (!isoDate) return 'recently';
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 'recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSec < 45) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.floor(diffMo / 12)}y ago`;
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
