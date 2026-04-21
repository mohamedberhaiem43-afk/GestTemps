// Mobile app API configuration
// For physical device: use your machine's local IP address
// For Android emulator: 'http://10.0.2.2:5125/api'
// For web: 'http://localhost:5125/api'
// export const API_BASE_URL = 'http://192.168.1.57:5125/api';
export const API_BASE_URL = 'http://141.94.42.138/api';

export const COLORS = {
  primary: '#1a237e',
  primaryLight: '#534bae',
  primaryDark: '#000051',
  secondary: '#0d47a1',
  accent: '#ff6f00',
  success: '#2e7d32',
  warning: '#f57f17',
  error: '#c62828',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#ffffff',
  border: '#e0e0e0',
  disabled: '#bdbdbd',
};

export const THEME = {
  ...COLORS,
  borderRadius: 12,
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
};