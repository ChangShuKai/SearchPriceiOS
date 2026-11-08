import type { SFSymbol } from 'sf-symbols-typescript';

/**
 * 支援的販售通路（連鎖品牌）。
 * `id` 是存入資料庫的穩定代碼；`patterns` 用來比對 OpenStreetMap 的店名 / 品牌欄位。
 */
export type StoreChain = {
  id: string;
  name: string;
  color: string;
  icon: SFSymbol;
  patterns: RegExp[];
};

export const STORE_CHAINS: StoreChain[] = [
  { id: '7-eleven', name: '7-Eleven', color: '#F47B20', icon: '7.square.fill', patterns: [/7[\s-]?eleven/i, /統一超商/, /^7-11/i] },
  { id: 'familymart', name: '全家', color: '#00A0E9', icon: 'f.square.fill', patterns: [/family\s?mart/i, /全家/] },
  { id: 'pxmart', name: '全聯', color: '#E60012', icon: 'cart.fill', patterns: [/px\s?mart/i, /全聯/] },
  { id: 'hilife', name: '萊爾富', color: '#D7000F', icon: 'heart.fill', patterns: [/hi[\s-]?life/i, /萊爾富/] },
  { id: 'okmart', name: 'OK 超商', color: '#F5A200', icon: 'checkmark.seal.fill', patterns: [/ok\s?mart/i, /^ok/i, /OK超商/] },
  { id: 'carrefour', name: '家樂福', color: '#1E4FA3', icon: 'basket.fill', patterns: [/carrefour/i, /家樂福/] },
  { id: 'simplemart', name: '美廉社', color: '#E95513', icon: 'bag.fill', patterns: [/simple\s?mart/i, /美廉社/] },
  { id: 'costco', name: '好市多', color: '#005DAA', icon: 'building.2.fill', patterns: [/costco/i, /好市多/] },
  { id: 'rt-mart', name: '大潤發', color: '#C8102E', icon: 'building.fill', patterns: [/rt[\s-]?mart/i, /大潤發/] },
  { id: 'watsons', name: '屈臣氏', color: '#00A19A', icon: 'cross.case.fill', patterns: [/watsons/i, /屈臣氏/] },
  { id: 'cosmed', name: '康是美', color: '#E4007F', icon: 'cross.fill', patterns: [/cosmed/i, /康是美/] },
  { id: 'poya', name: '寶雅', color: '#ED1B67', icon: 'sparkles', patterns: [/poya/i, /寶雅/] },
  { id: 'pchome', name: 'PChome 24h', color: '#DE2020', icon: 'shippingbox.fill', patterns: [/pchome/i, /24h/i] },
  { id: 'other', name: '其他', color: '#8E8E93', icon: 'storefront.fill', patterns: [] },
];

export function getChain(id: string): StoreChain {
  return STORE_CHAINS.find((c) => c.id === id) ?? STORE_CHAINS[STORE_CHAINS.length - 1];
}

export function matchChain(...labels: (string | undefined)[]): StoreChain | undefined {
  for (const label of labels) {
    if (!label) continue;
    const hit = STORE_CHAINS.find((c) => c.patterns.some((p) => p.test(label)));
    if (hit) return hit;
  }
  return undefined;
}
