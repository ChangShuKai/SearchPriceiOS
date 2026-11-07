import * as Crypto from 'expo-crypto';

import { getMeta, setMeta } from './db';

let cachedDeviceId: string | null = null;

/** 匿名裝置代碼（不含個資），用於辨識回報來源。 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  let id = await getMeta('device_id');
  if (!id) {
    id = Crypto.randomUUID();
    await setMeta('device_id', id);
  }
  cachedDeviceId = id;
  return id;
}

export function newId(): string {
  return Crypto.randomUUID();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 2026/11/07 */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 2026/11/07 13:24 */
export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 「3 天前」等相對時間 */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return formatDate(iso);
}

export function formatPrice(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(1)}`;
}

/** 相機要辨識的商品條碼格式 */
export const PRODUCT_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/** 商品條碼（EAN-13 / EAN-8 / UPC）基本格式檢查 */
export function isValidBarcode(code: string): boolean {
  return /^\d{8}$|^\d{12,14}$/.test(code);
}
