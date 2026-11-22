import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  ExternalLink,
  GitCommitHorizontal,
  GitFork,
  GitMerge,
  MessageCircle,
  PartyPopper,
  Pause,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  AlertCircle,
} from 'lucide-react';
import type { AiDigest, AIProviderConfig, MilestoneAlert, RepoSnapshot } from './types';
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
import {
  getBrowserNotificationState,
  NotificationToastStack,
  requestBrowserNotifications,
  sendBrowserPushNotification,
  type BrowserNotificationState,
} from './components/NotificationCenter';
import { AIProviderModal, loadAIConfig, clearAIConfig } from './components/AIProviderModal';
import { calculateAdaptiveSyncInterval, type CadenceInfo } from './utils/cadence';
import { loadCachedDigest, saveCachedDigest } from './utils/digestCache';
import { fetchRepoSnapshot } from './services/githubService';
import { generateStoryDigest } from './services/aiService';

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
        if (!activeConfig || (!activeConfig.apiKey && activeConfig.provider !== 'local')) {
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

  const handleApplyAIConfig = useCallback(
    (cfg: AIProviderConfig) => {
      setAiConfig(cfg);
      setShowProviderModal(false);
      if (snapshot) {
        const cached = loadCachedDigest(snapshot, cfg.provider, cfg.model || '');
        if (cached) {
          setDigest(cached);
          setAiError(null);
        } else {
          setDigest(null);
          void fetchAiSummary(snapshot, { configOverride: cfg });
        }
      }
    },
    [snapshot, fetchAiSummary]
  );

  const loadRepository = useCallback(
    async (repoInput: string, options?: { isBackgroundSync?: boolean }) => {
      const isBg = Boolean(options?.isBackgroundSync);
      if (isBg) {
        setIsSyncing(true);
      } else {
        setIsLoadingRepo(true);
        setRepoError(null);
        setAiError(null);
      }

      try {
        const data = await fetchRepoSnapshot(repoInput, { forceSync: isBg });

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
              body: `${data.repo.name} just published ${latestTag}. Updating your plain-English highlights now!`,
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

          const provider = aiConfig?.provider || 'default';
          const model = aiConfig?.model || '';
          const cached = loadCachedDigest(data, provider, model);

          if (cached) {
            setDigest(cached);
            setAiError(null);
          } else {
            setDigest(null);
            void fetchAiSummary(data);
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

  const handleTestMilestoneAlert = () => {
    if (!snapshot) return;
    const latestRel = snapshot.releases[0]?.tagName;
    const latestAuthor = snapshot.commits[0]?.authorLogin || 'community';
    pushMilestoneAlert({
      type: 'celebration',
      emoji: '🎊',
      title: `Milestone Celebration: ${snapshot.repo.name}`,
      body: latestRel
        ? `Tracking live momentum past ${latestRel} — @${latestAuthor} and ${snapshot.contributors.length}+ builders are pushing the lifecycle forward!`
        : `Live tracker active! @${latestAuthor} and the community are pushing steady updates to ${snapshot.repo.name}.`,
      isSimulated: true,
    });
  };

  const handleAskAboutItem = (prompt: string, contextLabel: string) => {
    setChatOpen(true);
    setPendingChatPrompt((prev) => ({
      text: prompt,
      contextLabel,
      seq: (prev?.seq || 0) + 1,
    }));
  };

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
        />
        {!showProviderModal && (
          <RepoLauncher
            onSelectRepo={(repo) => void loadRepository(repo)}
            recentRepos={recentRepos}
            initialError={repoError}
            isLoading={isLoadingRepo}
            onChangeAI={() => setShowProviderModal(true)}
            aiConfig={aiConfig}
          />
        )}
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
      />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/85 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setSnapshot(null);
              setDigest(null);
              setRepoError(null);
            }}
            className="font-display text-xl font-extrabold tracking-tight text-[#0F172A] hover:text-[#FF5A5F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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

          <div className="flex items-center gap-2 shrink-0">
            {/* AI Provider badge + change button */}
            {aiConfig && (
              <button
                type="button"
                onClick={() => setShowProviderModal(true)}
                title={`AI: ${aiConfig.provider} · ${aiConfig.model || 'default model'}`}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F] transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="capitalize">{aiConfig.provider}</span>
              </button>
            )}
            {!aiConfig && (
              <button
                type="button"
                onClick={() => setShowProviderModal(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Set AI Key</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF5A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E0484D] transition-colors whitespace-nowrap cursor-pointer"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Ask AI Guide</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-6 pb-20 sm:px-6">
        {/* Contextual Repo Controls & Live 60s Sync Bar */}
        <section
          id="overview"
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-wrap items-center gap-3">
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

            <div className="flex items-center gap-2.5">
              {snapshot.repo.avatarUrl && (
                <img
                  src={snapshot.repo.avatarUrl}
                  alt={`${snapshot.repo.owner} avatar`}
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded-full border border-slate-200 object-cover"
                />
              )}
              <a
                href={snapshot.repo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-display text-sm font-bold text-[#0F172A] hover:text-[#FF5A5F] transition-colors"
              >
                <span>{snapshot.repo.fullName}</span>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
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

            <button
              type="button"
              onClick={handleTestMilestoneAlert}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF5A5F]/12 px-3 py-1.5 text-xs font-semibold text-[#FF5A5F] hover:bg-[#FF5A5F]/20 transition-colors whitespace-nowrap cursor-pointer"
            >
              <PartyPopper className="h-3.5 w-3.5" />
              <span>Test Milestone Alert</span>
            </button>
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
                className="flex-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#0F172A] focus:border-[#FF5A5F] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoadingRepo}
                className="rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
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
        <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#0D9488]">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF5A5F]" />
                  AI Community Briefing
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-600">
                  {digest
                    ? `${digest.momentumEmoji} ${digest.momentumMood}`
                    : `${snapshot.repo.language}`}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-500">
                  Last pushed {formatRelativeTime(snapshot.repo.pushedAt)}
                </span>
              </div>

              {isLoadingAi && !digest ? (
                <div className="mt-4 space-y-3 animate-pulse">
                  <div className="h-9 w-4/5 rounded-xl bg-slate-100" />
                  <div className="h-4 w-full rounded-lg bg-slate-100" />
                  <div className="h-4 w-2/3 rounded-lg bg-slate-100" />
                </div>
              ) : (
                <>
                  <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl leading-tight">
                    {digest?.headline || `Live Community Pulse for ${snapshot.repo.name}`}
                  </h1>
                  <p className="mt-3 text-base leading-relaxed text-slate-600">
                    {digest?.playfulSummary || snapshot.repo.description}
                  </p>
                </>
              )}

              {aiError && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="flex-1">{aiError}</span>
                  <button
                    type="button"
                    onClick={() => void fetchAiSummary(snapshot)}
                    className="font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    Retry AI Summary
                  </button>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void fetchAiSummary(snapshot, { forceRefresh: true })}
                disabled={isLoadingAi}
                title="Force-regenerate the AI briefing and story chapters from recent git activity"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F] hover:bg-white disabled:opacity-50 transition-all whitespace-nowrap cursor-pointer shadow-xs"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-[#FF5A5F] ${isLoadingAi ? 'animate-spin' : ''}`}
                />
                <span>{isLoadingAi ? 'Synthesizing...' : 'Regenerate Summary'}</span>
              </button>

              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <MessageCircle className="h-4 w-4 text-[#FF5A5F]" />
                <span>Chat About Progress</span>
              </button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <p className="text-xs font-medium text-slate-500">Community Stars</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
                <Star className="h-5 w-5 text-[#F59E0B] fill-[#F59E0B]" />
                {formatCompactNumber(snapshot.repo.stars)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">Forks &amp; Remixes</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
                <GitFork className="h-5 w-5 text-[#0D9488]" />
                {formatCompactNumber(snapshot.repo.forks)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">Total Commits</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
                <GitCommitHorizontal className="h-5 w-5 text-[#FF5A5F]" />
                {formatCompactNumber(snapshot.repo.totalCommits || snapshot.commits.length)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">Total Pull Requests</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
                <GitMerge className="h-5 w-5 text-[#8B5CF6]" />
                {formatCompactNumber(snapshot.repo.totalPRs || snapshot.mergedPRs.length)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">Latest Release</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#FF5A5F] truncate">
                {snapshot.releases[0]?.tagName || 'Rolling'}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">Active Open Issues</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A]">
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

      <footer className="border-t border-slate-200 bg-white">
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
          className="fixed bottom-5 right-5 z-30 inline-flex h-13 items-center gap-2 rounded-full bg-[#0F172A] px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-transform hover:-translate-y-0.5 md:hidden cursor-pointer"
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
