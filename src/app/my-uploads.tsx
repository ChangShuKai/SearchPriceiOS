import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { GradientBackground } from '@/components/gradient-background';
import { ThemedText } from '@/components/themed-text';
import { getStoreIcon } from '@/constants/store-icons';
import { getChain } from '@/constants/stores';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteMyUpload,
  getMyUploads,
  type UserUploadRecord,
} from '@/lib/db';
import { fetchMyRemoteUploads, syncNow } from '@/lib/sync';
import { formatPrice, getDeviceId, relativeTime } from '@/lib/utils';

export default function MyUploadsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [uploads, setUploads] = useState<UserUploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchLocal = async () => {
      try {
        const deviceId = await getDeviceId();
        const local = await getMyUploads(deviceId);
        if (active) {
          setUploads(local);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };
    void fetchLocal();
    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const deviceId = await getDeviceId();
      await Promise.allSettled([
        fetchMyRemoteUploads(deviceId),
        syncNow(true),
      ]);
      const updated = await getMyUploads(deviceId);
      setUploads(updated);
    } catch {
      // 網路異常降級
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleDelete = useCallback(
    (item: UserUploadRecord) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        '刪除回報紀錄',
        `確定要刪除「${item.product_name}」的價格紀錄嗎？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '確定刪除',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMyUpload(item.id);
                setUploads((prev) => prev.filter((r) => r.id !== item.id));
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) {
                Alert.alert('刪除失敗', e instanceof Error ? e.message : '請稍候再試');
              }
            },
          },
        ],
      );
    },
    [],
  );

  const renderItem = ({ item }: { item: UserUploadRecord }) => {
    const chain = getChain(item.store_chain);
    const storeIcon = getStoreIcon(item.store_chain);

    return (
      <Glass style={styles.card}>
        {/* 卡片頂部：通路標籤與狀態 */}
        <View style={styles.cardHeader}>
          <View style={styles.storeBadge}>
            <Image source={storeIcon} style={styles.storeLogo} contentFit="contain" />
            <ThemedText variant="footnote" style={{ fontWeight: '600', color: theme.text }}>
              {chain.name}
            </ThemedText>
            {item.store_name ? (
              <ThemedText variant="caption" secondary numberOfLines={1} style={styles.storeSubname}>
                · {item.store_name}
              </ThemedText>
            ) : null}
          </View>

          {/* 同步狀態 */}
          <View
            style={[
              styles.syncStatusBadge,
              { backgroundColor: item.synced ? theme.success + '1A' : '#F5A2001A' },
            ]}>
            <SymbolView
              name={{
                ios: item.synced ? 'checkmark.circle.fill' : 'arrow.triangle.2.circlepath',
                android: item.synced ? 'check_circle' : 'sync',
              }}
              size={12}
              tintColor={item.synced ? theme.success : '#F5A200'}
            />
            <ThemedText
              variant="footnote"
              style={{
                color: item.synced ? theme.success : '#F5A200',
                fontWeight: '600',
              }}>
              {item.synced ? '已同步' : '本機待傳'}
            </ThemedText>
          </View>
        </View>

        {/* 卡片主體：商品圖片 + 資訊 + 價格 */}
        <View style={styles.cardBody}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImg} contentFit="cover" />
          ) : (
            <View style={[styles.productImgPlaceholder, { backgroundColor: theme.tint + '12' }]}>
              <SymbolView
                name={{ ios: 'shippingbox.fill', android: 'inventory_2' }}
                size={22}
                tintColor={theme.tint}
              />
            </View>
          )}

          <View style={styles.productInfo}>
            <ThemedText variant="headline" numberOfLines={2} style={styles.productName}>
              {item.product_name}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText variant="caption" secondary style={styles.monoBarcode}>
                {item.barcode}
              </ThemedText>
              <ThemedText variant="caption" secondary>
                · {relativeTime(item.reported_at)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.priceCol}>
            <ThemedText variant="caption" secondary>
              回報價格
            </ThemedText>
            <ThemedText variant="title" style={[styles.priceText, { color: theme.tint }]}>
              {formatPrice(item.price)}
            </ThemedText>
          </View>
        </View>

        {/* 卡片底部操作列 */}
        <View style={styles.cardFooter}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: theme.tint + '14', opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              void Haptics.selectionAsync();
              router.push({ pathname: '/product/[barcode]', params: { barcode: item.barcode } });
            }}>
            <SymbolView
              name={{ ios: 'arrow.right.circle.fill', android: 'arrow_forward' }}
              size={14}
              tintColor={theme.tint}
            />
            <ThemedText variant="footnote" style={{ color: theme.tint, fontWeight: '600' }}>
              查看商品比價
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.deleteBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={8}
            onPress={() => handleDelete(item)}>
            <SymbolView
              name={{ ios: 'trash', android: 'delete' }}
              size={15}
              tintColor={theme.danger}
            />
            <ThemedText variant="caption" style={{ color: theme.danger }}>
              刪除
            </ThemedText>
          </Pressable>
        </View>
      </Glass>
    );
  };

  return (
    <View style={styles.flex}>
      <GradientBackground />

      {/* 頂部導航列 */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: theme.glassFallback, opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={10}
          onPress={() => {
            void Haptics.selectionAsync();
            router.back();
          }}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left' }}
            size={18}
            tintColor={theme.tint}
          />
          <ThemedText variant="body" style={{ color: theme.tint, fontWeight: '600' }}>
            返回
          </ThemedText>
        </Pressable>

        <ThemedText variant="headline" style={styles.headerTitle}>
          我的上傳紀錄
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.refreshBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={10}
          onPress={handleRefresh}
          disabled={refreshing}>
          {refreshing ? (
            <ActivityIndicator size="small" color={theme.tint} />
          ) : (
            <SymbolView
              name={{ ios: 'arrow.clockwise', android: 'refresh' }}
              size={18}
              tintColor={theme.tint}
            />
          )}
        </Pressable>
      </View>

      {/* 統計概況條 */}
      <View style={styles.statsWrap}>
        <Glass style={styles.statsBar}>
          <View style={styles.statsLeft}>
            <SymbolView
              name={{ ios: 'tray.full.fill', android: 'inventory' }}
              size={16}
              tintColor={theme.tint}
            />
            <ThemedText variant="headline" style={{ fontWeight: '600' }}>
              累計上傳 {uploads.length} 筆
            </ThemedText>
          </View>
          <ThemedText variant="caption" secondary>
            {uploads.some((u) => !u.synced)
              ? `${uploads.filter((u) => !u.synced).length} 筆待同步`
              : '全部已雲端同步'}
          </ThemedText>
        </Glass>
      </View>

      {/* 列表內容 */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
          <ThemedText variant="headline" secondary style={{ marginTop: Spacing.two }}>
            載入上傳紀錄中…
          </ThemedText>
        </View>
      ) : uploads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.tint + '15' }]}>
            <SymbolView
              name={{ ios: 'doc.text.magnifyingglass', android: 'manage_search' }}
              size={48}
              tintColor={theme.tint}
            />
          </View>
          <ThemedText variant="title" style={styles.emptyTitle}>
            尚未有上傳紀錄
          </ThemedText>
          <ThemedText variant="body" secondary style={styles.emptySubtitle}>
            您在新增價格回報的每一筆商品價格，都會自動儲存在這裡，隨時可複查與追蹤。
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.emptyActionBtn,
              { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              void Haptics.selectionAsync();
              router.back();
            }}>
            <ThemedText variant="headline" style={{ color: '#fff' }}>
              立即新增第一筆價格
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={uploads}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.four },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.tint}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitle: {
    fontWeight: '700',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsWrap: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  storeLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  storeSubname: {
    flex: 1,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  productImg: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
  },
  productImgPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monoBarcode: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: Spacing.two,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionBtn: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    borderRadius: Radius.pill,
  },
});
