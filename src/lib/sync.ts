import { AppState } from 'react-native';

import {
  countTotalReports,
  countUnsynced,
  getMeta,
  getUnsynced,
  markSynced,
  setMeta,
  upsertRemoteReports,
  type PriceReport,
} from './db';
import { supabase } from './supabase';

const COLUMNS =
  'id, barcode, product_name, price, store_chain, store_name, latitude, longitude, reported_at, device_id, image_url, source_url, created_at';
const PAGE = 1000;
const INTERVAL_MS = 5 * 60 * 1000;

export type SyncState = {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncedAt: string | null;
  pending: number;
  totalOfflineCount: number;
  error?: string;
};

let state: SyncState = {
  status: supabase ? 'idle' : 'offline',
  lastSyncedAt: null,
  pending: 0,
  totalOfflineCount: 0,
};
const listeners = new Set<(s: SyncState) => void>();
let running: Promise<void> | null = null;

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getSyncState() {
  return state;
}

export function subscribeSync(listener: (s: SyncState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 上傳本地尚未同步的回報。 */
async function upload() {
  if (!supabase) return;
  for (;;) {
    const rows = await getUnsynced(200);
    if (rows.length === 0) return;
    const { error } = await supabase.from('price_reports').insert(rows);
    if (!error) {
      await markSynced(rows.map((r) => r.id));
      continue;
    }
    // 批次中有重複的 id（例如上次上傳後尚未標記）→ 逐筆重試，重複視為成功。
    if (error.code !== '23505') throw error;
    for (const row of rows) {
      const res = await supabase.from('price_reports').insert(row);
      if (!res.error || res.error.code === '23505') await markSynced([row.id]);
      else throw res.error;
    }
  }
}

/** 增量下載其他使用者的回報（依伺服器 created_at）。 */
async function download() {
  if (!supabase) return;
  let cursor = (await getMeta('remote_cursor')) ?? '1970-01-01T00:00:00Z';
  for (;;) {
    const { data, error } = await supabase
      .from('price_reports')
      .select(COLUMNS)
      .gt('created_at', cursor)
      .order('created_at', { ascending: true })
      .limit(PAGE);
    if (error) throw error;
    if (!data || data.length === 0) return;
    await upsertRemoteReports(data as PriceReport[]);
    cursor = (data[data.length - 1] as { created_at: string }).created_at;
    await setMeta('remote_cursor', cursor);
    if (data.length < PAGE) return;
  }
}

/** 完整同步：先上傳再下載。重複呼叫時共用同一個執行中的同步。 */
export function syncNow(): Promise<void> {
  if (!supabase) {
    void countUnsynced().then((pending) => emit({ pending, status: 'offline' }));
    return Promise.resolve();
  }
  if (running) return running;
  running = (async () => {
    emit({ status: 'syncing', error: undefined });
    try {
      await upload();
      await download();
      const now = new Date().toISOString();
      await setMeta('last_synced_at', now);
      const [pending, totalOfflineCount] = await Promise.all([countUnsynced(), countTotalReports()]);
      emit({ status: 'idle', lastSyncedAt: now, pending, totalOfflineCount });
    } catch (e) {
      const [pending, totalOfflineCount] = await Promise.all([countUnsynced(), countTotalReports()]);
      emit({
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
        pending,
        totalOfflineCount,
      });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** 直接向伺服器查詢單一條碼（比價頁開啟時使用，確保資料即時）。 */
export async function fetchRemoteBarcode(barcode: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('price_reports')
    .select(COLUMNS)
    .eq('barcode', barcode)
    .order('reported_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  await upsertRemoteReports((data ?? []) as PriceReport[]);
}

let started = false;

/** 啟動背景定時同步：App 開啟、回到前景、以及每 5 分鐘。 */
export function startBackgroundSync() {
  if (started) return;
  started = true;
  void Promise.all([getMeta('last_synced_at'), countTotalReports(), countUnsynced()]).then(
    ([lastSyncedAt, totalOfflineCount, pending]) => emit({ lastSyncedAt, totalOfflineCount, pending }),
  );
  void syncNow();
  setInterval(() => {
    if (AppState.currentState === 'active') void syncNow();
  }, INTERVAL_MS);
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncNow();
  });
}
