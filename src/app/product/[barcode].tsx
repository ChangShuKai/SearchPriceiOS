import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, glassSupported } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { getChain } from '@/constants/stores';
import { getStoreIcon } from '@/constants/store-icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getLatestPricesByChain, getProductNamesForBarcode, type PriceReport } from '@/lib/db';
import { fetchOpenFoodFacts, type OffProduct } from '@/lib/openfoodfacts';
import { fetchRemoteBarcode } from '@/lib/sync';
import { getExpiringDiscountInfo } from '@/lib/discount-service';
import { formatDate, formatPrice, relativeTime } from '@/lib/utils';

type Row = PriceReport & { report_count: number };
type OffState = { loading: boolean; product: OffProduct | null; error?: string };

export default function ProductScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [off, setOff] = useState<OffState>({ loading: true, product: null });

  const fetchLocal = useCallback(
    () => Promise.all([getLatestPricesByChain(barcode), getProductNamesForBarcode(barcode)]),
    [barcode],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const apply = ([r, n]: [Row[], string[]]) => {
      if (ctrl.signal.aborted) return;
      setRows(r);
      setNames(n);
    };
    // 1) 本地資料庫：立即顯示
    fetchLocal()
      .then(apply)
      .finally(() => setLocalLoading(false));
    // 2) Supabase：抓這個條碼的最新資料後重新整理
    fetchRemoteBarcode(barcode)
      .then(fetchLocal)
      .then(apply)
      .catch(() => {})
      .finally(() => setRemoteLoading(false));
    // 3) Open Food Facts：同時查詢
    fetchOpenFoodFacts(barcode, ctrl.signal)
      .then((product) => setOff({ loading: false, product }))
      .catch((e) => {
        if (!ctrl.signal.aborted) setOff({ loading: false, product: null, error: String(e?.message ?? e) });
      });
    return () => ctrl.abort();
  }, [barcode, fetchLocal]);

  const title = names[0] ?? off.product?.name ?? (off.loading ? '查詢中…' : '未知商品');
  const cheapest = rows[0]?.price;
  const mostExpensive = rows[rows.length - 1]?.price;

  const goAdd = () => {
    router.back();
    router.navigate({ pathname: '/add', params: { barcode } });
  };

  /** 開啟地圖搜尋最近的該品牌店家（例如最近的「全家」） */
  const navigateToStore = (r: Row) => {
    const chain = getChain(r.store_chain);
    // 依據通路品牌名稱搜尋距離使用者當下最近的該店（如 "全家"、"7-Eleven"、"全聯"）
    const searchTarget = chain.id === 'other' ? (r.store_name || '超商') : chain.name;
    const query = encodeURIComponent(searchTarget);

    if (Platform.OS === 'ios') {
      // Apple Maps: maps://?q=全家 會直接以使用者目前所在位置為中心，搜尋並列出離自己最近的全家
      const appleMapsUrl = `maps://?q=${query}`;
      void Linking.openURL(appleMapsUrl).catch(() => {
        void Linking.openURL(`https://maps.apple.com/?q=${query}`);
      });
    } else {
      const geoUrl = `geo:0,0?q=${query}`;
      void Linking.openURL(geoUrl).catch(() => {
        void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      });
    }
  };

  const customImage = rows.find((r) => r.image_url)?.image_url;
  const productImage = customImage ?? off.product?.imageUrl;

  const basePriceForDiscount = rows[0]?.price ?? (rows.length > 0 ? rows[0].price : 39);
  const discountInfo = getExpiringDiscountInfo(title, basePriceForDiscount);

  return (
    <View style={[styles.flex, !glassSupported && { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}
        contentInsetAdjustmentBehavior="automatic">
        {/* 商品資訊 */}
        <View style={styles.header}>
          <Glass style={styles.imageBox}>
            {productImage ? (
              <Image source={productImage} style={styles.image} contentFit="contain" transition={200} />
            ) : (
              <SymbolView name={{ ios: 'shippingbox', android: 'inventory_2' }} size={36} tintColor={theme.textSecondary} />
            )}
          </Glass>
          <View style={styles.headerText}>
            <ThemedText variant="title" numberOfLines={3}>
              {title}
            </ThemedText>
            <ThemedText variant="caption" secondary style={styles.mono}>
              {barcode}
            </ThemedText>
            {rows.length > 1 && cheapest != null && mostExpensive != null && mostExpensive > cheapest && (
              <ThemedText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
                最多可省 {formatPrice(mostExpensive - cheapest)}
              </ThemedText>
            )}
          </View>
        </View>

        {/* 即期特惠試算卡 (i珍食 65折 / 友善時光 7折) */}
        {discountInfo.isDiscountable && rows.length > 0 && (
          <Glass style={styles.expiringCard}>
            <View style={styles.expiringCardHeader}>
              <View style={styles.expiringTitleRow}>
                <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department' }} size={16} tintColor="#FF3B30" />
                <ThemedText variant="headline" style={{ color: '#FF3B30', fontWeight: '700' }}>
                  超商即期限時特惠試算
                </ThemedText>
              </View>
              <ThemedText variant="caption" secondary>
                原價 {formatPrice(basePriceForDiscount)}
              </ThemedText>
            </View>

            <View style={styles.expiringRow}>
              <View style={styles.expiringPill}>
                <ThemedText variant="caption" secondary>
                  7-11 i珍食 (65折)
                </ThemedText>
                <ThemedText variant="headline" style={{ color: '#FF3B30', fontWeight: '800', fontSize: 18 }}>
                  {formatPrice(discountInfo.sevenElevenPrice)}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
                  現省 {formatPrice(discountInfo.savingsSeven)}
                </ThemedText>
              </View>

              <View style={[styles.expiringDivider, { backgroundColor: theme.separator }]} />

              <View style={styles.expiringPill}>
                <ThemedText variant="caption" secondary>
                  全家友善時光 (7折)
                </ThemedText>
                <ThemedText variant="headline" style={{ color: '#FF3B30', fontWeight: '800', fontSize: 18 }}>
                  {formatPrice(discountInfo.familyMartPrice)}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
                  現省 {formatPrice(discountInfo.savingsFamily)}
                </ThemedText>
              </View>
            </View>
          </Glass>
        )}

        {/* 各通路比價 */}
        <SectionTitle title="各通路價格" loading={remoteLoading} />
        {localLoading ? (
          <ActivityIndicator style={{ marginVertical: Spacing.four }} />
        ) : rows.length === 0 ? (
          <Glass style={styles.empty}>
            <SymbolView name={{ ios: 'tag.slash', android: 'money_off' }} size={32} tintColor={theme.textSecondary} />
            <ThemedText secondary style={styles.centerText}>
              目前還沒有人回報這項商品的價格
            </ThemedText>
            <Pressable onPress={goAdd} style={[styles.primaryBtn, { backgroundColor: theme.tint }]}>
              <ThemedText variant="headline" style={{ color: '#fff' }}>
                成為第一個回報的人
              </ThemedText>
            </Pressable>
          </Glass>
        ) : (
          <Glass style={styles.list}>
            {rows.map((r, i) => {
              const chain = getChain(r.store_chain);
              const isCheapest = r.price === cheapest && rows.length > 1;
              return (
                <View
                  key={r.id}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
                  <View style={[styles.chainDot, { backgroundColor: '#fff', overflow: 'hidden' }]}>
                    {getStoreIcon(chain.id) ? (
                      <Image source={getStoreIcon(chain.id)} style={styles.chainLogoImg} contentFit="contain" />
                    ) : (
                      <SymbolView name={chain.icon} size={18} tintColor={chain.color} />
                    )}
                  </View>
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <ThemedText variant="headline">{chain.name}</ThemedText>
                      {isCheapest && (
                        <View style={[styles.badge, { backgroundColor: theme.success }]}>
                          <ThemedText variant="footnote" style={styles.badgeText}>
                            最便宜
                          </ThemedText>
                        </View>
                      )}
                      <Pressable
                        style={[styles.navigateBtn, { backgroundColor: theme.tint + '14' }]}
                        onPress={() => navigateToStore(r)}
                        hitSlop={6}>
                        <SymbolView name={{ ios: 'arrow.triangle.turn.up.right.circle.fill', android: 'directions' }} size={13} tintColor={theme.tint} />
                        <ThemedText variant="footnote" style={{ color: theme.tint, fontWeight: '600' }}>
                          帶我去
                        </ThemedText>
                      </Pressable>
                    </View>
                    <ThemedText variant="caption" secondary numberOfLines={1}>
                      {r.store_name ? `${r.store_name} · ${r.product_name}` : r.product_name}
                    </ThemedText>
                    {/* 最後更新日期（小字） */}
                    <ThemedText variant="footnote" secondary>
                      最後更新 {formatDate(r.reported_at)}（{relativeTime(r.reported_at)}）· {r.report_count} 筆回報
                    </ThemedText>
                  </View>
                  <ThemedText variant="price" style={isCheapest ? { color: theme.success } : undefined}>
                    {formatPrice(r.price)}
                  </ThemedText>
                </View>
              );
            })}
          </Glass>
        )}

        {rows.length > 0 && (
          <Glass interactive style={styles.addMore}>
            <Pressable style={styles.addMoreInner} onPress={goAdd}>
              <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle' }} size={20} tintColor={theme.tint} />
              <ThemedText variant="headline" style={{ color: theme.tint }}>
                回報這家店的價格
              </ThemedText>
            </Pressable>
          </Glass>
        )}

        {/* Open Food Facts */}
        <SectionTitle title="Open Food Facts" loading={off.loading} />
        <Glass style={styles.offCard}>
          {off.loading ? (
            <ActivityIndicator />
          ) : off.product ? (
            <>
              <InfoRow label="名稱" value={off.product.name} />
              <InfoRow label="品牌" value={off.product.brand} />
              <InfoRow label="容量" value={off.product.quantity} />
              <InfoRow label="分類" value={off.product.categories} />
              <InfoRow label="Nutri-Score" value={off.product.nutriscore?.toUpperCase()} />
              <InfoRow label="販售國家" value={off.product.countries} />
              <Pressable onPress={() => void WebBrowser.openBrowserAsync(off.product!.url)} style={styles.link}>
                <ThemedText variant="caption" style={{ color: theme.tint }}>
                  在 Open Food Facts 查看完整資料 ›
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <ThemedText secondary style={styles.centerText}>
              {off.error ? `查詢失敗：${off.error}` : 'Open Food Facts 尚未收錄此商品'}
            </ThemedText>
          )}
        </Glass>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title, loading }: { title: string; loading?: boolean }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText variant="headline">{title}</ThemedText>
      {loading && <ActivityIndicator size="small" />}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <ThemedText variant="caption" secondary style={styles.infoLabel}>
        {label}
      </ThemedText>
      <ThemedText variant="caption" style={styles.infoValue} numberOfLines={3}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, paddingTop: Platform.OS === 'ios' ? Spacing.four : Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  imageBox: { width: 96, height: 96, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  image: { width: 88, height: 88 },
  headerText: { flex: 1, gap: Spacing.one },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  list: { borderRadius: Radius.lg, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 14 },
  chainDot: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  chainLogoImg: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  chainInitial: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rowMain: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontWeight: '700' },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  empty: { borderRadius: Radius.lg, padding: Spacing.four, alignItems: 'center', gap: Spacing.three },
  centerText: { textAlign: 'center' },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: Spacing.four, borderRadius: Radius.pill },
  addMore: { borderRadius: Radius.pill, alignSelf: 'center' },
  addMoreInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 12, paddingHorizontal: Spacing.four },
  offCard: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two },
  expiringCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  expiringCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expiringTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expiringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: Spacing.one,
  },
  expiringPill: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  expiringDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
  },
  infoRow: { flexDirection: 'row', gap: Spacing.three },
  infoLabel: { width: 80 },
  infoValue: { flex: 1 },
  link: { marginTop: Spacing.one },
});
