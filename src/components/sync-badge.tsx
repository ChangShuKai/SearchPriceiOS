import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Glass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSyncState } from '@/hooks/use-sync-state';
import { useTheme } from '@/hooks/use-theme';
import { syncNow } from '@/lib/sync';
import { relativeTime } from '@/lib/utils';

/** 顯示同步狀態與離線資料庫筆數，點擊立即同步下載 */
export function SyncBadge({ onCamera = true }: { onCamera?: boolean }) {
  const theme = useTheme();
  const s = useSyncState();
  const color = onCamera ? '#fff' : theme.text;

  let icon: { ios: 'arrow.triangle.2.circlepath' | 'checkmark.icloud' | 'exclamationmark.icloud' | 'icloud.slash'; android: 'sync' | 'cloud_done' | 'cloud_off' | 'error' };
  let label: string;
  switch (s.status) {
    case 'syncing':
      icon = { ios: 'arrow.triangle.2.circlepath', android: 'sync' };
      label = '下載同步中…';
      break;
    case 'error':
      icon = { ios: 'exclamationmark.icloud', android: 'error' };
      label = s.totalOfflineCount > 0 ? `離線 ${s.totalOfflineCount} 筆 (未連網)` : '同步失敗';
      break;
    case 'offline':
      icon = { ios: 'icloud.slash', android: 'cloud_off' };
      label = s.totalOfflineCount > 0 ? `離線庫 ${s.totalOfflineCount} 筆` : '本地模式';
      break;
    default:
      icon = { ios: 'checkmark.icloud', android: 'cloud_done' };
      label = s.totalOfflineCount > 0 ? `離線庫 ${s.totalOfflineCount} 筆` : (s.lastSyncedAt ? relativeTime(s.lastSyncedAt) : '離線就緒');
  }

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void syncNow();
  };

  return (
    <Glass variant={onCamera ? 'clear' : 'regular'} interactive style={styles.pill}>
      <Pressable style={styles.inner} onPress={handlePress}>
        <SymbolView name={icon} size={16} tintColor={s.status === 'error' ? theme.danger : color} />
        <ThemedText variant="caption" style={{ color }}>
          {label}
          {s.pending > 0 ? ` · ${s.pending} 待傳` : ''}
        </ThemedText>
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: Radius.pill },
  inner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2, paddingHorizontal: 12, paddingVertical: 8 },
});
