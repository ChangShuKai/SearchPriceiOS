import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DAILY_CATEGORY_TABS,
  FAMILY_SERVICE_FILTERS,
  fetchSpecialServiceStores,
  getDailyNecessityProducts,
  getNewAndPromoProducts,
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
  '7-eleven': '7-11',
  familymart: '全家',
};

export default function RadarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // 1. 通路切換 ('7-eleven' | 'familymart')
  const [selectedChain, setSelectedChain] = useState<RadarChain>('7-eleven');

  // 2. 主模式切換 ('products' = 本週新品·特價牆 | 'machines' = 特殊機台·服務雷達)
  const [viewMode, setViewMode] = useState<RadarViewMode>('products');

  // 3. 新品牆與日常用品子分類與搜尋
  const [feedTab, setFeedTab] = useState<ProductFeedTab>('new');
  const [dailyTab, setDailyTab] = useState<DailyCategoryTab>('口腔護理·牙線牙膏');
  const [searchQuery, setSearchQuery] = useState('');

  // 4. 特殊機台篩選與門市資料
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [loadingStores, setLoadingStores] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [specialStores, setSpecialStores] = useState<SpecialStoreItem[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: 25.033964,
    lng: 121.564468, // 預設台北信義區
  });

  // 取得新品與特惠商品清單（同步立即可用）
  const products = useMemo(() => {
    const raw = getNewAndPromoProducts(selectedChain, feedTab);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }, [selectedChain, feedTab, searchQuery]);

  // 取得日常用品（牙線/牙膏/衛生紙/清潔）跨通路比價清單
  const dailyProducts = useMemo(() => {
    const raw = getDailyNecessityProducts(dailyTab);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [dailyTab, searchQuery]);

  // 載入附近特殊機台門市
  useEffect(() => {
    let cancelled = false;

    const loadSpecialStores = async () => {
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
        const list = await fetchSpecialServiceStores(selectedChain, coords.lat, coords.lng);
        if (!cancelled) {
          setSpecialStores(list);
          setLoadingStores(false);
        }
      } catch {
        if (!cancelled) {
          setLoadingStores(false);
        }
      }
    };

    void loadSpecialStores();
    return () => {
      cancelled = true;
    };
  }, [selectedChain, userCoords]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await fetchSpecialServiceStores(selectedChain, userCoords.lat, userCoords.lng);
      setSpecialStores(list);
    } finally {
      setRefreshing(false);
    }
  }, [selectedChain, userCoords]);

  const handleSelectChain = (chain: RadarChain) => {
    if (chain === selectedChain) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChain(chain);
    setSelectedServiceId('all');
    setLoadingStores(true);
  };

  const serviceFilters = selectedChain === '7-eleven' ? SEVEN_SERVICE_FILTERS : FAMILY_SERVICE_FILTERS;

  const filteredStores = useMemo(() => {
    if (selectedServiceId === 'all') {
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

  return (
    <View style={[styles.flex, !glassSupported && { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.five },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentInsetAdjustmentBehavior="automatic">
        {/* 頂部標題與超商切換 */}
        <View style={styles.header}>
          <View style={styles.flex}>
            <ThemedText variant="largeTitle" style={styles.title}>
              超商雷達
            </ThemedText>
            <ThemedText variant="caption" secondary>
              當期聯名新品·特價牆 ＆ 霜淇淋/思樂冰/熱壓吐司門市雷達
            </ThemedText>
          </View>

          {/* 7-11 / 全家 快速切換膠囊 */}
          <View style={[styles.chainToggleBox, { borderColor: theme.separator }]}>
            <Pressable
              onPress={() => handleSelectChain('7-eleven')}
              style={[
                styles.chainPill,
                selectedChain === '7-eleven' && { backgroundColor: theme.tint },
              ]}>
              <Image source={getStoreIcon('7-eleven')} style={styles.chainLogo} contentFit="contain" />
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
              <Image source={getStoreIcon('familymart')} style={styles.chainLogo} contentFit="contain" />
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
        </View>

        {/* 主功能切換：本週新品 vs 日常用品(牙線/百貨) vs 特殊機台雷達 */}
        <Glass style={styles.modeSwitcher}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode('products');
            }}
            style={[
              styles.modeBtn,
              viewMode === 'products' && { backgroundColor: theme.tint },
            ]}>
            <SymbolView
              name="sparkles"
              size={15}
              tintColor={viewMode === 'products' ? '#fff' : theme.textSecondary}
            />
            <ThemedText
              variant="caption"
              style={{
                color: viewMode === 'products' ? '#fff' : theme.text,
                fontWeight: '700',
              }}>
              超商新品
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode('daily');
            }}
            style={[
              styles.modeBtn,
              viewMode === 'daily' && { backgroundColor: theme.tint },
            ]}>
            <SymbolView
              name="basket.fill"
              size={15}
              tintColor={viewMode === 'daily' ? '#fff' : theme.textSecondary}
            />
            <ThemedText
              variant="caption"
              style={{
                color: viewMode === 'daily' ? '#fff' : theme.text,
                fontWeight: '700',
              }}>
              日常·牙線百貨
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode('machines');
            }}
            style={[
              styles.modeBtn,
              viewMode === 'machines' && { backgroundColor: theme.tint },
            ]}>
            <SymbolView
              name="mappin.and.ellipse"
              size={15}
              tintColor={viewMode === 'machines' ? '#fff' : theme.textSecondary}
            />
            <ThemedText
              variant="caption"
              style={{
                color: viewMode === 'machines' ? '#fff' : theme.text,
                fontWeight: '700',
              }}>
              特殊機台雷達
            </ThemedText>
          </Pressable>
        </Glass>

        {viewMode === 'products' ? (
          /* ================= 模式一：本週新品 · 聯名特價牆 ================= */
          <View style={styles.section}>
            {/* 子分類切換 */}
            <View style={styles.subTabRow}>
              {(
                [
                  { id: 'new', label: '🔥 當期新品上市' },
                  { id: 'promo', label: '⭐ 星級聯名·特惠' },
                  { id: 'health', label: '💪 高蛋白·輕食飲控' },
                ] as { id: ProductFeedTab; label: string }[]
              ).map((t) => {
                const active = feedTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFeedTab(t.id);
                    }}
                    style={[
                      styles.subTabPill,
                      {
                        backgroundColor: active ? theme.tint + '22' : '#ffffff15',
                        borderColor: active ? theme.tint : theme.separator,
                      },
                    ]}>
                    <ThemedText
                      variant="caption"
                      style={{
                        color: active ? theme.tint : theme.text,
                        fontWeight: active ? '700' : '500',
                      }}>
                      {t.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* 關鍵字篩選框 */}
            <Glass style={styles.searchBar}>
              <SymbolView name="magnifyingglass" size={16} tintColor={theme.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`在 ${selectedChain === '7-eleven' ? '7-Eleven' : '全家'} 新品與鮮食中搜尋...`}
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <SymbolView name="xmark.circle.fill" size={16} tintColor={theme.textSecondary} />
                </Pressable>
              )}
            </Glass>

            <View style={styles.listHeaderRow}>
              <ThemedText variant="headline">
                {selectedChain === '7-eleven' ? '7-Eleven' : '全家'} 精選商品
              </ThemedText>
              <ThemedText variant="caption" secondary>
                共 {products.length} 項 · 點擊查看詳細資訊與營養標示
              </ThemedText>
            </View>

            {products.map((item) => (
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
                    {item.description && (
                      <ThemedText variant="caption" secondary numberOfLines={1}>
                        {item.description}
                      </ThemedText>
                    )}

                    <View style={styles.badgeWrap}>
                      {item.badges.map((b, i) => (
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
            ))}
          </View>
        ) : viewMode === 'daily' ? (
          /* ================= 模式二：日常用品 · 牙線生活百貨跨通路比價 ================= */
          <View style={styles.section}>
            <View style={styles.subTabRow}>
              {DAILY_CATEGORY_TABS.map((t) => {
                const active = dailyTab === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDailyTab(t.id);
                    }}
                    style={[
                      styles.subTabPill,
                      {
                        backgroundColor: active ? theme.tint + '22' : '#ffffff15',
                        borderColor: active ? theme.tint : theme.separator,
                      },
                    ]}>
                    <ThemedText
                      variant="caption"
                      style={{
                        color: active ? theme.tint : theme.text,
                        fontWeight: active ? '700' : '500',
                      }}>
                      {t.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <Glass style={styles.searchBar}>
              <SymbolView name="magnifyingglass" size={16} tintColor={theme.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
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

            <View style={styles.listHeaderRow}>
              <ThemedText variant="headline">{dailyTab}</ThemedText>
              <ThemedText variant="caption" secondary>
                共 {dailyProducts.length} 項 · 點擊查看全通路比價
              </ThemedText>
            </View>

            {dailyProducts.map((item: DailyNecessityItem, idx: number) => {
              const chainCount = Object.keys(item.prices).length;
              const savings = chainCount > 1 ? Math.max(0, item.highestPrice - item.lowestPrice) : 0;
              return (
                <Glass key={`${item.id}_${idx}`} interactive style={styles.productCard}>
                  <Pressable
                    style={styles.productRow}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (item.barcode) {
                        router.push(`/product/${item.barcode}`);
                      } else {
                        router.push({ pathname: '/(tabs)', params: { q: item.name } });
                      }
                    }}>
                    <View style={styles.productImgBox}>
                      {item.imageUrl ? (
                        <Image source={item.imageUrl} style={styles.productImg} contentFit="cover" />
                      ) : (
                        <Image
                          source={getStoreIcon(item.lowestChain)}
                          style={{ width: 38, height: 38, borderRadius: 8 }}
                          contentFit="contain"
                        />
                      )}
                    </View>

                    <View style={styles.productMain}>
                      <ThemedText variant="headline" numberOfLines={2}>
                        {item.name}
                      </ThemedText>
                      <View style={styles.badgeWrap}>
                        <View style={[styles.badgePill, { backgroundColor: '#34C75922' }]}>
                          <ThemedText variant="caption" style={{ color: '#248A3D', fontWeight: '700', fontSize: 11 }}>
                            {chainCount > 1 ? '最低：' : '販售通路：'}
                            {CHAIN_NAME_MAP[item.lowestChain] || item.lowestChain} {formatPrice(item.lowestPrice)}
                          </ThemedText>
                        </View>
                        {chainCount > 1 && savings > 0 ? (
                          <View style={[styles.badgePill, { backgroundColor: '#FF3B3018' }]}>
                            <ThemedText variant="caption" style={{ color: '#FF3B30', fontWeight: '700', fontSize: 11 }}>
                              跨店價差省 ${savings}
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
                      ) : item.originalPrice && item.originalPrice > item.lowestPrice ? (
                        <ThemedText variant="caption" secondary style={{ textDecorationLine: 'line-through' }}>
                          原價 {formatPrice(item.originalPrice)}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                </Glass>
              );
            })}
          </View>
        ) : (
          /* ================= 模式二：特殊機台 · 服務門市雷達 ================= */
          <View style={styles.section}>
            <ThemedText variant="caption" secondary>
              點選下方圖示，立即篩選附近有「霜淇淋、思樂冰、熱壓吐司、夯番薯、洗手間、座位區」的門市（由近到遠）：
            </ThemedText>

            {/* 橫向特殊機台篩選膠囊 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}>
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
                      styles.serviceFilterChip,
                      {
                        backgroundColor: active ? theme.tint : '#ffffff18',
                        borderColor: active ? theme.tint : theme.separator,
                      },
                    ]}>
                    <ThemedText style={{ fontSize: 14 }}>{f.emoji}</ThemedText>
                    <ThemedText
                      variant="caption"
                      style={{
                        color: active ? '#fff' : theme.text,
                        fontWeight: active ? '700' : '600',
                      }}>
                      {f.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.listHeaderRow}>
              <ThemedText variant="headline">
                附近符合條件的門市（由近到遠）
              </ThemedText>
              <ThemedText variant="caption" secondary>
                找到 {filteredStores.length} 間門市
              </ThemedText>
            </View>

            {loadingStores ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.tint} />
                <ThemedText secondary style={{ marginTop: Spacing.three }}>
                  正在掃描周圍門市特殊機台配置...
                </ThemedText>
              </View>
            ) : filteredStores.length === 0 ? (
              <Glass style={styles.emptyCard}>
                <SymbolView name="storefront" size={38} tintColor={theme.textSecondary} />
                <ThemedText variant="headline" style={{ marginTop: Spacing.three }}>
                  此行政區暫無配置該機台的門市
                </ThemedText>
                <ThemedText variant="caption" secondary style={{ marginTop: Spacing.one, textAlign: 'center' }}>
                  可切換上方其他特殊機台標籤（如霜淇淋、座位區、洗手間）查看周邊門市
                </ThemedText>
              </Glass>
            ) : (
              filteredStores.map((st) => (
                <Glass key={st.id} style={styles.storeCard}>
                  <View style={styles.storeHeader}>
                    <Image source={getStoreIcon(st.chain)} style={styles.storeLogo} contentFit="contain" />
                    <View style={styles.storeInfoMain}>
                      <View style={styles.storeTitleRow}>
                        <ThemedText variant="headline" numberOfLines={1}>
                          {st.name}
                        </ThemedText>
                        <View style={[styles.distPill, { backgroundColor: theme.tint + '18' }]}>
                          <ThemedText variant="caption" style={{ color: theme.tint, fontWeight: '700' }}>
                            {st.distance}m
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText variant="caption" secondary numberOfLines={1}>
                        {st.address} {st.tel ? `· ${st.tel}` : ''}
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

                  {/* 該門市具備的特殊機台標籤列表 */}
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
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  chainToggleBox: {
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
    paddingHorizontal: Spacing.two,
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
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.md,
    gap: 6,
  },
  section: {
    gap: Spacing.three,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  subTabPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    width: 64,
    height: 64,
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productPriceBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  discPreviewPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  filterScroll: {
    gap: Spacing.two,
    paddingVertical: 2,
  },
  serviceFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  emptyCard: {
    padding: Spacing.five,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  storeCard: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
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
    borderRadius: Radius.md,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
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
