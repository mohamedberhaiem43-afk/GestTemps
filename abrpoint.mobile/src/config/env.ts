// Mobile app API configuration
// For physical device: use your machine's local IP address
// For Android emulator: 'http://10.0.2.2:5125/api'
// For web: 'http://localhost:5125/api'
// export const API_BASE_URL = 'http://192.168.1.57:5125/api';
export const API_BASE_URL = 'https://concorde-work-force.com/api';

export const COLORS = {
  primary: '#0040a1',
  primaryContainer: '#0056d2',
  onPrimary: '#ffffff',
  secondary: '#515f74',
  secondaryContainer: '#d5e3fc',
  onSecondary: '#ffffff',
  tertiary: '#005136',
  tertiaryContainer: '#006c49',
  onTertiary: '#ffffff',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  background: '#f7f9fb',
  onBackground: '#191c1e',
  surface: '#f7f9fb',
  onSurface: '#191c1e',
  surfaceVariant: '#e0e3e5',
  onSurfaceVariant: '#424654',
  outline: '#737785',
  outlineVariant: '#c3c6d6',
  inverseSurface: '#2d3133',
  inverseOnSurface: '#eff1f3',
  inversePrimary: '#b2c5ff',
  surfaceDim: '#d8dadc',
  surfaceBright: '#f7f9fb',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainer: '#eceef0',
  surfaceContainerHigh: '#e6e8ea',
  surfaceContainerHighest: '#e0e3e5',
  
  // Material 3 fixed tokens (accents fixes utilisés dans les badges & chips)
  primaryFixed: '#dae2ff',
  onPrimaryFixed: '#001a41',
  primaryFixedDim: '#b2c5ff',
  onPrimaryFixedVariant: '#0040a1',

  secondaryFixed: '#d5e3fc',
  onSecondaryFixed: '#0c1c2f',
  secondaryFixedDim: '#b8c9e0',
  onSecondaryFixedVariant: '#384759',

  tertiaryFixed: '#8df7c2',
  onTertiaryFixed: '#00210f',
  tertiaryFixedDim: '#71daa7',
  onTertiaryFixedVariant: '#005236',

  // Accent générique utilisé par certaines vues
  accent: '#0056d2',

  // Legacy or common aliases
  success: '#006c49',
  warning: '#b45309',
  text: '#191c1e',
  textSecondary: '#424654',
  textLight: '#ffffff',
  border: '#c3c6d6',
  disabled: '#94a3b8',
};

export const THEME = {
  ...COLORS,
  borderRadius: {
    default: 2,
    lg: 4,
    xl: 8,
    full: 12,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    title: 28,
  },
  fontFamily: {
    headline: 'Manrope',
    display: 'Manrope',
    body: 'Inter',
    label: 'Inter',
  }
};