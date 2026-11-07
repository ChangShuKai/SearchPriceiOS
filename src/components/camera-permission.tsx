import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { GradientBackground } from '@/components/gradient-background';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 尚未取得相機權限時的畫面 */
export function CameraPermission({ onRequest, canAskAgain }: { onRequest: () => void; canAskAgain: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <GradientBackground />
      <Glass style={styles.card}>
        <SymbolView name={{ ios: 'camera.viewfinder', android: 'photo_camera' }} size={48} tintColor={theme.tint} />
        <ThemedText variant="title">需要相機權限</ThemedText>
        <ThemedText secondary style={styles.center}>
          Search Price 需要使用相機來掃描商品條碼與辨識價格標籤。
        </ThemedText>
        <Pressable onPress={onRequest} style={[styles.button, { backgroundColor: theme.tint }]}>
          <ThemedText variant="headline" style={{ color: '#fff' }}>
            {canAskAgain ? '允許使用相機' : '前往設定開啟'}
          </ThemedText>
        </Pressable>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  card: { padding: Spacing.four, gap: Spacing.three, alignItems: 'center', borderRadius: Radius.lg, alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  button: { paddingVertical: 14, paddingHorizontal: Spacing.four, borderRadius: Radius.pill, marginTop: Spacing.two },
});
