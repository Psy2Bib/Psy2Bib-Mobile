import { MD3LightTheme, configureFonts, MD3Theme } from 'react-native-paper';

const primary = '#4a37e0';
const success = '#198754';
const info = '#0dcaf0';
const surface = '#f8f9fa';

const fontConfig = {
  config: {
    fontFamily: 'System',
  },
} as const;

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: configureFonts(fontConfig),
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary,
    secondary: success,
    tertiary: info,
    background: surface,
    surface,
    surfaceVariant: '#e9ecef',
    outline: '#ced4da',
  },
};
