import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, glassSupported } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { getStoreIcon } from '@/constants/store-icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  checkDiscountTimeStatus,
  fetchChainDiscounts,
  type ChainChoice,
  type DiscountCategory,
  type DiscountProduct,
  type DiscountStore,
} from '@/lib/discount-service';
import { formatPrice } from '@/lib/utils';

const CHAIN_LABELS: Record<ChainChoice, string> = {
  '7-eleven': '7-Eleven',
  familymart: '全家',
  pxmart: '全聯',
  poya: '寶雅',
};

export default function DiscountScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 1. 通路選擇 ('7-eleven' | 'familymart')
  const [selectedChain, setSelectedChain] = useState<ChainChoice>('7-eleven');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 2. 導航層級狀態：
  // selectedStore === null => 門市列表（第一層）
  // selectedStore !== null && selectedCategory === null => 大分類列表（第二層）
  // selectedCategory !== null => 該分類商品詳細列表（第三層）
  const [selectedStore, setSelectedStore] = useState<DiscountStore | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DiscountCategory | null>(null);

  // 3. 資料與載入狀態
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stores, setStores] = useState<DiscountStore[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 25.033964,
    lng: 121.564468, // 預設台北信義區中心
  });
  const timeStatus = checkDiscountTimeStatus(selectedChain);

  // 取得定位並載入門市即期品
  useEffect(() => {
    let cancelled = false;

    const fetchStores = async () => {
      try {
        let coords = userCoords;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getLastKnownPositionAsync();
          if (pos && !cancelled) {
            coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserCoords(coords);
          }
        }

        const result = await fetchChainDiscounts(selectedChain, coords.lat, coords.lng);

        if (!cancelled) {
          setStores(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('載入即期品失敗:', err);
          setLoading(false);
        }
      }
    };

    void fetchStores();

    return () => {
      cancelled = true;
    };
  }, [selectedChain, userCoords]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchChainDiscounts(selectedChain, userCoords.lat, userCoords.lng);
      setStores(result);
    } catch (err) {
      console.warn('重整即期品失敗:', err);
    } finally {
      setRefreshing(false);
    }
  }, [selectedChain, userCoords]);

  // 切換超商通路
  const handleSelectChain = (chain: ChainChoice) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setSelectedChain(chain);
    setDropdownOpen(false);
    setSelectedStore(null);
    setSelectedCategory(null);
  };

  // 開啟地圖導航帶我去
  const navigateToStore = (store: DiscountStore) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const query = encodeURIComponent(`${store.name} ${store.address}`);
    if (Platform.OS === 'ios') {
      void Linking.openURL(`maps://?q=${query}`).catch(() => {
        void Linking.openURL(`https://maps.apple.com/?q=${query}`);
      });
    } else {
      void Linking.openURL(`geo:${store.latitude},${store.longitude}?q=${query}`).catch(() => {
        void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
      });
    }
  };

  // 點擊前往該商品在 App 中的完整各通路比價畫面
  const goToProductComparison = (product: DiscountProduct) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (product.barcode) {
      router.push(`/product/${product.barcode}`);
    } else {
      // 依品名導向搜尋
      router.push({ pathname: '/(tabs)', params: { q: product.name } });
    }
  };

  return (
    <View style={[styles.flex, !glassSupported && { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.five },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentInsetAdjustmentBehavior="automatic">
        {/* 頂部標題與通路下拉選單 */}
        <View style={styles.header}>
          <View>
            <ThemedText variant="largeTitle" style={styles.title}>
              即期特惠
            </ThemedText>
            <ThemedText variant="caption" secondary>
              7-11 i珍食 · 全家友善時光 · 全聯惜食 · 寶雅特賣
            </ThemedText>
          </View>

          {/* 下拉選單觸發按鈕 */}
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDropdownOpen(!dropdownOpen);
            }}
            style={[styles.dropdownBtn, { borderColor: theme.separator }]}>
            <Image source={getStoreIcon(selectedChain)} style={styles.dropdownLogo} contentFit="contain" />
            <ThemedText variant="headline" style={styles.dropdownText}>
              {CHAIN_LABELS[selectedChain]}
            </ThemedText>
            <SymbolView
              name={dropdownOpen ? 'chevron.up' : 'chevron.down'}
              size={14}
              tintColor={theme.tint}
            />
          </Pressable>
        </View>

        {/* 下拉選單展開浮層 */}
        {dropdownOpen && (
          <Glass style={styles.dropdownMenu}>
            <Pressable
              style={[
                styles.dropdownItem,
                selectedChain === '7-eleven' && { backgroundColor: theme.tint + '15' },
              ]}
              onPress={() => handleSelectChain('7-eleven')}>
              <Image source={getStoreIcon('7-eleven')} style={styles.itemLogo} contentFit="contain" />
              <View style={styles.itemTextContainer}>
                <ThemedText variant="headline">7-Eleven (i珍食)</ThemedText>
                <ThemedText variant="caption" secondary>
                  全品項 65 折 · 每日 10:00-17:00 / 20:00-03:00
                </ThemedText>
              </View>
              {selectedChain === '7-eleven' && (
                <SymbolView name="checkmark.circle.fill" size={18} tintColor={theme.tint} />
              )}
            </Pressable>

            <View style={[styles.separator, { backgroundColor: theme.separator }]} />

            <Pressable
              style={[
                styles.dropdownItem,
                selectedChain === 'familymart' && { backgroundColor: theme.tint + '15' },
              ]}
              onPress={() => handleSelectChain('familymart')}>
              <Image source={getStoreIcon('familymart')} style={styles.itemLogo} contentFit="contain" />
              <View style={styles.itemTextContainer}>
                <ThemedText variant="headline">全家便利商店 (友善時光)</ThemedText>
                <ThemedText variant="caption" secondary>
                  全品項 7 折 · 每日 10:00-17:00 / 17:00-24:00
                </ThemedText>
              </View>
              {selectedChain === 'familymart' && (
                <SymbolView name="checkmark.circle.fill" size={18} tintColor={theme.tint} />
              )}
            </Pressable>

            <View style={[styles.separator, { backgroundColor: theme.separator }]} />

            <Pressable
              style={[
                styles.dropdownItem,
                selectedChain === 'pxmart' && { backgroundColor: theme.tint + '15' },
              ]}
              onPress={() => handleSelectChain('pxmart')}>
              <Image source={getStoreIcon('pxmart')} style={styles.itemLogo} contentFit="contain" />
              <View style={styles.itemTextContainer}>
                <ThemedText variant="headline">全聯福利中心 (惜食地圖)</ThemedText>
                <ThemedText variant="caption" secondary>
                  生鮮/美味堂/阪急麵包 6折·8折 · 11:00-14:00 / 16:00-22:00
                </ThemedText>
              </View>
              {selectedChain === 'pxmart' && (
                <SymbolView name="checkmark.circle.fill" size={18} tintColor={theme.tint} />
              )}
            </Pressable>

            <View style={[styles.separator, { backgroundColor: theme.separator }]} />

            <Pressable
              style={[
                styles.dropdownItem,
                selectedChain === 'poya' && { backgroundColor: theme.tint + '15' },
              ]}
              onPress={() => handleSelectChain('poya')}>
              <Image source={getStoreIcon('poya')} style={styles.itemLogo} contentFit="contain" />
              <View style={styles.itemTextContainer}>
                <ThemedText variant="headline">寶雅 POYA (限時特賣·買一送一)</ThemedText>
                <ThemedText variant="caption" secondary>
                  官方特惠庫存與原價對照 · 每日 10:00-22:30
                </ThemedText>
              </View>
              {selectedChain === 'poya' && (
                <SymbolView name="checkmark.circle.fill" size={18} tintColor={theme.tint} />
              )}
            </Pressable>
          </Glass>
        )}

        {/* 載入中 */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.tint} />
            <ThemedText secondary style={{ marginTop: Spacing.three }}>
              正在搜尋周圍最近的 {CHAIN_LABELS[selectedChain]} 門市特惠商品...
            </ThemedText>
          </View>
        ) : selectedCategory ? (
          /* ================= 第三層：分類詳細商品列表 ================= */
          <View style={styles.section}>
            {/* 麵包屑導航返回 */}
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(null);
              }}>
              <SymbolView name="chevron.left" size={16} tintColor={theme.tint} />
              <ThemedText variant="headline" style={{ color: theme.tint, fontWeight: '600' }}>
                返回 {selectedCategory.name} 類別
              </ThemedText>
            </Pressable>

            <View style={styles.storeHeaderBadge}>
              <ThemedText variant="title">{selectedCategory.name}</ThemedText>
              <ThemedText variant="caption" secondary>
                {selectedStore?.name} · 共 {selectedCategory.products.length} 項即期商品
              </ThemedText>
            </View>

            <View style={styles.listContainer}>
              {selectedCategory.products.map((p, idx) => (
                <Glass key={p.id || idx} interactive style={styles.productCard}>
                  <Pressable style={styles.productRow} onPress={() => goToProductComparison(p)}>
                    {/* 左邊：商品圖片 */}
                    <View style={styles.productImgBox}>
                      {p.imageUrl ? (
                        <Image source={p.imageUrl} style={styles.productImg} contentFit="cover" />
                      ) : (
                        <SymbolView name="shippingbox.fill" size={28} tintColor={theme.textSecondary} />
                      )}
                    </View>

                    {/* 中間：名稱 + 剩餘數量 + 折扣標籤 */}
                    <View style={styles.productMain}>
                      <ThemedText variant="headline" numberOfLines={2}>
                        {p.name}
                      </ThemedText>
                      {p.content && (
                        <ThemedText variant="caption" secondary numberOfLines={1}>
                          {p.content}
                        </ThemedText>
                      )}
                      <View style={styles.badgeRow}>
                        <View style={[styles.discountRateBadge, { backgroundColor: '#FF3B30' }]}>
                          <ThemedText variant="caption" style={{ color: '#fff', fontWeight: '700' }}>
                            {p.discountRate}
                          </ThemedText>
                        </View>
                        {p.isNew && (
                          <View style={[styles.discountRateBadge, { backgroundColor: '#FF9500' }]}>
                            <ThemedText variant="caption" style={{ color: '#fff', fontWeight: '700' }}>
                              新品
                            </ThemedText>
                          </View>
                        )}
                        <View style={[styles.stockBadge, { backgroundColor: theme.tint + '18' }]}>
                          <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '600' }}>
                            剩餘 {p.count} 件
                          </ThemedText>
                        </View>
                        {p.kcal && (
                          <ThemedText variant="caption" secondary>
                            {p.kcal} kcal
                          </ThemedText>
                        )}
                      </View>
                    </View>

                    {/* 右邊：價格 + 比價入口 */}
                    <View style={styles.productPriceBox}>
                      <ThemedText variant="price" style={{ color: '#FF3B30', fontSize: 18 }}>
                        {formatPrice(p.discountPrice)}
                      </ThemedText>
                      <ThemedText variant="caption" secondary style={styles.strikethrough}>
                        原價 {formatPrice(p.originalPrice)}
                      </ThemedText>
                      <View style={[styles.compareBtn, { backgroundColor: theme.tint }]}>
                        <ThemedText variant="caption" style={{ color: '#fff', fontWeight: '600' }}>
                          比價·營養
                        </ThemedText>
                      </View>
                    </View>
                  </Pressable>
                </Glass>
              ))}
            </View>
          </View>
        ) : selectedStore ? (
          /* ================= 第二層：點進門市 -> 大分類列表 ================= */
          <View style={styles.section}>
            {/* 麵包屑導航返回門市列表 */}
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedStore(null);
              }}>
              <SymbolView name="chevron.left" size={16} tintColor={theme.tint} />
              <ThemedText variant="headline" style={{ color: theme.tint, fontWeight: '600' }}>
                返回附近門市列表
              </ThemedText>
            </Pressable>

            {/* 門市資訊摘要卡片 */}
            <Glass style={styles.selectedStoreCard}>
              <Image source={getStoreIcon(selectedStore.chain)} style={styles.storeLogo} contentFit="contain" />
              <View style={styles.storeInfoMain}>
                <ThemedText variant="headline">{selectedStore.name}</ThemedText>
                <ThemedText variant="caption" secondary numberOfLines={1}>
                  {selectedStore.address}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '600' }}>
                  距離約 {selectedStore.distance} 公尺 · 剩餘 {selectedStore.remainingTotal} 件即期品
                </ThemedText>
              </View>
              <Pressable
                style={[styles.navigateBtn, { backgroundColor: theme.tint }]}
                onPress={() => navigateToStore(selectedStore)}>
                <SymbolView name="location.fill" size={14} tintColor="#fff" />
                <ThemedText variant="caption" style={{ color: '#fff', fontWeight: '600' }}>
                  導航
                </ThemedText>
              </Pressable>
            </Glass>

            <ThemedText variant="headline" style={styles.categoryHeaderTitle}>
              選擇商品類別（大致分）
            </ThemedText>

            {/* 類別列表：每行左邊為圖片+名稱，右邊為數量 */}
            <Glass style={styles.categoryList}>
              {selectedStore.categories.map((cat, i) => (
                <Pressable
                  key={cat.id || i}
                  style={[
                    styles.categoryRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  ]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(cat);
                  }}>
                  {/* 左邊：圖片 + 名稱 */}
                  <View style={styles.categoryLeft}>
                    <View style={styles.catImageBox}>
                      {cat.imageUrl ? (
                        <Image source={cat.imageUrl} style={styles.catImage} contentFit="cover" />
                      ) : (
                        <SymbolView name="bag.fill" size={20} tintColor={theme.tint} />
                      )}
                    </View>
                    <ThemedText variant="headline" style={styles.catName}>
                      {cat.name}
                    </ThemedText>
                  </View>

                  {/* 右邊：數量 + 箭頭 */}
                  <View style={styles.categoryRight}>
                    <View style={[styles.categoryCountBadge, { backgroundColor: theme.tint + '18' }]}>
                      <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700' }}>
                        {cat.count} 件
                      </ThemedText>
                    </View>
                    <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} />
                  </View>
                </Pressable>
              ))}
            </Glass>
          </View>
        ) : (
          /* ================= 第一層：附近門市列表（由近到遠排序） ================= */
          <View style={styles.section}>
            <View style={styles.listHeaderRow}>
              <ThemedText variant="headline">附近門市列表（由近到遠）</ThemedText>
              <ThemedText variant="caption" secondary>
                找到 {stores.length} 間門市
              </ThemedText>
            </View>

            {!timeStatus.isDiscountTime || stores.length === 0 ? (
              <Glass style={styles.emptyCard}>
                <SymbolView name="clock.badge.exclamationmark" size={42} tintColor={theme.tint} />
                <ThemedText variant="title" style={{ textAlign: 'center', marginTop: Spacing.three }}>
                  目前非即期品時間暫無數據
                </ThemedText>
                <ThemedText variant="caption" secondary style={{ textAlign: 'center', marginTop: Spacing.two }}>
                  {timeStatus.scheduleText}
                </ThemedText>
                <View style={[styles.nextWindowPill, { backgroundColor: theme.tint + '18' }]}>
                  <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700' }}>
                    {timeStatus.nextWindowText}
                  </ThemedText>
                </View>
              </Glass>
            ) : (
              stores.map((st) => (
                <Glass key={st.id} interactive style={styles.storeCard}>
                  <Pressable
                    style={styles.storeCardInner}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedStore(st);
                    }}>
                    <Image source={getStoreIcon(st.chain)} style={styles.storeLogo} contentFit="contain" />
                    <View style={styles.storeCardMain}>
                      <View style={styles.storeTitleRow}>
                        <ThemedText variant="headline" numberOfLines={1}>
                          {st.name}
                        </ThemedText>
                        <View style={[styles.distancePill, { backgroundColor: theme.tint + '18' }]}>
                          <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700' }}>
                            {st.distance}m
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText variant="caption" secondary numberOfLines={1} style={{ marginTop: 2 }}>
                        {st.address}
                      </ThemedText>

                      {/* 剩餘數量標示 */}
                      <View style={styles.stockInfoRow}>
                        <View style={[styles.stockPill, { backgroundColor: '#FF3B301A' }]}>
                          <SymbolView name="flame.fill" size={12} tintColor="#FF3B30" />
                          <ThemedText variant="caption" style={{ color: '#FF3B30', fontWeight: '700', marginLeft: 4 }}>
                            剩餘 {st.remainingTotal} 件即期品
                          </ThemedText>
                        </View>
                        <ThemedText variant="caption" secondary>
                          點擊查看分類 〉
                        </ThemedText>
                      </View>
                    </View>
                  </Pressable>
                </Glass>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#ffffff20',
    gap: Spacing.two,
  },
  dropdownLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  dropdownText: {
    fontWeight: '600',
  },
  dropdownMenu: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  itemLogo: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
  },
  itemTextContainer: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six * 2,
  },
  section: {
    gap: Spacing.three,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  storeCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  storeCardInner: {
    flexDirection: 'row',
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  storeLogo: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
  },
  storeCardMain: {
    flex: 1,
  },
  storeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distancePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  emptyCard: {
    padding: Spacing.five,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  nextWindowPill: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  selectedStoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.lg,
    gap: Spacing.three,
  },
  storeInfoMain: {
    flex: 1,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    gap: 4,
  },
  categoryHeaderTitle: {
    marginTop: Spacing.two,
    fontWeight: '700',
  },
  categoryList: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  catImageBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: '#ffffff30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catImage: {
    width: '100%',
    height: '100%',
  },
  catName: {
    fontWeight: '600',
    flex: 1,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryCountBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  storeHeaderBadge: {
    marginBottom: Spacing.two,
  },
  listContainer: {
    gap: Spacing.three,
  },
  productCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: Spacing.three,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  productImgBox: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  productMain: {
    flex: 1,
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 2,
  },
  discountRateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  productPriceBox: {
    alignItems: 'flex-end',
    gap: 3,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  compareBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: 2,
  },
});
