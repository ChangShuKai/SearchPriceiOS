import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openShoppingPage, SHOPPING_ENGINES, type ShoppingEngine } from '@/lib/shopping';

interface Props {
  productName?: string | null;
  barcode: string;
}

export function OnlinePricingCard({ productName, barcode }: Props) {
  const theme = useTheme();
  const [activeEngine, setActiveEngine] = useState<ShoppingEngine>('google');

  // 優先使用商品名稱搜尋，若無商品名稱則使用純條碼搜尋
  const searchQuery = productName?.trim() || barcode;
  const currentEngine = SHOPPING_ENGINES.find((e) => e.id === activeEngine) ?? SHOPPING_ENGINES[0];

  const handleOpen = (engine: ShoppingEngine) => {
    void openShoppingPage(engine, searchQuery, theme.tint);
  };

  return (
    <Glass style={styles.card}>
      {/* 頂部主區塊 */}
      <View style={styles.topRow}>
        <View style={styles.iconContainer}>
          <Image
            source={require('@/assets/google.png')}
            style={styles.googleIcon}
            contentFit="contain"
          />
        </View>

        <View style={styles.titleWrap}>
          <View style={styles.titleRow}>
            <ThemedText variant="headline">{currentEngine.name}</ThemedText>
            <View style={[styles.badge, { backgroundColor: currentEngine.badgeColor + '18' }]}>
              <ThemedText variant="footnote" style={{ color: currentEngine.badgeColor, fontWeight: '700' }}>
                全網比價
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="caption" secondary numberOfLines={2}>
            {currentEngine.description}
          </ThemedText>
        </View>
      </View>

      {/* 搜尋品項提示與一鍵比價主按鈕 */}
      <Pressable
        onPress={() => handleOpen(activeEngine)}
        style={({ pressed }) => [
          styles.mainActionBtn,
          { backgroundColor: theme.tint },
          pressed && { opacity: 0.85 },
        ]}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search' }}
          size={16}
          tintColor="#fff"
        />
        <ThemedText variant="body" style={styles.actionBtnText} numberOfLines={1}>
          在 {currentEngine.shortName} 查詢「{searchQuery}」
        </ThemedText>
        <SymbolView
          name={{ ios: 'arrow.up.right', android: 'open_in_new' }}
          size={14}
          tintColor="#fff"
        />
      </Pressable>

      {/* 底部各比價引擎切換膠囊 */}
      <View style={styles.engineTabs}>
        {SHOPPING_ENGINES.map((engine) => {
          const isActive = engine.id === activeEngine;
          return (
            <Pressable
              key={engine.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setActiveEngine(engine.id);
              }}
              style={[
                styles.enginePill,
                isActive && { backgroundColor: theme.text + '10', borderColor: theme.tint },
              ]}>
              <ThemedText
                variant="footnote"
                style={[
                  styles.enginePillText,
                  isActive ? { color: theme.tint, fontWeight: '700' } : { color: theme.textSecondary },
                ]}>
                {engine.shortName}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  googleIcon: {
    width: 28,
    height: 28,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 11,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    flexShrink: 1,
  },
  engineTabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  enginePill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  enginePillText: {
    fontSize: 13,
  },
});
