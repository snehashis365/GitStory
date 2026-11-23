import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { clearEntireGitStoryCache } from '../utils/digestCache';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('GitStory ErrorBoundary caught an unexpected error:', error, errorInfo);
  }

  handleClearCacheAndReload = () => {
    try {
      clearEntireGitStoryCache();
    } catch (e) {
      console.error('Failed to clear cache during recovery:', e);
    }
    window.location.reload();
  };

  handleReturnHome = () => {
    try {
      clearEntireGitStoryCache();
      const url = new URL(window.location.href);
      url.searchParams.delete('repo');
      window.location.href = url.pathname;
    } catch {
      window.location.href = window.location.pathname;
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFFDF9] dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-800 dark:text-slate-100 font-sans">
          <div className="w-full max-w-lg rounded-3xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-xl sm:text-2xl font-black text-[#0F172A] dark:text-slate-100 tracking-tight">
                Rendering Hiccup Detected
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                A malformed synthesis or corrupted browser cache caused this view to stop rendering.
                Don&apos;t worry—your settings are safe and you can recover instantly with a clean cache reload.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center">
              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF5A5F] px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-[#E0484D] transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear Cache &amp; Reload</span>
              </button>

              <button
                type="button"
                onClick={this.handleReturnHome}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                <Home className="h-4 w-4" />
                <span>Return to Repos</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-left">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors cursor-pointer"
              >
                {this.state.showDetails ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Hide Error Details</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>Show Error Details</span>
                  </>
                )}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 overflow-hidden rounded-xl bg-slate-900 p-3.5 font-mono text-[11px] text-rose-300">
                  <div className="font-semibold text-rose-400 mb-1">
                    {this.state.error?.name}: {this.state.error?.message}
                  </div>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-slate-400 text-[10px]">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
