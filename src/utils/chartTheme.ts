import { useEffect, useState } from 'react';

const THEME_KEY = 'dietshift-theme';
const THEME_EVENT = 'dietshift-theme-change';

export function isDarkThemeActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function toggleTheme(): boolean {
  const nextDark = !isDarkThemeActive();
  if (nextDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem(THEME_KEY, 'dark'); } catch {}
  } else {
    document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, 'light'); } catch {}
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { isDark: nextDark } }));
  return nextDark;
}

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(isDarkThemeActive);

  useEffect(() => {
    const handler = () => setIsDark(isDarkThemeActive());
    window.addEventListener(THEME_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(THEME_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return isDark;
}

const DARK_HEX_MAP: Record<string, string> = {
  '#eaedf2': '#1e242e',
  '#f8fafc': '#1e242e',
  '#ffffff': '#1e242e',
  '#cfd5df': '#27303f',
  '#aeb6c4': '#334155',
  '#8c96a6': '#475569',
  '#d8dde6': '#334155',
  '#111827': '#e5e9f0',
  '#0f172a': '#e5e9f0',
  '#2d3643': '#cbd5e1',
  '#1e293b': '#cbd5e1',
  '#3d4654': '#94a3b8',
  '#475569': '#94a3b8',
  '#64748b': '#94a3b8',
  '#163d4a': '#5ea3b8',
  '#3f6f7d': '#7ac2d6',
  '#8a1253': '#e85d9f',
  '#6b4c1b': '#d4a34f',
  '#525e70': '#8ea0b8',
  '#7b8696': '#9aa7b8',
};

function remapColorString(val: string): string {
  const lower = val.trim().toLowerCase();
  if (DARK_HEX_MAP[lower]) return DARK_HEX_MAP[lower];
  return val.replace(/#[0-9a-fA-F]{6}/g, (match) => DARK_HEX_MAP[match.toLowerCase()] ?? match);
}

function deepAdapt(node: unknown): unknown {
  if (node == null) return node;
  if (typeof node === 'string') return remapColorString(node);
  if (typeof node === 'function') return node;
  if (Array.isArray(node)) return node.map(deepAdapt);
  if (typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'formatter' && typeof v === 'function') {
        const origFn = v as (...args: unknown[]) => unknown;
        out[k] = (...args: unknown[]) => {
          const res = origFn(...args);
          return typeof res === 'string' ? remapColorString(res) : res;
        };
      } else if (k === 'color' && typeof v === 'function') {
        const origColorFn = v as (...args: unknown[]) => unknown;
        out[k] = (...args: unknown[]) => {
          const res = origColorFn(...args);
          return typeof res === 'string' ? remapColorString(res) : res;
        };
      } else {
        out[k] = deepAdapt(v);
      }
    }
    return out;
  }
  return node;
}

export function adaptChartOption<T>(option: T, isDark: boolean): T {
  if (!isDark || !option || typeof option !== 'object') return option;
  return deepAdapt(option) as T;
}
