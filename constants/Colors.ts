/**
 * Relaxo palette — aligned with the app icon (night sky, moon blue, soft lavender).
 * Care-event colors stay distinct for charts/logs.
 */
export const Colors = {
  light: {
    text: '#122048',
    textSecondary: '#6B7190',
    background: '#F4F2F8',
    card: '#FFFFFF',
    tint: '#6B7FBF',
    tintDark: '#3D4B8E',
    border: '#E2DFEC',
    asleep: '#9BB0D9',
    awake: '#E0B8A8',
    feeding: '#B8A0D4',
    diaper: '#E8C88A',
    bath: '#7BB8D0',
    wake: '#7CA8D8',
    success: '#6B7FBF',
    danger: '#D4847C',
    confidence: {
      low: '#D4847C',
      medium: '#E0B8A8',
      high: '#6B7FBF',
    },
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#6B7FBF',
  },
  dark: {
    text: '#EDEAF5',
    textSecondary: '#A3A5CE',
    background: '#0A122E',
    card: '#162240',
    tint: '#A3A5CE',
    tintDark: '#7786C1',
    border: '#2A3658',
    asleep: '#7786C1',
    awake: '#DBB6AF',
    feeding: '#B8A0D4',
    diaper: '#C4A060',
    bath: '#5A9AAD',
    wake: '#7CA8D8',
    success: '#A3A5CE',
    danger: '#D4847C',
    confidence: {
      low: '#D4847C',
      medium: '#DBB6AF',
      high: '#A3A5CE',
    },
    tabIconDefault: '#6B7280',
    tabIconSelected: '#A3A5CE',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const touchTarget = {
  minHeight: 56,
  buttonHeight: 72,
};
