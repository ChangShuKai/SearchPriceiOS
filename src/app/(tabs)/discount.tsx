import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  checkDiscountTimeStatus,
  fetchChainDiscounts,
  getInstantChainDiscounts,
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

const CHAIN_BADGES: Record<ChainChoice, string> = {
  '7-eleven': 'i珍食 65折',
  familymart: '友善時光 7折',
  pxmart: '惜食 6折·8折',
  poya: '門市特賣',
};

export default function DiscountScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedChain, setSelectedChain] = useState<ChainChoice>('7-eleven');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 三層漸進導航：門市列表 -> 大分類 -> 商品明細
  const [selectedStore, setSelectedStore] = useState<DiscountStore | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DiscountCategory | null>(null);

  const coordsRef = useRef<{ lat: number; lng: number }>({
    lat: 25.033964,
    lng: 121.564468,
  });

  // 首幀 0ms 即時載入，絕不轉圈圈卡畫面
  const [stores, setStores] = useState<DiscountStore[]>(() =>
    getInstantChainDiscounts('7-eleven', 25.033964, 121.564468),
  );
  const [refreshing, setRefreshing] = useState(false);

  const timeStatus = checkDiscountTimeStatus(selectedChain);

  // 背景取得定位並更新真實鄰近門市（無無限迴圈、不阻擋畫面）
  useEffect(() => {
    let cancelled = false;

    const syncLiveStores = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        let granted = perm.status === 'granted';
        if (!granted && perm.canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === 'granted';
        }
        if (granted && !cancelled) {
          let pos = await Location.getLastKnownPositionAsync();
          if (!pos) {
            pos = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
            ]);
          }
          if (pos) {
            coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            // 立即以真實座標所在的縣市更新 0ms 預覽（包含全台 502 間寶雅）
            if (!cancelled) {
              setStores(
                getInstantChainDiscounts(
                  selectedChain,
                  coordsRef.current.lat,
                  coordsRef.current.lng,
                ),
              );
            }
          }
        }
        const liveResult = await fetchChainDiscounts(
          selectedChain,
          coordsRef.current.lat,
          coordsRef.current.lng,
        );
        if (!cancelled && liveResult.length > 0) {
          setStores(liveResult);
        }
      } catch {
        // 保持即時母庫門市
      }
    };

    void syncLiveStores();
    return () => {
      cancelled = true;
    };
  }, [selectedChain]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchChainDiscounts(
        selectedChain,
        coordsRef.current.lat,
        coordsRef.current.lng,
      );
      if (result.length > 0) {
        setStores(result);
      }
    } finally {
      setRefreshing(false);
    }
  }, [selectedChain]);

  // 切換超商通路：0ms 立即切換門市與商品
  const handleSelectChain = (chain: ChainChoice) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChain(chain);
    setDropdownOpen(false);
    setSelectedStore(null);
    setSelectedCategory(null);
    setStores(getInstantChainDiscounts(chain, coordsRef.current.lat, coordsRef.current.lng));
  };

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

  const goToProductComparison = (product: DiscountProduct) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (product.barcode) {
      router.push(`/product/${product.barcode}`);
    } else {
      router.push({ pathname: '/(tabs)', params: { q: product.name } });
    }
  };

  return (
    <View style={[styles.flex, !glassSupported && { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: BottomTabInset + insets.bottom + Spacing.five,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentInsetAdjustmentBehavior="automatic">
        {/* 頂部標題與通路選擇器（修正彈性寬度，絕不破圖超出螢幕） */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText variant="largeTitle" style={styles.title}>
              即期特惠
            </ThemedText>
            <ThemedText variant="caption" secondary numberOfLines={1}>
              {CHAIN_LABELS[selectedChain]} · {CHAIN_BADGES[selectedChain]} ({timeStatus.scheduleText})
            </ThemedText>
          </View>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDropdownOpen(!dropdownOpen);
            }}
            style={[
              styles.dropdownBtn,
              { borderColor: theme.separator, backgroundColor: theme.tint + '14' },
            ]}>
            <Image source={getStoreIcon(selectedChain)} style={styles.dropdownLogo} contentFit="contain" />
            <ThemedText variant="headline" style={styles.dropdownText}>
              {CHAIN_LABELS[selectedChain]}
            </ThemedText>
            <SymbolView
              name={dropdownOpen ? 'chevron.up' : 'chevron.down'}
              size={13}
              tintColor={theme.tint}
            />
          </Pressable>
        </View>

        {/* 下拉選單展開浮層 */}
        {dropdownOpen && (
          <Glass style={styles.dropdownMenu}>
            {(
              [
                {
                  id: '7-eleven',
                  title: '7-Eleven (i珍食)',
                  sub: '全品項 65 折 · 10:00–17:00 / 20:00–03:00',
                },
                {
                  id: 'familymart',
                  title: '全家便利商店 (友善時光)',
                  sub: '全品項 7 折 · 10:00–17:00 / 17:00–24:00',
                },
                {
                  id: 'pxmart',
                  title: '全聯福利中心 (惜食地圖)',
                  sub: '生鮮/美味堂/阪急麵包 6折·8折 · 11:00–14:00 / 16:00–22:00',
                },
                {
                  id: 'poya',
                  title: '寶雅 POYA (限時特賣)',
                  sub: '門市特賣庫存與原價對照 · 10:00–22:30',
                },
              ] as { id: ChainChoice; title: string; sub: string }[]
            ).map((opt, idx) => (
              <View key={opt.id}>
                {idx > 0 && <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
                <Pressable
                  style={[
                    styles.dropdownItem,
                    selectedChain === opt.id && { backgroundColor: theme.tint + '15' },
                  ]}
                  onPress={() => handleSelectChain(opt.id)}>
                  <Image source={getStoreIcon(opt.id)} style={styles.itemLogo} contentFit="contain" />
                  <View style={styles.itemTextContainer}>
                    <ThemedText variant="headline">{opt.title}</ThemedText>
                    <ThemedText variant="caption" secondary>
                      {opt.sub}
                    </ThemedText>
                  </View>
                  {selectedChain === opt.id && (
                    <SymbolView name="checkmark.circle.fill" size={18} tintColor={theme.tint} />
                  )}
                </Pressable>
              </View>
            ))}
          </Glass>
        )}

        {selectedCategory ? (
          /* ================= 第三層：分類詳細商品列表 ================= */
          <View style={styles.section}>
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(null);
              }}>
              <SymbolView name="chevron.left" size={16} tintColor={theme.tint} />
              <ThemedText variant="headline" style={{ color: theme.tint, fontWeight: '600' }}>
                返回 {selectedStore?.name} 分類
              </ThemedText>
            </Pressable>

            <View style={styles.storeHeaderBadge}>
              <ThemedText variant="title">{selectedCategory.name}</ThemedText>
              <ThemedText variant="caption" secondary>
                {selectedStore?.name} · 共 {selectedCategory.products.length} 項特惠商品
              </ThemedText>
            </View>

            <View style={styles.listContainer}>
              {selectedCategory.products.map((p, idx) => (
                <Glass key={p.id || idx} interactive style={styles.productCard}>
                  <Pressable style={styles.productRow} onPress={() => goToProductComparison(p)}>
                    <View style={styles.productImgBox}>
                      {p.imageUrl ? (
                        <Image source={p.imageUrl} style={styles.productImg} contentFit="cover" />
                      ) : (
                        <SymbolView name="shippingbox.fill" size={28} tintColor={theme.textSecondary} />
                      )}
                    </View>

                    <View style={styles.productMain}>
                      <ThemedText variant="headline" numberOfLines={2}>
                        {p.name}
                      </ThemedText>
                      <View style={styles.badgeRow}>
                        <View style={[styles.discountRateBadge, { backgroundColor: '#FF3B30' }]}>
                          <ThemedText variant="caption" style={{ color: '#fff', fontWeight: '700' }}>
                            {p.discountRate}
                          </ThemedText>
                        </View>
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

                    <View style={styles.productPriceBox}>
                      <ThemedText variant="price" style={{ color: '#FF3B30', fontSize: 18 }}>
                        {formatPrice(p.discountPrice)}
                      </ThemedText>
                      <ThemedText variant="caption" secondary style={styles.strikethrough}>
                        原價 {formatPrice(p.originalPrice)}
                      </ThemedText>
                    </View>
                  </Pressable>
                </Glass>
              ))}
            </View>
          </View>
        ) : selectedStore ? (
          /* ================= 第二層：點進門市 -> 大分類列表 ================= */
          <View style={styles.section}>
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

            <Glass style={styles.selectedStoreCard}>
              <Image
                source={getStoreIcon(selectedStore.chain)}
                style={styles.storeLogo}
                contentFit="contain"
              />
              <View style={styles.storeInfoMain}>
                <ThemedText variant="headline">{selectedStore.name}</ThemedText>
                <ThemedText variant="caption" secondary numberOfLines={1}>
                  {selectedStore.address}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '600' }}>
                  距離約 {selectedStore.distance} 公尺 · 剩餘 {selectedStore.remainingTotal} 件特惠品
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
              選擇商品類別
            </ThemedText>

            <Glass style={styles.categoryList}>
              {selectedStore.categories.map((cat, i) => (
                <Pressable
                  key={cat.id || i}
                  style={[
                    styles.categoryRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.separator,
                    },
                  ]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(cat);
                  }}>
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
            {!timeStatus.isDiscountTime && (
              <Glass style={styles.timeBanner}>
                <SymbolView name="clock.fill" size={16} tintColor="#FF9500" />
                <ThemedText variant="caption" style={{ flex: 1, fontWeight: '600' }}>
                  {timeStatus.nextWindowText}
                </ThemedText>
              </Glass>
            )}

            <View style={styles.listHeaderRow}>
              <ThemedText variant="headline">附近門市（由近到遠）</ThemedText>
              <ThemedText variant="caption" secondary>
                共 {stores.length} 間門市
              </ThemedText>
            </View>

            {stores.map((st) => (
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
                      <ThemedText variant="headline" numberOfLines={1} style={styles.flex}>
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

                    <View style={styles.stockInfoRow}>
                      <View style={[styles.stockPill, { backgroundColor: '#FF3B301A' }]}>
                        <SymbolView name="flame.fill" size={12} tintColor="#FF3B30" />
                        <ThemedText
                          variant="caption"
                          style={{ color: '#FF3B30', fontWeight: '700', marginLeft: 4 }}>
                          剩餘 {st.remainingTotal} 件特惠品
                        </ThemedText>
                      </View>
                      <ThemedText variant="caption" secondary>
                        查看分類 ›
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              </Glass>
            ))}
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
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  headerLeft: {
    flex: 1,
    paddingRight: Spacing.one,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dropdownBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  dropdownLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  dropdownText: {
    fontWeight: '700',
    fontSize: 14,
  },
  dropdownMenu: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
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
  timeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.md,
  },
  section: {
    gap: Spacing.three,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
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
    gap: Spacing.two,
  },
  distancePill: {
    flexShrink: 0,
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
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
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    gap: 4,
  },
  categoryHeaderTitle: {
    marginTop: Spacing.one,
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
    marginBottom: Spacing.one,
  },
  listContainer: {
    gap: Spacing.two + 2,
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
    width: 56,
    height: 56,
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
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  discountRateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productPriceBox: {
    alignItems: 'flex-end',
    gap: 2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
