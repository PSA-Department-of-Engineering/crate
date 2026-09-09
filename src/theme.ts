export type ThemeName = 'cream' | 'glass';

export const DEFAULT_THEME: ThemeName = 'cream';
export const THEME_STORAGE_KEY = 'crate_theme';

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'cream' || value === 'glass';
}

export function getStoredTheme(): ThemeName {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_THEME;
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(storedTheme) ? storedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: ThemeName): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}
