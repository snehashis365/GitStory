import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Bell,
  BellRing,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  GitCommitHorizontal,
  GitFork,
  GitMerge,
  Lightbulb,
  Maximize2,
  Minimize2,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  AlertCircle,
} from 'lucide-react';
import type { AiDigest, AIProviderConfig, MilestoneAlert, ReadmeOverview, RepoSnapshot } from './types';
import {
  formatCompactNumber,
  formatRelativeTime,
  normalizeRepoInput,
} from './utils/format';
import { RepoLauncher } from './components/RepoLauncher';
import { ProjectLifecyclePipeline } from './components/ProjectLifecyclePipeline';
import { VelocityAndContributors } from './components/VelocityAndContributors';
import { ActivityFeed } from './components/ActivityFeed';
import { CommunityChatDrawer } from './components/CommunityChatDrawer';
import { ThemeToggle } from './components/ThemeToggle';
import {
  getBrowserNotificationState,
  NotificationToastStack,
  requestBrowserNotifications,
  sendBrowserPushNotification,
  type BrowserNotificationState,
} from './components/NotificationCenter';
import { AIProviderModal, loadAIConfig, clearAIConfig } from './components/AIProviderModal';
import { calculateAdaptiveSyncInterval, type CadenceInfo } from './utils/cadence';
import { loadCachedDigest, saveCachedDigest, clearAllRepoCache } from './utils/digestCache';
import { fetchRepoSnapshot, fetchRepoReadme } from './services/githubService';
import {
  generateStoryDigest,
  generateReadmeOverview,
  loadCachedReadmeOverview,
  saveCachedReadmeOverview,
} from './services/aiService';

const DEFAULT_SYNC_INTERVAL_SECONDS = 600; // 10 minutes default
const RECENT_REPOS_STORAGE_KEY = 'gitstory_recent_repos_v1';
const LEGACY_RECENT_REPOS_STORAGE_KEY = 'pulseisle_recent_repos_v1';

function formatSecondsToTimer(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function loadRecentRepos(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_REPOS_STORAGE_KEY) || localStorage.getItem(LEGACY_RECENT_REPOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecentRepo(fullName: string): string[] {
  const existing = loadRecentRepos().filter(
    (r) => r.toLowerCase() !== fullName.toLowerCase()
  );
  const next = [fullName, ...existing].slice(0, 5);
  try {
    localStorage.setItem(RECENT_REPOS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage restrictions
  }
  return next;
}

export default function App() {
  const [aiConfig, setAiConfig] = useState<AIProviderConfig | null>(() => loadAIConfig());
  const [showProviderModal, setShowProviderModal] = useState(() => !loadAIConfig());
  const [recentRepos, setRecentRepos] = useState<string[]>(() => loadRecentRepos());
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [digest, setDigest] = useState<AiDigest | null>(null);
  const [isLoadingRepo, setIsLoadingRepo] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherInput, setSwitcherInput] = useState('');
  const [switcherError, setSwitcherError] = useState<string | null>(null);

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [secondsToSync, setSecondsToSync] = useState(DEFAULT_SYNC_INTERVAL_SECONDS);
  const [cadence, setCadence] = useState<CadenceInfo | null>(null);
  const [notifState, setNotifState] = useState<BrowserNotificationState>(() =>
    getBrowserNotificationState()
  );
  const [alerts, setAlerts] = useState<MilestoneAlert[]>([]);
  const [celebrationSignal, setCelebrationSignal] = useState(0);

  const [chatOpen, setChatOpen] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<{
    text: string;
    contextLabel: string;
    seq: number;
  } | null>(null);

  const [briefingTab, setBriefingTab] = useState<'pulse' | 'readme'>('pulse');
  const [readmeOverview, setReadmeOverview] = useState<ReadmeOverview | null>(null);
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const [showReadmePeek, setShowReadmePeek] = useState(false);
  const [isReadmeExpanded, setIsReadmeExpanded] = useState(false);
  const [rawReadmeText, setRawReadmeText] = useState<string>('');

  const lastSeenRef = useRef<{
    repo: string;
    commitSha: string | null;
    releaseTag: string | null;
    prNumber: number | null;
  }>({
    repo: '',
    commitSha: null,
    releaseTag: null,
    prNumber: null,
  });

  const pushMilestoneAlert = useCallback(
    (alert: Omit<MilestoneAlert, 'id' | 'timestamp'>, triggerCelebration = true) => {
      const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const entry: MilestoneAlert = { ...alert, id, timestamp };
      setAlerts((prev) => [entry, ...prev].slice(0, 3));
      if (triggerCelebration) {
        setCelebrationSignal((n) => n + 1);
      }
      sendBrowserPushNotification(`${alert.emoji} ${alert.title}`, alert.body);

      window.setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 8500);
    },
    []
  );

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const getAIHeaders = useCallback((): Record<string, string> => {
    if (!aiConfig) return {};
    return {
      'x-ai-provider': aiConfig.provider,
      'x-ai-key': aiConfig.apiKey,
      'x-ai-model': aiConfig.model ?? '',
      ...(aiConfig.localEndpoint ? { 'x-ai-endpoint': aiConfig.localEndpoint } : {}),
    };
  }, [aiConfig]);

  const fetchAiSummary = useCallback(
    async (
      repoSnap: RepoSnapshot,
      options?: { forceRefresh?: boolean; configOverride?: AIProviderConfig }
    ) => {
      const force = Boolean(options?.forceRefresh);
      const activeConfig = options?.configOverride ?? aiConfig;
      const provider = activeConfig?.provider || 'default';
      const model = activeConfig?.model || '';

      // Check persistent client-side cache first if not manually force-refreshing
      if (!force) {
        const cached = loadCachedDigest(repoSnap, provider, model);
        if (cached) {
          setDigest(cached);
          setAiError(null);
          return;
        }
      }

      setIsLoadingAi(true);
      setAiError(null);
      try {
        if (!activeConfig || (!activeConfig.apiKey && activeConfig.provider !== 'local' && activeConfig.provider !== 'demo')) {
          throw new Error('Please configure your AI Provider API key in settings.');
        }
        const data = await generateStoryDigest(repoSnap, activeConfig);
        setDigest(data);
        saveCachedDigest(repoSnap, data, provider, model);
      } catch (err: unknown) {
        setAiError(err instanceof Error ? err.message : 'AI summary temporarily unavailable.');
      } finally {
        setIsLoadingAi(false);
      }
    },
    [aiConfig, getAIHeaders]
  );

  const loadRepository = useCallback(
    async (
      repoInput: string,
      options?: {
        isBackgroundSync?: boolean;
        configOverride?: AIProviderConfig;
        forceRefreshAi?: boolean;
        forceSyncRepo?: boolean;
      }
    ) => {
      const isBg = Boolean(options?.isBackgroundSync);
      const forceRepo = Boolean(options?.forceSyncRepo);
      if (isBg) {
        setIsSyncing(true);
      } else {
        setIsLoadingRepo(true);
        setRepoError(null);
        setAiError(null);
      }

      try {
        const data = await fetchRepoSnapshot(repoInput, { forceSync: isBg || forceRepo });

        const latestSha = data.commits[0]?.sha || null;
        const latestTag = data.releases[0]?.tagName || null;
        const latestPr = data.mergedPRs[0]?.number || null;

        const prev = lastSeenRef.current;
        const isSameRepo = prev.repo.toLowerCase() === data.repo.fullName.toLowerCase();

        // Calculate smart adaptive sync cadence from commit intervals (cluster mass merges)
        const cadenceInfo = calculateAdaptiveSyncInterval(data.commits, data.mergedPRs);
        setCadence(cadenceInfo);

        if (isBg && isSameRepo) {
          let detectedNewActivity = false;
          if (latestTag && prev.releaseTag && latestTag !== prev.releaseTag) {
            detectedNewActivity = true;
            pushMilestoneAlert({
              type: 'release',
              emoji: '🚀',
              title: `New Release ${latestTag} Shipped!`,
              body: `${data.repo.name} just published ${latestTag}. Updating your progress highlights now!`,
            });
          } else if (latestPr && prev.prNumber && latestPr !== prev.prNumber) {
            detectedNewActivity = true;
            pushMilestoneAlert({
              type: 'pr',
              emoji: '🎉',
              title: `Fresh PR #${latestPr} Merged!`,
              body: `New community improvement merged into ${data.repo.name}. Translating what changed!`,
            });
          } else if (latestSha && prev.commitSha && latestSha !== prev.commitSha) {
            detectedNewActivity = true;
            pushMilestoneAlert({
              type: 'commit',
              emoji: '⚡',
              title: `New Progress in ${data.repo.name}`,
              body: `@${data.commits[0].authorLogin} just landed fresh work. Refreshing your AI summary!`,
            });
          }

          setSnapshot(data);
          // Only re-generate summary if actual new commits, PRs, or releases were detected!
          if (detectedNewActivity) {
            void fetchAiSummary(data, { forceRefresh: true });
          }
        } else {
          // Fresh repo load or switching between repos: check cache first!
          setSnapshot(data);
          setSwitcherOpen(false);
          setSwitcherInput('');
          setSwitcherError(null);
          setRecentRepos(saveRecentRepo(data.repo.fullName));

          setBriefingTab('pulse');
          setReadmeOverview(null);
          setRawReadmeText('');
          setShowReadmePeek(false);
          setIsReadmeExpanded(false);
          setReadmeError(null);

          const activeCfg = options?.configOverride ?? aiConfig;
          const provider = activeCfg?.provider || 'default';
          const model = activeCfg?.model || '';
          const cached = options?.forceRefreshAi ? null : loadCachedDigest(data, provider, model);

          if (cached) {
            setDigest(cached);
            setAiError(null);
          } else {
            setDigest(null);
            void fetchAiSummary(data, { configOverride: activeCfg ?? undefined, forceRefresh: options?.forceRefreshAi });
          }
        }

        lastSeenRef.current = {
          repo: data.repo.fullName,
          commitSha: latestSha,
          releaseTag: latestTag,
          prNumber: latestPr,
        };
        setSecondsToSync(cadenceInfo.intervalSeconds);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to fetch GitHub repository.';
        if (!isBg) {
          setRepoError(message);
        }
      } finally {
        setIsLoadingRepo(false);
        setIsSyncing(false);
      }
    },
    [aiConfig, fetchAiSummary, pushMilestoneAlert]
  );

  const handleApplyAIConfig = useCallback(
    (cfg: AIProviderConfig) => {
      setAiConfig(cfg);
      setShowProviderModal(false);
      if (snapshot) {
        // Refetch snapshot with current sync depth and regenerate briefing with new config
        void loadRepository(snapshot.repo.fullName, {
          configOverride: cfg,
          forceRefreshAi: true,
          forceSyncRepo: true,
        });
      }
    },
    [snapshot, loadRepository]
  );

  // Smart adaptive auto-sync loop (waits for AI generation to finish before next sync)
  useEffect(() => {
    if (!snapshot || !autoSyncEnabled) return;

    // DO NOT run auto sync or decrement while AI generation or sync is already in flight!
    if (isLoadingAi || isSyncing) return;

    const timer = window.setInterval(() => {
      setSecondsToSync((prev) => {
        if (prev <= 1) {
          void loadRepository(snapshot.repo.fullName, { isBackgroundSync: true });
          return cadence?.intervalSeconds ?? DEFAULT_SYNC_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [snapshot, autoSyncEnabled, isLoadingAi, isSyncing, cadence, loadRepository]);

  const handleEnableNotifications = async () => {
    const result = await requestBrowserNotifications();
    setNotifState(result);
    if (result === 'granted' && snapshot) {
      pushMilestoneAlert(
        {
          type: 'celebration',
          emoji: '🔔',
          title: 'Milestone Alerts Active!',
          body: `You'll get instant browser & dashboard alerts whenever ${snapshot.repo.name} ships new updates.`,
        },
        false
      );
    }
  };

  const handleAskAboutItem = (prompt: string, contextLabel: string) => {
    setChatOpen(true);
    setPendingChatPrompt((prev) => ({
      text: prompt,
      contextLabel,
      seq: (prev?.seq || 0) + 1,
    }));
  };

  const handleSelectBriefingTab = useCallback(
    async (tab: 'pulse' | 'readme') => {
      setBriefingTab(tab);
      if (tab !== 'readme' || !snapshot) return;

      if (readmeOverview) return;

      const cached = loadCachedReadmeOverview(snapshot.repo.fullName);
      if (cached) {
        setReadmeOverview(cached);
        if (cached.rawReadmeSnippet) {
          setRawReadmeText(cached.rawReadmeSnippet);
        } else {
          void fetchRepoReadme(snapshot.repo.fullName).then((text) => setRawReadmeText(text)).catch(() => {});
        }
        return;
      }

      setIsLoadingReadme(true);
      setReadmeError(null);
      try {
        const rawText = await fetchRepoReadme(snapshot.repo.fullName);
        setRawReadmeText(rawText);
        const overview = await generateReadmeOverview(snapshot.repo, rawText, aiConfig);
        overview.rawReadmeSnippet = rawText.slice(0, 40000);
        setReadmeOverview(overview);
        saveCachedReadmeOverview(snapshot.repo.fullName, overview);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to generate project overview right now.';
        const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('busy');
        setReadmeError(
          isRateLimit
            ? 'The AI model was momentarily busy during startup. Click "Retry Reading" below to generate.'
            : msg
        );
      } finally {
        setIsLoadingReadme(false);
      }
    },
    [snapshot, readmeOverview, aiConfig]
  );

  const handleClearRepoCache = useCallback(() => {
    if (!snapshot) return;
    clearAllRepoCache(snapshot.repo.fullName);
    setDigest(null);
    setReadmeOverview(null);
    void fetchAiSummary(snapshot, { forceRefresh: true });
  }, [snapshot, fetchAiSummary]);

  const handleSwitcherSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeRepoInput(switcherInput);
    if (!normalized) {
      setSwitcherError('Enter a valid GitHub link or owner/repo handle.');
      return;
    }
    setSwitcherError(null);
    void loadRepository(normalized);
  };

  if (!snapshot) {
    return (
      <>
        <AIProviderModal
          isOpen={showProviderModal}
          onConfirm={handleApplyAIConfig}
          onClose={() => setShowProviderModal(false)}
        />
        <RepoLauncher
          onSelectRepo={(repo) => void loadRepository(repo)}
          recentRepos={recentRepos}
          initialError={repoError}
          isLoading={isLoadingRepo}
          onChangeAI={() => setShowProviderModal(true)}
          aiConfig={aiConfig}
        />
        <NotificationToastStack alerts={alerts} onDismiss={dismissAlert} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* AI Provider Modal (change provider while viewing a repo) */}
      <AIProviderModal
        isOpen={showProviderModal}
        onConfirm={handleApplyAIConfig}
        onClose={() => setShowProviderModal(false)}
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/85 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3.5 py-2.5 sm:gap-8 sm:px-6 sm:py-3.5">
          <button
            type="button"
            onClick={() => {
              setSnapshot(null);
              setDigest(null);
              setRepoError(null);
            }}
            className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#0F172A] hover:text-[#FF5A5F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            GitStory
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#overview"
              className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
            >
              AI Briefing
            </a>
            <a
              href="#updates"
              className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
            >
              Progress Story
            </a>
            <a
              href="#lifecycle-flow"
              className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
            >
              Lifecycle Flow
            </a>
            <a
              href="#community"
              className="hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
            >
              Velocity
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 3-Step Theme Toggle: Light > Auto > Dark */}
            <ThemeToggle />

            {/* AI Provider badge + change button */}
            {aiConfig && (
              <button
                type="button"
                onClick={() => setShowProviderModal(true)}
                title={`AI: ${aiConfig.provider} · ${aiConfig.model || 'default model'}`}
                className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F] transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#FF5A5F]" />
                <span className="capitalize">
                  {aiConfig.provider === 'demo' ? (
                    <>
                      <span className="hidden xs:inline">Demo AI</span>
                      <span className="xs:hidden">Demo</span>
                    </>
                  ) : (
                    aiConfig.provider
                  )}
                </span>
              </button>
            )}
            {!aiConfig && (
              <button
                type="button"
                onClick={() => setShowProviderModal(true)}
                className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>Set Key</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl bg-[#FF5A5F] px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#E0484D] transition-colors whitespace-nowrap cursor-pointer"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Ask AI Guide</span>
              <span className="sm:hidden">Ask AI</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 sm:space-y-8 px-3.5 pt-4 pb-20 sm:px-6 sm:pt-6">
        {/* Contextual Repo Controls & Live 60s Sync Bar */}
        <section
          id="overview"
          className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setSnapshot(null);
                setDigest(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#0F172A] transition-colors whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Repos</span>
            </button>

            <span className="text-slate-300" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-2 min-w-0">
              {snapshot.repo.avatarUrl && (
                <img
                  src={snapshot.repo.avatarUrl}
                  alt={`${snapshot.repo.owner} avatar`}
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 sm:h-6 sm:w-6 rounded-full border border-slate-200 object-cover shrink-0"
                />
              )}
              <a
                href={snapshot.repo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-display text-sm font-bold text-[#0F172A] hover:text-[#FF5A5F] transition-colors truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-none"
              >
                <span className="truncate">{snapshot.repo.fullName}</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </a>
            </div>

            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#0D9488] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Search className="h-3 w-3 text-[#0D9488]" />
              <span>Switch Repo</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              title={cadence?.explanation || 'Adaptive sync cadence'}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F8FAFC] border border-slate-200/80 px-3 py-1.5 text-xs text-slate-600"
            >
              <span className="font-medium">
                {isSyncing
                  ? 'Syncing...'
                  : isLoadingAi
                    ? 'AI synthesizing...'
                    : autoSyncEnabled
                      ? 'Auto-sync in'
                      : 'Auto-sync paused'}
              </span>
              {autoSyncEnabled && !isSyncing && !isLoadingAi && (
                <span className="font-mono font-semibold tabular-nums text-[#0D9488]">
                  {formatSecondsToTimer(secondsToSync)}
                </span>
              )}
              {cadence && (
                <span className="hidden sm:inline-block rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {cadence.cadenceLabel}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAutoSyncEnabled((v) => !v)}
              aria-label={autoSyncEnabled ? 'Pause auto-sync' : 'Resume auto-sync'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {autoSyncEnabled ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-slate-500" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-[#0D9488]" />
                  <span>Resume</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void loadRepository(snapshot.repo.fullName, { isBackgroundSync: true })}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#0D9488] ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>Sync Now</span>
            </button>

            <button
              type="button"
              onClick={handleClearRepoCache}
              title="Clear cached AI summaries and reload fresh"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-500" />
              <span>Clear Cache</span>
            </button>

            {notifState !== 'unsupported' && notifState !== 'granted' && (
              <button
                type="button"
                onClick={() => void handleEnableNotifications()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/10 px-3 py-1.5 text-xs font-semibold text-[#0D9488] hover:bg-[#0D9488]/16 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>{notifState === 'denied' ? 'Alerts Blocked' : 'Enable Push Alerts'}</span>
              </button>
            )}

            {notifState === 'granted' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-[#0D9488] whitespace-nowrap">
                <BellRing className="h-3.5 w-3.5" />
                <span>Push Alerts On</span>
              </span>
            )}
          </div>
        </section>

        {/* Expandable Quick Repo Switcher */}
        {switcherOpen && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSwitcherSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={switcherInput}
                onChange={(e) => {
                  setSwitcherInput(e.target.value);
                  if (switcherError) setSwitcherError(null);
                }}
                placeholder="Paste any GitHub URL or owner/repo (e.g. tailwindlabs/tailwindcss)"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-4 py-2.5 text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#FF5A5F] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoadingRepo}
                className="rounded-xl bg-[#0F172A] dark:bg-slate-800 dark:hover:bg-slate-700 dark:border dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                {isLoadingRepo ? 'Loading...' : 'Load Repo'}
              </button>
            </div>
            {(switcherError || repoError) && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {switcherError || repoError}
              </p>
            )}
          </motion.form>
        )}

        {/* Hero Community AI Briefing + KPI Strip */}
        <section className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8">
          {/* Header Tab Switcher (Pulse vs Project 101 README Primer) */}
          <div className="mb-6 flex flex-col gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-full sm:w-auto items-center rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setBriefingTab('pulse')}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold transition-all cursor-pointer ${
                  briefingTab === 'pulse'
                    ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#FF5A5F]" />
                <span>Community Pulse</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSelectBriefingTab('readme')}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold transition-all cursor-pointer ${
                  briefingTab === 'readme'
                    ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-[#0D9488]" />
                <span>Project 101</span>
                {!readmeOverview && !isLoadingReadme && (
                  <span className="rounded-full bg-[#0D9488]/15 px-1.5 py-0.2 text-[10px] font-bold text-[#0D9488] dark:text-[#2DD4BF]">
                    README
                  </span>
                )}
              </button>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {briefingTab === 'pulse' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void fetchAiSummary(snapshot, { forceRefresh: true })}
                    disabled={isLoadingAi}
                    title="Force-regenerate the AI briefing and story chapters from recent git activity"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F] hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-all whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 text-[#FF5A5F] ${isLoadingAi ? 'animate-spin' : ''}`}
                    />
                    <span>{isLoadingAi ? 'Synthesizing...' : 'Regenerate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChatOpen(true)}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-[#0F172A] dark:bg-slate-800 dark:hover:bg-slate-700 dark:border dark:border-slate-700 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="h-4 w-4 text-[#FF5A5F]" />
                    <span>Chat About Progress</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowReadmePeek((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    {showReadmePeek ? (
                      <EyeOff className="h-3.5 w-3.5 text-[#0D9488]" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-[#0D9488]" />
                    )}
                    <span>{showReadmePeek ? 'Hide README' : 'Peek README'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChatOpen(true);
                      handleAskAboutItem(
                        `Can you explain what ${snapshot.repo.name} does in simple terms and why people use it?`,
                        'Project 101'
                      );
                    }}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-[#0F172A] dark:bg-slate-800 dark:hover:bg-slate-700 dark:border dark:border-slate-700 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="h-4 w-4 text-[#FF5A5F]" />
                    <span>Ask About Project</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TAB 1: Live Community Pulse View */}
          {briefingTab === 'pulse' && (
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#0D9488]">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF5A5F]" />
                  AI Community Briefing
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {digest
                    ? `${digest.momentumEmoji} ${digest.momentumMood}`
                    : `${snapshot.repo.language}`}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Last pushed {formatRelativeTime(snapshot.repo.pushedAt)}
                </span>
              </div>

              {isLoadingAi && !digest ? (
                <div className="mt-4 space-y-3 animate-pulse">
                  <div className="h-9 w-4/5 rounded-xl bg-slate-100 dark:bg-slate-800" />
                  <div className="h-4 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                  <div className="h-4 w-2/3 rounded-lg bg-slate-100 dark:bg-slate-800" />
                </div>
              ) : (
                <>
                  <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-slate-100 sm:text-3xl lg:text-4xl leading-tight">
                    {digest?.headline || `Live Community Pulse for ${snapshot.repo.name}`}
                  </h1>
                  <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    {digest?.playfulSummary || snapshot.repo.description}
                  </p>
                </>
              )}

              {aiError && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="flex-1">{aiError}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void fetchAiSummary(snapshot)}
                      className="font-semibold underline underline-offset-2 cursor-pointer"
                    >
                      Retry AI Summary
                    </button>
                    {(aiError.includes('Demo rate limit') || aiError.includes('limit reached')) && (
                      <button
                        type="button"
                        onClick={() => setShowProviderModal(true)}
                        className="rounded-lg bg-amber-600 px-2.5 py-1 text-white font-semibold hover:bg-amber-700 transition-colors cursor-pointer"
                      >
                        Add Your Own Key
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Project 101 (README De-Jargonizer) View */}
          {briefingTab === 'readme' && (
            <div className="space-y-6">
              {isLoadingReadme && (
                <div className="space-y-4 py-4 animate-pulse">
                  <div className="h-6 w-1/3 rounded-lg bg-slate-100 dark:bg-slate-800" />
                  <div className="h-20 w-full rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                    <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              )}

              {readmeError && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="flex-1">{readmeError}</span>
                  <button
                    type="button"
                    onClick={() => void handleSelectBriefingTab('readme')}
                    className="font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    Retry Reading
                  </button>
                </div>
              )}

              {readmeOverview && !isLoadingReadme && (
                <div className="space-y-5">
                  {/* Analogy & Headline Banner */}
                  <div className="rounded-2xl border border-teal-200/80 dark:border-teal-500/20 bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0D9488] dark:text-[#2DD4BF]">
                      <Lightbulb className="h-4 w-4 shrink-0" />
                      <span>The Big Idea</span>
                    </div>
                    <h2 className="mt-2.5 font-display text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-slate-100 leading-snug">
                      {readmeOverview.analogy}
                    </h2>
                    <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {readmeOverview.oneLiner}
                    </p>
                  </div>

                  {/* Problem Solved vs How It Works Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 p-4 sm:p-5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
                        <span>🛑 The Problem Before This</span>
                      </div>
                      <p className="mt-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {readmeOverview.problemSolved}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-teal-200/70 dark:border-teal-900/40 bg-teal-50/30 dark:bg-teal-950/20 p-4 sm:p-5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide">
                        <span>✨ How This Project Solves It</span>
                      </div>
                      <p className="mt-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {readmeOverview.howItWorks}
                      </p>
                    </div>
                  </div>

                  {/* Core Superpowers Cards */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                      Core Superpowers
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(readmeOverview.superpowers || []).map((sp, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 p-4"
                        >
                          <div className="text-xl">{sp.emoji}</div>
                          <h4 className="mt-1.5 text-sm font-bold text-[#0F172A] dark:text-slate-100">
                            {sp.title}
                          </h4>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {sp.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Target Audience Badges */}
                  {Array.isArray(readmeOverview.targetAudience) && readmeOverview.targetAudience.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        Built for:
                      </span>
                      {readmeOverview.targetAudience.map((audience, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          {audience}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Peek Rendered Markdown README Viewer */}
                  {showReadmePeek && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 sm:p-5 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-[#0D9488]" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                            Rendered README.md
                          </span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-500">
                            Markdown
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setIsReadmeExpanded((v) => !v)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            {isReadmeExpanded ? (
                              <>
                                <Minimize2 className="h-3 w-3 text-slate-500" />
                                <span>Collapse</span>
                              </>
                            ) : (
                              <>
                                <Maximize2 className="h-3 w-3 text-[#0D9488]" />
                                <span>Expand Full</span>
                              </>
                            )}
                          </button>

                          <a
                            href={`${snapshot.repo.htmlUrl}#readme`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#0D9488] hover:underline"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      {/* Rendered Markdown Body with smooth expandable constraint */}
                      <div
                        className={`relative transition-all duration-300 ease-in-out ${
                          isReadmeExpanded
                            ? 'max-h-[85vh] overflow-y-auto'
                            : 'max-h-72 sm:max-h-80 overflow-hidden'
                        }`}
                      >
                        <div className="readme-markdown text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed space-y-3 break-words">
                          {rawReadmeText ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ ...props }) => (
                                  <h1
                                    className="font-display text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white mt-4 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800"
                                    {...props}
                                  />
                                ),
                                h2: ({ ...props }) => (
                                  <h2
                                    className="font-display text-base sm:text-lg font-bold text-[#0F172A] dark:text-white mt-3.5 mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800"
                                    {...props}
                                  />
                                ),
                                h3: ({ ...props }) => (
                                  <h3
                                    className="font-display text-sm sm:text-base font-bold text-[#0F172A] dark:text-white mt-3 mb-1"
                                    {...props}
                                  />
                                ),
                                p: ({ ...props }) => (
                                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed my-2" {...props} />
                                ),
                                ul: ({ ...props }) => (
                                  <ul className="list-disc pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300 marker:text-[#0D9488]" {...props} />
                                ),
                                ol: ({ ...props }) => (
                                  <ol className="list-decimal pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300 marker:text-slate-400" {...props} />
                                ),
                                li: ({ ...props }) => <li className="leading-snug" {...props} />,
                                code: ({ inline, className, children, ...props }: any) => {
                                  return inline ? (
                                    <code
                                      className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] sm:text-xs text-[#0D9488] dark:text-[#2DD4BF] border border-slate-200 dark:border-slate-700 break-all"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  ) : (
                                    <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] sm:text-xs font-mono text-slate-100 dark:bg-slate-950 my-2.5 border border-slate-800">
                                      <code {...props}>{children}</code>
                                    </pre>
                                  );
                                },
                                pre: ({ children }) => <>{children}</>,
                                a: ({ href, children, ...props }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#0D9488] dark:text-[#2DD4BF] underline underline-offset-2 hover:text-[#0F172A] dark:hover:text-white break-all"
                                    {...props}
                                  >
                                    {children}
                                  </a>
                                ),
                                blockquote: ({ ...props }) => (
                                  <blockquote
                                    className="border-l-4 border-[#0D9488] pl-3 italic text-slate-600 dark:text-slate-400 my-2 bg-slate-50/70 dark:bg-slate-900/50 py-1 rounded-r"
                                    {...props}
                                  />
                                ),
                                table: ({ ...props }) => (
                                  <div className="overflow-x-auto my-3">
                                    <table
                                      className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 text-xs text-left"
                                      {...props}
                                    />
                                  </div>
                                ),
                                th: ({ ...props }) => (
                                  <th
                                    className="bg-slate-100 dark:bg-slate-800 px-3 py-2 font-bold text-slate-900 dark:text-white"
                                    {...props}
                                  />
                                ),
                                td: ({ ...props }) => (
                                  <td
                                    className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                                    {...props}
                                  />
                                ),
                                img: ({ src, alt, ...props }) => (
                                  <img
                                    src={src}
                                    alt={alt || 'README illustration'}
                                    className="max-w-full h-auto rounded-lg my-2 border border-slate-200 dark:border-slate-800"
                                    {...props}
                                  />
                                ),
                              }}
                            >
                              {rawReadmeText}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-slate-500 italic py-4">
                              No README content found for this repository.
                            </p>
                          )}
                        </div>

                        {/* Bottom Gradient Fade overlay when collapsed */}
                        {!isReadmeExpanded && rawReadmeText && (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-24 items-end justify-center bg-gradient-to-t from-white via-white/85 to-transparent dark:from-slate-950 dark:via-slate-950/85">
                            <button
                              type="button"
                              onClick={() => setIsReadmeExpanded(true)}
                              className="pointer-events-auto mb-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-4 py-1.5 text-xs font-bold text-[#0D9488] dark:text-[#2DD4BF] shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                              <span>Expand Full README</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bottom Collapse Button when expanded */}
                      {isReadmeExpanded && (
                        <div className="mt-3 flex justify-center border-t border-slate-100 dark:border-slate-800 pt-3">
                          <button
                            type="button"
                            onClick={() => setIsReadmeExpanded(false)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                            <span>Collapse README Preview</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 sm:mt-7 grid grid-cols-2 gap-3 sm:gap-4 border-t border-slate-100 dark:border-slate-800 pt-5 sm:pt-6 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Community Stars</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#0F172A] dark:text-slate-100">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 text-[#F59E0B] fill-[#F59E0B] shrink-0" />
                {formatCompactNumber(snapshot.repo.stars)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Forks &amp; Remixes</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#0F172A] dark:text-slate-100">
                <GitFork className="h-4 w-4 sm:h-5 sm:w-5 text-[#0D9488] shrink-0" />
                {formatCompactNumber(snapshot.repo.forks)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Commits</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#FF5A5F]">
                <GitCommitHorizontal className="h-4 w-4 sm:h-5 sm:w-5 text-[#FF5A5F] shrink-0" />
                {formatCompactNumber(snapshot.repo.totalCommits || snapshot.commits.length)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total PRs</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#0F172A] dark:text-slate-100">
                <GitMerge className="h-4 w-4 sm:h-5 sm:w-5 text-[#8B5CF6] shrink-0" />
                {formatCompactNumber(snapshot.repo.totalPRs || snapshot.mergedPRs.length)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Latest Release</p>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#FF5A5F] truncate">
                {snapshot.releases[0]?.tagName || 'Rolling'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Issues</p>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#0F172A] dark:text-slate-100">
                {formatCompactNumber(snapshot.repo.openIssues)}
              </p>
            </div>
          </div>
        </section>

        {/* PRIMARY DEFAULT PROGRESS VIEW: AI Progress Story Chapters, Release Notes & Jargon Decoder */}
        <ActivityFeed
          snapshot={snapshot}
          digest={digest}
          isAiLoading={isLoadingAi}
          aiProvider={aiConfig?.provider}
          aiModel={aiConfig?.model}
          onRetryAi={() => void fetchAiSummary(snapshot)}
          onRegenerateAi={() => void fetchAiSummary(snapshot, { forceRefresh: true })}
          onAskAboutItem={handleAskAboutItem}
        />

        {/* Interactive 2D Motion Project Lifecycle Pipeline Flow */}
        <section id="lifecycle-flow" className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0F172A]">
                Interactive Project Lifecycle Pipeline Flow
              </h2>
              <p className="text-sm text-slate-600">
                Follow how work flows from Active Coding → Reviewed &amp; Merged PRs → Community
                Engine → Shipped Release.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Click any stage card to inspect live telemetry and AI breakdown
            </span>
          </div>

          <ProjectLifecyclePipeline
            snapshot={snapshot}
            digest={digest}
            isAiLoading={isLoadingAi}
            celebrationSignal={celebrationSignal}
            onAskAboutStage={handleAskAboutItem}
          />
        </section>

        {/* Animated Velocity Charts & Community Contributors */}
        <VelocityAndContributors snapshot={snapshot} digest={digest} />
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-xs text-slate-500 sm:px-6">
          <span>
            GitStory · Tracking <strong className="text-[#0F172A]">{snapshot.repo.fullName}</strong>
          </span>
          <span className="tabular-nums">Last synced {formatRelativeTime(snapshot.syncedAt)}</span>
        </div>
      </footer>

      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Open Community AI Chat"
          className="fixed bottom-5 right-5 z-30 inline-flex h-13 items-center gap-2 rounded-full bg-[#0F172A] dark:bg-slate-800 dark:hover:bg-slate-700 dark:border dark:border-slate-700 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-transform hover:-translate-y-0.5 md:hidden cursor-pointer"
        >
          <MessageCircle className="h-4 w-4 text-[#FF5A5F]" />
          <span>Ask AI</span>
        </button>
      )}

      <CommunityChatDrawer
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        snapshot={snapshot}
        digest={digest}
        aiConfig={aiConfig}
        onOpenAIConfig={() => setShowProviderModal(true)}
        pendingPrompt={pendingChatPrompt}
      />

      <NotificationToastStack alerts={alerts} onDismiss={dismissAlert} />
    </div>
  );
}
