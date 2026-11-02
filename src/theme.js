import { createContext, useContext } from 'react';

export const ORANGE = '#ff5a1f';

export const palettes = {
  light: { bg: '#ffffff', panel: '#f5f5f5', text: '#171717', muted: '#666666', line: '#dddddd', soft: '#fff0e9', good: '#1f9d55', bad: '#d64545' },
  dark: { bg: '#090909', panel: '#171717', text: '#f5f5f5', muted: '#aaaaaa', line: '#333333', soft: '#28170f', good: '#4ade80', bad: '#f87171' },
};

export const ThemeContext = createContext({ c: palettes.light, dark: false });
export const useTheme = () => useContext(ThemeContext);

const formatters = {};
export function money(value, currency = 'USD') {
  if (value == null || Number.isNaN(value)) return '—';
  formatters[currency] ||= new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return formatters[currency].format(value);
}

export function shortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
