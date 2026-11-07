import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B0B0F',
    textSecondary: '#5E616B',
    tint: '#0A84FF',
    success: '#1FA855',
    danger: '#E5484D',
    background: '#F2F4F8',
    gradient: ['#DCE9FF', '#F4ECFF', '#FFEFE3'] as const,
    glassFallback: 'rgba(255,255,255,0.72)',
    separator: 'rgba(60,60,67,0.18)',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A6A9B2',
    tint: '#4DA3FF',
    success: '#3DD27A',
    danger: '#FF6369',
    background: '#000000',
    gradient: ['#0B1530', '#1A1030', '#2A140C'] as const,
    glassFallback: 'rgba(40,40,46,0.72)',
    separator: 'rgba(235,235,245,0.18)',
  },
} as const;

export type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
} as const;

/** Height reserved for the floating native tab bar. */
export const BottomTabInset = Platform.select({ ios: 110, android: 116 }) ?? 0;
