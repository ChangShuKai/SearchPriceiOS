import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Glass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSyncState } from '@/hooks/use-sync-state';
import { useTheme } from '@/hooks/use-theme';
import { syncNow } from '@/lib/sync';

/** 顯示雲端與本地資料庫筆數，點擊可手動觸發同步 */
export function SyncBadge({ onCamera = true }: { onCamera?: boolean }) {
  const theme = useTheme();
  const s = useSyncState();
  const color = onCamera ? '#fff' : theme.text;
  const formattedCount = s.totalOfflineCount.toLocaleString();

  let icon: {
    ios: 'arrow.triangle.2.circlepath' | 'checkmark.icloud.fill' | 'exclamationmark.icloud' | 'icloud.slash';
    android: 'sync' | 'cloud_done' | 'cloud_off' | 'error';
  };
  let label: string;
  switch (s.status) {
    case 'syncing':
      icon = { ios: 'arrow.triangle.2.circlepath', android: 'sync' };
      label = `同步中 · ${formattedCount} 筆`;
      break;
    case 'offline':
      icon = { ios: 'icloud.slash', android: 'cloud_off' };
      label = `離線庫 ${formattedCount} 筆`;
      break;
    default:
      icon = { ios: 'checkmark.icloud.fill', android: 'cloud_done' };
      label = `比價庫 ${formattedCount} 筆`;
  }

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void syncNow(true);
  };

  return (
    <Glass variant={onCamera ? 'clear' : 'regular'} interactive style={styles.pill}>
      <Pressable style={styles.inner} onPress={handlePress}>
        <SymbolView name={icon} size={16} tintColor={s.status === 'idle' ? '#34C759' : color} />
        <ThemedText variant="caption" style={{ color, fontWeight: '600' }}>
          {label}
          {s.pending > 0 ? ` · ${s.pending} 待傳` : ''}
        </ThemedText>
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: Radius.pill },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
