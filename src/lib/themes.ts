export type AccentPreset = 'ocean' | 'forest' | 'sunset' | 'violet' | 'rose' | 'midnight';

export interface ThemePreset {
  id: AccentPreset;
  label: string;
  color: string;          // accent hex for swatch display
  accent: string;         // --color-accent
  accentLight: string;    // --color-accent-light
  accentDark: string;     // --color-accent in dark mode
  accentLightDark: string;// --color-accent-light in dark mode
}

export const presets: ThemePreset[] = [
  {
    id: 'ocean',
    label: 'Ocean',
    color: '#007aff',
    accent: '#007aff',
    accentLight: '#e8f2ff',
    accentDark: '#0a84ff',
    accentLightDark: '#1a3a5c',
  },
  {
    id: 'forest',
    label: 'Forest',
    color: '#22c55e',
    accent: '#16a34a',
    accentLight: '#dcfce7',
    accentDark: '#22c55e',
    accentLightDark: '#14532d',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    color: '#f59e0b',
    accent: '#d97706',
    accentLight: '#fef3c7',
    accentDark: '#fbbf24',
    accentLightDark: '#78350f',
  },
  {
    id: 'violet',
    label: 'Violet',
    color: '#8b5cf6',
    accent: '#7c3aed',
    accentLight: '#ede9fe',
    accentDark: '#a78bfa',
    accentLightDark: '#3b0764',
  },
  {
    id: 'rose',
    label: 'Rose',
    color: '#f43f5e',
    accent: '#e11d48',
    accentLight: '#ffe4e6',
    accentDark: '#fb7185',
    accentLightDark: '#4c0519',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    color: '#06b6d4',
    accent: '#0891b2',
    accentLight: '#cffafe',
    accentDark: '#22d3ee',
    accentLightDark: '#164e63',
  },
];

export function getPreset(id: AccentPreset): ThemePreset {
  return presets.find(p => p.id === id) ?? presets[0];
}
