export type ThemeMode = 'light' | 'auto' | 'dark';

const THEME_STORAGE_KEY = 'gitstory_theme';
const THEME_CHANGE_EVENT = 'gitstory_theme_change';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'auto';
}

export function saveStoredTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function getNextTheme(mode: ThemeMode): ThemeMode {
  // Step sequence: Light > Auto > Dark > Light
  if (mode === 'light') return 'auto';
  if (mode === 'auto') return 'dark';
  return 'light';
}

export function applyTheme(mode: ThemeMode): boolean {
  if (typeof window === 'undefined') return false;

  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Update theme-color meta tag for mobile browser headers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#0B0F19' : '#0F172A');
  }

  return isDark;
}

export function dispatchThemeChange(mode: ThemeMode) {
  saveStoredTheme(mode);
  applyTheme(mode);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: mode }));
  }
}

export function subscribeToThemeChanges(callback: (mode: ThemeMode) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<ThemeMode>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleMediaChange = () => {
    const current = getStoredTheme();
    if (current === 'auto') {
      applyTheme('auto');
      callback('auto');
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleCustomEvent);
  mediaQuery.addEventListener('change', handleMediaChange);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleCustomEvent);
    mediaQuery.removeEventListener('change', handleMediaChange);
  };
}
