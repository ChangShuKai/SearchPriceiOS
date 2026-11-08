import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, glassSupported } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { getStoreIcon } from '@/constants/store-icons';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DAILY_CATEGORY_TABS,
  FAMILY_SERVICE_FILTERS,
  fetchSpecialServiceStores,
  getAllDailyNecessityProducts,
  getDailyNecessityProducts,
  getInstantSpecialServiceStores,
  getNewAndPromoProducts,
  PRODUCT_FEED_TABS,
  SEVEN_SERVICE_FILTERS,
  type DailyCategoryTab,
  type DailyNecessityItem,
  type ProductFeedTab,
  type RadarChain,
  type RadarProductItem,
  type SpecialStoreItem,
} from '@/lib/radar-service';
import { formatPrice } from '@/lib/utils';

type RadarViewMode = 'products' | 'daily' | 'machines';

const CHAIN_NAME_MAP: Record<string, string> = {
  poya: '寶雅',
  pxmart: '全聯',
  carrefour: '家樂福',
  watsons: '屈臣氏',
  cosmed: '康是美',
  costco: '好市多',
  'rt-mart': '大潤發',
  simplemart: '美廉社',
  '7-eleven': '7-11',
  familymart: '全家',
};

const PAGE_SIZE = 24;

export default function RadarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 1. 通路切換 ('7-eleven' | 'familymart')
  const [selectedChain, setSelectedChain] = useState<RadarChain>('7-eleven');

  // 2. 主模式切換 ('products' = 超商新品 | 'daily' = 日常百貨 | 'machines' = 特殊機台)
  const [viewMode, setViewMode] = useState<RadarViewMode>('products');

  // 3. 分層導航狀態（null 代表在清爽的第一層「分類總覽」，點進才顯示第二層清單，不把所有東西擠在一起）
  const [selectedFeedTab, setSelectedFeedTab] = useState<ProductFeedTab | null>(null);
  const [selectedDailyTab, setSelectedDailyTab] = useState<DailyCategoryTab | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // 4. 搜尋與分頁狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 5. 特殊機台門市資料（首幀 0ms 預載，背景自動更新）
  const coordsRef = useRef<{ lat: number; lng: number }>({
    lat: 25.033964,
    lng: 121.564468,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [specialStores, setSpecialStores] = useState<SpecialStoreItem[]>(() =>
    getInstantSpecialServiceStores('7-eleven', 25.033964, 121.564468),
  );

  // 背景更新附近特殊機台門市（修正依賴項，消除無限迴圈與轉圈圈）
  useEffect(() => {
    let cancelled = false;

    const loadSpecialStores = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        let granted = perm.status === 'granted';
        if (!granted && perm.canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === 'granted';
        }
        if (granted && !cancelled) {
          const pos = await Location.getLastKnownPositionAsync();
          if (pos) {
            coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          }
        }
        const list = await fetchSpecialServiceStores(
          selectedChain,
          coordsRef.current.lat,
          coordsRef.current.lng,
        );
        if (!cancelled && list.length > 0) {
          setSpecialStores(list);
        }
      } catch {
        // 保持即時門市資料
      }
    };

    void loadSpecialStores();
    return () => {
      cancelled = true;
    };
  }, [selectedChain]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await fetchSpecialServiceStores(
        selectedChain,
        coordsRef.current.lat,
        coordsRef.current.lng,
      );
      if (list.length > 0) {
        setSpecialStores(list);
      }
    } finally {
      setRefreshing(false);
    }
  }, [selectedChain]);

  const handleSelectChain = (chain: RadarChain) => {
    if (chain === selectedChain) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChain(chain);
    setSelectedServiceId(null);
    setVisibleCount(PAGE_SIZE);
    setSpecialStores(
      getInstantSpecialServiceStores(chain, coordsRef.current.lat, coordsRef.current.lng),
    );
  };

  const handleSwitchMode = (mode: RadarViewMode) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewMode(mode);
    setSearchQuery('');
    setVisibleCount(PAGE_SIZE);
  };

  // 超商新品清單
  const activeFeedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      // 若有輸入搜尋關鍵字，跨新品/聯名/飲控三個子分類一起搜尋
      const all = [
        ...getNewAndPromoProducts(selectedChain, 'new'),
        ...getNewAndPromoProducts(selectedChain, 'promo'),
        ...getNewAndPromoProducts(selectedChain, 'health'),
      ];
      const seen = new Set<string>();
      return all.filter((p) => {
        if (seen.has(p.name)) return false;
        const match =
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q));
        if (match) seen.add(p.name);
        return match;
      });
    }
    return getNewAndPromoProducts(selectedChain, selectedFeedTab || 'new');
  }, [selectedChain, selectedFeedTab, searchQuery]);

  // 日常用品清單
  const activeDailyProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const base = selectedDailyTab
        ? getDailyNecessityProducts(selectedDailyTab)
        : getAllDailyNecessityProducts();
      return base.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
      );
    }
    return getDailyNecessityProducts(selectedDailyTab || '口腔護理·牙線牙膏');
  }, [selectedDailyTab, searchQuery]);

  // 日常百貨跨通路價差最大精選（前 5 項）
  const topSavingsDaily = useMemo(() => {
    return getAllDailyNecessityProducts()
      .filter((item) => Object.keys(item.prices).length > 1 && item.highestPrice > item.lowestPrice)
      .sort((a, b) => b.highestPrice - b.lowestPrice - (a.highestPrice - a.lowestPrice))
      .slice(0, 5);
  }, []);

  const serviceFilters =
    selectedChain === '7-eleven' ? SEVEN_SERVICE_FILTERS : FAMILY_SERVICE_FILTERS;

  const filteredStores = useMemo(() => {
    if (!selectedServiceId || selectedServiceId === 'all') {
      return specialStores.filter((s) => s.serviceTags.length > 0);
    }
    return specialStores.filter((s) => s.serviceTags.some((t) => t.id === selectedServiceId));
  }, [specialStores, selectedServiceId]);

  const openProductDetail = (item: RadarProductItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.barcode) {
      router.push(`/product/${item.barcode}`);
    } else {
      router.push({ pathname: '/(tabs)', params: { q: item.name } });
    }
  };

  const openDailyDetail = (item: DailyNecessityItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.barcode) {
      router.push(`/product/${item.barcode}`);
    } else {
      router.push({ pathname: '/(tabs)', params: { q: item.name } });
    }
  };

  const navigateToStore = (store: SpecialStoreItem) => {
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

  const renderFeedProductCard = (item: RadarProductItem) => (
    <Glass key={item.id} interactive style={styles.productCard}>
      <Pressable style={styles.productRow} onPress={() => openProductDetail(item)}>
        <View style={styles.productImgBox}>
          {item.imageUrl ? (
            <Image source={item.imageUrl} style={styles.productImg} contentFit="cover" />
          ) : (
            <SymbolView name="takeoutbag.and.cup.and.straw.fill" size={26} tintColor={theme.tint} />
          )}
        </View>

        <View style={styles.productMain}>
          <ThemedText variant="headline" numberOfLines={2}>
            {item.name}
          </ThemedText>
          <View style={styles.badgeWrap}>
            {item.badges.slice(0, 2).map((b, i) => (
              <View
                key={i}
                style={[
                  styles.badgePill,
                  { backgroundColor: i === 0 ? '#FF950022' : theme.tint + '18' },
                ]}>
                <ThemedText
                  variant="caption"
                  style={{
                    color: i === 0 ? '#FF9500' : theme.tint,
                    fontWeight: '700',
                    fontSize: 11,
                  }}>
                  {b}
                </ThemedText>
              </View>
            ))}
            {item.kcal && (
              <ThemedText variant="caption" secondary>
                {item.kcal} kcal
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.productPriceBox}>
          <ThemedText variant="price" style={{ color: theme.tint, fontSize: 18 }}>
            {formatPrice(item.price)}
          </ThemedText>
          <View style={[styles.discPreviewPill, { backgroundColor: '#FF3B3018' }]}>
            <ThemedText variant="caption" style={{ color: '#FF3B30', fontWeight: '700', fontSize: 11 }}>
              {item.discountLabel} {formatPrice(item.discountPrice)}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </Glass>
  );

  const renderDailyProductCard = (item: DailyNecessityItem, idx: number) => {
    const chainCount = Object.keys(item.prices).length;
    const savings = chainCount > 1 ? Math.max(0, item.highestPrice - item.lowestPrice) : 0;
    return (
      <Glass key={`${item.id}_${idx}`} interactive style={styles.productCard}>
        <Pressable style={styles.productRow} onPress={() => openDailyDetail(item)}>
          <View style={styles.productImgBox}>
            {item.imageUrl ? (
              <Image source={item.imageUrl} style={styles.productImg} contentFit="cover" />
            ) : (
              <Image
                source={getStoreIcon(item.lowestChain)}
                style={{ width: 36, height: 36, borderRadius: 8 }}
                contentFit="contain"
              />
            )}
          </View>

          <View style={styles.productMain}>
            <ThemedText variant="headline" numberOfLines={2}>
              {item.name}
            </ThemedText>
            <View style={styles.badgeWrap}>
              <View style={[styles.badgePill, { backgroundColor: '#34C75920' }]}>
                <ThemedText variant="caption" style={{ color: '#248A3D', fontWeight: '700', fontSize: 11 }}>
                  最低：{CHAIN_NAME_MAP[item.lowestChain] || item.lowestChain}{' '}
                  {formatPrice(item.lowestPrice)}
                </ThemedText>
              </View>
              {chainCount > 1 && savings > 0 ? (
                <View style={[styles.badgePill, { backgroundColor: '#FF3B3018' }]}>
                  <ThemedText variant="caption" style={{ color: '#FF3B30', fontWeight: '700', fontSize: 11 }}>
                    價差省 ${savings}
                  </ThemedText>
                </View>
              ) : item.promotionTag ? (
                <View style={[styles.badgePill, { backgroundColor: theme.tint + '18' }]}>
                  <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700', fontSize: 11 }}>
                    {item.promotionTag}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.productPriceBox}>
            <ThemedText variant="price" style={{ color: '#248A3D', fontSize: 18 }}>
              {formatPrice(item.lowestPrice)}
            </ThemedText>
            {chainCount > 1 && item.highestPrice > item.lowestPrice ? (
              <ThemedText variant="caption" secondary style={{ textDecorationLine: 'line-through' }}>
                他店 {formatPrice(item.highestPrice)}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>
      </Glass>
    );
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
        {/* 頂部簡潔標題列 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText variant="largeTitle" style={styles.title}>
              超商雷達
            </ThemedText>
            <ThemedText variant="caption" secondary numberOfLines={1}>
              {viewMode === 'daily'
                ? '跨全聯·寶雅·藥妝·超商民生用品比價'
                : viewMode === 'machines'
                  ? '周邊霜淇淋·思樂冰·熱壓吐司門市地圖'
                  : '當期聯名新品·星級主廚與增肌飲控'}
            </ThemedText>
          </View>

          {/* 僅在「超商新品」與「特殊機台」顯示 7-11 / 全家 切換膠囊 */}
          {viewMode !== 'daily' && (
            <View style={[styles.chainToggleBox, { borderColor: theme.separator }]}>
              <Pressable
                onPress={() => handleSelectChain('7-eleven')}
                style={[
                  styles.chainPill,
                  selectedChain === '7-eleven' && { backgroundColor: theme.tint },
                ]}>
                <Image
                  source={getStoreIcon('7-eleven')}
                  style={styles.chainLogo}
                  contentFit="contain"
                />
                <ThemedText
                  variant="caption"
                  style={{
                    fontWeight: '700',
                    color: selectedChain === '7-eleven' ? '#fff' : theme.text,
                  }}>
                  7-11
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => handleSelectChain('familymart')}
                style={[
                  styles.chainPill,
                  selectedChain === 'familymart' && { backgroundColor: theme.tint },
                ]}>
                <Image
                  source={getStoreIcon('familymart')}
                  style={styles.chainLogo}
                  contentFit="contain"
                />
                <ThemedText
                  variant="caption"
                  style={{
                    fontWeight: '700',
                    color: selectedChain === 'familymart' ? '#fff' : theme.text,
                  }}>
                  全家
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* 三大主功能切換列 */}
        <Glass style={styles.modeSwitcher}>
          {(
            [
              { id: 'products', label: '超商新品', icon: 'sparkles' },
              { id: 'daily', label: '日常百貨', icon: 'basket.fill' },
              { id: 'machines', label: '特殊機台', icon: 'mappin.and.ellipse' },
            ] as const
          ).map((m) => {
            const active = viewMode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => handleSwitchMode(m.id)}
                style={[styles.modeBtn, active && { backgroundColor: theme.tint }]}>
                <SymbolView
                  name={m.icon}
                  size={15}
                  tintColor={active ? '#fff' : theme.textSecondary}
                />
                <ThemedText
                  variant="caption"
                  style={{
                    color: active ? '#fff' : theme.text,
                    fontWeight: '700',
                  }}>
                  {m.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </Glass>

        {/* ================================================================= */}
        {/* 模式一：超商新品（分層：先選主題分類 -> 再看清單，不擠在同一畫面） */}
        {/* ================================================================= */}
        {viewMode === 'products' && (
          <View style={styles.section}>
            {/* 搜尋列 */}
            <Glass style={styles.searchBar}>
              <SymbolView name="magnifyingglass" size={16} tintColor={theme.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder={`搜尋 ${selectedChain === '7-eleven' ? '7-Eleven' : '全家'} 鮮食、新品、聯名...`}
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <SymbolView name="xmark.circle.fill" size={16} tintColor={theme.textSecondary} />
                </Pressable>
              )}
            </Glass>

            {selectedFeedTab === null && searchQuery.trim().length === 0 ? (
              /* 第一層：清爽的 3 大主題分類卡片 + 精選預覽 */
              <>
                <View style={styles.listHeaderRow}>
                  <ThemedText variant="headline">
                    選擇 {selectedChain === '7-eleven' ? '7-Eleven' : '全家'} 專區
                  </ThemedText>
                  <ThemedText variant="caption" secondary>
                    點選分類展開清單
                  </ThemedText>
                </View>

                <Glass style={styles.categoryGroupCard}>
                  {PRODUCT_FEED_TABS.map((tab, i) => {
                    const count = getNewAndPromoProducts(selectedChain, tab.id).length;
                    return (
                      <Pressable
                        key={tab.id}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedFeedTab(tab.id);
                          setVisibleCount(PAGE_SIZE);
                        }}
                        style={[
                          styles.categoryCardRow,
                          i > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: theme.separator,
                          },
                        ]}>
                        <View style={[styles.catEmojiBox, { backgroundColor: theme.tint + '14' }]}>
                          <ThemedText style={{ fontSize: 22 }}>{tab.emoji}</ThemedText>
                        </View>
                        <View style={styles.catTextMain}>
                          <ThemedText variant="headline">{tab.label.replace(/^.\s*/, '')}</ThemedText>
                          <ThemedText variant="caption" secondary numberOfLines={1}>
                            {tab.subtitle}
                          </ThemedText>
                        </View>
                        <View style={styles.catRightBox}>
                          <View style={[styles.countPill, { backgroundColor: theme.tint + '18' }]}>
                            <ThemedText
                              variant="caption"
                              style={{ color: theme.tint, fontWeight: '700' }}>
                              {count} 項
                            </ThemedText>
                          </View>
                          <SymbolView
                            name="chevron.right"
                            size={14}
                            tintColor={theme.textSecondary}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </Glass>

                <View style={[styles.listHeaderRow, { marginTop: Spacing.one }]}>
                  <ThemedText variant="headline">🔥 本週熱門新品預覽</ThemedText>
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFeedTab('new');
                    }}>
                    <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700' }}>
                      查看全部 ›
                    </ThemedText>
                  </Pressable>
                </View>

                {getNewAndPromoProducts(selectedChain, 'new')
                  .slice(0, 4)
                  .map((item) => renderFeedProductCard(item))}
              </>
            ) : (
              /* 第二層：點進某個專區或搜尋結果 */
              <>
                <View style={styles.detailNavRow}>
                  <Pressable
                    style={styles.backBtn}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFeedTab(null);
                      setSearchQuery('');
                    }}>
                    <SymbolView name="chevron.left" size={16} tintColor={theme.tint} />
                    <ThemedText variant="headline" style={{ color: theme.tint, fontWeight: '600' }}>
                      返回專區總覽
                    </ThemedText>
                  </Pressable>
                  <ThemedText variant="caption" secondary>
                    共 {activeFeedProducts.length} 項商品
                  </ThemedText>
                </View>

                {/* 單行輕量切換膠囊（不換行堆疊） */}
                {searchQuery.trim().length === 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.singleLineScroll}>
                    {PRODUCT_FEED_TABS.map((t) => {
                      const active = selectedFeedTab === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedFeedTab(t.id);
                            setVisibleCount(PAGE_SIZE);
                          }}
                          style={[
                            styles.singleLinePill,
                            {
                              backgroundColor: active ? theme.tint : theme.tint + '12',
                              borderColor: active ? theme.tint : theme.separator,
                            },
                          ]}>
                          <ThemedText
                            variant="caption"
                            style={{
                              color: active ? '#fff' : theme.text,
                              fontWeight: '700',
                            }}>
                            {t.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                {activeFeedProducts.slice(0, visibleCount).map((item) => renderFeedProductCard(item))}

                {visibleCount < activeFeedProducts.length && (
                  <Pressable
                    onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    style={[styles.loadMoreBtn, { backgroundColor: theme.tint + '18' }]}>
                    <ThemedText variant="headline" style={{ color: theme.tint }}>
                      顯示更多商品（剩餘 {activeFeedProducts.length - visibleCount} 項）
                    </ThemedText>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* 模式二：日常百貨（分層：先選 4 大品類卡片 -> 再看商品，清爽不擁擠） */}
        {/* ================================================================= */}
        {viewMode === 'daily' && (
          <View style={styles.section}>
            <Glass style={styles.searchBar}>
              <SymbolView name="magnifyingglass" size={16} tintColor={theme.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={(t) => {
                  setSearchQuery(t);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="搜尋牙線棒、歐樂B、3M、舒酸定、衛生紙、洗衣球..."
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <SymbolView name="xmark.circle.fill" size={16} tintColor={theme.textSecondary} />
                </Pressable>
              )}
            </Glass>

            {selectedDailyTab === null && searchQuery.trim().length === 0 ? (
              /* 第一層：4 大民生日常分類卡片 + 跨店省最多精選 */
              <>
                <View style={styles.listHeaderRow}>
                  <ThemedText variant="headline">選擇日常用品分類</ThemedText>
                  <ThemedText variant="caption" secondary>
                    點選分類查看跨店比價
                  </ThemedText>
                </View>

                <Glass style={styles.categoryGroupCard}>
                  {DAILY_CATEGORY_TABS.map((cat, i) => {
                    const count = getDailyNecessityProducts(cat.id).length;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedDailyTab(cat.id);
                          setVisibleCount(PAGE_SIZE);
                        }}
                        style={[
                          styles.categoryCardRow,
                          i > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: theme.separator,
                          },
                        ]}>
                        <View style={[styles.catEmojiBox, { backgroundColor: theme.tint + '14' }]}>
                          <ThemedText style={{ fontSize: 22 }}>{cat.emoji}</ThemedText>
                        </View>
                        <View style={styles.catTextMain}>
                          <ThemedText variant="headline">{cat.id}</ThemedText>
                          <ThemedText variant="caption" secondary numberOfLines={1}>
                            {cat.subtitle}
                          </ThemedText>
                        </View>
                        <View style={styles.catRightBox}>
                          <View style={[styles.countPill, { backgroundColor: theme.tint + '18' }]}>
                            <ThemedText
                              variant="caption"
                              style={{ color: theme.tint, fontWeight: '700' }}>
                              {count} 項
                            </ThemedText>
                          </View>
                          <SymbolView
                            name="chevron.right"
                            size={14}
                            tintColor={theme.textSecondary}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </Glass>

                <View style={[styles.listHeaderRow, { marginTop: Spacing.one }]}>
                  <ThemedText variant="headline">💰 跨通路價差最大精選</ThemedText>
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDailyTab('口腔護理·牙線牙膏');
                    }}>
                    <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700' }}>
                      牙線·口腔專區 ›
                    </ThemedText>
                  </Pressable>
                </View>

                {topSavingsDaily.map((item, idx) => renderDailyProductCard(item, idx))}
              </>
            ) : (
              /* 第二層：點進某個日常用品分類或搜尋結果 */
              <>
                <View style={styles.detailNavRow}>
                  <Pressable
                    style={styles.backBtn}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDailyTab(null);
                      setSearchQuery('');
                    }}>
                    <SymbolView name="chevron.left" size={16} tintColor={theme.tint} />
                    <ThemedText variant="headline" style={{ color: theme.tint, fontWeight: '600' }}>
                      返回日常分類
                    </ThemedText>
                  </Pressable>
                  <ThemedText variant="caption" secondary>
                    共 {activeDailyProducts.length} 項 · 點擊比價
                  </ThemedText>
                </View>

                {/* 單行橫向快速切換（絕不折成三行擠在一起） */}
                {searchQuery.trim().length === 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.singleLineScroll}>
                    {DAILY_CATEGORY_TABS.map((t) => {
                      const active = selectedDailyTab === t.id;
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedDailyTab(t.id);
                            setVisibleCount(PAGE_SIZE);
                          }}
                          style={[
                            styles.singleLinePill,
                            {
                              backgroundColor: active ? theme.tint : theme.tint + '12',
                              borderColor: active ? theme.tint : theme.separator,
                            },
                          ]}>
                          <ThemedText
                            variant="caption"
                            style={{
                              color: active ? '#fff' : theme.text,
                              fontWeight: '700',
                            }}>
                            {t.emoji} {t.shortLabel}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                {activeDailyProducts
                  .slice(0, visibleCount)
                  .map((item, idx) => renderDailyProductCard(item, idx))}

                {visibleCount < activeDailyProducts.length && (
                  <Pressable
                    onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    style={[styles.loadMoreBtn, { backgroundColor: theme.tint + '18' }]}>
                    <ThemedText variant="headline" style={{ color: theme.tint }}>
                      顯示更多商品（剩餘 {activeDailyProducts.length - visibleCount} 項）
                    </ThemedText>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* 模式三：特殊機台雷達（分層：先選機台服務 -> 再看附近門市列表）       */}
        {/* ================================================================= */}
        {viewMode === 'machines' && (
          <View style={styles.section}>
            {selectedServiceId === null ? (
              /* 第一層：選擇想要尋找的特殊機台或門市服務 */
              <>
                <View style={styles.listHeaderRow}>
                  <ThemedText variant="headline">
                    選擇要查詢的 {selectedChain === '7-eleven' ? '7-Eleven' : '全家'} 機台服務
                  </ThemedText>
                  <ThemedText variant="caption" secondary>
                    附近 {specialStores.length} 間門市
                  </ThemedText>
                </View>

                <View style={styles.serviceGrid}>
                  {serviceFilters.map((f) => {
                    const matchCount =
                      f.id === 'all'
                        ? specialStores.filter((s) => s.serviceTags.length > 0).length
                        : specialStores.filter((s) => s.serviceTags.some((t) => t.id === f.id))
                            .length;
                    return (
                      <Glass key={f.id} interactive style={styles.serviceCard}>
                        <Pressable
                          style={styles.serviceCardInner}
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedServiceId(f.id);
                          }}>
                          <ThemedText style={{ fontSize: 24 }}>{f.emoji}</ThemedText>
                          <View style={styles.flex}>
                            <ThemedText variant="headline" numberOfLines={1}>
                              {f.label}
                            </ThemedText>
                            <ThemedText variant="caption" secondary>
                              附近 {matchCount} 間門市 ›
                            </ThemedText>
                          </View>
                        </Pressable>
                      </Glass>
                    );
                  })}
                </View>
              </>
            ) : (
              /* 第二層：符合該特殊機台的附近門市列表 */
              <>
                <View style={styles.detailNavRow}>
                  <Pressable
                    style={styles.backBtn}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedServiceId(null);
                    }}>
                    <SymbolView name="chevron.left" size={16} tintColor={theme.tint} />
                    <ThemedText variant="headline" style={{ color: theme.tint, fontWeight: '600' }}>
                      返回機台分類
                    </ThemedText>
                  </Pressable>
                  <ThemedText variant="caption" secondary>
                    找到 {filteredStores.length} 間門市
                  </ThemedText>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.singleLineScroll}>
                  {serviceFilters.map((f) => {
                    const active = selectedServiceId === f.id;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedServiceId(f.id);
                        }}
                        style={[
                          styles.singleLinePill,
                          {
                            backgroundColor: active ? theme.tint : theme.tint + '12',
                            borderColor: active ? theme.tint : theme.separator,
                          },
                        ]}>
                        <ThemedText
                          variant="caption"
                          style={{
                            color: active ? '#fff' : theme.text,
                            fontWeight: '700',
                          }}>
                          {f.emoji} {f.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {filteredStores.length === 0 ? (
                  <Glass style={styles.emptyCard}>
                    <SymbolView name="storefront" size={38} tintColor={theme.textSecondary} />
                    <ThemedText variant="headline" style={{ marginTop: Spacing.three }}>
                      此行政區暫無配置該機台的門市
                    </ThemedText>
                    <ThemedText
                      variant="caption"
                      secondary
                      style={{ marginTop: Spacing.one, textAlign: 'center' }}>
                      可切換上方其他特殊機台標籤查看周邊門市
                    </ThemedText>
                  </Glass>
                ) : (
                  filteredStores.map((st) => (
                    <Glass key={st.id} style={styles.storeCard}>
                      <View style={styles.storeHeader}>
                        <Image
                          source={getStoreIcon(st.chain)}
                          style={styles.storeLogo}
                          contentFit="contain"
                        />
                        <View style={styles.storeInfoMain}>
                          <View style={styles.storeTitleRow}>
                            <ThemedText variant="headline" numberOfLines={1} style={styles.flex}>
                              {st.name}
                            </ThemedText>
                            <View style={[styles.distPill, { backgroundColor: theme.tint + '18' }]}>
                              <ThemedText
                                variant="caption"
                                style={{ color: theme.tint, fontWeight: '700' }}>
                                {st.distance}m
                              </ThemedText>
                            </View>
                          </View>
                          <ThemedText variant="caption" secondary numberOfLines={1}>
                            {st.address}
                          </ThemedText>
                        </View>

                        <Pressable
                          style={[styles.navBtn, { backgroundColor: theme.tint }]}
                          onPress={() => navigateToStore(st)}>
                          <SymbolView name="location.fill" size={13} tintColor="#fff" />
                          <ThemedText variant="caption" style={{ color: '#fff', fontWeight: '700' }}>
                            導航
                          </ThemedText>
                        </Pressable>
                      </View>

                      <View style={styles.storeTagsWrap}>
                        {st.serviceTags.map((tag) => {
                          const highlighted = selectedServiceId === tag.id;
                          return (
                            <View
                              key={tag.id}
                              style={[
                                styles.storeTagChip,
                                {
                                  backgroundColor: highlighted ? theme.tint : theme.tint + '15',
                                },
                              ]}>
                              <ThemedText style={{ fontSize: 12 }}>{tag.emoji}</ThemedText>
                              <ThemedText
                                variant="caption"
                                style={{
                                  color: highlighted ? '#fff' : theme.tint,
                                  fontWeight: '700',
                                  fontSize: 11,
                                }}>
                                {tag.label}
                              </ThemedText>
                            </View>
                          );
                        })}
                      </View>
                    </Glass>
                  ))
                )}
              </>
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
  chainToggleBox: {
    flexShrink: 0,
    flexDirection: 'row',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    backgroundColor: '#ffffff18',
    gap: 4,
  },
  chainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    gap: 4,
  },
  chainLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  modeSwitcher: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.lg,
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
  },
  section: {
    gap: Spacing.three,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryGroupCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  categoryCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three + 2,
    gap: Spacing.three,
  },
  catEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTextMain: {
    flex: 1,
    gap: 2,
  },
  catRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  detailNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  singleLineScroll: {
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  singleLinePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  productCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    overflow: 'hidden',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  productImgBox: {
    width: 58,
    height: 58,
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
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  productPriceBox: {
    alignItems: 'flex-end',
    gap: 3,
  },
  discPreviewPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  loadMoreBtn: {
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + 2,
  },
  serviceCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  serviceCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.two + 2,
  },
  emptyCard: {
    padding: Spacing.five,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  storeCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  storeLogo: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
  },
  storeInfoMain: {
    flex: 1,
    gap: 2,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  distPill: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  navBtn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    gap: 4,
  },
  storeTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  storeTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    gap: 4,
  },
});
