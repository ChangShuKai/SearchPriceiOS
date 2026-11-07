import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const glassSupported =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export type GlassProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
  /** regular = 一般玻璃；clear = 更透明（適合疊在相機畫面上） */
  variant?: 'regular' | 'clear';
  interactive?: boolean;
  tintColor?: string;
};

/**
 * Apple 原生 Liquid Glass 容器（iOS 26+）。
 * 不支援的平台（Android、舊版 iOS）自動退回半透明背景。
 */
export function Glass({ style, variant = 'regular', interactive, tintColor, children, ...rest }: GlassProps) {
  const theme = useTheme();
  if (glassSupported) {
    return (
      <GlassView
        glassEffectStyle={variant}
        isInteractive={interactive}
        tintColor={tintColor}
        style={[styles.base, style]}
        {...rest}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        styles.base,
        styles.fallback,
        { backgroundColor: tintColor ?? theme.glassFallback, borderColor: theme.separator },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

export { glassSupported };

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  fallback: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
