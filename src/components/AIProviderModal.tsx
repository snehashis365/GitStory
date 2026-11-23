import { useState, useEffect, useRef, useCallback, type FormEvent, type ComponentType, type SVGProps } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key, Sparkles, ChevronDown, Eye, EyeOff,
  ExternalLink, Loader2, CheckCircle2, AlertCircle, X,
} from 'lucide-react';
import type { AIProviderConfig, AIProviderType } from '../types';
import {
  GoogleGeminiIcon,
  OpenAIIcon,
  AnthropicClaudeIcon,
  NvidiaIcon,
  LocalServerIcon,
  GroqIcon,
  DemoAiIcon,
} from './BrandIcons';
import { fetchAvailableModels, CURATED_MODELS, DEFAULT_AI_MODELS, isStaticDeployment } from '../services/aiService';
import {
  getStoredGitHubToken,
  saveStoredGitHubToken,
  getStoredSyncDepth,
  saveStoredSyncDepth,
  SYNC_DEPTH_PRESETS,
  type SyncDepthConfig,
} from '../services/githubService';

// ─── Provider metadata ────────────────────────────────────────────────────────
const PROVIDERS: {
  id: AIProviderType;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  placeholder: string;
  docsUrl: string;
  defaultModel: string;
  note?: string;
}[] = [
  {
    id: 'demo',
    label: 'Demo Gateway (Groq)',
    icon: DemoAiIcon,
    placeholder: 'No API key required',
    docsUrl: 'https://groq.com',
    defaultModel: 'openai/gpt-oss-120b',
    note: '⚡ Powered by Groq Cloud + Cloudflare Edge Gateway running openai/gpt-oss-120b. No API key needed. Rate limited to 12 req/min.',
  },
  {
    id: 'groq',
    label: 'Groq Cloud (BYOK)',
    icon: GroqIcon,
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    defaultModel: 'openai/gpt-oss-120b',
    note: '🎁 Free API key at console.groq.com (no credit card needed). Blazing fast ~500 tok/sec inference.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    icon: GoogleGeminiIcon,
    placeholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.5-flash',
    note: '🎁 Free API key available at Google AI Studio (no credit card needed). Works directly in browser & locally.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    icon: OpenAIIcon,
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    icon: AnthropicClaudeIcon,
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-3-5-haiku-latest',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    icon: NvidiaIcon,
    placeholder: 'nvapi-...',
    docsUrl: 'https://build.nvidia.com/explore/discover',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    note: '⚡ Works locally (npm run dev). On static GitHub Pages, direct requests are blocked by NVIDIA browser CORS.',
  },
  {
    id: 'local',
    label: 'Local Endpoint',
    icon: LocalServerIcon,
    placeholder: 'optional-key',
    docsUrl: 'https://ollama.com',
    defaultModel: 'llama3',
    note: 'Ollama, LM Studio, or any OpenAI-compatible local server',
  },
];

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = 'gitstory_ai_config_v1';
const LEGACY_STORAGE_KEY = 'pulseisle_ai_config_v1';

export function loadAIConfig(): AIProviderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return {
        provider: 'demo',
        apiKey: '',
        model: 'openai/gpt-oss-120b',
      };
    }
    return JSON.parse(raw) as AIProviderConfig;
  } catch {
    return {
      provider: 'demo',
      apiKey: '',
      model: 'openai/gpt-oss-120b',
    };
  }
}

export function saveAIConfig(cfg: AIProviderConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearAIConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── Model-fetch hook ─────────────────────────────────────────────────────────
type FetchState = 'idle' | 'loading' | 'ok' | 'error';

function useModelList(provider: AIProviderType, apiKey: string, localEndpoint: string) {
  const [models, setModels] = useState<string[]>(() => CURATED_MODELS[provider] || []);
  const [fetchState, setFetchState] = useState<FetchState>('ok');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync curated models immediately when switching providers
  useEffect(() => {
    setModels(CURATED_MODELS[provider] || []);
    setFetchState('ok');
    setFetchError(null);
  }, [provider]);

  const trigger = useCallback(() => {
    // Anthropic and Demo: already using curated list, no external call needed
    if (provider === 'anthropic' || provider === 'demo') {
      setModels(CURATED_MODELS[provider]);
      setFetchState('ok');
      setFetchError(null);
      return;
    }

    const needsKey = provider !== 'local';
    if (needsKey && apiKey.trim().length < 10) {
      setModels(CURATED_MODELS[provider] || []);
      setFetchState('ok');
      setFetchError(null);
      return;
    }
    if (provider === 'local' && !localEndpoint.trim()) {
      setModels(CURATED_MODELS.local || []);
      setFetchState('ok');
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setFetchState('loading');
      setFetchError(null);

      try {
        const fetched = await fetchAvailableModels(provider, apiKey.trim(), localEndpoint.trim());
        if (Array.isArray(fetched) && fetched.length > 0) {
          setModels(fetched);
        } else {
          setModels(CURATED_MODELS[provider] || []);
        }
        setFetchState('ok');
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;
        // Gracefully keep curated models on error so user is never blocked
        setModels(CURATED_MODELS[provider] || []);
        setFetchState('ok');
      }
    }, 700); // 700 ms debounce
  }, [provider, apiKey, localEndpoint]);

  // Auto-trigger when provider, apiKey, or localEndpoint change
  useEffect(() => {
    trigger();
    return () => {
      debounceRef.current && clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [trigger]);

  return { models, fetchState, fetchError };
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AIProviderModalProps {
  isOpen: boolean;
  onConfirm: (cfg: AIProviderConfig) => void;
  onClose?: () => void;
}

export function AIProviderModal({ isOpen, onConfirm, onClose }: AIProviderModalProps) {
  const existing = loadAIConfig();
  const [provider, setProvider] = useState<AIProviderType>(existing?.provider ?? 'gemini');
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [model, setModel] = useState(existing?.model ?? '');
  const [localEndpoint, setLocalEndpoint] = useState(
    existing?.localEndpoint ?? 'http://localhost:11434/v1'
  );
  const [showKey, setShowKey] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [ghToken, setGhToken] = useState(() => getStoredGitHubToken());
  const [syncDepth, setSyncDepth] = useState<SyncDepthConfig>(() => getStoredSyncDepth());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync state whenever modal is opened so it always reflects current saved settings
  useEffect(() => {
    if (isOpen) {
      const current = loadAIConfig();
      const currentProv = current?.provider ?? 'gemini';
      const currentModel = current?.model ?? PROVIDERS.find((p) => p.id === currentProv)?.defaultModel ?? '';
      setProvider(currentProv);
      setApiKey(current?.apiKey ?? '');
      setModel(currentModel);
      setLocalEndpoint(current?.localEndpoint ?? 'http://localhost:11434/v1');
      setGhToken(getStoredGitHubToken());
      setSyncDepth(getStoredSyncDepth());
      setShowKey(false);
      setSubmitError(null);

      const curated = CURATED_MODELS[currentProv] || [];
      setIsCustomModel(Boolean(currentModel && !curated.includes(currentModel)));
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const meta = PROVIDERS.find((p) => p.id === provider)!;
  const { models, fetchState, fetchError } = useModelList(provider, apiKey, localEndpoint);

  // When model list loads and current model is empty, select the saved or first model
  useEffect(() => {
    if (!isCustomModel && fetchState === 'ok' && models.length > 0) {
      if (!model) {
        const current = loadAIConfig();
        if (current?.provider === provider && current?.model && models.includes(current.model)) {
          setModel(current.model);
        } else {
          setModel(models[0]);
        }
      }
    }
  }, [fetchState, models, model, isCustomModel, provider]);

  const handleProviderChange = (p: AIProviderType) => {
    setProvider(p);
    const current = loadAIConfig();
    if (current && current.provider === p) {
      // Re-load the saved config for this provider if it was already saved
      setApiKey(current.apiKey);
      setModel(current.model || '');
      const curated = CURATED_MODELS[p] || [];
      setIsCustomModel(Boolean(current.model && !curated.includes(current.model)));
    } else {
      setApiKey('');
      const defaultMod = PROVIDERS.find((x) => x.id === p)?.defaultModel || CURATED_MODELS[p]?.[0] || '';
      setModel(defaultMod);
      setIsCustomModel(false);
    }
    setSubmitError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (provider !== 'local' && provider !== 'demo' && !apiKey.trim()) {
      setSubmitError('Please enter your API key.');
      return;
    }
    if (provider === 'local' && !localEndpoint.trim()) {
      setSubmitError('Please enter the local server endpoint URL.');
      return;
    }
    setSubmitError(null);
    const resolvedModel =
      model.trim() ||
      (models.length > 0 ? models[0] : meta.defaultModel);
    const cfg: AIProviderConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: resolvedModel,
      ...(provider === 'local' ? { localEndpoint: localEndpoint.trim() } : {}),
    };
    saveAIConfig(cfg);
    saveStoredGitHubToken(ghToken);
    saveStoredSyncDepth(syncDepth);
    onConfirm(cfg);
  };

  // ── Model field: dropdown when list loaded, text input as fallback ──
  const modelField = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-[#0F172A]">Model</label>
        <div className="flex items-center gap-2">
          {fetchState === 'loading' && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching…
            </span>
          )}
          {fetchState === 'ok' && models.length > 0 && !isCustomModel && (
            <span className="inline-flex items-center gap-1 text-xs text-[#0D9488]">
              <CheckCircle2 className="h-3 w-3" />
              {models.length} models
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCustomModel((v) => !v)}
            className="text-xs font-medium text-[#FF5A5F] hover:underline cursor-pointer"
          >
            {isCustomModel ? 'Pick from list' : 'Custom model ID'}
          </button>
        </div>
      </div>

      {!isCustomModel && fetchState === 'ok' && models.length > 0 ? (
        // ── Dropdown populated from API ──
        <div className="relative">
          <select
            value={model || models[0]}
            onChange={(e) => setModel(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-4 py-3 pr-10 text-sm font-mono text-[#0F172A] dark:text-slate-100 focus:border-[#FF5A5F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]/20 cursor-pointer"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      ) : (
        // ── Free-text fallback ──
        <div className="relative">
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={meta.defaultModel}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-4 py-3 text-sm font-mono text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 focus:border-[#FF5A5F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]/20"
          />
        </div>
      )}
      <p className="text-xs text-slate-400">
        {isCustomModel
          ? 'Enter any valid model ID supported by your account.'
          : fetchState === 'ok' && models.length > 0
            ? 'Select from curated or active models for this provider.'
            : 'Enter a valid API key above to auto-populate the model list.'}
      </p>
    </div>
  );

  const form = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Local Endpoint (only for local) */}
      {provider === 'local' && (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#0F172A]">Server Endpoint URL</label>
          <input
            type="url"
            value={localEndpoint}
            onChange={(e) => { setLocalEndpoint(e.target.value); setSubmitError(null); }}
            placeholder="http://localhost:11434/v1"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-4 py-3 text-sm text-[#0F172A] dark:text-slate-100 focus:border-[#FF5A5F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]/20"
          />
        </div>
      )}

      {/* API Key or Demo Gateway Banner */}
      {provider === 'demo' ? (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-500/10 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
            <Sparkles className="h-4 w-4 text-[#FF5A5F]" />
            <span>Community Demo Mode Active</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Requests are processed through the Cloudflare Edge Gateway running Groq&apos;s ultra-fast{' '}
            <code className="rounded bg-teal-100 dark:bg-teal-900/60 px-1 py-0.5 text-teal-800 dark:text-teal-200 font-mono text-[11px]">openai/gpt-oss-120b</code>.
            No API key required! Rate limited to 12 requests/minute.
          </p>
          <div className="pt-1 flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Hit the limit or want higher quotas?</span>
            <button
              type="button"
              onClick={() => handleProviderChange('groq')}
              className="text-xs font-semibold text-[#0D9488] dark:text-[#2DD4BF] hover:underline cursor-pointer"
            >
              Bring Your Own Groq Key →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[#0F172A]">
              {provider === 'local' ? 'API Key (optional)' : 'API Key'}
            </label>
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0D9488] hover:underline"
            >
              {provider === 'gemini' || provider === 'groq' ? 'Get free key' : 'Get key'} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSubmitError(null); }}
              placeholder={meta.placeholder}
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 px-4 py-3 pr-11 text-sm font-mono text-[#0F172A] dark:text-slate-100 focus:border-[#FF5A5F] focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]/20"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Stored locally in your browser only. Never sent to any third party.
          </p>
        </div>
      )}

      {/* Model selector */}
      {modelField}

      {/* Sync & Synthesis Depth */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Sync &amp; Synthesis Depth
          </label>
          <span className="text-[11px] font-mono font-medium text-[#0D9488] dark:text-[#2DD4BF]">
            {syncDepth.maxCommits} commits · {syncDepth.maxPRs} PRs
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Controls how many recent commits and merged pull requests are fetched and analyzed by AI.
        </p>
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {SYNC_DEPTH_PRESETS.map((preset) => {
            const isSelected =
              syncDepth.maxCommits === preset.depth.maxCommits &&
              syncDepth.maxPRs === preset.depth.maxPRs;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSyncDepth(preset.depth)}
                className={`rounded-xl px-2.5 py-2 text-left text-xs transition-all border cursor-pointer ${
                  isSelected
                    ? 'border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488] dark:text-[#2DD4BF] font-semibold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="font-semibold">{preset.label}</div>
                <div className="text-[10px] opacity-75">{preset.depth.maxCommits}c / {preset.depth.maxPRs}pr</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional GitHub Token */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-3.5 space-y-1.5">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          GitHub Personal Access Token (Optional)
        </label>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Unauthenticated calls are limited to 60 req/hr. Paste a fine-grained token to boost to 5,000 req/hr.
        </p>
        <input
          type="password"
          value={ghToken}
          onChange={(e) => setGhToken(e.target.value)}
          placeholder="ghp_... (stored locally in browser)"
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-mono text-[#0F172A] dark:text-slate-100 focus:border-[#FF5A5F] focus:outline-none"
        />
      </div>

      {submitError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <div className="flex items-center gap-2.5 pt-1">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className={`rounded-xl bg-[#FF5A5F] py-3 text-sm font-semibold text-white hover:bg-[#E0484D] transition-colors cursor-pointer ${
            onClose ? 'w-2/3' : 'w-full'
          }`}
        >
          {existing ? 'Update & Continue' : 'Save & Start Tracking'}
        </button>
      </div>
    </form>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) {
              onClose();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-7 shadow-2xl shadow-slate-900/15 max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5A5F]/10 shrink-0">
                  <Key className="h-5 w-5 text-[#FF5A5F]" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
                    Choose Your AI Provider
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    GitStory works with any major AI provider
                  </p>
                </div>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-1.5 -mt-1.5 rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label="Close settings"
                  title="Close (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Provider badges */}
            <div className="mb-5 flex flex-wrap gap-2">
              {PROVIDERS.map((p) => {
                const Icon = p.icon;
                const isSelected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-[#FF5A5F] bg-[#FF5A5F]/10 text-[#FF5A5F] shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Provider note */}
            {meta.note && (
              <p className="mb-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                {meta.note}
              </p>
            )}

            {isStaticDeployment() && provider === 'nvidia' && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Browser CORS Notice for NVIDIA NIM</span>
                </div>
                <p className="leading-relaxed">
                  NVIDIA NIM’s gateway does not return browser CORS headers. Web browsers block direct client-side requests on static hosts like GitHub Pages.
                </p>
                <p className="leading-relaxed font-medium text-amber-800">
                  💡 For GitHub Pages, <strong>Google Gemini</strong> or <strong>OpenAI</strong> work directly in the browser. Run GitStory locally via <code>npm run dev</code> for full NVIDIA NIM proxy support.
                </p>
              </div>
            )}

            {form}

            <p className="mt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3 text-[#FF5A5F]" />
              GitStory · AI-powered GitHub storytelling
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
