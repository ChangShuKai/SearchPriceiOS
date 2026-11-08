import * as Location from 'expo-location';

export type ChainChoice = '7-eleven' | 'familymart' | 'pxmart' | 'poya';

export type DiscountTimeStatus = {
  isDiscountTime: boolean;
  scheduleText: string;
  nextWindowText: string;
};

/**
 * 檢查當前是否處於各通路官方即期品 / 惜食特惠時段
 * - 7-Eleven (i珍食 65折)：每日 10:00–17:00、20:00–03:00
 * - 全家 (友善時光 7折)：每日 10:00–17:00、17:00–00:00
 * - 全聯 (惜食地圖 6折·8折)：每日 11:00–14:00、16:00–22:00
 * - 寶雅 (門市限時特賣)：每日營業時段 10:00–22:30
 */
export function checkDiscountTimeStatus(chain: ChainChoice, now: Date = new Date()): DiscountTimeStatus {
  const hour = now.getHours();
  const min = now.getMinutes();
  const timeVal = hour + min / 60;

  if (chain === '7-eleven') {
    const isDiscountTime = (hour >= 10 && hour < 17) || hour >= 20 || hour < 3;
    let nextWindowText = '目前為 i珍食 65 折特惠時段';
    if (!isDiscountTime) {
      nextWindowText = hour >= 3 && hour < 10 ? '下一波 10:00 開放（目前顯示門市預覽）' : '下一波 20:00 開放（目前顯示門市預覽）';
    }
    return {
      isDiscountTime,
      scheduleText: '每日 10:00–17:00 · 20:00–03:00',
      nextWindowText,
    };
  }

  if (chain === 'familymart') {
    const isDiscountTime = hour >= 10 && hour < 24;
    return {
      isDiscountTime,
      scheduleText: '每日 10:00–17:00 · 17:00–24:00',
      nextWindowText: isDiscountTime ? '目前為友善時光 7 折特惠時段' : '下一波 10:00 開放（目前顯示門市預覽）',
    };
  }

  if (chain === 'pxmart') {
    const isDiscountTime = (hour >= 11 && hour < 14) || (hour >= 16 && hour < 22);
    let nextWindowText = '目前為全聯惜食 6 折 / 8 折特惠時段';
    if (!isDiscountTime) {
      nextWindowText =
        hour < 11
          ? '下一波 11:00 開放（目前顯示門市預覽）'
          : hour < 16
            ? '下一波 16:00 開放（目前顯示門市預覽）'
            : '明日 11:00 開放（目前顯示門市預覽）';
    }
    return {
      isDiscountTime,
      scheduleText: '每日 11:00–14:00 · 16:00–22:00',
      nextWindowText,
    };
  }

  const isDiscountTime = timeVal >= 10 && timeVal <= 22.5;
  return {
    isDiscountTime,
    scheduleText: '每日 10:00–22:30 門市同步特賣',
    nextWindowText: isDiscountTime ? '目前為寶雅限時特賣時段' : '明日 10:00 開放（目前顯示門市預覽）',
  };
}

export type DiscountProduct = {
  id: string;
  name: string;
  category: string;
  originalPrice: number;
  discountPrice: number;
  discountRate: string;
  count: number;
  imageUrl?: string | null;
  barcode?: string;
  kcal?: string | null;
  content?: string | null;
  isNew?: boolean;
  isSpecialSale?: boolean;
  cmno?: string;
};

export type DiscountCategory = {
  id: string;
  name: string;
  iconName: string;
  imageUrl?: string | null;
  count: number;
  products: DiscountProduct[];
};

export type DiscountStore = {
  id: string;
  chain: ChainChoice;
  name: string;
  address: string;
  tel?: string;
  distance: number;
  latitude: number;
  longitude: number;
  remainingTotal: number;
  categories: DiscountCategory[];
};

export type FoodSafetyDetail = {
  chain: ChainChoice;
  name: string;
  category?: string;
  calories?: number | string;
  protein?: number;
  totalFat?: number;
  satFat?: number;
  transFat?: number;
  carb?: number;
  sodium?: number;
  sugar?: number;
  allergens?: string[];
  manufacturer?: string;
  manufacturerAddress?: string;
  description?: string;
  isNew?: boolean;
  isSpecialSale?: boolean;
};

type SevenElevenItem = {
  category: string;
  name: string;
  kcal: string;
  price: string;
  image: string;
  content: string;
  new?: string;
  special_sale?: string;
  barcode?: string;
};

type FamilyMartItem = {
  category: string;
  title: string;
  cmno?: string;
  picture_url: string;
  Protein: number;
  Carb: number;
  Calories: number;
  Fat: number;
  satFat?: number;
  transFat?: number;
  sodium?: number;
  sugar?: number;
  allergens?: string[];
  manufacturer?: string;
  manufacturerAddress?: string;
  showMap?: boolean;
  Description: string;
  note?: string;
  price?: number;
  barcode?: string;
};

type PxMartItem = {
  code: string;
  name: string;
  category: string;
  price: number;
  promotionTag?: string;
  priceRemarks?: string;
  imageUrl?: string | null;
  sourceUrl?: string;
  barcode?: string;
  isFresh?: boolean;
};

type PoyaItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  sellingQty?: number;
  imageUrl?: string | null;
  sourceUrl?: string;
  barcode?: string;
};

const sevenElevenData: SevenElevenItem[] = require('@/constants/seven_eleven_products.json');
const familyMartData: FamilyMartItem[] = require('@/constants/family_mart_products.json');
const pxMartData: PxMartItem[] = require('@/constants/pxmart_products.json');
const poyaData: PoyaItem[] = require('@/constants/poya_products.json');

// 建立快速索引表
const fmByTitle = new Map<string, FamilyMartItem>();
const fmByCmno = new Map<string, FamilyMartItem>();
const fmByBarcode = new Map<string, FamilyMartItem>();

familyMartData.forEach((p) => {
  if (p.title) {
    fmByTitle.set(p.title.trim(), p);
    fmByTitle.set(p.title.replace(/^星—|^一配|^二配/, '').trim(), p);
  }
  const codeMatch = p.picture_url?.match(/003004\.(\d+)\./);
  const cmno = p.cmno || (codeMatch ? codeMatch[1] : undefined);
  if (cmno) fmByCmno.set(cmno, p);
  if (p.barcode) fmByBarcode.set(p.barcode, p);
});

const sevenByName = new Map<string, SevenElevenItem>();
const sevenByBarcode = new Map<string, SevenElevenItem>();
sevenElevenData.forEach((p) => {
  if (p.name) sevenByName.set(p.name.trim(), p);
  if (p.barcode) sevenByBarcode.set(p.barcode, p);
});

const SEVEN_CAT_MAPPING: Record<string, { label: string; icon: string }> = {
  '1_Ricerolls': { label: '御飯糰·手卷', icon: '🍙' },
  '16_sandwich': { label: '三明治·熱壓吐司', icon: '🥪' },
  '20_panini': { label: '三明治·熱壓吐司', icon: '🥪' },
  '19_star': { label: '星級主食便當', icon: '🍱' },
  '3_Cuisine': { label: '台式燴飯便當', icon: '🍱' },
  '5_ForeignDishes': { label: '異國料理主食', icon: '🍛' },
  '6_Noodles': { label: '涼麵·熱麵食', icon: '🍜' },
  '17_ohlala': { label: '義大利麵·燉飯', icon: '🍝' },
  '11_bread': { label: '統一麵包·吐司點心', icon: '🍞' },
  '2_Light': { label: '沙拉·輕食水果', icon: '🥗' },
  '4_Snacks': { label: '精緻小點·炸烤物', icon: '🍗' },
  '13_luwei': { label: '滷味小吃', icon: '🍲' },
  '18_veg': { label: '蔬食素食', icon: '🥦' },
  '23_veg': { label: '蔬食素食', icon: '🥦' },
  '15_health': { label: '健身增肌餐盒', icon: '🥩' },
  '7_Oden': { label: '關東煮·蒸食', icon: '🍢' },
  '12_steam': { label: '關東煮·蒸食', icon: '🍢' },
  '8_Bigbite': { label: '大亨堡熟食', icon: '🌭' },
  '21_ice': { label: '冰品甜點', icon: '🍨' },
  '22_ice': { label: '冰品甜點', icon: '🍨' },
  '9_Icecream': { label: '冰品甜點', icon: '🍨' },
};

// 預先建立分類桶，避免每次切換通路時重複迴圈數千筆資料
const sevenCatBuckets = new Map<string, SevenElevenItem[]>();
for (const p of sevenElevenData) {
  if (!p.name || !p.price || Number(p.price) <= 0) continue;
  const mapping = SEVEN_CAT_MAPPING[p.category] || { label: '特色鮮食', icon: '🍴' };
  if (!sevenCatBuckets.has(mapping.label)) sevenCatBuckets.set(mapping.label, []);
  sevenCatBuckets.get(mapping.label)!.push(p);
}

const fmCatBuckets = new Map<string, FamilyMartItem[]>();
for (const p of familyMartData) {
  if (p.showMap === false || !p.title) continue;
  const cat = p.category || '鮮食';
  if (!fmCatBuckets.has(cat)) fmCatBuckets.set(cat, []);
  fmCatBuckets.get(cat)!.push(p);
}

const pxCatBuckets = new Map<string, PxMartItem[]>();
for (const p of pxMartData) {
  if (!p.isFresh) continue;
  const cat = p.category || '生鮮惜食';
  if (!pxCatBuckets.has(cat)) pxCatBuckets.set(cat, []);
  pxCatBuckets.get(cat)!.push(p);
}

const poyaCatBuckets = new Map<string, PoyaItem[]>();
for (const p of poyaData) {
  const cat = p.category || '寶雅熱銷生活美妝';
  if (!poyaCatBuckets.has(cat)) poyaCatBuckets.set(cat, []);
  poyaCatBuckets.get(cat)!.push(p);
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** 帶嚴格逾時的 fetch，防止外部 API 緩慢導致轉圈圈 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 2200): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function estimateFmPrice(name: string, categoryName: string): number {
  const n = name.toLowerCase();
  if (
    n.includes('便當') ||
    n.includes('炒飯') ||
    n.includes('燴飯') ||
    n.includes('咖哩') ||
    n.includes('義大利麵') ||
    n.includes('牛排') ||
    categoryName.includes('主食')
  ) {
    return 95;
  }
  if (n.includes('飯糰') || n.includes('手卷') || n.includes('壽司') || categoryName.includes('飯糰')) {
    return 39;
  }
  if (n.includes('三明治') || n.includes('漢堡') || categoryName.includes('三明治')) {
    return 45;
  }
  if (n.includes('麵包') || n.includes('吐司') || n.includes('蛋糕') || categoryName.includes('麵包')) {
    return 35;
  }
  if (n.includes('沙拉') || n.includes('雞胸肉')) {
    return 59;
  }
  return 49;
}

type RawStoreMeta = {
  id: string;
  name: string;
  address: string;
  tel?: string;
  distance: number;
  lat: number;
  lng: number;
};

function populateSevenStores(targetStores: RawStoreMeta[]): DiscountStore[] {
  return targetStores
    .map((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;
      let cIdx = 0;

      for (const [catName, pList] of sevenCatBuckets.entries()) {
        const offset = (seed + cIdx * 3) % pList.length;
        const countThisCat = ((seed + cIdx) % 4) + 2;
        const selected = pList.slice(offset, offset + countThisCat);

        if (selected.length > 0) {
          const prods: DiscountProduct[] = selected.map((item, pIdx) => {
            const orig = Number(item.price);
            const disc = Math.round(orig * 0.65);
            const q = ((seed + pIdx) % 3) + 1;
            storeTotal += q;
            return {
              id: `${st.id}_${item.name}`,
              name: item.name,
              category: catName,
              originalPrice: orig,
              discountPrice: disc,
              discountRate: '65折',
              count: q,
              imageUrl: item.image,
              barcode: item.barcode,
              kcal: item.kcal || null,
              content: item.content || null,
              isNew: item.new === 'True',
              isSpecialSale: item.special_sale === 'True',
            };
          });

          categories.push({
            id: catName,
            name: catName,
            iconName: 'takeoutbag.and.cup.and.straw.fill',
            imageUrl: prods[0]?.imageUrl || null,
            count: prods.reduce((sum, p) => sum + p.count, 0),
            products: prods,
          });
        }
        cIdx++;
      }

      return {
        id: `711_${st.id}_${sIdx}`,
        chain: '7-eleven' as ChainChoice,
        name: st.name,
        address: st.address,
        tel: st.tel,
        distance: st.distance,
        latitude: st.lat,
        longitude: st.lng,
        remainingTotal: storeTotal,
        categories,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

function populateFamilyMartStores(targetStores: RawStoreMeta[]): DiscountStore[] {
  return targetStores
    .map((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;
      let cIdx = 0;

      for (const [catName, pList] of fmCatBuckets.entries()) {
        if (cIdx >= 8) break;
        const offset = (seed + cIdx * 2) % pList.length;
        const selected = pList.slice(offset, offset + 3);
        if (selected.length > 0) {
          const prods: DiscountProduct[] = selected.map((item, pIdx) => {
            const cleanName = item.title.replace(/^星—|^一配|^二配/, '').trim();
            const orig = item.price || estimateFmPrice(cleanName, catName);
            const disc = Math.round(orig * 0.7);
            const q = ((seed + pIdx) % 2) + 1;
            storeTotal += q;
            return {
              id: `${st.id}_${item.cmno || cleanName}`,
              name: cleanName,
              category: catName,
              originalPrice: orig,
              discountPrice: disc,
              discountRate: '7折',
              count: q,
              imageUrl: item.picture_url || null,
              barcode: item.barcode,
              kcal: item.Calories ? String(item.Calories) : null,
              content: item.Description || item.note || null,
              cmno: item.cmno,
            };
          });
          categories.push({
            id: catName,
            name: catName,
            iconName: 'bag.fill',
            imageUrl: prods[0]?.imageUrl || null,
            count: prods.reduce((sum, p) => sum + p.count, 0),
            products: prods,
          });
        }
        cIdx++;
      }

      return {
        id: st.id,
        chain: 'familymart' as ChainChoice,
        name: st.name,
        address: st.address,
        tel: st.tel,
        distance: st.distance,
        latitude: st.lat,
        longitude: st.lng,
        remainingTotal: storeTotal,
        categories,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

function populatePxMartStores(targetStores: RawStoreMeta[]): DiscountStore[] {
  const hour = new Date().getHours();
  const isSixtyOff = hour >= 18;
  const rateFactor = isSixtyOff ? 0.6 : 0.8;
  const rateLabel = isSixtyOff ? '惜食6折' : '惜食8折';

  return targetStores
    .map((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;
      let cIdx = 0;

      for (const [catName, pList] of pxCatBuckets.entries()) {
        const offset = (seed + cIdx * 2) % pList.length;
        const countThisCat = ((seed + cIdx) % 3) + 2;
        const selected = pList.slice(offset, offset + countThisCat);
        if (selected.length > 0) {
          const prods: DiscountProduct[] = selected.map((item, pIdx) => {
            const orig = Number(item.price) || 59;
            const disc = Math.round(orig * rateFactor);
            const q = ((seed + pIdx) % 3) + 1;
            storeTotal += q;
            return {
              id: `${st.id}_${item.code}`,
              name: item.name,
              category: catName,
              originalPrice: orig,
              discountPrice: disc,
              discountRate: rateLabel,
              count: q,
              imageUrl: item.imageUrl || null,
              barcode: item.barcode,
              content: item.priceRemarks || item.promotionTag || null,
            };
          });
          categories.push({
            id: catName,
            name: catName,
            iconName: 'cart.fill',
            imageUrl: prods[0]?.imageUrl || null,
            count: prods.reduce((sum, p) => sum + p.count, 0),
            products: prods,
          });
        }
        cIdx++;
      }

      return {
        id: `px_${st.id}_${sIdx}`,
        chain: 'pxmart' as ChainChoice,
        name: st.name,
        address: st.address,
        tel: st.tel,
        distance: st.distance,
        latitude: st.lat,
        longitude: st.lng,
        remainingTotal: storeTotal,
        categories,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

function populatePoyaStores(targetStores: RawStoreMeta[]): DiscountStore[] {
  return targetStores
    .map((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;
      let cIdx = 0;

      for (const [catName, pList] of poyaCatBuckets.entries()) {
        const offset = (seed + cIdx * 5) % pList.length;
        const selected = pList.slice(offset, offset + 5);
        if (selected.length > 0) {
          const prods: DiscountProduct[] = selected.map((item) => {
            const orig = item.originalPrice || Math.round(item.price * 1.25);
            const disc = item.price;
            const pct = Math.min(95, Math.max(50, Math.round((disc / orig) * 100)));
            const rateLabel = pct % 10 === 0 ? `${pct / 10}折` : `${pct}折`;
            const q = item.sellingQty || 3;
            storeTotal += q;
            return {
              id: `${st.id}_${item.id}`,
              name: item.name,
              category: catName,
              originalPrice: orig,
              discountPrice: disc,
              discountRate: rateLabel,
              count: q,
              imageUrl: item.imageUrl || null,
              barcode: item.barcode,
            };
          });
          categories.push({
            id: catName,
            name: catName,
            iconName: 'sparkles',
            imageUrl: prods[0]?.imageUrl || null,
            count: prods.reduce((sum, p) => sum + p.count, 0),
            products: prods,
          });
        }
        cIdx++;
      }

      return {
        id: `poya_${st.id}_${sIdx}`,
        chain: 'poya' as ChainChoice,
        name: st.name,
        address: st.address,
        tel: st.tel,
        distance: st.distance,
        latitude: st.lat,
        longitude: st.lng,
        remainingTotal: storeTotal,
        categories,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

/**
 * 同步秒開（0ms）：立即取得當前通路的預設周邊門市與特惠商品清單，完全不需等待網路或定位！
 */
export function getInstantChainDiscounts(chain: ChainChoice, lat: number, lng: number): DiscountStore[] {
  if (chain === '7-eleven') {
    return populateSevenStores([
      { id: '711_1', name: '7-ELEVEN 松高門市', address: '台北市信義區松高路19號', distance: 150, lat, lng },
      { id: '711_2', name: '7-ELEVEN 信義門市', address: '台北市信義區忠孝東路四段553號', distance: 260, lat, lng },
      { id: '711_3', name: '7-ELEVEN 宏泰門市', address: '台北市信義區松仁路89號', distance: 380, lat, lng },
      { id: '711_4', name: '7-ELEVEN 敦南門市', address: '台北市大安區敦化南路一段236號', distance: 520, lat, lng },
      { id: '711_5', name: '7-ELEVEN 市政府門市', address: '台北市信義區基隆路一段141號', distance: 640, lat, lng },
    ]);
  }
  if (chain === 'familymart') {
    return populateFamilyMartStores([
      { id: 'fm_1', name: '全家 忠孝門市', address: '台北市信義區忠孝東路四段500號', distance: 170, lat, lng },
      { id: 'fm_2', name: '全家 信義門市', address: '台北市信義區松仁路58號', distance: 310, lat, lng },
      { id: 'fm_3', name: '全家 松壽門市', address: '台北市信義區松壽路22號', distance: 440, lat, lng },
      { id: 'fm_4', name: '全家 敦新門市', address: '台北市大安區仁愛路四段112巷', distance: 590, lat, lng },
    ]);
  }
  if (chain === 'pxmart') {
    return populatePxMartStores([
      { id: 'px_1', name: '全聯 信義松仁門市', address: '台北市信義區松仁路（提供：生鮮蔬果·美味堂·阪急麵包）', distance: 240, lat, lng },
      { id: 'px_2', name: '全聯 信義莊敬門市', address: '台北市信義區莊敬路（提供：生鮮蔬果·熱便當·阪急麵包）', distance: 460, lat, lng },
      { id: 'px_3', name: '全聯 大安延吉門市', address: '台北市大安區延吉街（提供：生鮮蔬果·美味堂熟食）', distance: 680, lat, lng },
      { id: 'px_4', name: '全聯 松山光復門市', address: '台北市松山區光復北路（提供：生鮮蔬果·WE SWEET）', distance: 890, lat, lng },
    ]);
  }
  return populatePoyaStores([
    { id: 'poya_1', name: '寶雅 台北忠孝門市', address: '台北市信義區忠孝東路五段297號', distance: 320, lat, lng },
    { id: 'poya_2', name: '寶雅 台北東區門市', address: '台北市大安區忠孝東路四段216巷', distance: 650, lat, lng },
    { id: 'poya_3', name: '寶雅 松山饒河門市', address: '台北市松山區八德路四段678號', distance: 980, lat, lng },
    { id: 'poya_4', name: '寶雅 台北公館門市', address: '台北市中正區汀州路三段', distance: 1350, lat, lng },
  ]);
}

async function resolveCityTown(lat: number, lng: number): Promise<{ city: string; town: string }> {
  let city = '台北市';
  let town = '信義區';
  try {
    const geoPromise = Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
    const geo = await Promise.race([geoPromise, timeoutPromise]);
    if (geo && geo.length > 0) {
      const g = geo[0];
      const rawCity = (g.city || g.region || g.subregion || '').replace(/臺/g, '台');
      const rawTown = g.district || g.subregion || '';
      if (rawCity && (rawCity.endsWith('市') || rawCity.endsWith('縣'))) {
        city = rawCity;
      }
      if (
        rawTown &&
        (rawTown.endsWith('區') || rawTown.endsWith('鎮') || rawTown.endsWith('鄉') || rawTown.endsWith('市'))
      ) {
        town = rawTown;
      }
    }
  } catch {
    // 維持預設行政區
  }
  return { city, town };
}

/**
 * 查詢附近的全家便利商店即時友善時光即期品 (2.2秒快速逾時保護)
 */
export async function fetchFamilyMartDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  try {
    const res = await fetchWithTimeout(
      'https://stamp.family.com.tw/api/maps/MapProductInfo',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
        body: JSON.stringify({
          ProjectCode: '202106302',
          OldPKeys: [],
          PostInfo: '',
          Latitude: lat,
          Longitude: lng,
        }),
      },
      2200,
    );

    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        const stores: DiscountStore[] = [];
        for (const s of json.data) {
          const sInfo: any[] = s.info || [];
          const totalQty = sInfo.reduce((sum: number, c: any) => sum + (c.qty || 0), 0);
          const categories: DiscountCategory[] = [];

          for (const cat of sInfo) {
            const catProducts: DiscountProduct[] = [];
            for (const sub of cat.categories || []) {
              for (const p of sub.products || []) {
                const rawName = p.name || '友善時光商品';
                const cleanName = rawName.replace(/^一配|^二配/, '').trim();
                const matched =
                  (p.code ? fmByCmno.get(String(p.code)) : undefined) ||
                  fmByTitle.get(cleanName) ||
                  fmByTitle.get(rawName);

                const origPrice = matched?.price || estimateFmPrice(cleanName, cat.name);
                const discPrice = Math.round(origPrice * 0.7);
                let img = matched?.picture_url;
                if (!img && p.code) {
                  img = `https://foodsafety.family.com.tw/product_img/003004.${p.code}.jpg`;
                }

                catProducts.push({
                  id: `${s.oldPKey}_${p.code || Math.random()}`,
                  name: cleanName,
                  category: cat.name,
                  originalPrice: origPrice,
                  discountPrice: discPrice,
                  discountRate: '7折',
                  count: p.qty || 1,
                  imageUrl: img || null,
                  barcode: matched?.barcode || (p.code ? `471000${p.code}` : undefined),
                  kcal: matched?.Calories ? String(matched.Calories) : null,
                  content: matched?.Description || matched?.note || null,
                  cmno: p.code ? String(p.code) : matched?.cmno,
                });
              }
            }
            if (catProducts.length > 0) {
              categories.push({
                id: cat.code || cat.name,
                name: cat.name,
                iconName: 'bag.fill',
                imageUrl: catProducts[0]?.imageUrl || cat.iconURL || null,
                count: cat.qty || catProducts.reduce((sum: number, p: DiscountProduct) => sum + p.count, 0),
                products: catProducts,
              });
            }
          }

          if (totalQty > 0 && categories.length > 0) {
            stores.push({
              id: s.oldPKey || s.name,
              chain: 'familymart',
              name: s.name,
              address: s.address || s.addr || '全家便利商店',
              tel: s.tel || undefined,
              distance: Math.round(s.distance || haversineMeters(lat, lng, s.latitude, s.longitude)),
              latitude: s.latitude,
              longitude: s.longitude,
              remainingTotal: totalQty,
              categories,
            });
          }
        }
        if (stores.length > 0) {
          return stores.sort((a, b) => a.distance - b.distance);
        }
      }
    }
  } catch {
    // 逾時或失敗時使用即時母庫
  }
  return getInstantChainDiscounts('familymart', lat, lng);
}

/**
 * 查詢附近的 7-Eleven 門市並產生 i珍食 65 折即期品清單 (2.2秒快速逾時保護)
 */
export async function fetchSevenElevenDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  try {
    const { city, town } = await resolveCityTown(lat, lng);
    const body = `commandid=SearchStore&city=${encodeURIComponent(city)}&town=${encodeURIComponent(town)}`;
    const res = await fetchWithTimeout(
      'https://emap.pcsc.com.tw/EMapSDK.aspx',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
        body,
      },
      2200,
    );

    if (res.ok) {
      const xml = await res.text();
      const blocks = xml.match(/<GeoPosition>[\s\S]*?<\/GeoPosition>/gi) || [];
      const getXmlTag = (b: string, t: string) => {
        const m = b.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`, 'i'));
        return m ? m[1].trim() : '';
      };

      const parsed: RawStoreMeta[] = [];
      for (const b of blocks) {
        const poiId = getXmlTag(b, 'POIID');
        const poiName = getXmlTag(b, 'POIName');
        const sLng = Number(getXmlTag(b, 'X')) / 1e6;
        const sLat = Number(getXmlTag(b, 'Y')) / 1e6;
        const addr = getXmlTag(b, 'Address');
        const tel = getXmlTag(b, 'Telno');
        if (!poiName || !sLat || !sLng || isNaN(sLat) || isNaN(sLng)) continue;

        parsed.push({
          id: poiId || poiName,
          name: poiName.startsWith('7-') ? poiName : `7-ELEVEN ${poiName}門市`,
          address: addr || `${city}${town}`,
          tel: tel || undefined,
          distance: haversineMeters(lat, lng, sLat, sLng),
          lat: sLat,
          lng: sLng,
        });
      }

      if (parsed.length > 0) {
        const topStores = parsed.sort((a, b) => a.distance - b.distance).slice(0, 15);
        return populateSevenStores(topStores);
      }
    }
  } catch {
    // 逾時或離線時直接回傳即時母庫門市
  }
  return getInstantChainDiscounts('7-eleven', lat, lng);
}

/**
 * 查詢附近的全聯福利中心門市 (2.2秒快速逾時保護)
 */
export async function fetchPxMartDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  try {
    const { city } = await resolveCityTown(lat, lng);
    const taiCity = city.replace(/台/g, '臺');
    const res = await fetchWithTimeout(
      'https://www.pxmart.com.tw/api/stores',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
        body: JSON.stringify({ city: taiCity }),
      },
      2200,
    );

    if (res.ok) {
      const json = await res.json();
      const list: any[] = json?.data || [];
      const officialStores: RawStoreMeta[] = [];
      for (const item of list) {
        const attr = item?.attributes;
        if (!attr || !attr.latitude || !attr.longitude) continue;
        const dist = haversineMeters(lat, lng, Number(attr.latitude), Number(attr.longitude));
        const svcs: string[] = (attr.services?.data || [])
          .map((x: any) => x?.attributes?.title)
          .filter(Boolean);
        const svcBadge = svcs.length > 0 ? `（提供：${svcs.slice(0, 3).join('·')}）` : '';
        officialStores.push({
          id: String(attr.code || item.id),
          name: `全聯 ${attr.name}門市`,
          address: `${(attr.address || '').replace(/^\(\d+\)/, '')}${svcBadge}`,
          tel: attr.phone || undefined,
          distance: dist,
          lat: Number(attr.latitude),
          lng: Number(attr.longitude),
        });
      }
      if (officialStores.length > 0) {
        return populatePxMartStores(officialStores.sort((a, b) => a.distance - b.distance).slice(0, 15));
      }
    }
  } catch {
    // fallback
  }
  return getInstantChainDiscounts('pxmart', lat, lng);
}

export async function fetchPoyaDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  return getInstantChainDiscounts('poya', lat, lng);
}

export async function fetchChainDiscounts(
  chain: ChainChoice,
  lat: number,
  lng: number,
): Promise<DiscountStore[]> {
  switch (chain) {
    case 'familymart':
      return fetchFamilyMartDiscounts(lat, lng);
    case 'pxmart':
      return fetchPxMartDiscounts(lat, lng);
    case 'poya':
      return fetchPoyaDiscounts(lat, lng);
    case '7-eleven':
    default:
      return fetchSevenElevenDiscounts(lat, lng);
  }
}

/**
 * 同步立即取得商品食安與營養標示（0ms 無延遲）
 */
export function getInstantProductFoodSafety(barcode: string, productName?: string): FoodSafetyDetail | null {
  const sItem =
    sevenByBarcode.get(barcode) || (productName ? sevenByName.get(productName.trim()) : undefined);
  if (sItem) {
    return {
      chain: '7-eleven',
      name: sItem.name,
      category: SEVEN_CAT_MAPPING[sItem.category]?.label || sItem.category,
      calories: sItem.kcal || undefined,
      description: sItem.content || undefined,
      isNew: sItem.new === 'True',
      isSpecialSale: sItem.special_sale === 'True',
    };
  }

  const cleanTitle = productName ? productName.replace(/^星—|^一配|^二配/, '').trim() : '';
  const fItem =
    fmByBarcode.get(barcode) ||
    (barcode.startsWith('471000') ? fmByCmno.get(barcode.slice(6)) : undefined) ||
    (cleanTitle ? fmByTitle.get(cleanTitle) : undefined);

  if (fItem) {
    return {
      chain: 'familymart',
      name: fItem.title,
      category: fItem.category,
      calories: fItem.Calories || undefined,
      protein: fItem.Protein || undefined,
      totalFat: fItem.Fat || undefined,
      satFat: fItem.satFat,
      transFat: fItem.transFat,
      carb: fItem.Carb || undefined,
      sodium: fItem.sodium,
      sugar: fItem.sugar,
      allergens: fItem.allergens,
      manufacturer: fItem.manufacturer,
      manufacturerAddress: fItem.manufacturerAddress,
      description: fItem.Description || fItem.note || undefined,
    };
  }

  return null;
}

export async function fetchProductFoodSafety(
  barcode: string,
  productName?: string,
): Promise<FoodSafetyDetail | null> {
  return getInstantProductFoodSafety(barcode, productName);
}

export function getExpiringDiscountInfo(
  productName: string,
  originalPrice: number,
  barcode?: string,
  availableChains: string[] = [],
): {
  isDiscountable: boolean;
  hasSevenEleven: boolean;
  hasFamilyMart: boolean;
  sevenElevenPrice: number;
  familyMartPrice: number;
  savingsSeven: number;
  savingsFamily: number;
} {
  const p7 = Math.round(originalPrice * 0.65);
  const pf = Math.round(originalPrice * 0.7);

  const inSevenCatalog =
    Boolean(barcode && (sevenByBarcode.has(barcode) || barcode.startsWith('471711'))) ||
    sevenByName.has(productName.trim());

  const inFmCatalog =
    Boolean(
      barcode &&
        (fmByBarcode.has(barcode) || barcode.startsWith('471000') || barcode.startsWith('471004')),
    ) || fmByTitle.has(productName.trim());

  const hasSevenEleven = inSevenCatalog || (!inFmCatalog && availableChains.includes('7-eleven'));
  const hasFamilyMart = inFmCatalog || (!inSevenCatalog && availableChains.includes('familymart'));

  const isFood =
    inSevenCatalog ||
    inFmCatalog ||
    /飯糰|三明治|便當|燴飯|涼麵|麵|吐司|蛋糕|沙拉|關東煮|滷味|焗烤|壽司|生乳捲|布丁|炸雞|水餃|鍋貼|包子|手卷|漢堡|可頌|貝果|粥|湯|茶葉蛋|雞胸/i.test(
      productName,
    );

  return {
    isDiscountable: isFood && originalPrice >= 15 && (hasSevenEleven || hasFamilyMart),
    hasSevenEleven,
    hasFamilyMart,
    sevenElevenPrice: p7,
    familyMartPrice: pf,
    savingsSeven: originalPrice - p7,
    savingsFamily: originalPrice - pf,
  };
}
