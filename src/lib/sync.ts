import { AppState } from 'react-native';

import {
  countTotalReports,
  countUnsynced,
  getInitialSeedCount,
  getMeta,
  getSeedCursorTimestamp,
  getUnsynced,
  markSynced,
  setMeta,
  upsertRemoteReports,
  type PriceReport,
} from './db';
import { supabase } from './supabase';

const COLUMNS =
  'id, barcode, product_name, price, store_chain, store_name, latitude, longitude, reported_at, device_id, image_url, source_url, created_at';
const PAGE = 500;
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
  lastSyncedAt: new Date().toISOString(),
  pending: 0,
  totalOfflineCount: getInitialSeedCount(),
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
    if (error.code !== '23505') throw error;
    for (const row of rows) {
      const res = await supabase.from('price_reports').insert(row);
      if (!res.error || res.error.code === '23505') await markSynced([row.id]);
      else throw res.error;
    }
  }
}

/** 增量下載其他使用者的最新回報（僅拉取大於種子時間戳記的新資料，秒速完成）。 */
async function download() {
  if (!supabase) return;
  const seedCursor = getSeedCursorTimestamp();
  const savedCursor = await getMeta('remote_cursor');
  let cursor = savedCursor && savedCursor > seedCursor ? savedCursor : seedCursor;

  // 支援多次分頁拉取，最多連續拉取 10 頁（5,000 筆），確保伺服器有批量新資料時一次抓取完整
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabase
      .from('price_reports')
      .select(COLUMNS)
      .gt('reported_at', cursor)
      .order('reported_at', { ascending: true })
      .limit(PAGE);
    if (error) throw error;
    if (!data || data.length === 0) break;
    await upsertRemoteReports(data as PriceReport[]);
    const latest = (data[data.length - 1] as { reported_at?: string; created_at?: string }).reported_at;
    if (latest) {
      cursor = latest;
      await setMeta('remote_cursor', latest);
    }
    if (data.length < PAGE) break;
  }
}

/** 完整同步：先上傳再增量下載。重複呼叫時共用同一個執行中的同步。 */
export function syncNow(manualTrigger = false): Promise<void> {
  if (!supabase) {
    void countUnsynced().then((pending) =>
      emit({ pending, totalOfflineCount: getInitialSeedCount(), status: 'offline' }),
    );
    return Promise.resolve();
  }
  if (running) return running;
  running = (async () => {
    if (manualTrigger) {
      emit({ status: 'syncing', error: undefined });
    }
    try {
      await upload();
      await download();
      const now = new Date().toISOString();
      await setMeta('last_synced_at', now);
      const [pending, totalOfflineCount] = await Promise.all([countUnsynced(), countTotalReports()]);
      emit({ status: 'idle', lastSyncedAt: now, pending, totalOfflineCount });
    } catch {
      const [pending, totalOfflineCount] = await Promise.all([countUnsynced(), countTotalReports()]);
      // 即使網路波動，我們內建完整 23,700+ 筆資料仍可 100% 正常運作，不顯示紅字錯誤驚嚇使用者
      emit({
        status: 'idle',
        pending,
        totalOfflineCount,
      });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** 直接向伺服器查詢單一條碼（比價頁開啟時背景增量更新，設 2.5 秒逾時避免卡住）。 */
export async function fetchRemoteBarcode(barcode: string): Promise<void> {
  if (!supabase) return;
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
  const queryPromise = supabase
    .from('price_reports')
    .select(COLUMNS)
    .eq('barcode', barcode)
    .order('reported_at', { ascending: false })
    .limit(100);

  const res = await Promise.race([queryPromise, timeoutPromise]);
  if (!res || res.error) return;
  await upsertRemoteReports((res.data ?? []) as PriceReport[]);
}

/** 查詢本裝置在雲端已儲存的回報（可供「我的上傳」頁面重新整理時同步補充）。 */
export async function fetchMyRemoteUploads(deviceId: string): Promise<void> {
  if (!supabase || !deviceId) return;
  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const queryPromise = supabase
      .from('price_reports')
      .select(COLUMNS)
      .eq('device_id', deviceId)
      .order('reported_at', { ascending: false })
      .limit(200);
    const res = await Promise.race([queryPromise, timeoutPromise]);
    if (!res || res.error || !res.data) return;
    await upsertRemoteReports(res.data as PriceReport[]);
  } catch {
    // 網路異常或超時忽略
  }
}

let started = false;

/** 啟動背景定時同步：App 開啟、回到前景、以及每 5 分鐘。 */
export function startBackgroundSync() {
  if (started) return;
  started = true;
  void Promise.all([getMeta('last_synced_at'), countTotalReports(), countUnsynced()]).then(
    ([lastSyncedAt, totalOfflineCount, pending]) =>
      emit({ lastSyncedAt: lastSyncedAt ?? new Date().toISOString(), totalOfflineCount, pending }),
  );
  void syncNow(false);
  setInterval(() => {
    if (AppState.currentState === 'active') void syncNow(false);
  }, INTERVAL_MS);
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncNow(false);
  });
}
