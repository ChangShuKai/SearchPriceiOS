import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** 柔和漸層背景，讓 Liquid Glass 有可折射的內容。 */
export function GradientBackground() {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={theme.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
