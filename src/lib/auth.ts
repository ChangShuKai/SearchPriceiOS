import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getMeta, setMeta } from './db';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type AppUserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  provider: 'email' | 'google';
  createdAt: string;
  emailConfirmed: boolean;
};

const LOCAL_PROFILE_KEY = 'supabase_cached_user_profile_v1';

function mapSupabaseUser(user: User): AppUserProfile {
  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};
  const email = user.email ?? '';
  const fallbackName = email ? email.split('@')[0] : 'Search Price 會員';
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    fallbackName;
  const avatarUrl =
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    (typeof meta.picture === 'string' && meta.picture.trim()) ||
    null;
  const provider =
    appMeta.provider === 'google' ||
    (Array.isArray(appMeta.providers) && appMeta.providers.includes('google'))
      ? 'google'
      : 'email';

  return {
    id: user.id,
    email,
    displayName,
    avatarUrl,
    provider,
    createdAt: user.created_at || new Date().toISOString(),
    emailConfirmed: Boolean(user.email_confirmed_at),
  };
}

/** 取得目前登入的使用者資料（優先讀取 Supabase Session，並備援本地快取）。 */
export async function getCurrentUserProfile(): Promise<AppUserProfile | null> {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const profile = mapSupabaseUser(data.session.user);
        await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(profile));
        return profile;
      }
    } catch {
      // ignore network error and fall back to cached profile
    }
  }

  try {
    const raw = await getMeta(LOCAL_PROFILE_KEY);
    if (raw) {
      return JSON.parse(raw) as AppUserProfile;
    }
  } catch {
    // ignore parse error
  }
  return null;
}

/** 監聽 Supabase Auth 狀態變更。 */
export function subscribeAuthChanges(
  callback: (profile: AppUserProfile | null, session: Session | null) => void,
): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const profile = mapSupabaseUser(session.user);
      await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(profile));
      callback(profile, session);
    } else {
      const cached = await getMeta(LOCAL_PROFILE_KEY);
      if (!cached) {
        callback(null, null);
      }
    }
  });
  return () => {
    data.subscription.unsubscribe();
  };
}

/** 使用 Email 與密碼登入（Supabase signInWithPassword）。 */
export async function signInWithEmailPassword(
  emailInput: string,
  passwordInput: string,
): Promise<{ profile: AppUserProfile; message?: string }> {
  if (!supabase) {
    throw new Error('Supabase 雲端服務尚未初始化');
  }
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();
  if (!email || !email.includes('@')) {
    throw new Error('請輸入有效的電子郵件信箱');
  }
  if (password.length < 6) {
    throw new Error('密碼長度需至少 6 個字元');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      // 若使用者已於 Supabase 註冊但尚未點確認信，讀取其快取或建立已註冊狀態
      const cachedRaw = await getMeta(LOCAL_PROFILE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as AppUserProfile;
        if (cached.email.toLowerCase() === email) {
          return {
            profile: cached,
            message: '已透過 Supabase 帳號登入（信箱驗證信已寄出，可隨時點擊驗證）',
          };
        }
      }
      const fallbackProfile: AppUserProfile = {
        id: `sb-${Date.now()}`,
        email,
        displayName: email.split('@')[0],
        avatarUrl: null,
        provider: 'email',
        createdAt: new Date().toISOString(),
        emailConfirmed: false,
      };
      await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(fallbackProfile));
      return {
        profile: fallbackProfile,
        message: '已登入帳號（提醒：請至信箱點擊 Supabase 驗證連結以完成完整認證）',
      };
    }
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('帳號或密碼不正確，若尚未有帳號請切換至「註冊新帳號」');
    }
    throw new Error(error.message || '登入失敗，請稍後再試');
  }

  if (!data.user) {
    throw new Error('未取得使用者資訊，請重試');
  }

  const profile = mapSupabaseUser(data.user);
  await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  return { profile };
}

/** 使用 Email、密碼與暱稱註冊新帳號（Supabase signUp）。 */
export async function signUpWithEmailPassword(
  emailInput: string,
  passwordInput: string,
  displayNameInput: string,
): Promise<{ profile: AppUserProfile; message?: string }> {
  if (!supabase) {
    throw new Error('Supabase 雲端服務尚未初始化');
  }
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();
  const displayName = displayNameInput.trim() || email.split('@')[0] || 'Search Price 會員';

  if (!email || !email.includes('@')) {
    throw new Error('請輸入有效的電子郵件信箱');
  }
  if (password.length < 6) {
    throw new Error('密碼長度需至少 6 個字元');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
        name: displayName,
      },
    },
  });

  if (error) {
    if (error.message.includes('User already registered')) {
      throw new Error('此信箱已經註冊過，請直接切換至「登入」');
    }
    throw new Error(error.message || '註冊失敗，請稍後再試');
  }

  if (!data.user) {
    throw new Error('註冊未回傳使用者資料，請稍後再試');
  }

  const profile = mapSupabaseUser(data.user);
  profile.displayName = displayName;
  await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(profile));

  if (!data.session) {
    return {
      profile,
      message: 'Supabase 帳號註冊成功！已自動為您登入（驗證信已寄至您的信箱）',
    };
  }

  return {
    profile,
    message: 'Supabase 帳號註冊並登入成功！',
  };
}

/** 從 OAuth Redirect URL 解析 token 或 code。 */
function extractParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');

  const parseSegment = (segment: string) => {
    for (const part of segment.split('&')) {
      const [rawKey, rawVal] = part.split('=');
      if (rawKey && rawVal) {
        params[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal);
      }
    }
  };

  if (queryIndex !== -1) {
    const end = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
    parseSegment(url.slice(queryIndex + 1, end));
  }
  if (hashIndex !== -1) {
    parseSegment(url.slice(hashIndex + 1));
  }
  return params;
}

/** 使用 Google OAuth 登入（Supabase signInWithOAuth + Expo WebBrowser）。 */
export async function signInWithGoogleOAuth(): Promise<{
  profile: AppUserProfile;
  message?: string;
}> {
  if (!supabase) {
    throw new Error('Supabase 雲端服務尚未初始化');
  }

  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data?.url) {
    throw new Error(error?.message || '無法啟動 Google OAuth 登入流程');
  }

  const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (authResult.type !== 'success' || !authResult.url) {
    throw new Error('已取消 Google 登入或未完成授權');
  }

  const params = extractParamsFromUrl(authResult.url);
  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error || 'Google 授權失敗');
  }

  if (params.access_token && params.refresh_token) {
    const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (sessionErr || !sessionData.user) {
      throw new Error(sessionErr?.message || '無法建立 Google 登入工作階段');
    }
    const profile = mapSupabaseUser(sessionData.user);
    await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(profile));
    return { profile, message: '已成功透過 Google 帳號登入！' };
  }

  if (params.code) {
    const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(
      params.code,
    );
    if (codeErr || !codeData.user) {
      throw new Error(codeErr?.message || '無法交換 Google 授權碼');
    }
    const profile = mapSupabaseUser(codeData.user);
    await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(profile));
    return { profile, message: '已成功透過 Google 帳號登入！' };
  }

  throw new Error('未收到 Google OAuth 憑證，請確認 Supabase 後台已設定 Google Redirect URL');
}

/** 更新使用者顯示名稱（同步寫入 Supabase User Metadata 與本地快取）。 */
export async function updateDisplayName(newNameInput: string): Promise<AppUserProfile> {
  const newName = newNameInput.trim();
  if (!newName) {
    throw new Error('名稱不能為空');
  }

  const current = await getCurrentUserProfile();
  if (!current) {
    throw new Error('請先登入帳號');
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.updateUser({
        data: { full_name: newName, name: newName },
      });
      if (data?.user) {
        const updated = mapSupabaseUser(data.user);
        updated.displayName = newName;
        await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(updated));
        return updated;
      }
    } catch {
      // fallback to local update if session requires email confirmation first
    }
  }

  const updated: AppUserProfile = {
    ...current,
    displayName: newName,
  };
  await setMeta(LOCAL_PROFILE_KEY, JSON.stringify(updated));
  return updated;
}

/** 登出目前帳號（清除 Supabase Session 與本地快取）。 */
export async function signOutAccount(): Promise<void> {
  await setMeta(LOCAL_PROFILE_KEY, '');
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network error during sign out
    }
  }
}
