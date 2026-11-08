import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraPermission } from '@/components/camera-permission';
import { Glass } from '@/components/glass';
import { GradientBackground } from '@/components/gradient-background';
import { NameSuggestions, type Suggestion } from '@/components/name-suggestions';
import { ScanFrame } from '@/components/scan-frame';
import { StorePicker, type SelectedStore } from '@/components/store-picker';
import { SyncBadge } from '@/components/sync-badge';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countMyUploads, getProductNamesForBarcode, insertLocalReport, searchProductNames } from '@/lib/db';
import { detectNearbyStores, type NearbyStore } from '@/lib/location';
import { isExpoGo, isOcrAvailable, recognizeProductText } from '@/lib/ocr';
import { contributeToOpenFoodFacts, fetchOpenFoodFacts } from '@/lib/openfoodfacts';
import { syncNow } from '@/lib/sync';
import { getDeviceId, isValidBarcode, newId, PRODUCT_BARCODE_TYPES } from '@/lib/utils';

export default function AddScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [focused, setFocused] = useState(true);

  // 表單欄位
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [store, setStore] = useState<SelectedStore | null>(null);

  // 輔助狀態
  const [nameFocused, setNameFocused] = useState(false);
  const [barcodeInfo, setBarcodeInfo] = useState<{ code: string; names: string[]; off: string | null }>({
    code: '',
    names: [],
    off: null,
  });
  const [search, setSearch] = useState<string[]>([]);
  const [nearby, setNearby] = useState<NearbyStore[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [locMessage, setLocMessage] = useState<string>();
  const [ocrBusy, setOcrBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [prevParam, setPrevParam] = useState<string | undefined>(undefined);
  const [myUploadCount, setMyUploadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void countMyUploads().then(setMyUploadCount);
      return () => setFocused(false);
    }, []),
  );

  // 從比價頁帶入條碼（render 期間依參數調整 state）
  if (params.barcode !== prevParam) {
    setPrevParam(params.barcode);
    if (params.barcode && isValidBarcode(params.barcode)) setBarcode(params.barcode);
  }

  // GPS 偵測所在門市
  const applyDetect = useCallback((res: Awaited<ReturnType<typeof detectNearbyStores>>) => {
    setCoords(res.coords);
    setNearby(res.stores);
    setLocMessage(res.error);
    const nearest = res.stores[0];
    if (nearest) setStore({ chain: nearest.chain, name: nearest.name });
  }, []);

  const runDetect = useCallback(
    () =>
      detectNearbyStores()
        .then(applyDetect)
        .catch(() => setLocMessage('無法取得定位，請手動選擇通路'))
        .finally(() => setDetecting(false)),
    [applyDetect],
  );

  const detectStore = useCallback(() => {
    setDetecting(true);
    setLocMessage(undefined);
    void runDetect();
  }, [runDetect]);

  useEffect(() => {
    void runDetect();
  }, [runDetect]);

  // 條碼變更時：載入此條碼常用名稱 + Open Food Facts 名稱
  useEffect(() => {
    if (!isValidBarcode(barcode)) return;
    const ctrl = new AbortController();
    void getProductNamesForBarcode(barcode).then((list) => {
      if (ctrl.signal.aborted) return;
      setBarcodeInfo((prev) => ({ code: barcode, names: list, off: prev.code === barcode ? prev.off : null }));
      setName((cur) => cur || list[0] || '');
    });
    fetchOpenFoodFacts(barcode, ctrl.signal)
      .then((p) => {
        if (!p?.name) return;
        const label = p.quantity && !p.name.includes(p.quantity) ? `${p.name} ${p.quantity}` : p.name;
        setBarcodeInfo((prev) => ({ code: barcode, names: prev.code === barcode ? prev.names : [], off: label }));
        setName((cur) => cur || label);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [barcode]);

  // 名稱輸入時查詢資料庫建議
  useEffect(() => {
    const q = name.trim();
    if (!q) return;
    const t = setTimeout(() => void searchProductNames(q).then(setSearch), 150);
    return () => clearTimeout(t);
  }, [name]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const barcodeNames = barcodeInfo.code === barcode ? barcodeInfo.names : [];
    const offName = barcodeInfo.code === barcode ? barcodeInfo.off : null;
    const searchResults = name.trim() ? search : [];
    const seen = new Set<string>([name.trim()]);
    const out: Suggestion[] = [];
    const push = (label: string | null | undefined, source: Suggestion['source']) => {
      if (!label || seen.has(label)) return;
      seen.add(label);
      out.push({ label, source });
    };
    barcodeNames.forEach((n) => push(n, 'barcode'));
    push(offName, 'off');
    searchResults.forEach((n) => push(n, 'search'));
    return out.slice(0, 8);
  }, [barcodeInfo, barcode, search, name]);

  const onScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (!isValidBarcode(data) || data === barcode) return;
      void Haptics.selectionAsync();
      setBarcode(data);
      setName('');
      setJustSaved(null);
    },
    [barcode],
  );

  // 拍照 → 本地 OCR → 填入名稱與價格
  const runOcr = useCallback(async () => {
    if (!isOcrAvailable) {
      Alert.alert(
        '文字辨識未啟用',
        isExpoGo
          ? '本地文字辨識需要原生模組，Expo Go 無法載入。\n請先手動輸入，或使用 Development Build（npx expo run:ios）後即可啟用。'
          : '找不到文字辨識模組，請重新建置 App。',
      );
      return;
    }
    if (!cameraRef.current || ocrBusy) return;
    setOcrBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (!photo) throw new Error('拍照失敗');
      const res = await recognizeProductText(photo.uri);
      if (res.name) setName(res.name);
      if (res.price != null) setPrice(String(res.price));
      void Haptics.notificationAsync(
        res.name || res.price != null ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      );
      if (!res.name && res.price == null) Alert.alert('辨識不到文字', '請將價格標籤置中、靠近一點再試一次。');
    } catch (e) {
      Alert.alert('辨識失敗', e instanceof Error ? e.message : String(e));
    } finally {
      setOcrBusy(false);
    }
  }, [ocrBusy]);

  // 拍照商品圖片
  const takeProductPhoto = async () => {
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setImageUri(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('無法開啟相機', e instanceof Error ? e.message : String(e));
    }
  };

  // 從相簿挑選商品圖片
  const pickProductImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!res.canceled && res.assets[0]?.uri) {
        setImageUri(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('無法存取相簿', e instanceof Error ? e.message : String(e));
    }
  };

  const priceNum = Number(price);
  const canSubmit =
    isValidBarcode(barcode) && name.trim().length > 0 && Number.isFinite(priceNum) && priceNum > 0 && !!store && !submitting;

  const submit = async () => {
    if (!canSubmit || !store) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const reportedAt = new Date();
      await insertLocalReport({
        id: newId(),
        barcode,
        product_name: name.trim(),
        price: Math.round(priceNum * 100) / 100,
        store_chain: store.chain.id,
        store_name: store.name,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        reported_at: reportedAt.toISOString(),
        device_id: await getDeviceId(),
        image_url: imageUri ?? null,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void syncNow();
      // 同步回饋至開放資料庫，豐富往後的條碼庫
      void contributeToOpenFoodFacts(barcode, name.trim());
      setJustSaved(barcode);
      setMyUploadCount((c) => c + 1);
      setPrice('');
      setName('');
      setBarcode('');
      setImageUri(null);
    } catch (e) {
      Alert.alert('儲存失敗', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission) return <View style={styles.flex} />;
  if (!permission.granted) {
    return (
      <CameraPermission
        canAskAgain={permission.canAskAgain}
        onRequest={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <GradientBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.two, paddingBottom: BottomTabInset + insets.bottom + Spacing.four },
          ]}>
          <View style={styles.titleRow}>
            <ThemedText variant="largeTitle">新增價格</ThemedText>
            <View style={styles.headerRight}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push('/my-uploads' as any);
                }}
                style={({ pressed }) => [
                  styles.myUploadsBtn,
                  { backgroundColor: theme.tint + '18', opacity: pressed ? 0.7 : 1 },
                ]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="我的上傳">
                <SymbolView
                  name={{ ios: 'clock.arrow.circlepath', android: 'history' }}
                  size={15}
                  tintColor={theme.tint}
                />
                <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700' }}>
                  我的上傳
                </ThemedText>
                {myUploadCount > 0 && (
                  <View style={[styles.uploadBadge, { backgroundColor: theme.tint }]}>
                    <ThemedText variant="footnote" style={styles.uploadBadgeText}>
                      {myUploadCount > 99 ? '99+' : myUploadCount}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
              <SyncBadge onCamera={false} />
            </View>
          </View>

            {/* 相機：掃條碼 + 拍照辨識 */}
            <View style={styles.cameraBox}>
              {focused && (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODE_TYPES] }}
                  onBarcodeScanned={onScanned}
                />
              )}
              <View style={styles.cameraCenter} pointerEvents="none">
                <ScanFrame width={200} height={100} active={isValidBarcode(barcode)} />
              </View>
              <Glass interactive variant="clear" style={styles.shutter}>
                <Pressable style={styles.shutterInner} onPress={runOcr} disabled={ocrBusy}>
                  {ocrBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <SymbolView name={{ ios: 'text.viewfinder', android: 'document_scanner' }} size={16} tintColor="#fff" />
                      <ThemedText variant="caption" style={[styles.white, { fontWeight: '600' }]}>
                        辨識文字
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </Glass>
            </View>

          {justSaved && (
            <Glass style={styles.saved} tintColor={theme.success + '33'}>
              <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={22} tintColor={theme.success} />
              <ThemedText style={styles.flex}>已儲存，感謝你的回報！</ThemedText>
              <Pressable
                onPress={() => router.push({ pathname: '/product/[barcode]', params: { barcode: justSaved } })}
                hitSlop={8}>
                <ThemedText variant="headline" style={{ color: theme.tint }}>
                  查看比價
                </ThemedText>
              </Pressable>
            </Glass>
          )}

          {/* 表單：每一行對應一個欄位 */}
          <Glass style={styles.form}>
            <FieldRow icon={{ ios: 'barcode', android: 'barcode' }} label="條碼">
              <TextInput
                value={barcode}
                onChangeText={(t) => setBarcode(t.replace(/\D/g, ''))}
                placeholder="掃描或手動輸入"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={14}
                style={[styles.input, styles.mono, { color: theme.text }]}
              />
            </FieldRow>
            <Divider />
            <FieldRow icon={{ ios: 'shippingbox', android: 'inventory_2' }} label="商品名稱">
              <TextInput
                value={name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setTimeout(() => setNameFocused(false), 150)}
                placeholder="例如：麥香紅茶 300ml"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                style={[styles.input, { color: theme.text }]}
              />
            </FieldRow>
            {(nameFocused || (!name && suggestions.length > 0)) && (
              <NameSuggestions
                items={suggestions}
                onSelect={(label) => {
                  setName(label);
                  setNameFocused(false);
                  Keyboard.dismiss();
                }}
              />
            )}
            <Divider />
            <FieldRow icon={{ ios: 'dollarsign.circle', android: 'payments' }} label="價格">
              <View style={styles.priceWrap}>
                <ThemedText variant="headline" secondary>
                  NT$
                </ThemedText>
                <TextInput
                  value={price}
                  onChangeText={(t) => setPrice(t.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  maxLength={8}
                  style={[styles.input, styles.priceInput, { color: theme.text }]}
                />
              </View>
            </FieldRow>
            <Divider />
            <View style={styles.storeRow}>
              <View style={styles.fieldLabel}>
                <SymbolView name={{ ios: 'storefront', android: 'storefront' }} size={18} tintColor={theme.tint} />
                <ThemedText variant="caption" secondary>
                  通路
                </ThemedText>
              </View>
              <StorePicker
                value={store}
                nearby={nearby}
                detecting={detecting}
                message={locMessage}
                onSelect={(s) => setStore(s)}
                onRefresh={() => void detectStore()}
              />
            </View>
            <Divider />
            {/* 商品圖片：極簡縮圖膠囊 */}
            <View style={styles.imageSection}>
              <View style={styles.fieldLabel}>
                <SymbolView name={{ ios: 'photo', android: 'photo' }} size={18} tintColor={theme.tint} />
                <ThemedText variant="caption" secondary>
                  商品圖片
                </ThemedText>
              </View>
              <View style={styles.imageActions}>
                {imageUri ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image source={imageUri} style={styles.imagePreview} contentFit="cover" />
                    <Pressable style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                      <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={18} tintColor={theme.danger} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.imageBtnRow}>
                    <Pressable style={[styles.imgBtn, { backgroundColor: theme.tint + '12' }]} onPress={takeProductPhoto}>
                      <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera' }} size={14} tintColor={theme.tint} />
                      <ThemedText variant="footnote" style={{ color: theme.tint, fontWeight: '600' }}>
                        拍照
                      </ThemedText>
                    </Pressable>
                    <Pressable style={[styles.imgBtn, { backgroundColor: theme.tint + '12' }]} onPress={pickProductImage}>
                      <SymbolView name={{ ios: 'photo.on.rectangle', android: 'image' }} size={14} tintColor={theme.tint} />
                      <ThemedText variant="footnote" style={{ color: theme.tint, fontWeight: '600' }}>
                        相簿
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </Glass>

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.submit, { backgroundColor: theme.tint, opacity: canSubmit ? 1 : 0.4 }]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText variant="headline" style={styles.white}>
                送出價格
              </ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldRow({
  icon,
  label,
  children,
}: {
  icon: React.ComponentProps<typeof SymbolView>['name'];
  label: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabel}>
        <SymbolView name={icon} size={18} tintColor={theme.tint} />
        <ThemedText variant="caption" secondary>
          {label}
        </ThemedText>
      </View>
      <View style={styles.fieldValue}>{children}</View>
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator }} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: '#fff' },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  myUploadsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  uploadBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  uploadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  cameraBox: { height: 180, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  cameraCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  cameraHint: { position: 'absolute', top: 10, left: 10, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  shutter: { position: 'absolute', bottom: 10, alignSelf: 'center', borderRadius: Radius.pill },
  shutterInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center' },
  saved: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md },
  form: { borderRadius: Radius.lg, paddingHorizontal: Spacing.three, paddingVertical: 2 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: Spacing.two },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 84 },
  fieldValue: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 1 },
  priceWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceInput: { fontSize: 20, fontWeight: '700' },
  imageSection: { paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  imageActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  imagePreviewWrap: { position: 'relative' },
  imagePreview: { width: 44, height: 44, borderRadius: Radius.sm },
  removeImageBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: '#fff', borderRadius: 9 },
  imageBtnRow: { flexDirection: 'row', gap: 8 },
  imgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: Spacing.two },
  submit: { height: 50, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
