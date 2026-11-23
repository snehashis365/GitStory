export interface RepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  language: string;
  defaultBranch: string;
  pushedAt: string;
  updatedAt: string;
  createdAt: string;
  htmlUrl: string;
  avatarUrl: string;
  topics: string[];
  license: string | null;
  totalCommits?: number;
  totalPRs?: number;
}

export interface CommitItem {
  sha: string;
  shortSha: string;
  message: string;
  firstLine: string;
  authorName: string;
  authorLogin: string;
  authorAvatar: string;
  date: string;
  htmlUrl: string;
}

export interface PullRequestItem {
  number: number;
  title: string;
  userLogin: string;
  userAvatar: string;
  mergedAt: string;
  htmlUrl: string;
  labels: string[];
}

export interface ReleaseItem {
  id: number;
  tagName: string;
  name: string;
  publishedAt: string;
  body: string;
  htmlUrl: string;
  authorLogin: string;
}

export interface ContributorItem {
  login: string;
  avatarUrl: string;
  contributions: number;
  htmlUrl: string;
}

export interface VelocityPoint {
  label: string;
  date: string;
  commits: number;
  mergedPRs: number;
}

export interface RepoSnapshot {
  repo: RepoMetadata;
  commits: CommitItem[];
  mergedPRs: PullRequestItem[];
  releases: ReleaseItem[];
  contributors: ContributorItem[];
  velocitySeries: VelocityPoint[];
  syncedAt: string;
  rateLimitRemaining: number | null;
  cached: boolean;
}

export type ChangeCategory = 'Feature' | 'Fix' | 'Speed' | 'Docs' | 'Polish';

export interface CommitTranslation {
  sha: string;
  emoji: string;
  plainTitle: string;
  whyItMatters: string;
  category: ChangeCategory;
}

export interface PrTranslation {
  number: number;
  emoji: string;
  plainTitle: string;
  whyItMatters: string;
  category: ChangeCategory;
}

export interface ReleaseHighlight {
  emoji: string;
  text: string;
}

export interface ReleaseTranslation {
  tagName: string;
  cheerfulTitle: string;
  summary: string;
  highlights: ReleaseHighlight[];
}

export interface ProgressChapter {
  emoji: string;
  title: string;
  summary: string;
  impactLabel: string;
  keyWins: string[];
  relatedCount: number;
}

export interface JargonTerm {
  term: string;
  plainMeaning: string;
  emoji: string;
}

export interface LifecycleStageBriefs {
  commits: string;
  prs: string;
  community: string;
  release: string;
}

export interface AiDigest {
  headline: string;
  playfulSummary: string;
  momentumMood: string;
  momentumEmoji: string;
  nextMilestoneEstimate: string;
  milestoneProgressPct: number;
  progressChapters: ProgressChapter[];
  jargonDecoder: JargonTerm[];
  lifecycleStageBriefs: LifecycleStageBriefs;
  releaseTranslation: ReleaseTranslation | null;
  commitTranslations: CommitTranslation[];
  prTranslations: PrTranslation[];
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  contextLabel?: string;
}

export interface MilestoneAlert {
  id: string;
  type: 'commit' | 'pr' | 'release' | 'celebration';
  title: string;
  body: string;
  emoji: string;
  timestamp: string;
  isSimulated?: boolean;
}

export type AIProviderType = 'demo' | 'groq' | 'gemini' | 'openai' | 'anthropic' | 'nvidia' | 'local';

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  /** Used only for 'local' provider */
  localEndpoint?: string;
  /** Model override (optional) */
  model?: string;
}

export type LifecycleStageId = 'commits' | 'prs' | 'community' | 'release';

export interface LifecycleStageInfo {
  id: LifecycleStageId;
  stepNumber: number;
  label: string;
  metricText: string;
  emoji: string;
  whatThisStageMeans: string;
  liveSummary: string;
  url: string;
  cameraPos: [number, number, number];
  lookAt: [number, number, number];
  worldAnchor: [number, number, number];
}
