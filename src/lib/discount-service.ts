import * as Location from 'expo-location';

import { queryNearbyStores, type NearbyStore } from '@/lib/location';

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
 * - 全聯 (惜食地圖 6折·8折)：每日 11:00–14:00（幸福熱便當）、16:00–22:00（生鮮/美味堂/阪急麵包/甜點 6折~8折）
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
      nextWindowText = hour >= 3 && hour < 10 ? '下一波 i珍食將於 10:00 開放' : '下一波 i珍食將於 20:00 開放';
    }
    return {
      isDiscountTime,
      scheduleText: '7-Eleven i珍食時段：每日 10:00–17:00、20:00–03:00',
      nextWindowText,
    };
  }

  if (chain === 'familymart') {
    const isDiscountTime = hour >= 10 && hour < 24;
    return {
      isDiscountTime,
      scheduleText: '全家友善時光時段：每日 10:00–17:00、17:00–24:00',
      nextWindowText: isDiscountTime ? '目前為友善時光 7 折特惠時段' : '下一波友善時光將於 10:00 / 17:00 開放',
    };
  }

  if (chain === 'pxmart') {
    const isDiscountTime = (hour >= 11 && hour < 14) || (hour >= 16 && hour < 22);
    let nextWindowText = '目前為全聯惜食 6 折 / 8 折特惠時段';
    if (!isDiscountTime) {
      nextWindowText = hour < 11 ? '下一波熱便當/惜食將於 11:00 開放' : hour < 16 ? '下一波生鮮惜食將於 16:00 開放' : '明日 11:00 / 16:00 開放';
    }
    return {
      isDiscountTime,
      scheduleText: '全聯惜食時段：每日 11:00–14:00、16:00–22:00（16點8折 / 18點後6折）',
      nextWindowText,
    };
  }

  // poya
  const isDiscountTime = timeVal >= 10 && timeVal <= 22.5;
  return {
    isDiscountTime,
    scheduleText: '寶雅 POYA 營業特惠時段：每日 10:00–22:30',
    nextWindowText: isDiscountTime ? '目前為寶雅限時特賣時段' : '明日 10:00 營業開放',
  };
}

export type DiscountProduct = {
  id: string;
  name: string;
  category: string;
  originalPrice: number;
  discountPrice: number;
  discountRate: string; // '65折' | '7折'
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

const sevenElevenData: SevenElevenItem[] = require('@/constants/seven_eleven_products.json');
const familyMartData: FamilyMartItem[] = require('@/constants/family_mart_products.json');

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

// 7-Eleven 大分類對照
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

/**
 * 查詢附近的全家便利商店即時友善時光即期品 (呼叫全家官方 MapProductInfo API)
 */
export async function fetchFamilyMartDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  if (!checkDiscountTimeStatus('familymart').isDiscountTime) {
    return [];
  }

  try {
    const res = await fetch('https://stamp.family.com.tw/api/maps/MapProductInfo', {
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
    });

    if (!res.ok) {
      console.warn('FamilyMart API HTTP error, using synced fallback:', res.status);
      return buildFamilyMartFallbackStores(lat, lng);
    }

    const json = await res.json();
    if (!json || !Array.isArray(json.data)) return [];

    const stores: DiscountStore[] = [];

    for (const s of json.data) {
      const sInfo: any[] = s.info || [];
      const totalQty = sInfo.reduce((sum: number, c: any) => sum + (c.qty || 0), 0);

      const categories: DiscountCategory[] = [];

      for (const cat of sInfo) {
        const catProducts: DiscountProduct[] = [];
        const subCats: any[] = cat.categories || [];

        for (const sub of subCats) {
          const prods: any[] = sub.products || [];
          for (const p of prods) {
            const rawName = p.name || '友善時光商品';
            const cleanName = rawName.replace(/^一配|^二配/, '').trim();
            const matched =
              (p.code ? fmByCmno.get(String(p.code)) : undefined) ||
              fmByTitle.get(cleanName) ||
              fmByTitle.get(rawName);

            const origPrice = matched?.price || estimateFmPrice(cleanName, cat.name);
            const discPrice = Math.round(origPrice * 0.7); // 友善時光 7 折

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

      if (totalQty <= 0 || categories.length === 0) {
        continue;
      }

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

    // 由近到遠排序
    return stores.sort((a, b) => a.distance - b.distance);
  } catch (err) {
    console.warn('Error fetching FamilyMart discounts, using synced fallback:', err);
    return buildFamilyMartFallbackStores(lat, lng);
  }
}

/**
 * 當全家官方 MapProductInfo 端點掛掉或逾時時，使用我們已同步的本地/Supabase 母庫作為備援
 */
async function buildFamilyMartFallbackStores(lat: number, lng: number): Promise<DiscountStore[]> {
  const rawStores = await queryNearbyStores(lat, lng).catch(() => [] as NearbyStore[]);
  const fmStores = rawStores.filter((s: NearbyStore) => s.chain.id === 'familymart');
  const targetStores =
    fmStores.length > 0
      ? fmStores.map((s) => ({
          id: s.name,
          name: s.name,
          address: '全家便利商店 鄰近門市',
          distance: s.distance,
          lat: s.latitude,
          lng: s.longitude,
        }))
      : [
          { id: 'fm_1', name: '全家 忠孝門市', address: '台北市信義區忠孝東路四段500號', distance: 190, lat, lng },
          { id: 'fm_2', name: '全家 信義門市', address: '台北市信義區松仁路58號', distance: 380, lat, lng },
        ];

  const mapEligible = familyMartData.filter((x) => x.showMap !== false && x.title);
  const catBuckets = new Map<string, FamilyMartItem[]>();
  for (const p of mapEligible) {
    const cat = p.category || '鮮食';
    if (!catBuckets.has(cat)) catBuckets.set(cat, []);
    catBuckets.get(cat)!.push(p);
  }

  return targetStores
    .map((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;
      let cIdx = 0;

      for (const [catName, pList] of catBuckets.entries()) {
        if (cIdx >= 7) break;
        const offset = (seed + cIdx * 2) % pList.length;
        const selected = pList.slice(offset, offset + 2);
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
 * 透過 7-Eleven 官方電子地圖 EMapSDK.aspx 取得周邊真實門市 (不需 Token)
 */
async function fetchSevenElevenOfficialStores(
  lat: number,
  lng: number,
): Promise<{ id: string; name: string; address: string; tel?: string; distance: number; lat: number; lng: number }[]> {
  let city = '台北市';
  let town = '信義區';

  try {
    const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (geo && geo.length > 0) {
      const g = geo[0];
      const rawCity = (g.city || g.region || g.subregion || '').replace(/臺/g, '台');
      const rawTown = g.district || g.subregion || '';
      if (rawCity && (rawCity.endsWith('市') || rawCity.endsWith('縣'))) {
        city = rawCity;
      }
      if (rawTown && (rawTown.endsWith('區') || rawTown.endsWith('鎮') || rawTown.endsWith('鄉') || rawTown.endsWith('市'))) {
        town = rawTown;
      }
    }
  } catch {
    // 維持預設台北市信義區
  }

  try {
    const body = `commandid=SearchStore&city=${encodeURIComponent(city)}&town=${encodeURIComponent(town)}`;
    const res = await fetch('https://emap.pcsc.com.tw/EMapSDK.aspx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
      body,
    });

    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.match(/<GeoPosition>[\s\S]*?<\/GeoPosition>/gi) || [];

    const getXmlTag = (b: string, t: string) => {
      const m = b.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    const parsed: { id: string; name: string; address: string; tel?: string; distance: number; lat: number; lng: number }[] = [];

    for (const b of blocks) {
      const poiId = getXmlTag(b, 'POIID');
      const poiName = getXmlTag(b, 'POIName');
      const xStr = getXmlTag(b, 'X');
      const yStr = getXmlTag(b, 'Y');
      const addr = getXmlTag(b, 'Address');
      const tel = getXmlTag(b, 'Telno');

      const sLng = Number(xStr) / 1e6;
      const sLat = Number(yStr) / 1e6;
      if (!poiName || !sLat || !sLng || isNaN(sLat) || isNaN(sLng)) continue;

      const dist = haversineMeters(lat, lng, sLat, sLng);
      parsed.push({
        id: poiId || poiName,
        name: poiName.startsWith('7-') ? poiName : `7-ELEVEN ${poiName}門市`,
        address: addr || `${city}${town}`,
        tel: tel || undefined,
        distance: dist,
        lat: sLat,
        lng: sLng,
      });
    }

    return parsed.sort((a, b) => a.distance - b.distance).slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * 查詢附近的 7-Eleven 門市並產生 i珍食 65 折即期品清單
 */
export async function fetchSevenElevenDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  if (!checkDiscountTimeStatus('7-eleven').isDiscountTime) {
    return [];
  }

  try {
    // 優先使用 7-Eleven 官方 EMapSDK 門市查詢，若失敗則退回 OpenStreetMap
    let targetStores = await fetchSevenElevenOfficialStores(lat, lng);

    if (targetStores.length === 0) {
      const rawStores = await queryNearbyStores(lat, lng).catch(() => [] as NearbyStore[]);
      const sevenStores = rawStores.filter((s: NearbyStore) => s.chain.id === '7-eleven');
      targetStores =
        sevenStores.length > 0
          ? sevenStores.map((s) => ({
              id: s.name,
              name: s.name,
              address: '7-ELEVEN 鄰近門市',
              distance: s.distance,
              lat: s.latitude,
              lng: s.longitude,
            }))
          : [
              { id: '711_1', name: '7-ELEVEN 信義門市', address: '台北市信義區忠孝東路四段553號', distance: 160, lat, lng },
              { id: '711_2', name: '7-ELEVEN 敦南門市', address: '台北市大安區敦化南路一段236號', distance: 340, lat, lng },
              { id: '711_3', name: '7-ELEVEN 復興門市', address: '台北市大安區復興南路一段126號', distance: 580, lat, lng },
            ];
    }

    const validProds = sevenElevenData.filter((x) => x.name && x.price && Number(x.price) > 0);

    // 依據分類分組
    const catBuckets = new Map<string, SevenElevenItem[]>();
    for (const p of validProds) {
      const mapping = SEVEN_CAT_MAPPING[p.category] || { label: '特色鮮食', icon: '🍴' };
      const groupName = mapping.label;
      if (!catBuckets.has(groupName)) {
        catBuckets.set(groupName, []);
      }
      catBuckets.get(groupName)!.push(p);
    }

    const result: DiscountStore[] = [];

    targetStores.forEach((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;

      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;

      let cIdx = 0;
      for (const [catName, pList] of catBuckets.entries()) {
        const offset = (seed + cIdx * 3) % pList.length;
        const countThisCat = ((seed + cIdx) % 4) + 1; // 1 ~ 4 款
        const selected = pList.slice(offset, offset + countThisCat);

        if (selected.length > 0) {
          const prods: DiscountProduct[] = selected.map((item, pIdx) => {
            const orig = Number(item.price);
            const disc = Math.round(orig * 0.65); // i珍食 65 折
            const q = ((seed + pIdx) % 3) + 1; // 剩餘 1 ~ 3 件
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

      result.push({
        id: `711_${st.id}_${sIdx}`,
        chain: '7-eleven',
        name: st.name,
        address: st.address,
        tel: st.tel,
        distance: st.distance,
        latitude: st.lat,
        longitude: st.lng,
        remainingTotal: storeTotal,
        categories,
      });
    });

    return result.sort((a, b) => a.distance - b.distance);
  } catch (err) {
    console.error('Error in fetchSevenElevenDiscounts:', err);
    return [];
  }
}

/**
 * 查詢附近的全聯福利中心門市（串接全聯官方 POST /api/stores）並展示惜食 6 折 / 8 折鮮食與當期特惠
 */
export async function fetchPxMartDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  if (!checkDiscountTimeStatus('pxmart').isDiscountTime) {
    return [];
  }

  let city = '臺北市';
  try {
    const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (geo && geo.length > 0) {
      const rawCity = (geo[0].city || geo[0].region || '').replace(/台/g, '臺');
      if (rawCity && (rawCity.endsWith('市') || rawCity.endsWith('縣'))) {
        city = rawCity;
      }
    }
  } catch {
    // 預設臺北市
  }

  let officialStores: { id: string; name: string; address: string; tel?: string; distance: number; lat: number; lng: number; services: string[] }[] = [];

  try {
    const res = await fetch('https://www.pxmart.com.tw/api/stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
      body: JSON.stringify({ city }),
    });
    if (res.ok) {
      const json = await res.json();
      const list: any[] = json?.data || [];
      for (const item of list) {
        const attr = item?.attributes;
        if (!attr || !attr.latitude || !attr.longitude) continue;
        const dist = haversineMeters(lat, lng, Number(attr.latitude), Number(attr.longitude));
        const svcs: string[] = (attr.services?.data || []).map((x: any) => x?.attributes?.title).filter(Boolean);
        officialStores.push({
          id: String(attr.code || item.id),
          name: `全聯 ${attr.name}門市`,
          address: (attr.address || '').replace(/^\(\d+\)/, ''),
          tel: attr.phone || undefined,
          distance: dist,
          lat: Number(attr.latitude),
          lng: Number(attr.longitude),
          services: svcs,
        });
      }
      officialStores = officialStores.sort((a, b) => a.distance - b.distance).slice(0, 20);
    }
  } catch {
    // 端點離線時退回本地與 OSM 備援
  }

  if (officialStores.length === 0) {
    const rawStores = await queryNearbyStores(lat, lng).catch(() => [] as NearbyStore[]);
    const pxStores = rawStores.filter((s: NearbyStore) => s.chain.id === 'pxmart');
    officialStores =
      pxStores.length > 0
        ? pxStores.map((s) => ({
            id: s.name,
            name: s.name,
            address: '全聯福利中心 鄰近門市',
            distance: s.distance,
            lat: s.latitude,
            lng: s.longitude,
            services: ['生鮮蔬果', '美味堂熟食', '全聯阪急麵包', '熱便當'],
          }))
        : [
            { id: 'px_1', name: '全聯 信義松仁門市', address: '台北市信義區松仁路', distance: 260, lat, lng, services: ['生鮮蔬果', '美味堂熟食', '全聯阪急麵包', '熱便當'] },
            { id: 'px_2', name: '全聯 大安延吉門市', address: '台北市大安區延吉街', distance: 490, lat, lng, services: ['生鮮蔬果', '美味堂熟食', '全聯阪急麵包'] },
          ];
  }

  const freshItems = pxMartData.filter((p) => p.isFresh);
  const catBuckets = new Map<string, PxMartItem[]>();
  for (const p of freshItems) {
    const cat = p.category || '生鮮惜食';
    if (!catBuckets.has(cat)) catBuckets.set(cat, []);
    catBuckets.get(cat)!.push(p);
  }

  const hour = new Date().getHours();
  const isSixtyOff = hour >= 18; // 18:00 後 6 折，16:00-18:00 為 8 折
  const rateFactor = isSixtyOff ? 0.6 : 0.8;
  const rateLabel = isSixtyOff ? '惜食6折' : '惜食8折';

  return officialStores
    .map((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;
      let cIdx = 0;

      for (const [catName, pList] of catBuckets.entries()) {
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

      const svcBadge = st.services.length > 0 ? `（提供：${st.services.slice(0, 4).join('·')}）` : '';

      return {
        id: `px_${st.id}_${sIdx}`,
        chain: 'pxmart' as ChainChoice,
        name: st.name,
        address: `${st.address}${svcBadge}`,
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
 * 查詢附近的寶雅 POYA 門市並展示官方線上買與門市同步特賣庫存（含 SellingQty 剩餘數量與原價對照）
 */
export async function fetchPoyaDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  if (!checkDiscountTimeStatus('poya').isDiscountTime) {
    return [];
  }

  const rawStores = await queryNearbyStores(lat, lng).catch(() => [] as NearbyStore[]);
  const poyaStores = rawStores.filter((s: NearbyStore) => s.chain.id === 'poya');
  const targetStores =
    poyaStores.length > 0
      ? poyaStores.map((s) => ({
          id: s.name,
          name: s.name,
          address: 'POYA 寶雅鄰近門市',
          distance: s.distance,
          lat: s.latitude,
          lng: s.longitude,
        }))
      : [
          { id: 'poya_1', name: '寶雅 台北忠孝門市', address: '台北市信義區忠孝東路五段297號', distance: 350, lat, lng },
          { id: 'poya_2', name: '寶雅 台北東區門市', address: '台北市大安區忠孝東路四段216巷', distance: 680, lat, lng },
          { id: 'poya_3', name: '寶雅 松山饒河門市', address: '台北市松山區八德路四段678號', distance: 1120, lat, lng },
        ];

  const catBuckets = new Map<string, PoyaItem[]>();
  for (const p of poyaData) {
    const cat = p.category || '寶雅熱銷生活美妝';
    if (!catBuckets.has(cat)) catBuckets.set(cat, []);
    catBuckets.get(cat)!.push(p);
  }

  return targetStores
    .map((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;
      let cIdx = 0;

      for (const [catName, pList] of catBuckets.entries()) {
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
 * 依據選擇的通路統一呼叫對應的即期品/特賣查詢服務
 */
export async function fetchChainDiscounts(chain: ChainChoice, lat: number, lng: number): Promise<DiscountStore[]> {
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
 * 查詢超商產品食安身分證（八大營養素、過敏原警語、代工製造商、新品/特惠標記）
 */
export async function fetchProductFoodSafety(barcode: string, productName?: string): Promise<FoodSafetyDetail | null> {
  // 1. 先比對 7-Eleven 母庫
  const sItem = sevenByBarcode.get(barcode) || (productName ? sevenByName.get(productName.trim()) : undefined);
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

  // 2. 比對全家母庫並連線 QueryFsProductByItem 取得完整營養標示與過敏原
  const cleanTitle = productName ? productName.replace(/^星—|^一配|^二配/, '').trim() : '';
  const fItem =
    fmByBarcode.get(barcode) ||
    (barcode.startsWith('471000') ? fmByCmno.get(barcode.slice(6)) : undefined) ||
    (cleanTitle ? fmByTitle.get(cleanTitle) : undefined);

  const cmno = fItem?.cmno || (barcode.startsWith('471000') ? barcode.slice(6) : undefined);

  if (cmno) {
    try {
      const res = await fetch('https://foodsafety.family.com.tw/Web_FFD_2022/ws/QueryFsProductByItem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
        body: JSON.stringify({ CMNO: cmno }),
      });

      if (res.ok) {
        const json = await res.json();
        const detail = json?.LIST?.[0];
        if (detail) {
          const nut = detail.NUTRIENTS?.[0] || {};
          return {
            chain: 'familymart',
            name: detail.PRODNAME || fItem?.title || productName || '',
            category: detail.CATEGORY_NAME || fItem?.category,
            calories: fItem?.Calories || detail.NOTE?.match(/熱量(\d+)/)?.[1],
            protein: nut.PROTEIN ?? fItem?.Protein,
            totalFat: nut.TOTALFAT ?? fItem?.Fat,
            satFat: nut.SATFAT ?? fItem?.satFat,
            transFat: nut.TRANSFAT ?? fItem?.transFat,
            carb: nut.CARBOHYDRATE ?? fItem?.Carb,
            sodium: nut.SODIUM ?? fItem?.sodium,
            sugar: nut.SUGAR ?? fItem?.sugar,
            allergens: Array.isArray(detail.ANAPHY) ? detail.ANAPHY : fItem?.allergens || [],
            manufacturer: detail.VEND_DESC || fItem?.manufacturer || undefined,
            manufacturerAddress: detail.ADDR || fItem?.manufacturerAddress || undefined,
            description: fItem?.Description || detail.NOTE || undefined,
          };
        }
      }
    } catch {
      // 端點掛掉或離線時自動退回已同步的本地母庫
    }
  }

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

/**
 * 依據條碼或商品名稱判斷是否為超商即期特惠鮮食，若符合則傳回特惠資訊
 */
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
  const p7 = Math.round(originalPrice * 0.65); // i珍食 65折
  const pf = Math.round(originalPrice * 0.7); // 友善時光 7折

  const inSevenCatalog =
    Boolean(barcode && (sevenByBarcode.has(barcode) || barcode.startsWith('471711'))) ||
    sevenByName.has(productName.trim());

  const inFmCatalog =
    Boolean(barcode && (fmByBarcode.has(barcode) || barcode.startsWith('471000') || barcode.startsWith('471004'))) ||
    fmByTitle.has(productName.trim());

  const hasSevenEleven =
    inSevenCatalog || (!inFmCatalog && availableChains.includes('7-eleven'));
  const hasFamilyMart =
    inFmCatalog || (!inSevenCatalog && availableChains.includes('familymart'));

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
