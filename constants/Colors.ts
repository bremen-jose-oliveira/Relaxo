export const Colors = {
  light: {
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    background: '#F8F6F3',
    card: '#FFFFFF',
    tint: '#7C9A92',
    tintDark: '#5A7A72',
    border: '#E8E4DF',
    asleep: '#9BB5CE',
    awake: '#E8C4A0',
    feeding: '#C9A0DC',
    diaper: '#F0C674',
    wake: '#7CB7D4',
    success: '#7C9A92',
    danger: '#D4847C',
    confidence: {
      low: '#D4847C',
      medium: '#E8C4A0',
      high: '#7C9A92',
    },
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#7C9A92',
  },
  dark: {
    text: '#F5F0EB',
    textSecondary: '#A8A29E',
    background: '#1A1A2E',
    card: '#252540',
    tint: '#9BB5A8',
    tintDark: '#7C9A92',
    border: '#3D3D5C',
    asleep: '#6B8BA8',
    awake: '#C4A882',
    feeding: '#9B7BB8',
    diaper: '#C4A060',
    wake: '#5E93AF',
    success: '#9BB5A8',
    danger: '#D4847C',
    confidence: {
      low: '#D4847C',
      medium: '#C4A882',
      high: '#9BB5A8',
    },
    tabIconDefault: '#6B7280',
    tabIconSelected: '#9BB5A8',
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

// Default export for legacy template components
const DefaultColors = {
  light: {
    text: Colors.light.text,
    background: Colors.light.background,
    tint: Colors.light.tint,
    tabIconDefault: Colors.light.tabIconDefault,
    tabIconSelected: Colors.light.tabIconSelected,
  },
  dark: {
    text: Colors.dark.text,
    background: Colors.dark.background,
    tint: Colors.dark.tint,
    tabIconDefault: Colors.dark.tabIconDefault,
    tabIconSelected: Colors.dark.tabIconSelected,
  },
};

export default DefaultColors;
