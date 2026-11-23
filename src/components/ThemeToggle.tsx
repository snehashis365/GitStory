import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  type ThemeMode,
  getStoredTheme,
  getNextTheme,
  dispatchThemeChange,
  subscribeToThemeChanges,
} from '../utils/theme';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = true }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    return subscribeToThemeChanges((newTheme) => {
      setTheme(newTheme);
    });
  }, []);

  const handleToggle = () => {
    const next = getNextTheme(theme);
    dispatchThemeChange(next);
    setTheme(next);
  };

  const nextTheme = getNextTheme(theme);

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={`Theme: ${theme.toUpperCase()} (Click for ${nextTheme.toUpperCase()})`}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#FF5A5F]/40 hover:text-[#FF5A5F] transition-all cursor-pointer sm:px-3 sm:py-2 ${className}`}
      aria-label={`Current theme is ${theme}. Click to switch to ${nextTheme}`}
    >
      {theme === 'light' && <Sun className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />}
      {theme === 'auto' && <Monitor className="h-3.5 w-3.5 text-sky-500" />}
      {theme === 'dark' && <Moon className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400/20" />}

      {showLabel && (
        <span className="capitalize hidden xs:inline sm:inline">
          {theme}
        </span>
      )}

      {/* 3-Step Visual Dot Indicator: Light > Auto > Dark */}
      <span className="flex items-center gap-0.5 ml-0.5" aria-hidden="true">
        <span
          className={`h-1 w-1 rounded-full transition-all ${
            theme === 'light' ? 'bg-[#FF5A5F] scale-125' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
        <span
          className={`h-1 w-1 rounded-full transition-all ${
            theme === 'auto' ? 'bg-[#FF5A5F] scale-125' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
        <span
          className={`h-1 w-1 rounded-full transition-all ${
            theme === 'dark' ? 'bg-[#FF5A5F] scale-125' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
      </span>
    </button>
  );
}
