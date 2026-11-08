import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xydpfmwzqluglkcuomqg.supabase.co';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';

/**
 * 使用內建 expo-sqlite 實作 Supabase Auth Session 持久化儲存，
 * 免安裝額外 Native 模組即可在重啟 App 後保持登入狀態。
 */
const memoryAuthCache = new Map<string, string>();
let authDbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getAuthDb(): Promise<SQLite.SQLiteDatabase> {
  if (!authDbPromise) {
    authDbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('searchprice_auth.db');
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS auth_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
      );
      return db;
    })();
  }
  return authDbPromise;
}

const supabaseStorage = {
  getItem: async (storageKey: string): Promise<string | null> => {
    if (memoryAuthCache.has(storageKey)) {
      return memoryAuthCache.get(storageKey) ?? null;
    }
    if (Platform.OS === 'web') {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
      } catch {
        return null;
      }
    }
    try {
      const db = await getAuthDb();
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM auth_kv WHERE key = ?',
        storageKey,
      );
      if (row?.value) {
        memoryAuthCache.set(storageKey, row.value);
        return row.value;
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: async (storageKey: string, value: string): Promise<void> => {
    memoryAuthCache.set(storageKey, value);
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, value);
      } catch {
        // ignore web storage error
      }
      return;
    }
    try {
      const db = await getAuthDb();
      await db.runAsync(
        'INSERT OR REPLACE INTO auth_kv (key, value) VALUES (?, ?)',
        storageKey,
        value,
      );
    } catch {
      // ignore sqlite error
    }
  },
  removeItem: async (storageKey: string): Promise<void> => {
    memoryAuthCache.delete(storageKey);
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
      } catch {
        // ignore web storage error
      }
      return;
    }
    try {
      const db = await getAuthDb();
      await db.runAsync('DELETE FROM auth_kv WHERE key = ?', storageKey);
    } catch {
      // ignore sqlite error
    }
  },
};

/** 建立 Supabase 雲端連線客戶端（支援環境變數與內建公開金鑰備援，並啟用 Auth Session 持久化）。 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: supabaseStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
