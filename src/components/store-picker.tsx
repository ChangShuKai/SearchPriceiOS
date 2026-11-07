import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';

import { Glass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { STORE_CHAINS, type StoreChain } from '@/constants/stores';
import { getStoreIcon } from '@/constants/store-icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { NearbyStore } from '@/lib/location';

export type SelectedStore = { chain: StoreChain; name: string | null };

type Props = {
  value: SelectedStore | null;
  nearby: NearbyStore[];
  detecting: boolean;
  message?: string;
  onSelect: (s: SelectedStore) => void;
  onRefresh: () => void;
};

/**
 * 販售通路迷你選單（精簡 iOS 浮動彈窗，自帶 Liquid Glass）
 */
export function StorePicker({
  value,
  nearby,
  detecting,
  message,
  onSelect,
  onRefresh,
}: Props) {
  const theme = useTheme();
  const [popoverVisible, setPopoverVisible] = React.useState(false);
  const [customInputVisible, setCustomInputVisible] = React.useState(false);
  const [customName, setCustomName] = React.useState('');

  const otherChain = STORE_CHAINS.find((c) => c.id === 'other') ?? STORE_CHAINS[STORE_CHAINS.length - 1];
  const nearbyChainIds = new Set(nearby.map((n) => n.chain.id));
  const standardChains = STORE_CHAINS.filter((c) => c.id !== 'other' && !nearbyChainIds.has(c.id));

  const promptCustomStore = () => {
    setPopoverVisible(false);
    if (Platform.OS === 'ios') {
      Alert.prompt(
        '輸入店家名稱',
        '請輸入自訂店家或賣場名稱（例如：小北百貨）：',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '確定',
            onPress: (text) => {
              const trimmed = text?.trim();
              if (trimmed) onSelect({ chain: otherChain, name: trimmed });
            },
          },
        ],
        'plain-text',
        value?.chain.id === 'other' ? value.name ?? '' : ''
      );
    } else {
      setCustomName(value?.chain.id === 'other' ? value.name ?? '' : '');
      setCustomInputVisible(true);
    }
  };

  const isOther = value?.chain.id === 'other';

  return (
    <>
      {/* 觸發膠囊 */}
      <Pressable style={styles.field} onPress={() => setPopoverVisible(true)}>
        {value ? (
          <View style={styles.storeTag}>
            <View style={[styles.iconBadge, { backgroundColor: '#fff' }]}>
              {getStoreIcon(value.chain.id) ? (
                <Image source={getStoreIcon(value.chain.id)} style={styles.storeLogoImg} contentFit="contain" />
              ) : (
                <SymbolView name={value.chain.icon} size={14} tintColor={value.chain.color} />
              )}
            </View>
            <ThemedText variant="body" numberOfLines={1} style={styles.storeNameText}>
              {isOther ? (value.name ? `其他 · ${value.name}` : '其他店家') : (value.name || value.chain.name)}
            </ThemedText>
          </View>
        ) : (
          <ThemedText secondary style={styles.flex}>
            {detecting ? '定位偵測中…' : '選擇通路'}
          </ThemedText>
        )}
        {detecting ? (
          <ActivityIndicator size="small" />
        ) : (
          <SymbolView
            name={{ ios: 'chevron.up.chevron.down', android: 'unfold_more' }}
            size={14}
            tintColor={theme.textSecondary}
          />
        )}
      </Pressable>

      {/* 輕量級精緻彈出選單（Liquid Glass Popover） */}
      <Modal
        visible={popoverVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopoverVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPopoverVisible(false)}>
          <Glass style={styles.popoverCard}>
            {/* 標題與定位膠囊 */}
            <View style={styles.popoverHeader}>
              <ThemedText variant="headline" style={styles.popoverTitle}>選擇通路</ThemedText>
              <Pressable onPress={onRefresh} hitSlop={8} style={styles.locateBtn}>
                <SymbolView name={{ ios: 'location.fill', android: 'my_location' }} size={12} tintColor={theme.tint} />
                <ThemedText variant="footnote" style={{ color: theme.tint, fontWeight: '600' }}>
                  重新定位
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
              {/* 附近門市（GPS） */}
              {nearby.length > 0 && (
                <View style={styles.sectionWrap}>
                  <ThemedText variant="footnote" secondary style={styles.sectionLabel}>
                    📍 附近門市
                  </ThemedText>
                  {nearby.slice(0, 3).map((n, i) => (
                    <StoreItem
                      key={`near-${i}`}
                      chain={n.chain}
                      title={n.name}
                      subtitle={`${n.distance}m`}
                      selected={value?.chain.id === n.chain.id && value?.name === n.name}
                      onPress={() => {
                        onSelect({ chain: n.chain, name: n.name });
                        setPopoverVisible(false);
                      }}
                    />
                  ))}
                </View>
              )}

              {/* 常見通路 */}
              <View style={styles.sectionWrap}>
                <ThemedText variant="footnote" secondary style={styles.sectionLabel}>
                  常見通路
                </ThemedText>
                {standardChains.map((c) => (
                  <StoreItem
                    key={c.id}
                    chain={c}
                    title={c.name}
                    selected={value?.chain.id === c.id && !value?.name}
                    onPress={() => {
                      onSelect({ chain: c, name: null });
                      setPopoverVisible(false);
                    }}
                  />
                ))}
              </View>

              {/* 其他 */}
              <View style={[styles.sectionWrap, { marginBottom: 4 }]}>
                <StoreItem
                  chain={otherChain}
                  title="其他店家…"
                  subtitle={isOther && value.name ? value.name : '手動輸入'}
                  selected={isOther}
                  onPress={promptCustomStore}
                />
              </View>
            </ScrollView>
          </Glass>
        </Pressable>
      </Modal>

      {/* Android 自訂輸入彈窗 */}
      <Modal
        visible={customInputVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomInputVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCustomInputVisible(false)}>
          <Glass style={styles.customDialog}>
            <ThemedText variant="headline" style={{ marginBottom: Spacing.two }}>
              輸入店家名稱
            </ThemedText>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              placeholder="例如：小北百貨、某某雜貨店"
              placeholderTextColor={theme.textSecondary}
              style={[styles.customInput, { color: theme.text, borderColor: theme.separator }]}
              autoFocus
            />
            <View style={styles.dialogBtnRow}>
              <Pressable
                style={[styles.dialogBtn, { borderColor: theme.separator }]}
                onPress={() => setCustomInputVisible(false)}>
                <ThemedText secondary>取消</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.dialogBtn, { backgroundColor: theme.tint }]}
                onPress={() => {
                  const trimmed = customName.trim();
                  if (trimmed) onSelect({ chain: otherChain, name: trimmed });
                  setCustomInputVisible(false);
                }}>
                <ThemedText style={{ color: '#fff', fontWeight: '600' }}>確定</ThemedText>
              </Pressable>
            </View>
          </Glass>
        </Pressable>
      </Modal>
    </>
  );
}

function StoreItem({
  chain,
  title,
  subtitle,
  selected,
  onPress,
}: {
  chain: StoreChain;
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.storeItem,
        selected && { backgroundColor: theme.tint + '18' },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.itemBadge, { backgroundColor: '#fff' }]}>
        {getStoreIcon(chain.id) ? (
          <Image source={getStoreIcon(chain.id)} style={styles.storeItemLogoImg} contentFit="contain" />
        ) : (
          <SymbolView name={chain.icon} size={15} tintColor={chain.color} />
        )}
      </View>
      <ThemedText variant="body" style={styles.itemTitle} numberOfLines={1}>
        {title}
      </ThemedText>
      {subtitle && (
        <ThemedText variant="footnote" secondary style={styles.itemSubtitle}>
          {subtitle}
        </ThemedText>
      )}
      {selected && (
        <SymbolView name={{ ios: 'checkmark', android: 'check' }} size={16} tintColor={theme.tint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 46,
    flex: 1,
  },
  storeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storeLogoImg: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  storeNameText: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  popoverCard: {
    width: 290,
    maxHeight: 420,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  popoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.two,
  },
  popoverTitle: {
    fontSize: 17,
  },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  scrollList: {
    maxHeight: 330,
  },
  sectionWrap: {
    marginBottom: Spacing.two,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    fontWeight: '600',
    fontSize: 12,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    gap: 10,
  },
  itemBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  storeItemLogoImg: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
  },
  itemSubtitle: {
    marginRight: 2,
  },
  customDialog: {
    width: 300,
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  customInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: Spacing.three,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  dialogBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
