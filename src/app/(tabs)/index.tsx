import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraPermission } from '@/components/camera-permission';
import { Glass } from '@/components/glass';
import { BarcodeTrackingFrame, ScanFrame, type TargetBox } from '@/components/scan-frame';
import { SyncBadge } from '@/components/sync-badge';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidBarcode, PRODUCT_BARCODE_TYPES } from '@/lib/utils';

export default function ScanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [locked, setLocked] = useState(false);
  const [detectedBox, setDetectedBox] = useState<TargetBox | null>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const [cameraActive, setCameraActive] = useState(true);

  // 頁面切換優化：保持主相機生命週期熱啟動，只在離開時暫停辨識，避免硬體頻繁釋放與重啟
  useFocusEffect(
    useCallback(() => {
      setCameraActive(true);
      setLocked(false);
      setDetectedBox(null);
      return () => {
        setLocked(true); // 離開時鎖住，防止背景掃描
      };
    }, []),
  );

  const openProduct = useCallback((code: string, bounds?: BarcodeScanningResult['bounds']) => {
    setLocked(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (bounds?.origin && bounds?.size && bounds.size.width > 0 && bounds.size.height > 0) {
      setDetectedBox({
        x: bounds.origin.x,
        y: bounds.origin.y,
        width: bounds.size.width,
        height: bounds.size.height,
      });
      // 貼合動畫停留約 260ms 後再彈出比價面板（如同微信掃碼對齊效果）
      setTimeout(() => {
        router.push({ pathname: '/product/[barcode]', params: { barcode: code } });
      }, 260);
    } else {
      router.push({ pathname: '/product/[barcode]', params: { barcode: code } });
    }
  }, []);

  const onScanned = useCallback(
    ({ data, bounds }: BarcodeScanningResult) => {
      if (locked || !isValidBarcode(data)) return;
      const now = Date.now();
      if (lastScan.current && lastScan.current.code === data && now - lastScan.current.at < 2500) return;
      lastScan.current = { code: data, at: now };
      openProduct(data, bounds);
    },
    [locked, openProduct],
  );

  if (!permission) return <View style={styles.flex} />;
  if (!permission.granted) {
    return (
      <CameraPermission
        canAskAgain={permission.canAskAgain}
        onRequest={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
      />
    );
  }

  const frameW = Math.min(width - 64, 340);
  const frameH = frameW * 0.62;

  return (
    <View style={styles.flex}>
      {cameraActive && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODE_TYPES] }}
          onBarcodeScanned={locked ? undefined : onScanned}
        />
      )}
      <View style={styles.dim} pointerEvents="none" />

      {/* 頂部標題列 */}
      <View style={[styles.top, { paddingTop: insets.top + Spacing.two }]}>
        <Glass variant="clear" style={styles.titlePill}>
          <SymbolView name={{ ios: 'tag.fill', android: 'sell' }} size={18} tintColor="#fff" />
          <ThemedText variant="headline" style={styles.white}>
            Search Price
          </ThemedText>
        </Glass>
        <SyncBadge />
      </View>

      {/* 掃描框 */}
      <View style={styles.center} pointerEvents="none">
        <ScanFrame width={frameW} height={frameH} active={locked} />
        {!detectedBox && (
          <Glass variant="clear" style={styles.hint}>
            <ThemedText variant="caption" style={styles.white}>
              將商品條碼對準框內，自動查詢各通路價格
            </ThemedText>
          </Glass>
        )}
      </View>

      {/* 微信風格：辨識成功時移動並貼合條碼實體邊界 */}
      {detectedBox && (
        <BarcodeTrackingFrame target={detectedBox} />
      )}

      {/* 底部控制 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.bottom, { bottom: BottomTabInset + insets.bottom + 8 }]}>
        {manual ? (
          <Glass style={styles.manualCard}>
            <TextInput
              value={manualCode}
              onChangeText={(t) => setManualCode(t.replace(/\D/g, ''))}
              placeholder="輸入條碼數字"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={14}
              autoFocus
              style={[styles.manualInput, { color: theme.text }]}
            />
            <Pressable
              disabled={!isValidBarcode(manualCode)}
              onPress={() => {
                Keyboard.dismiss();
                setManual(false);
                openProduct(manualCode);
              }}
              style={[styles.goBtn, { backgroundColor: theme.tint, opacity: isValidBarcode(manualCode) ? 1 : 0.4 }]}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search' }} size={20} tintColor="#fff" />
            </Pressable>
            <Pressable onPress={() => setManual(false)} hitSlop={10}>
              <SymbolView name={{ ios: 'xmark.circle.fill', android: 'close' }} size={24} tintColor={theme.textSecondary} />
            </Pressable>
          </Glass>
        ) : (
          <View style={styles.controls}>
            <Glass interactive style={styles.roundBtn}>
              <Pressable style={styles.roundInner} onPress={() => setTorch((v) => !v)}>
                <SymbolView
                  name={{ ios: torch ? 'flashlight.on.fill' : 'flashlight.off.fill', android: torch ? 'flashlight_on' : 'flashlight_off' }}
                  size={22}
                  tintColor={torch ? '#FFD60A' : theme.text}
                />
              </Pressable>
            </Glass>
            <Glass interactive style={styles.wideBtn}>
              <Pressable style={styles.wideInner} onPress={() => setManual(true)}>
                <SymbolView name={{ ios: 'keyboard', android: 'keyboard' }} size={20} tintColor={theme.text} />
                <ThemedText variant="headline">手動輸入條碼</ThemedText>
              </Pressable>
            </Glass>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  white: { color: '#fff' },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  hint: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    marginTop: Spacing.two,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
  },
  controls: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  roundBtn: { width: 56, height: 56, borderRadius: 28 },
  roundInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wideBtn: { height: 56, borderRadius: 28, flex: 1, maxWidth: 260 },
  wideInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  manualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    height: 60,
    borderRadius: 30,
  },
  manualInput: { flex: 1, fontSize: 20, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  goBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
