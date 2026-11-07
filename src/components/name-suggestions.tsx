import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Suggestion = { label: string; source: 'barcode' | 'off' | 'search' };

/** 商品名稱建議清單：輸入「麥香紅茶」→ 顯示資料庫中的完整名稱供選擇 */
export function NameSuggestions({
  items,
  onSelect,
}: {
  items: Suggestion[];
  onSelect: (label: string) => void;
}) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={[styles.box, { borderColor: theme.separator }]}>
      {items.map((s, i) => (
        <Pressable
          key={`${s.label}-${i}`}
          onPress={() => onSelect(s.label)}
          style={({ pressed }) => [
            styles.item,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
            pressed && { opacity: 0.6 },
          ]}>
          <ThemedText style={styles.flex} numberOfLines={1}>
            {s.label}
          </ThemedText>
          <ThemedText variant="footnote" secondary>
            {s.source === 'barcode' ? '此條碼常用' : s.source === 'off' ? 'Open Food Facts' : '資料庫'}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export type { Suggestion };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
