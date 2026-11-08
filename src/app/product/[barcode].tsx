import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, glassSupported } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { getStoreIcon } from '@/constants/store-icons';
import { getChain } from '@/constants/stores';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getInstantPricesByChain,
  getLatestPricesByChain,
  getProductNamesForBarcode,
  type PriceReport,
} from '@/lib/db';
import {
  getExpiringDiscountInfo,
  getInstantProductFoodSafety,
  type FoodSafetyDetail,
} from '@/lib/discount-service';
import { fetchOpenFoodFacts, type OffProduct } from '@/lib/openfoodfacts';
import { fetchRemoteBarcode } from '@/lib/sync';
import { formatDate, formatPrice, relativeTime } from '@/lib/utils';

type Row = PriceReport & { report_count: number };

export default function ProductScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 首幀 0ms 同步從記憶體母庫取得各通路比價與營養標示，完全不轉圈圈
  const [rows, setRows] = useState<Row[]>(() => getInstantPricesByChain(barcode));
  const [names, setNames] = useState<string[]>(() => {
    const initial = getInstantPricesByChain(barcode);
    return initial[0]?.product_name ? [initial[0].product_name] : [];
  });
  const [localLoading, setLocalLoading] = useState<boolean>(
    () => getInstantPricesByChain(barcode).length === 0,
  );
  const [offProduct, setOffProduct] = useState<OffProduct | null>(null);
  const [foodSafety, setFoodSafety] = useState<FoodSafetyDetail | null>(() => {
    const initial = getInstantPricesByChain(barcode);
    return getInstantProductFoodSafety(barcode, initial[0]?.product_name);
  });

  const fetchLocal = useCallback(
    () => Promise.all([getLatestPricesByChain(barcode), getProductNamesForBarcode(barcode)]),
    [barcode],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const apply = ([r, n]: [Row[], string[]]) => {
      if (ctrl.signal.aborted) return;
      if (r.length > 0) setRows(r);
      if (n.length > 0) setNames(n);
      const fsData = getInstantProductFoodSafety(barcode, n[0] ?? r[0]?.product_name);
      if (fsData) setFoodSafety(fsData);
    };

    // 1) 結合 SQLite 本地自訂回報
    fetchLocal()
      .then(apply)
      .finally(() => {
        if (!ctrl.signal.aborted) setLocalLoading(false);
      });

    // 2) 背景靜默同步雲端最新回報（不顯示阻擋式轉圈）
    fetchRemoteBarcode(barcode)
      .then(fetchLocal)
      .then(apply)
      .catch(() => {});

    // 3) 背景查詢 Open Food Facts（僅在有資料時顯示）
    fetchOpenFoodFacts(barcode, ctrl.signal)
      .then((product) => {
        if (!ctrl.signal.aborted && product) setOffProduct(product);
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [barcode, fetchLocal]);

  const title =
    names[0] ?? rows[0]?.product_name ?? offProduct?.name ?? (localLoading ? '載入商品中…' : '未知商品');
  const cheapest = rows[0]?.price;
  const mostExpensive = rows[rows.length - 1]?.price;

  const goAdd = () => {
    router.back();
    router.navigate({ pathname: '/add', params: { barcode } });
  };

  const navigateToStore = (r: Row) => {
    const chain = getChain(r.store_chain);
    const searchTarget = chain.id === 'other' ? r.store_name || '超商' : chain.name;
    const query = encodeURIComponent(searchTarget);

    if (Platform.OS === 'ios') {
      void Linking.openURL(`maps://?q=${query}`).catch(() => {
        void Linking.openURL(`https://maps.apple.com/?q=${query}`);
      });
    } else {
      void Linking.openURL(`geo:0,0?q=${query}`).catch(() => {
        void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      });
    }
  };

  const customImage = rows.find((r) => r.image_url)?.image_url;
  const productImage = customImage ?? offProduct?.imageUrl;

  const basePriceForDiscount = rows[0]?.price ?? 39;
  const availableChains = rows.map((r) => r.store_chain);
  const discountInfo = getExpiringDiscountInfo(
    title,
    basePriceForDiscount,
    barcode,
    availableChains,
  );

  return (
    <View style={[styles.flex, !glassSupported && { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}
        contentInsetAdjustmentBehavior="automatic">
        {/* 商品資訊 */}
        <View style={styles.header}>
          <Glass style={styles.imageBox}>
            {productImage ? (
              <Image source={productImage} style={styles.image} contentFit="contain" transition={150} />
            ) : (
              <SymbolView
                name={{ ios: 'shippingbox', android: 'inventory_2' }}
                size={36}
                tintColor={theme.textSecondary}
              />
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
              <ThemedText variant="caption" style={{ color: theme.success, fontWeight: '700' }}>
                跨通路比價最多可省 {formatPrice(mostExpensive - cheapest)}
              </ThemedText>
            )}
          </View>
        </View>

        {/* 即期特惠試算卡 (i珍食 65折 / 友善時光 7折) */}
        {discountInfo.isDiscountable && rows.length > 0 && (
          <Glass style={styles.expiringCard}>
            <View style={styles.expiringCardHeader}>
              <View style={styles.expiringTitleRow}>
                <SymbolView
                  name={{ ios: 'flame.fill', android: 'local_fire_department' }}
                  size={16}
                  tintColor="#FF3B30"
                />
                <ThemedText variant="headline" style={{ color: '#FF3B30', fontWeight: '700' }}>
                  超商即期限時特惠試算
                </ThemedText>
              </View>
              <ThemedText variant="caption" secondary>
                原價 {formatPrice(basePriceForDiscount)}
              </ThemedText>
            </View>

            <View style={styles.expiringRow}>
              {discountInfo.hasSevenEleven && (
                <View style={styles.expiringPill}>
                  <ThemedText variant="caption" secondary>
                    7-11 i珍食 (65折)
                  </ThemedText>
                  <ThemedText
                    variant="headline"
                    style={{ color: '#FF3B30', fontWeight: '800', fontSize: 18 }}>
                    {formatPrice(discountInfo.sevenElevenPrice)}
                  </ThemedText>
                  <ThemedText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
                    現省 {formatPrice(discountInfo.savingsSeven)}
                  </ThemedText>
                </View>
              )}

              {discountInfo.hasSevenEleven && discountInfo.hasFamilyMart && (
                <View style={[styles.expiringDivider, { backgroundColor: theme.separator }]} />
              )}

              {discountInfo.hasFamilyMart && (
                <View style={styles.expiringPill}>
                  <ThemedText variant="caption" secondary>
                    全家友善時光 (7折)
                  </ThemedText>
                  <ThemedText
                    variant="headline"
                    style={{ color: '#FF3B30', fontWeight: '800', fontSize: 18 }}>
                    {formatPrice(discountInfo.familyMartPrice)}
                  </ThemedText>
                  <ThemedText variant="caption" style={{ color: theme.success, fontWeight: '600' }}>
                    現省 {formatPrice(discountInfo.savingsFamily)}
                  </ThemedText>
                </View>
              )}
            </View>
          </Glass>
        )}

        {/* 各通路比價 */}
        <SectionTitle title="各通路價格" />
        {localLoading && rows.length === 0 ? (
          <ActivityIndicator style={{ marginVertical: Spacing.four }} />
        ) : rows.length === 0 ? (
          <Glass style={styles.empty}>
            <SymbolView
              name={{ ios: 'tag.slash', android: 'money_off' }}
              size={32}
              tintColor={theme.textSecondary}
            />
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
                  key={r.id || `${r.store_chain}_${i}`}
                  style={[
                    styles.row,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.separator,
                    },
                  ]}>
                  <View style={[styles.chainDot, { backgroundColor: '#fff', overflow: 'hidden' }]}>
                    {getStoreIcon(chain.id) ? (
                      <Image
                        source={getStoreIcon(chain.id)}
                        style={styles.chainLogoImg}
                        contentFit="contain"
                      />
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
                        <SymbolView
                          name={{
                            ios: 'arrow.triangle.turn.up.right.circle.fill',
                            android: 'directions',
                          }}
                          size={13}
                          tintColor={theme.tint}
                        />
                        <ThemedText variant="footnote" style={{ color: theme.tint, fontWeight: '600' }}>
                          帶我去
                        </ThemedText>
                      </Pressable>
                    </View>
                    <ThemedText variant="caption" secondary numberOfLines={1}>
                      {r.store_name ? `${r.store_name} · ${r.product_name}` : r.product_name}
                    </ThemedText>
                    <ThemedText variant="footnote" secondary>
                      最後更新 {formatDate(r.reported_at)}（{relativeTime(r.reported_at)}）
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
              <SymbolView
                name={{ ios: 'plus.circle.fill', android: 'add_circle' }}
                size={20}
                tintColor={theme.tint}
              />
              <ThemedText variant="headline" style={{ color: theme.tint }}>
                回報最新門市價格
              </ThemedText>
            </Pressable>
          </Glass>
        )}

        {/* 超商食安與營養身分證 */}
        {foodSafety && (
          <>
            <SectionTitle title="營養標示與食安資訊" />
            <Glass style={styles.offCard}>
              <View style={styles.fsBadgeRow}>
                {foodSafety.category && (
                  <View style={[styles.fsTag, { backgroundColor: theme.tint + '18' }]}>
                    <ThemedText variant="footnote" style={{ color: theme.tint, fontWeight: '700' }}>
                      {foodSafety.category}
                    </ThemedText>
                  </View>
                )}
                {foodSafety.isNew && (
                  <View style={[styles.fsTag, { backgroundColor: '#FF9500' }]}>
                    <ThemedText variant="footnote" style={{ color: '#fff', fontWeight: '700' }}>
                      新品上市
                    </ThemedText>
                  </View>
                )}
                {foodSafety.isSpecialSale && (
                  <View style={[styles.fsTag, { backgroundColor: '#FF3B30' }]}>
                    <ThemedText variant="footnote" style={{ color: '#fff', fontWeight: '700' }}>
                      當期特惠
                    </ThemedText>
                  </View>
                )}
              </View>

              {(foodSafety.calories != null ||
                foodSafety.protein != null ||
                foodSafety.carb != null ||
                foodSafety.totalFat != null) && (
                <View style={styles.nutrientGrid}>
                  {foodSafety.calories != null && String(foodSafety.calories) !== '' && (
                    <View style={styles.nutrientCell}>
                      <ThemedText variant="footnote" secondary>
                        熱量
                      </ThemedText>
                      <ThemedText variant="headline" style={{ fontWeight: '800' }}>
                        {foodSafety.calories} kcal
                      </ThemedText>
                    </View>
                  )}
                  {foodSafety.protein != null && (
                    <View style={styles.nutrientCell}>
                      <ThemedText variant="footnote" secondary>
                        蛋白質
                      </ThemedText>
                      <ThemedText variant="headline" style={{ fontWeight: '800' }}>
                        {foodSafety.protein}g
                      </ThemedText>
                    </View>
                  )}
                  {foodSafety.carb != null && (
                    <View style={styles.nutrientCell}>
                      <ThemedText variant="footnote" secondary>
                        碳水
                      </ThemedText>
                      <ThemedText variant="headline" style={{ fontWeight: '800' }}>
                        {foodSafety.carb}g
                      </ThemedText>
                    </View>
                  )}
                  {foodSafety.totalFat != null && (
                    <View style={styles.nutrientCell}>
                      <ThemedText variant="footnote" secondary>
                        脂肪
                      </ThemedText>
                      <ThemedText variant="headline" style={{ fontWeight: '800' }}>
                        {foodSafety.totalFat}g
                      </ThemedText>
                    </View>
                  )}
                  {foodSafety.sodium != null && (
                    <View style={styles.nutrientCell}>
                      <ThemedText variant="footnote" secondary>
                        鈉含量
                      </ThemedText>
                      <ThemedText variant="headline" style={{ fontWeight: '800' }}>
                        {foodSafety.sodium}mg
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {foodSafety.allergens && foodSafety.allergens.length > 0 && (
                <View style={[styles.allergenBox, { backgroundColor: '#FF3B3014' }]}>
                  <ThemedText variant="caption" style={{ color: '#FF3B30', fontWeight: '700' }}>
                    ⚠️ 過敏原提醒：{foodSafety.allergens.join('、')}
                  </ThemedText>
                </View>
              )}

              <InfoRow label="商品說明" value={foodSafety.description} />
              <InfoRow label="製造廠商" value={foodSafety.manufacturer} />
              <InfoRow label="產地地址" value={foodSafety.manufacturerAddress} />
            </Glass>
          </>
        )}

        {/* Open Food Facts（僅在有對應資料時顯示，避免無謂轉圈圈與空白提示） */}
        {offProduct && (
          <>
            <SectionTitle title="Open Food Facts 國際條碼庫" />
            <Glass style={styles.offCard}>
              <InfoRow label="名稱" value={offProduct.name} />
              <InfoRow label="品牌" value={offProduct.brand} />
              <InfoRow label="容量" value={offProduct.quantity} />
              <InfoRow label="分類" value={offProduct.categories} />
              <InfoRow label="Nutri-Score" value={offProduct.nutriscore?.toUpperCase()} />
              <InfoRow label="販售國家" value={offProduct.countries} />
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(offProduct.url)}
                style={styles.link}>
                <ThemedText variant="caption" style={{ color: theme.tint }}>
                  在 Open Food Facts 查看完整資料 ›
                </ThemedText>
              </Pressable>
            </Glass>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText variant="headline">{title}</ThemedText>
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
  content: {
    padding: Spacing.three,
    paddingTop: Platform.OS === 'ios' ? Spacing.four : Spacing.three,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  imageBox: {
    width: 96,
    height: 96,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 88, height: 88 },
  headerText: { flex: 1, gap: Spacing.one },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 1 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
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
  empty: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  centerText: { textAlign: 'center' },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  addMore: { borderRadius: Radius.pill, alignSelf: 'center' },
  addMoreInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
  },
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
  fsBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fsTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  nutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  nutrientCell: {
    flex: 1,
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(120,120,128,0.08)',
    alignItems: 'center',
    gap: 2,
  },
  allergenBox: {
    padding: Spacing.two,
    borderRadius: Radius.sm,
  },
  infoRow: { flexDirection: 'row', gap: Spacing.three },
  infoLabel: { width: 80 },
  infoValue: { flex: 1 },
  link: { marginTop: Spacing.one },
});
