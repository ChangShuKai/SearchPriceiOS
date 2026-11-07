import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules } from 'react-native';

/**
 * 本地（裝置端）文字辨識。
 *
 * 使用 Google ML Kit（@react-native-ml-kit/text-recognition），完全在裝置上執行。
 * Expo Go 無法載入此原生模組 → `isOcrAvailable` 為 false，畫面會改為手動輸入。
 * 使用 Development Build（`npx expo run:ios` / `eas build --profile development`）即可啟用。
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const isOcrAvailable = !isExpoGo && !!NativeModules.TextRecognition;

export type OcrResult = {
  name: string | null;
  price: number | null;
  rawLines: string[];
};

type Line = { text: string; height: number; top: number };

const CJK = /[\u3400-\u9fff]/g;
const QUANTITY = /(\d+(?:\.\d+)?)\s*(ml|mL|ML|毫升|l|L|公升|g|G|公克|克|kg|KG|公斤|入|包|罐|瓶|片)(?![a-zA-Z])/;
const PRICE_HINT = /(\$|NT|元|特價|售價|價格|優惠|會員價|促銷)/i;
const NOT_PRICE = /(ml|毫升|公升|公克|kcal|大卡|%|\d{4}[./-]\d{1,2}|條碼|電話|統編)/i;
const NAME_BLOCKLIST = /(特價|售價|價格|優惠|會員|促銷|原價|單價|有效|日期|條碼|門市|統一編號|每100|營養|熱量)/;

function parsePrice(lines: Line[]): number | null {
  const candidates: { value: number; score: number }[] = [];
  for (const line of lines) {
    if (NOT_PRICE.test(line.text) && !PRICE_HINT.test(line.text)) continue;
    const matches = line.text.matchAll(/(^|[^\d.])(\d{1,5}(?:\.\d{1,2})?)(?![\d.])/g);
    for (const m of matches) {
      const value = Number(m[2]);
      if (!Number.isFinite(value) || value <= 0 || value >= 100000) continue;
      // 數字後面緊接容量單位 → 不是價格
      const after = line.text.slice((m.index ?? 0) + m[1].length + m[2].length);
      if (/^\s*(ml|毫升|l\b|公升|g\b|公克|克|kg|入|%)/i.test(after)) continue;
      let score = line.height;
      if (PRICE_HINT.test(line.text)) score *= 2;
      if (/^\s*\$?\s*\d+(\.\d+)?\s*元?\s*$/.test(line.text)) score *= 1.5; // 一整行只有價格
      candidates.push({ value, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value ?? null;
}

function parseName(lines: Line[]): string | null {
  const named = lines
    .filter((l) => (l.text.match(CJK)?.length ?? 0) >= 2 && !NAME_BLOCKLIST.test(l.text))
    .sort((a, b) => b.height - a.height);
  const best = named[0]?.text.replace(/\s+/g, ' ').trim();
  if (!best) return null;
  const cleaned = best.replace(/[$＄]\s*\d+(\.\d+)?\s*元?/g, '').trim();
  if (QUANTITY.test(cleaned)) return cleaned;
  // 名稱沒有容量時，從其他行補上（例：「麥香紅茶」+「300ml」）
  const qty = lines.map((l) => l.text.match(QUANTITY)?.[0]).find(Boolean);
  return qty ? `${cleaned} ${qty.replace(/\s+/g, '')}` : cleaned;
}

export async function recognizeProductText(imageUri: string): Promise<OcrResult> {
  if (!isOcrAvailable) throw new Error('OCR_UNAVAILABLE');
  // 延遲載入，避免在 Expo Go 中觸發原生模組錯誤
  const mod = await import('@react-native-ml-kit/text-recognition');
  const result = await mod.default.recognize(imageUri, mod.TextRecognitionScript.CHINESE);
  const lines: Line[] = result.blocks.flatMap((b) =>
    b.lines.map((l) => ({ text: l.text.trim(), height: l.frame?.height ?? 0, top: l.frame?.top ?? 0 })),
  );
  return {
    name: parseName(lines),
    price: parsePrice(lines),
    rawLines: lines.map((l) => l.text),
  };
}
