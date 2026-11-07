import * as SQLite from 'expo-sqlite';

/** 單筆價格回報（本地與 Supabase 的 `price_reports` 欄位一致）。 */
export type PriceReport = {
  id: string;
  barcode: string;
  product_name: string;
  price: number;
  store_chain: string;
  store_name: string | null;
  latitude: number | null;
  longitude: number | null;
  reported_at: string; // ISO 時間
  device_id: string | null;
  image_url?: string | null;
  source_url?: string | null;
};

type LocalRow = PriceReport & { synced: number };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('searchprice.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS price_reports (
          id TEXT PRIMARY KEY NOT NULL,
          barcode TEXT NOT NULL,
          product_name TEXT NOT NULL,
          price REAL NOT NULL,
          store_chain TEXT NOT NULL,
          store_name TEXT,
          latitude REAL,
          longitude REAL,
          reported_at TEXT NOT NULL,
          device_id TEXT,
          image_url TEXT,
          source_url TEXT,
          synced INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_reports_barcode ON price_reports (barcode, store_chain, reported_at);
        CREATE INDEX IF NOT EXISTS idx_reports_synced ON price_reports (synced);
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
      `);
      try {
        await db.execAsync('ALTER TABLE price_reports ADD COLUMN image_url TEXT;');
      } catch {
        // 欄位可能已存在
      }
      try {
        await db.execAsync('ALTER TABLE price_reports ADD COLUMN source_url TEXT;');
      } catch {
        // 欄位可能已存在
      }

      // 檢查是否已載入初始離線資料庫（首開秒用、斷網可用）
      try {
        const seedMeta = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', 'seed_loaded_v7');
        if (!seedMeta?.value) {
          const seed = require('@/constants/seed-data.json') as PriceReport[];
          if (Array.isArray(seed) && seed.length > 0) {
            await db.withTransactionAsync(async () => {
              for (const r of seed) {
                await db.runAsync(
                  `INSERT OR IGNORE INTO price_reports
                    (id, barcode, product_name, price, store_chain, store_name, latitude, longitude, reported_at, device_id, image_url, source_url, synced)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  r.id,
                  r.barcode,
                  r.product_name,
                  Number(r.price),
                  r.store_chain,
                  r.store_name ?? null,
                  r.latitude ?? null,
                  r.longitude ?? null,
                  r.reported_at,
                  r.device_id ?? 'seed',
                  r.image_url ?? null,
                  r.source_url ?? null,
                );
              }
            });
            await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'seed_loaded_v7', '1');
          }
        }
      } catch (err) {
        console.warn('[DB] Pre-seed loading skipped:', err);
      }

      return db;
    })();
  }
  return dbPromise;
}

export async function countTotalReports(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM price_reports');
  return row?.count ?? 0;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

/** 新增使用者自己回報的價格（尚未同步）。 */
export async function insertLocalReport(r: PriceReport): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO price_reports
      (id, barcode, product_name, price, store_chain, store_name, latitude, longitude, reported_at, device_id, image_url, source_url, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    r.id, r.barcode, r.product_name, r.price, r.store_chain, r.store_name,
    r.latitude, r.longitude, r.reported_at, r.device_id, r.image_url ?? null, r.source_url ?? null,
  );
}

/** 寫入從伺服器下載的資料（標記為已同步）。 */
export async function upsertRemoteReports(rows: PriceReport[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      await db.runAsync(
        `INSERT OR REPLACE INTO price_reports
          (id, barcode, product_name, price, store_chain, store_name, latitude, longitude, reported_at, device_id, image_url, source_url, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        r.id, r.barcode, r.product_name, Number(r.price), r.store_chain, r.store_name,
        r.latitude, r.longitude, r.reported_at, r.device_id, r.image_url ?? null, r.source_url ?? null,
      );
    }
  });
}

export async function getUnsynced(limit = 200): Promise<PriceReport[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LocalRow>(
    'SELECT * FROM price_reports WHERE synced = 0 ORDER BY reported_at LIMIT ?',
    limit,
  );
  return rows.map(({ synced: _s, ...r }) => r);
}

export async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`UPDATE price_reports SET synced = 1 WHERE id IN (${placeholders})`, ...ids);
}

export async function countUnsynced(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM price_reports WHERE synced = 0');
  return row?.n ?? 0;
}

/** 每個通路最新的一筆價格，依價格由低到高排序。 */
export async function getLatestPricesByChain(barcode: string): Promise<(PriceReport & { report_count: number })[]> {
  const db = await getDb();
  return db.getAllAsync<PriceReport & { report_count: number }>(
    `SELECT r.*, (SELECT COUNT(*) FROM price_reports c WHERE c.barcode = r.barcode AND c.store_chain = r.store_chain) AS report_count
       FROM price_reports r
      WHERE r.barcode = ?
        AND r.id = (
          SELECT r2.id FROM price_reports r2
           WHERE r2.barcode = r.barcode AND r2.store_chain = r.store_chain
           ORDER BY r2.reported_at DESC LIMIT 1)
      ORDER BY r.price ASC`,
    barcode,
  );
}

/** 此條碼最常被使用者填寫的商品名稱。 */
export async function getProductNamesForBarcode(barcode: string, limit = 5): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ product_name: string }>(
    `SELECT product_name FROM price_reports WHERE barcode = ?
      GROUP BY product_name ORDER BY COUNT(*) DESC, MAX(reported_at) DESC LIMIT ?`,
    barcode, limit,
  );
  return rows.map((r) => r.product_name);
}

/**
 * 名稱建議：使用者輸入「麥香紅茶」→ 回傳資料庫中包含所有關鍵字的完整名稱，
 * 例如「麥香紅茶 300ml」「麥香紅茶 TP375ml」。
 */
export async function searchProductNames(query: string, limit = 8): Promise<string[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const db = await getDb();
  const where = terms.map(() => 'product_name LIKE ?').join(' AND ');
  const rows = await db.getAllAsync<{ product_name: string }>(
    `SELECT product_name FROM price_reports WHERE ${where}
      GROUP BY product_name ORDER BY COUNT(*) DESC LIMIT ?`,
    ...terms.map((t) => `%${t}%`), limit,
  );
  return rows.map((r) => r.product_name);
}
