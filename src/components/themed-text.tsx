import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Variant = 'largeTitle' | 'title' | 'headline' | 'body' | 'caption' | 'footnote' | 'price';

const VARIANTS: Record<Variant, TextProps['style']> = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17 },
  caption: { fontSize: 13 },
  footnote: { fontSize: 11 },
  price: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

export function ThemedText({
  variant = 'body',
  secondary,
  style,
  ...rest
}: TextProps & { variant?: Variant; secondary?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      style={[VARIANTS[variant], { color: secondary ? theme.textSecondary : theme.text }, style]}
      {...rest}
    />
  );
}
