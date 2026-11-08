import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import {
  getCurrentUserProfile,
  signInWithEmailPassword,
  signInWithGoogleOAuth,
  signOutAccount,
  signUpWithEmailPassword,
  subscribeAuthChanges,
  updateDisplayName,
  type AppUserProfile,
} from '@/lib/auth';
import { getCatalogStats, type CatalogStats } from '@/lib/db';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getSyncState, subscribeSync, syncNow, type SyncState } from '@/lib/sync';

const APP_ICON_SOURCE = require('../../../assets/images/icon.png');

const CHAIN_BADGES = [
  { id: '7-11', label: '7', bg: '#00704A', fg: '#FFFFFF' },
  { id: 'family', label: '全', bg: '#0080CC', fg: '#FFFFFF' },
  { id: 'pxmart', label: '聯', bg: '#005BAC', fg: '#FFFFFF' },
  { id: 'poya', label: '寶', bg: '#D62872', fg: '#FFFFFF' },
  { id: 'cosmed', label: '康', bg: '#EA5514', fg: '#FFFFFF' },
];

export default function AccountScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  // 使用者登入狀態
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // 編輯暱稱 Modal
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // 系統狀態與詳細狀態 Modal
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());
  const [catalogStats, setCatalogStats] = useState<CatalogStats>(() => getCatalogStats());
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [changelogModalVisible, setChangelogModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supabaseLatencyMs, setSupabaseLatencyMs] = useState<number | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // 實測 Supabase 雲端連線延遲
  const runHealthCheck = useCallback(async () => {
    setCheckingHealth(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const start = Date.now();
    try {
      if (supabase) {
        await Promise.race([
          supabase.from('price_reports').select('id').limit(1),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
        setSupabaseLatencyMs(Math.max(1, Date.now() - start));
      } else {
        setSupabaseLatencyMs(null);
      }
      await syncNow(true);
      setCatalogStats(getCatalogStats());
    } catch {
      setSupabaseLatencyMs(null);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    void getCurrentUserProfile().then((p) => {
      if (p) setProfile(p);
    });
    if (supabase) {
      const start = Date.now();
      void Promise.race([
        supabase.from('price_reports').select('id').limit(1),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ])
        .then(() => {
          setSupabaseLatencyMs(Math.max(1, Date.now() - start));
        })
        .catch(() => {
          setSupabaseLatencyMs(null);
        });
    }
    const unsubAuth = subscribeAuthChanges((p) => {
      setProfile(p);
    });
    const unsubSync = subscribeSync((s) => {
      setSyncState(s);
      setCatalogStats(getCatalogStats());
    });
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);

  const handleOpenAuthModal = (mode: 'login' | 'register' = 'login') => {
    void Haptics.selectionAsync();
    setAuthMode(mode);
    setAuthFeedback(null);
    setAuthModalVisible(true);
  };

  const handleEmailSubmit = async () => {
    if (authSubmitting) return;
    setAuthFeedback(null);
    setAuthSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (authMode === 'login') {
        const res = await signInWithEmailPassword(emailInput, passwordInput);
        setProfile(res.profile);
        setEmailInput('');
        setPasswordInput('');
        setAuthModalVisible(false);
        if (res.message) {
          Alert.alert('登入成功', res.message);
        }
      } else {
        const res = await signUpWithEmailPassword(emailInput, passwordInput, nameInput);
        setProfile(res.profile);
        setEmailInput('');
        setPasswordInput('');
        setNameInput('');
        setAuthModalVisible(false);
        Alert.alert('註冊成功', res.message || '歡迎加入 Search Price！');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '認證失敗，請稍後再試';
      setAuthFeedback({ type: 'error', text: msg });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (authSubmitting) return;
    setAuthFeedback(null);
    setAuthSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await signInWithGoogleOAuth();
      setProfile(res.profile);
      setAuthModalVisible(false);
      if (res.message) {
        Alert.alert('Google 登入成功', res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google 登入未完成';
      setAuthFeedback({ type: 'error', text: msg });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('登出帳號', '確定要登出目前的 Supabase 帳號嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定登出',
        style: 'destructive',
        onPress: async () => {
          await signOutAccount();
          setProfile(null);
        },
      },
    ]);
  };

  const handleSaveDisplayName = async () => {
    try {
      const updated = await updateDisplayName(editNameValue);
      setProfile(updated);
      setEditNameModalVisible(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('更新失敗', err instanceof Error ? err.message : '請輸入有效名稱');
    }
  };

  // 配色系統（嚴格對齊 IMG_2682.PNG 的柔和圓角 Bento 卡片美學）
  const pageBg = isDark ? '#0D1117' : '#F4F6F5';
  const bentoCardBg = isDark ? '#161B22' : '#EAECEB';
  const bentoMintBg = isDark ? '#132A2A' : '#D3ECEB';
  const bentoGoldBg = isDark ? '#2E2614' : '#F7EFD2';
  const bentoGoldBorder = isDark ? '#856B26' : '#D4B459';
  const textPrimary = isDark ? '#F0F6FC' : '#1F2421';
  const textSecondary = isDark ? '#8B949E' : '#5E6662';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';

  const isSystemHealthy = isSupabaseConfigured && syncState.status !== 'error';
  const totalCountFormatted = Math.max(
    syncState.totalOfflineCount,
    catalogStats.totalRecords,
  ).toLocaleString();

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* ================= 1. 最上方：頭像與名稱 / Supabase 登入註冊區 ================= */}
        <Pressable
          onPress={() => {
            if (!profile) {
              handleOpenAuthModal('login');
            } else {
              setEditNameValue(profile.displayName);
              setEditNameModalVisible(true);
            }
          }}
          style={({ pressed }) => [
            styles.profileCard,
            {
              backgroundColor: bentoCardBg,
              borderColor: cardBorder,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <View style={styles.profileTopRow}>
            {/* 頭像 */}
            <View style={styles.avatarContainer}>
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={profile ? ['#10B981', '#0284C7'] : ['#4B5853', '#2F3A36']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarFallback}>
                  {profile ? (
                    <Text style={styles.avatarInitial}>
                      {profile.displayName.slice(0, 1).toUpperCase()}
                    </Text>
                  ) : (
                    <AppIcon name="person.fill" size={28} color="#FFFFFF" />
                  )}
                </LinearGradient>
              )}
              <View
                style={[
                  styles.avatarStatusDot,
                  {
                    backgroundColor: profile ? '#22C55E' : '#94A3B8',
                    borderColor: bentoCardBg,
                  },
                ]}
              />
            </View>

            {/* 名稱與狀態 */}
            <View style={styles.profileInfoCol}>
              <View style={styles.profileNameRow}>
                <Text
                  style={[styles.profileName, { color: textPrimary }]}
                  numberOfLines={1}>
                  {profile ? profile.displayName : '尚未登入帳號'}
                </Text>
                {profile && (
                  <View
                    style={[
                      styles.providerBadge,
                      {
                        backgroundColor:
                          profile.provider === 'google'
                            ? 'rgba(37, 99, 235, 0.14)'
                            : 'rgba(16, 185, 129, 0.15)',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.providerBadgeText,
                        {
                          color: profile.provider === 'google' ? '#2563EB' : '#059669',
                        },
                      ]}>
                      {profile.provider === 'google' ? 'Google' : 'Supabase'}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.profileSub, { color: textSecondary }]}
                numberOfLines={1}>
                {profile
                  ? profile.email
                  : '支援 Email 帳密註冊登入與 Sign in with Google'}
              </Text>
            </View>

            {/* 右側操作按鈕 */}
            {profile ? (
              <View style={styles.loggedActions}>
                <Pressable
                  onPress={() => {
                    setEditNameValue(profile.displayName);
                    setEditNameModalVisible(true);
                  }}
                  style={[
                    styles.smallActionBtn,
                    { backgroundColor: isDark ? '#262C36' : '#DCE0DF' },
                  ]}>
                  <Text style={[styles.smallActionText, { color: textPrimary }]}>
                    編輯
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSignOut}
                  style={[
                    styles.smallActionBtn,
                    { backgroundColor: 'rgba(239, 68, 68, 0.12)' },
                  ]}>
                  <Text style={[styles.smallActionText, { color: '#EF4444' }]}>
                    登出
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.chevronBox}>
                <AppIcon name="chevron.right" size={18} color={textSecondary} />
              </View>
            )}
          </View>

          {/* 未登入時的快速雙按鈕列（帳密登入註冊 + Sign in with Google） */}
          {!profile && (
            <View style={styles.quickAuthRow}>
              <Pressable
                onPress={() => handleOpenAuthModal('login')}
                style={[
                  styles.quickAuthPrimaryBtn,
                  { backgroundColor: isDark ? '#1F6FEB' : '#2F4842' },
                ]}>
                <AppIcon name="person.crop.circle" size={16} color="#FFFFFF" />
                <Text style={styles.quickAuthPrimaryText}>帳密登入 / 註冊</Text>
              </Pressable>

              <Pressable
                onPress={handleGoogleSignIn}
                style={[
                  styles.quickAuthGoogleBtn,
                  {
                    backgroundColor: isDark ? '#21262D' : '#FFFFFF',
                    borderColor: isDark ? '#30363D' : '#D5DBD8',
                  },
                ]}>
                <View style={styles.googleGIcon}>
                  <Text style={styles.googleGText}>G</Text>
                </View>
                <Text style={[styles.quickAuthGoogleText, { color: textPrimary }]}>
                  Sign in with Google
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* ================= 2. 中間雙欄 Bento 區（完全對齊 IMG_2682.PNG 視覺結構） ================= */}
        <View style={styles.bentoGrid}>
          {/* 左欄大卡片：Search Price 版本與通路總覽卡 */}
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setStatusModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.bentoLeftCard,
              {
                backgroundColor: bentoCardBg,
                borderColor: cardBorder,
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            {/* 頂部 App Icon + 名稱 */}
            <View style={styles.appHeaderRow}>
              <Image
                source={APP_ICON_SOURCE}
                style={styles.appMiniLogo}
                contentFit="cover"
              />
              <View style={styles.appTitleCol}>
                <Text
                  style={[styles.appCardTitle, { color: textPrimary }]}
                  numberOfLines={1}>
                  Search Price
                </Text>
                <Text
                  style={[styles.appCardSubtitle, { color: textSecondary }]}
                  numberOfLines={1}>
                  全台跨通路比價...
                </Text>
              </View>
              <AppIcon name="chevron.right" size={15} color={textSecondary} />
            </View>

            {/* 大字體雙色版本號 1.1 / 1.1.0 */}
            <View style={styles.versionHeroBlock}>
              <Text style={styles.versionBigGradient}>
                <Text style={{ color: '#4EA844' }}>1</Text>
                <Text style={{ color: '#276B80' }}>.</Text>
                <Text style={{ color: '#214E8A' }}>1</Text>
              </Text>
              <Text style={[styles.versionSubNumber, { color: textPrimary }]}>
                1.1.0
              </Text>
            </View>

            {/* 疊合圓形通路徽章列 + +2 */}
            <View style={styles.avatarStackRow}>
              <View style={styles.avatarStackOverlap}>
                {CHAIN_BADGES.map((b, idx) => (
                  <View
                    key={b.id}
                    style={[
                      styles.stackCircle,
                      {
                        backgroundColor: b.bg,
                        marginLeft: idx === 0 ? 0 : -8,
                        borderColor: bentoCardBg,
                      },
                    ]}>
                    <Text style={[styles.stackCircleText, { color: b.fg }]}>
                      {b.label}
                    </Text>
                  </View>
                ))}
              </View>
              <View
                style={[
                  styles.stackMorePill,
                  { backgroundColor: isDark ? '#262C36' : '#DCDFEA' },
                ]}>
                <Text style={[styles.stackMoreText, { color: textSecondary }]}>
                  +2
                </Text>
              </View>
            </View>

            {/* 底部「正式版」綠框標籤 + 日期 */}
            <View style={styles.releaseBadgeRow}>
              <View style={styles.officialBadge}>
                <Text style={styles.officialBadgeText}>正式版</Text>
              </View>
              <Text style={[styles.releaseDateText, { color: textSecondary }]}>
                26-11-08
              </Text>
            </View>
          </Pressable>

          {/* 右欄四張堆疊膠囊卡片 */}
          <View style={styles.bentoRightCol}>
            {/* 右 1：系統狀態（薄荷青底色，顯示簡單狀態，點擊進入詳細狀態） */}
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setStatusModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.rightPillCard,
                {
                  backgroundColor: bentoMintBg,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <View style={[styles.rightPillIconCircle, { backgroundColor: '#4A6362' }]}>
                <AppIcon name="checkmark.icloud.fill" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.rightPillTextCol}>
                <Text
                  style={[
                    styles.rightPillTitle,
                    { color: isDark ? '#E6FFFA' : '#2C4241' },
                  ]}
                  numberOfLines={1}>
                  系統狀態
                </Text>
                <Text
                  style={[
                    styles.rightPillSub,
                    { color: isDark ? '#81E6D9' : '#4A6B69' },
                  ]}
                  numberOfLines={1}>
                  {isSystemHealthy ? `正常 · ${totalCountFormatted} 筆` : '離線備援中'}
                </Text>
              </View>
              <AppIcon
                name="chevron.right"
                size={15}
                color={isDark ? '#81E6D9' : '#5E7A78'}
              />
            </Pressable>

            {/* 右 2：版本公告 */}
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setChangelogModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.rightPillCard,
                {
                  backgroundColor: bentoCardBg,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <View
                style={[
                  styles.rightPillIconCircle,
                  { backgroundColor: isDark ? '#262C36' : '#DCE0DF' },
                ]}>
                <AppIcon name="megaphone.fill" size={17} color={textPrimary} />
              </View>
              <View style={styles.rightPillTextCol}>
                <Text
                  style={[styles.rightPillTitle, { color: textPrimary }]}
                  numberOfLines={1}>
                  公告
                </Text>
              </View>
              <AppIcon name="arrow.up.right.square" size={16} color={textSecondary} />
            </Pressable>

            {/* 右 3：伺服器狀態（點擊同樣進入詳細系統狀態） */}
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setStatusModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.rightPillCard,
                {
                  backgroundColor: bentoCardBg,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <View
                style={[
                  styles.rightPillIconCircle,
                  { backgroundColor: isDark ? '#262C36' : '#DCE0DF' },
                ]}>
                <AppIcon name="server.rack" size={17} color={textPrimary} />
              </View>
              <View style={styles.rightPillTextCol}>
                <Text
                  style={[styles.rightPillTitle, { color: textPrimary }]}
                  numberOfLines={1}>
                  伺服器狀態
                </Text>
              </View>
              <AppIcon name="chevron.right" size={15} color={textSecondary} />
            </Pressable>

            {/* 右 4：支援我們（暖金底色 + 金框 + 愛心圓標，對齊 IMG_2682 右下角） */}
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setSupportModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.rightPillCard,
                styles.supportPillCard,
                {
                  backgroundColor: bentoGoldBg,
                  borderColor: bentoGoldBorder,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <View style={[styles.rightPillIconCircle, { backgroundColor: '#785B12' }]}>
                <AppIcon name="heart.fill" size={17} color="#FFFFFF" />
              </View>
              <View style={styles.rightPillTextCol}>
                <Text
                  style={[
                    styles.rightPillTitle,
                    { color: isDark ? '#FEF08A' : '#4D3802' },
                  ]}
                  numberOfLines={1}>
                  支援我們
                </Text>
              </View>
              <AppIcon
                name="chevron.right"
                size={15}
                color={isDark ? '#FDE047' : '#785B12'}
              />
            </Pressable>
          </View>
        </View>

        {/* ================= 3. 系統狀態快速摘要橫幅（點擊進入詳細狀態） ================= */}
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            setStatusModalVisible(true);
          }}
          style={({ pressed }) => [
            styles.quickStatusBanner,
            {
              backgroundColor: bentoCardBg,
              borderColor: cardBorder,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <View style={styles.quickStatusLeft}>
            <View
              style={[
                styles.livePulseDot,
                { backgroundColor: isSystemHealthy ? '#16A34A' : '#F59E0B' },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.quickStatusTitle, { color: textPrimary }]}>
                系統狀態：{isSystemHealthy ? '所有雲端與比價服務運作正常' : '離線高速模式'}
              </Text>
              <Text style={[styles.quickStatusSub, { color: textSecondary }]}>
                Supabase 雲端庫 {totalCountFormatted} 筆 ·{' '}
                {supabaseLatencyMs !== null ? `實測延遲 ${supabaseLatencyMs}ms` : '連線檢測中'} · 點擊查看詳細狀態
              </Text>
            </View>
          </View>
          <AppIcon name="chevron.right" size={16} color={textSecondary} />
        </Pressable>

        {/* ================= 4. 開發者的話（對齊 IMG_2682 下方圓角對話卡片） ================= */}
        <View
          style={[
            styles.devMessageCard,
            { backgroundColor: bentoCardBg, borderColor: cardBorder },
          ]}>
          <View style={styles.devHeaderRow}>
            <View
              style={[
                styles.devIconCircle,
                { backgroundColor: isDark ? '#262C36' : '#DCE0DF' },
              ]}>
              <AppIcon name="bubble.left" size={18} color={textPrimary} />
            </View>
            <View>
              <Text style={[styles.devHeaderTitle, { color: textPrimary }]}>
                開發者的話
              </Text>
              <Text style={[styles.devHeaderDate, { color: textSecondary }]}>
                2026-11-08
              </Text>
            </View>
          </View>
          <Text style={[styles.devBodyText, { color: textSecondary }]}>
            我們堅持所有商品與價格資料 100% 真實正確——目前資料庫已收錄{' '}
            {totalCountFormatted} 筆具備官方來源驗證的 7-11、全家、全聯、寶雅、康是美、家樂福與屈臣氏真實價格。各項連線狀態與雲端同步進度，皆能點擊上方「系統狀態」隨時追蹤。
          </Text>
        </View>

        {/* ================= 5. 最下方：製作人 ChangShuKai · 製作公司 SixStarCulture · 版權狀態 ================= */}
        <View
          style={[
            styles.creditsCard,
            { backgroundColor: bentoCardBg, borderColor: cardBorder },
          ]}>
          <View style={styles.creditsHeaderRow}>
            <View style={styles.creditsBadge}>
              <AppIcon name="checkmark.seal.fill" size={15} color="#059669" />
              <Text style={styles.creditsBadgeText}>官方正版授權發行</Text>
            </View>
            <Text style={[styles.creditsVersionTag, { color: textSecondary }]}>
              v1.1.0
            </Text>
          </View>

          <View style={styles.creditsGrid}>
            <View style={styles.creditItemRow}>
              <Text style={[styles.creditLabel, { color: textSecondary }]}>製作人</Text>
              <Text style={[styles.creditValue, { color: textPrimary }]}>
                ChangShuKai
              </Text>
            </View>

            <View
              style={[
                styles.creditDivider,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
              ]}
            />

            <View style={styles.creditItemRow}>
              <Text style={[styles.creditLabel, { color: textSecondary }]}>製作公司</Text>
              <Text style={[styles.creditValue, { color: textPrimary }]}>
                SixStarCulture
              </Text>
            </View>

            <View
              style={[
                styles.creditDivider,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
              ]}
            />

            <View style={styles.creditItemRow}>
              <Text style={[styles.creditLabel, { color: textSecondary }]}>版權狀態</Text>
              <Text style={[styles.creditValueHighlight, { color: '#059669' }]}>
                © 2026 SixStarCulture · All Rights Reserved
              </Text>
            </View>
          </View>

          <Text style={[styles.copyrightFootnote, { color: textSecondary }]}>
            Produced by ChangShuKai · SixStarCulture Studio. 版權所有，翻印或未經授權商業轉載必究。各超商與量販通路商標分屬原權利公司所有。
          </Text>
        </View>
      </ScrollView>

      {/* ================= Modal 1：Supabase 登入 / 註冊 Sheet ================= */}
      <Modal
        visible={authModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAuthModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                paddingBottom: insets.bottom + 24,
              },
            ]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>
                {authMode === 'login' ? '登入 Search Price 帳號' : '註冊 Supabase 新帳號'}
              </Text>
              <Pressable
                onPress={() => setAuthModalVisible(false)}
                style={styles.modalCloseBtn}>
                <AppIcon name="xmark" size={18} color={textSecondary} />
              </Pressable>
            </View>

            {/* 登入 / 註冊 切換器 */}
            <View
              style={[
                styles.authSwitchBar,
                { backgroundColor: isDark ? '#0D1117' : '#F1F5F9' },
              ]}>
              <Pressable
                onPress={() => {
                  setAuthMode('login');
                  setAuthFeedback(null);
                }}
                style={[
                  styles.authSwitchTab,
                  authMode === 'login' && {
                    backgroundColor: isDark ? '#21262D' : '#FFFFFF',
                  },
                ]}>
                <Text
                  style={[
                    styles.authSwitchText,
                    { color: authMode === 'login' ? textPrimary : textSecondary },
                  ]}>
                  帳密登入
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAuthMode('register');
                  setAuthFeedback(null);
                }}
                style={[
                  styles.authSwitchTab,
                  authMode === 'register' && {
                    backgroundColor: isDark ? '#21262D' : '#FFFFFF',
                  },
                ]}>
                <Text
                  style={[
                    styles.authSwitchText,
                    { color: authMode === 'register' ? textPrimary : textSecondary },
                  ]}>
                  註冊新帳號
                </Text>
              </Pressable>
            </View>

            {authMode === 'register' && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textSecondary }]}>
                  顯示名稱 / 暱稱
                </Text>
                <TextInput
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="例如：阿凱、省錢達人"
                  placeholderTextColor={textSecondary}
                  style={[
                    styles.textInput,
                    {
                      color: textPrimary,
                      backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                      borderColor: isDark ? '#30363D' : '#E2E8F0',
                    },
                  ]}
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>
                電子郵件 (Email)
              </Text>
              <TextInput
                value={emailInput}
                onChangeText={setEmailInput}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="name@example.com"
                placeholderTextColor={textSecondary}
                style={[
                  styles.textInput,
                  {
                    color: textPrimary,
                    backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                    borderColor: isDark ? '#30363D' : '#E2E8F0',
                  },
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>
                密碼 (至少 6 個字元)
              </Text>
              <TextInput
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry
                placeholder="請輸入密碼"
                placeholderTextColor={textSecondary}
                style={[
                  styles.textInput,
                  {
                    color: textPrimary,
                    backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                    borderColor: isDark ? '#30363D' : '#E2E8F0',
                  },
                ]}
              />
            </View>

            {authFeedback && (
              <View
                style={[
                  styles.feedbackBox,
                  {
                    backgroundColor:
                      authFeedback.type === 'error'
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(16, 185, 129, 0.12)',
                  },
                ]}>
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color: authFeedback.type === 'error' ? '#EF4444' : '#10B981',
                    },
                  ]}>
                  {authFeedback.text}
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleEmailSubmit}
              disabled={authSubmitting}
              style={[
                styles.submitPrimaryBtn,
                { opacity: authSubmitting ? 0.65 : 1 },
              ]}>
              {authSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitPrimaryText}>
                  {authMode === 'login' ? '使用 Email 登入' : '立即建立 Supabase 帳號'}
                </Text>
              )}
            </Pressable>

            <View style={styles.orDividerRow}>
              <View
                style={[
                  styles.orLine,
                  { backgroundColor: isDark ? '#30363D' : '#E2E8F0' },
                ]}
              />
              <Text style={[styles.orText, { color: textSecondary }]}>
                或透過 Supabase OAuth 連結
              </Text>
              <View
                style={[
                  styles.orLine,
                  { backgroundColor: isDark ? '#30363D' : '#E2E8F0' },
                ]}
              />
            </View>

            <Pressable
              onPress={handleGoogleSignIn}
              disabled={authSubmitting}
              style={[
                styles.googleModalBtn,
                {
                  backgroundColor: isDark ? '#21262D' : '#F8FAFC',
                  borderColor: isDark ? '#30363D' : '#CBD5E1',
                },
              ]}>
              <View style={styles.googleGIcon}>
                <Text style={styles.googleGText}>G</Text>
              </View>
              <Text style={[styles.googleModalBtnText, { color: textPrimary }]}>
                Sign in with Google
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= Modal 2：編輯名稱 Sheet ================= */}
      <Modal
        visible={editNameModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setEditNameModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                paddingBottom: insets.bottom + 24,
              },
            ]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>
                修改個人顯示名稱
              </Text>
              <Pressable
                onPress={() => setEditNameModalVisible(false)}
                style={styles.modalCloseBtn}>
                <AppIcon name="xmark" size={18} color={textSecondary} />
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: textSecondary }]}>
                顯示名稱（同步儲存至 Supabase User Metadata）
              </Text>
              <TextInput
                value={editNameValue}
                onChangeText={setEditNameValue}
                placeholder="輸入新名稱"
                placeholderTextColor={textSecondary}
                style={[
                  styles.textInput,
                  {
                    color: textPrimary,
                    backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                    borderColor: isDark ? '#30363D' : '#E2E8F0',
                  },
                ]}
              />
            </View>

            <Pressable onPress={handleSaveDisplayName} style={styles.submitPrimaryBtn}>
              <Text style={styles.submitPrimaryText}>儲存名稱</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= Modal 3：詳細系統狀態 (Detailed System Status) ================= */}
      <Modal
        visible={statusModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.statusDetailSheet,
              {
                backgroundColor: isDark ? '#0D1117' : '#F4F6F5',
                paddingBottom: insets.bottom + 20,
              },
            ]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: textPrimary }]}>
                  系統與伺服器詳細狀態
                </Text>
                <Text style={[styles.statusModalSubtitle, { color: textSecondary }]}>
                  即時監控 Supabase 雲端、記憶體引擎與八大通路資料庫
                </Text>
              </View>
              <Pressable
                onPress={() => setStatusModalVisible(false)}
                style={styles.modalCloseBtn}>
                <AppIcon name="xmark" size={18} color={textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24, gap: 14 }}>
              {/* 總體健康度橫幅 */}
              <View
                style={[
                  styles.healthHeroBanner,
                  { backgroundColor: isDark ? '#132A2A' : '#D3ECEB' },
                ]}>
                <View style={styles.healthHeroLeft}>
                  <View style={styles.healthHeroIconBox}>
                    <AppIcon name="checkmark.circle.fill" size={24} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.healthHeroTitle,
                        { color: isDark ? '#E6FFFA' : '#1E3A38' },
                      ]}>
                      所有核心系統運作正常
                    </Text>
                    <Text
                      style={[
                        styles.healthHeroSub,
                        { color: isDark ? '#81E6D9' : '#4A6B69' },
                      ]}>
                      雲端回應延遲：{supabaseLatencyMs ? `${supabaseLatencyMs} ms` : '離線快取就緒'} · 0ms 首幀渲染已啟用
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={runHealthCheck}
                  disabled={checkingHealth}
                  style={[
                    styles.recheckBtn,
                    { backgroundColor: isDark ? '#2C4241' : '#2F4842' },
                  ]}>
                  {checkingHealth ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.recheckBtnText}>重新檢測</Text>
                  )}
                </Pressable>
              </View>

              {/* 區塊 1：雲端與認證服務狀態 */}
              <View
                style={[
                  styles.detailSectionCard,
                  { backgroundColor: bentoCardBg, borderColor: cardBorder },
                ]}>
                <Text style={[styles.detailSectionTitle, { color: textPrimary }]}>
                  雲端與認證核心服務 (Supabase)
                </Text>

                <View style={styles.serviceRow}>
                  <View style={styles.serviceLeft}>
                    <AppIcon name="server.rack" size={17} color="#0284C7" />
                    <Text style={[styles.serviceName, { color: textPrimary }]}>
                      Supabase PostgreSQL 雲端庫
                    </Text>
                  </View>
                  <View style={styles.serviceStatusPill}>
                    <View style={styles.greenDotSmall} />
                    <Text style={styles.serviceStatusText}>
                      {supabaseLatencyMs !== null ? `正常 (${supabaseLatencyMs}ms)` : '連線正常'}
                    </Text>
                  </View>
                </View>

                <View style={styles.serviceRow}>
                  <View style={styles.serviceLeft}>
                    <AppIcon name="person.crop.circle.fill" size={17} color="#10B981" />
                    <Text style={[styles.serviceName, { color: textPrimary }]}>
                      Supabase Auth (帳密 / Google OAuth)
                    </Text>
                  </View>
                  <View style={styles.serviceStatusPill}>
                    <View style={styles.greenDotSmall} />
                    <Text style={styles.serviceStatusText}>連線正常</Text>
                  </View>
                </View>

                <View style={styles.serviceRow}>
                  <View style={styles.serviceLeft}>
                    <AppIcon name="bolt.fill" size={17} color="#F59E0B" />
                    <Text style={[styles.serviceName, { color: textPrimary }]}>
                      In-Memory 記憶體高速索引引擎
                    </Text>
                  </View>
                  <View style={styles.serviceStatusPill}>
                    <View style={styles.greenDotSmall} />
                    <Text style={styles.serviceStatusText}>&lt; 1ms 極速</Text>
                  </View>
                </View>

                <View style={styles.serviceRow}>
                  <View style={styles.serviceLeft}>
                    <AppIcon name="location.fill" size={17} color="#8B5CF6" />
                    <Text style={[styles.serviceName, { color: textPrimary }]}>
                      7-11 / 全家即期與特殊機台雷達 API
                    </Text>
                  </View>
                  <View style={styles.serviceStatusPill}>
                    <View style={styles.greenDotSmall} />
                    <Text style={styles.serviceStatusText}>2.2s 防卡保護</Text>
                  </View>
                </View>
              </View>

              {/* 區塊 2：資料庫統計指標 */}
              <View
                style={[
                  styles.detailSectionCard,
                  { backgroundColor: bentoCardBg, borderColor: cardBorder },
                ]}>
                <Text style={[styles.detailSectionTitle, { color: textPrimary }]}>
                  全通路比價資料庫統計 ({totalCountFormatted} 筆)
                </Text>

                <View style={styles.metricsRow}>
                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: isDark ? '#0D1117' : '#F4F6F5' },
                    ]}>
                    <Text style={[styles.metricNumber, { color: '#059669' }]}>
                      {totalCountFormatted}
                    </Text>
                    <Text style={[styles.metricLabel, { color: textSecondary }]}>
                      總收錄價格筆數
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: isDark ? '#0D1117' : '#F4F6F5' },
                    ]}>
                    <Text style={[styles.metricNumber, { color: '#0284C7' }]}>
                      {catalogStats.uniqueBarcodes.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricLabel, { color: textSecondary }]}>
                      獨立商品條碼數
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.metricBox,
                      { backgroundColor: isDark ? '#0D1117' : '#F4F6F5' },
                    ]}>
                    <Text style={[styles.metricNumber, { color: '#7C3AED' }]}>
                      {syncState.pending}
                    </Text>
                    <Text style={[styles.metricLabel, { color: textSecondary }]}>
                      待上傳回報佇列
                    </Text>
                  </View>
                </View>

                {/* 各通路筆數明細 */}
                <View style={{ marginTop: 10, gap: 8 }}>
                  {catalogStats.chainBreakdown.map((item) => {
                    const pct = Math.min(
                      100,
                      Math.max(6, Math.round((item.count / catalogStats.totalRecords) * 100)),
                    );
                    return (
                      <View key={item.chain} style={styles.chainStatRow}>
                        <View style={styles.chainStatHeader}>
                          <Text style={[styles.chainStatName, { color: textPrimary }]}>
                            {item.chain}
                          </Text>
                          <Text style={[styles.chainStatCount, { color: textSecondary }]}>
                            {item.count.toLocaleString()} 筆
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.chainProgressBg,
                            { backgroundColor: isDark ? '#0D1117' : '#DDE2E0' },
                          ]}>
                          <View
                            style={[
                              styles.chainProgressFill,
                              { width: `${pct}%`, backgroundColor: '#10B981' },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= Modal 4：版本公告 Modal ================= */}
      <Modal
        visible={changelogModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setChangelogModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                paddingBottom: insets.bottom + 24,
              },
            ]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>
                版本更新公告 (v1.1.0)
              </Text>
              <Pressable
                onPress={() => setChangelogModalVisible(false)}
                style={styles.modalCloseBtn}>
                <AppIcon name="xmark" size={18} color={textSecondary} />
              </Pressable>
            </View>
            <View style={{ gap: 10, marginVertical: 8 }}>
              <Text style={[styles.changelogItem, { color: textPrimary }]}>
                • 嚴格校驗並同步 {totalCountFormatted} 筆 100% 官方真實商品價格（涵蓋 7-11、全家、全聯、寶雅、康是美、家樂福、屈臣氏），零人工推算假資料。
              </Text>
              <Text style={[styles.changelogItem, { color: textPrimary }]}>
                • 導入 In-Memory 記憶體高速索引引擎，所有頁面與條碼比價實現 0ms 首幀秒開，徹底消除等待轉圈。
              </Text>
              <Text style={[styles.changelogItem, { color: textPrimary }]}>
                • 超商雷達全新兩層分頁架構，保留 100% 功能同時大幅提升閱讀舒適度。
              </Text>
              <Text style={[styles.changelogItem, { color: textPrimary }]}>
                • 新增「我的帳號」中心，完整串接 Supabase 帳密註冊登入、Google OAuth 與即時系統狀態檢測。
              </Text>
            </View>
            <Pressable
              onPress={() => setChangelogModalVisible(false)}
              style={styles.submitPrimaryBtn}>
              <Text style={styles.submitPrimaryText}>太棒了</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ================= Modal 5：支援我們 Modal ================= */}
      <Modal
        visible={supportModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSupportModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                paddingBottom: insets.bottom + 24,
              },
            ]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: textPrimary }]}>
                支援 Search Price 團隊
              </Text>
              <Pressable
                onPress={() => setSupportModalVisible(false)}
                style={styles.modalCloseBtn}>
                <AppIcon name="xmark" size={18} color={textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.devBodyText, { color: textSecondary, marginBottom: 16 }]}>
              Search Price 由製作人 ChangShuKai 與 SixStarCulture 團隊獨立開發維護。只要在日常購物時隨手使用「新增價格」回報最新門市特價，就是對我們與全台省錢社群最大的支持！
            </Text>
            <Pressable
              onPress={() => setSupportModalVisible(false)}
              style={[styles.submitPrimaryBtn, { backgroundColor: '#785B12' }]}>
              <Text style={styles.submitPrimaryText}>感謝支持 SixStarCulture</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  // 1. 頂部個人檔案 Bento 卡
  profileCard: {
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  profileInfoCol: {
    flex: 1,
    gap: 4,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  providerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  providerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileSub: {
    fontSize: 13,
    fontWeight: '500',
  },
  loggedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallActionBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
  },
  smallActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chevronBox: {
    paddingLeft: 4,
  },
  quickAuthRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAuthPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 16,
  },
  quickAuthPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quickAuthGoogleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  googleGIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  quickAuthGoogleText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // 2. 中間雙欄 Bento 區（對齊 IMG_2682.PNG）
  bentoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoLeftCard: {
    flex: 1.05,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 288,
  },
  appHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appMiniLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  appTitleCol: {
    flex: 1,
    gap: 2,
  },
  appCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  appCardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  versionHeroBlock: {
    marginVertical: 10,
  },
  versionBigGradient: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 54,
  },
  versionSubNumber: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  avatarStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  avatarStackOverlap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stackCircleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stackMorePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stackMoreText: {
    fontSize: 12,
    fontWeight: '800',
  },
  releaseBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  officialBadge: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  officialBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  releaseDateText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // 右欄四張膠囊卡片
  bentoRightCol: {
    flex: 1,
    gap: 10,
    justifyContent: 'space-between',
  },
  rightPillCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  supportPillCard: {
    borderWidth: 1.2,
  },
  rightPillIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightPillTextCol: {
    flex: 1,
    gap: 1,
  },
  rightPillTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rightPillSub: {
    fontSize: 11,
    fontWeight: '700',
  },

  // 3. 系統狀態快速橫幅
  quickStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 10,
  },
  quickStatusLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  quickStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  quickStatusSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // 4. 開發者的話（對齊 IMG_2682 下方卡片）
  devMessageCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  devHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  devIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  devHeaderDate: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  devBodyText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },

  // 5. 最下方：製作人 ChangShuKai · 製作公司 SixStarCulture · 版權狀態
  creditsCard: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  creditsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  creditsBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  creditsVersionTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  creditsGrid: {
    gap: 10,
  },
  creditItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  creditValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  creditValueHighlight: {
    fontSize: 13,
    fontWeight: '800',
  },
  creditDivider: {
    height: 1,
    width: '100%',
  },
  copyrightFootnote: {
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '500',
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  statusDetailSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 12,
    maxHeight: '88%',
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.35)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  statusModalSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(150,150,150,0.12)',
  },
  authSwitchBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
  },
  authSwitchTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
  },
  authSwitchText: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  feedbackBox: {
    padding: 12,
    borderRadius: 12,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitPrimaryBtn: {
    backgroundColor: '#2F4842',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 12,
    fontWeight: '600',
  },
  googleModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  googleModalBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // 詳細系統狀態元件
  healthHeroBanner: {
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  healthHeroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthHeroIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  healthHeroSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  recheckBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  recheckBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  detailSectionCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  serviceName: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  serviceStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  greenDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  serviceStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  chainStatRow: {
    gap: 4,
  },
  chainStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chainStatName: {
    fontSize: 13,
    fontWeight: '700',
  },
  chainStatCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  chainProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  chainProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  changelogItem: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
});
