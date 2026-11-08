import { resolveTaiwanCityTownSync } from './discount-service';

export type RadarChain = '7-eleven' | 'familymart';
export type ProductFeedTab = 'new' | 'promo' | 'health';
export type DailyCategoryTab =
  | '口腔護理·牙線牙膏'
  | '紙品濕巾·衛生棉'
  | '洗沐清潔·個人護理'
  | '居家清潔·生活百貨';

export type DailyNecessityItem = {
  id: string;
  barcode: string;
  name: string;
  category: DailyCategoryTab | string;
  prices: Record<string, number>;
  lowestChain: string;
  lowestPrice: number;
  highestPrice: number;
  originalPrice?: number | null;
  imageUrl?: string | null;
  promotionTag?: string;
};

export type RadarProductItem = {
  id: string;
  chain: RadarChain;
  name: string;
  category: string;
  price: number;
  discountPrice: number;
  discountLabel: string;
  imageUrl?: string | null;
  barcode?: string;
  kcal?: string | number | null;
  protein?: number | null;
  description?: string | null;
  badges: string[];
};

export type SpecialServiceTag = {
  id: string;
  label: string;
  emoji: string;
};

export type SpecialStoreItem = {
  id: string;
  chain: RadarChain;
  name: string;
  address: string;
  tel?: string;
  distance: number;
  latitude: number;
  longitude: number;
  is24H?: boolean;
  serviceTags: SpecialServiceTag[];
  rawServices: string[];
};

export const SEVEN_SERVICE_FILTERS: SpecialServiceTag[] = [
  { id: 'all', label: '全部特殊門市', emoji: '✨' },
  { id: 'icecream', label: '霜淇淋·酷聖石', emoji: '🍦' },
  { id: 'slurpee', label: '思樂冰', emoji: '🥤' },
  { id: 'panini', label: '熱壓吐司', emoji: '🥪' },
  { id: 'toilet', label: '洗手間廁所', emoji: '🚻' },
  { id: 'seat', label: '休憩座位區', emoji: '🪑' },
  { id: 'tea', label: '現萃茶·茶BAR', emoji: '🍵' },
  { id: 'sweetpotato', label: '現蒸/烤地瓜', emoji: '🍠' },
  { id: 'hotfood', label: '哈燒炸烤·21TOGO', emoji: '🍗' },
  { id: 'donut', label: 'Mister Donut', emoji: '🍩' },
  { id: 'coffee', label: '精品/不可思議咖啡', emoji: '☕' },
  { id: 'powerbank', label: '借行動電源', emoji: '🔋' },
];

export const FAMILY_SERVICE_FILTERS: SpecialServiceTag[] = [
  { id: 'all', label: '全部特殊門市', emoji: '✨' },
  { id: 'famiice', label: 'Fami!ce霜淇淋', emoji: '🍦' },
  { id: 'twoice', label: '雙口味霜淇淋', emoji: '🍨' },
  { id: 'toilet', label: '洗手間廁所', emoji: '🚻' },
  { id: 'seat', label: '休憩座位區', emoji: '🪑' },
  { id: 'sweetpotato', label: '夯番薯·烤馬鈴薯', emoji: '🍠' },
  { id: 'grill', label: 'SOHOT炎選烤炸物', emoji: '🍢' },
  { id: 'tea', label: 'Let’s Café私品茶', emoji: '🍵' },
  { id: 'fresh', label: '生鮮好蔬專區', emoji: '🥬' },
  { id: 'powerbank', label: 'ChargeSpot電源', emoji: '🔋' },
];

const SEVEN_CAT_LABELS: Record<string, string> = {
  '1_Ricerolls': '御飯糰·手卷',
  '16_sandwich': '三明治·吐司',
  '20_panini': '熱壓吐司',
  '19_star': '星級饗宴聯名',
  '3_Cuisine': '台式便當燴飯',
  '5_ForeignDishes': '異國主食料理',
  '6_Noodles': '涼麵·熱麵食',
  '17_ohlala': 'Ohlala義式料理',
  '11_bread': '烘焙麵包甜點',
  '2_Light': '輕食沙拉水果',
  '4_Snacks': '炸烤物·精緻小點',
  '13_luwei': '滷味小吃',
  '18_veg': '天素地蔬',
  '23_veg': '天素地蔬',
  '15_health': '健康增肌餐盒',
  '7_Oden': '關東煮·蒸食',
  '12_steam': '蒸食機台點心',
  '8_Bigbite': '大亨堡熟食',
  '21_ice': '冰品霜淇淋',
  '22_ice': '冰品霜淇淋',
  '9_Icecream': '雪淋霜霜淇淋',
  '10_Slurpee': '思樂冰特調',
};

const sevenElevenData: any[] = require('@/constants/seven_eleven_products.json');
const familyMartData: any[] = require('@/constants/family_mart_products.json');
const dailyData: DailyNecessityItem[] = require('@/constants/daily_necessities.json');

export const DAILY_CATEGORY_TABS: {
  id: DailyCategoryTab;
  label: string;
  shortLabel: string;
  emoji: string;
  subtitle: string;
}[] = [
  {
    id: '口腔護理·牙線牙膏',
    label: '🪥 牙線·牙膏·口腔',
    shortLabel: '口腔·牙線',
    emoji: '🪥',
    subtitle: '3M、歐樂B牙線棒、舒酸定、高露潔、漱口水跨店比價',
  },
  {
    id: '紙品濕巾·衛生棉',
    label: '🧻 衛生紙·濕巾·棉棒',
    shortLabel: '紙品·衛生棉',
    emoji: '🧻',
    subtitle: '舒潔、五月花抽取式衛生紙、純水濕巾、蘇菲、靠得住',
  },
  {
    id: '洗沐清潔·個人護理',
    label: '🧴 洗髮·沐浴·洗面乳',
    shortLabel: '洗沐·保養',
    emoji: '🧴',
    subtitle: '專科潔顏乳、蜜妮卸妝、多芬、澎澎、海倫仙度絲洗沐',
  },
  {
    id: '居家清潔·生活百貨',
    label: '🧹 洗衣·洗碗·電池百貨',
    shortLabel: '清潔·電池',
    emoji: '🧹',
    subtitle: 'ARIEL洗衣球、一匙靈、泡舒、3M菜瓜布、金頂電池',
  },
];

export const PRODUCT_FEED_TABS: {
  id: ProductFeedTab;
  label: string;
  shortLabel: string;
  emoji: string;
  subtitle: string;
}[] = [
  {
    id: 'new',
    label: '🔥 當期新品上市',
    shortLabel: '當期新品',
    emoji: '🔥',
    subtitle: '本週最新上架超商鮮食、話題甜點與季節限定飲品',
  },
  {
    id: 'promo',
    label: '⭐ 星級聯名·特惠',
    shortLabel: '星級聯名',
    emoji: '⭐',
    subtitle: '星級饗宴、主廚聯名便當、義式料理與熱壓吐司特選',
  },
  {
    id: 'health',
    label: '💪 高蛋白·輕食飲控',
    shortLabel: '增肌飲控',
    emoji: '💪',
    subtitle: '舒肥雞胸肉、高蛋白餐盒、輕食生菜沙拉與減醣料理',
  },
];

// 預先快取各分類清單，確保切換 0ms 完成
const dailyCache = new Map<DailyCategoryTab, DailyNecessityItem[]>();
export function getDailyNecessityProducts(category: DailyCategoryTab): DailyNecessityItem[] {
  if (!dailyCache.has(category)) {
    dailyCache.set(
      category,
      dailyData.filter((item) => item.category === category),
    );
  }
  return dailyCache.get(category)!;
}

export function getAllDailyNecessityProducts(): DailyNecessityItem[] {
  return dailyData;
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

const feedCache = new Map<string, RadarProductItem[]>();

export function getNewAndPromoProducts(chain: RadarChain, tab: ProductFeedTab): RadarProductItem[] {
  const cacheKey = `${chain}_${tab}`;
  if (feedCache.has(cacheKey)) return feedCache.get(cacheKey)!;

  if (chain === '7-eleven') {
    const valid = sevenElevenData.filter((x) => x.name && Number(x.price) > 0);
    let filtered: any[] = [];

    if (tab === 'new') {
      filtered = valid.filter((x) => x.new === 'True');
    } else if (tab === 'promo') {
      filtered = valid.filter(
        (x) =>
          x.special_sale === 'True' ||
          x.category === '19_star' ||
          x.category === '17_ohlala' ||
          x.category === '20_panini',
      );
    } else {
      filtered = valid.filter(
        (x) =>
          x.category === '15_health' ||
          x.category === '2_Light' ||
          x.category === '18_veg' ||
          /雞胸|蛋白|沙拉|輕食|健康|豆腐|燕麥|無糖/.test(x.name),
      );
    }

    const res = filtered.slice(0, 60).map((item, idx) => {
      const price = Number(item.price);
      const discPrice = Math.round(price * 0.65);
      const badges: string[] = [];
      if (item.new === 'True') badges.push('新品上市');
      if (item.special_sale === 'True') badges.push('限時特惠');
      if (item.category === '19_star') badges.push('星級聯名');
      if (item.category === '15_health') badges.push('增肌飲控');

      return {
        id: `711_${item.barcode || idx}`,
        chain: '7-eleven' as RadarChain,
        name: item.name,
        category: SEVEN_CAT_LABELS[item.category] || '超商鮮食',
        price,
        discountPrice: discPrice,
        discountLabel: 'i珍食65折',
        imageUrl: item.image || null,
        barcode: item.barcode,
        kcal: item.kcal || null,
        description: item.content || null,
        badges,
      };
    });
    feedCache.set(cacheKey, res);
    return res;
  }

  const validFm = familyMartData.filter((x) => x.title && x.picture_url);
  let filteredFm: any[] = [];

  if (tab === 'new') {
    filteredFm = validFm.filter(
      (x) =>
        x.title.startsWith('星—') ||
        /聯名|新|濃|特選|雙起司|金針菇|千層|舒肥/.test(x.title) ||
        x.category === '蛋糕甜品' ||
        x.category === '現做飲料',
    );
  } else if (tab === 'promo') {
    filteredFm = validFm.filter(
      (x) =>
        x.showMap === true ||
        x.category === '主餐麵食' ||
        x.category === '壽司手卷飯糰' ||
        x.category === '三明治漢堡' ||
        x.category === '燒烤食品',
    );
  } else {
    filteredFm = validFm
      .filter(
        (x) =>
          Number(x.Protein) >= 12 ||
          x.category === '生鮮蔬果沙拉' ||
          /雞胸|沙拉|蛋白|無糖|優格|茶葉蛋|溫泉蛋/.test(x.title),
      )
      .sort((a, b) => (Number(b.Protein) || 0) - (Number(a.Protein) || 0));
  }

  const res = filteredFm.slice(0, 60).map((item, idx) => {
    const cleanTitle = item.title.replace(/^星—|^一配|^二配/, '').trim();
    const price = Number(item.price) || 49;
    const discPrice = Math.round(price * 0.7);
    const badges: string[] = [];
    if (item.title.startsWith('星—')) badges.push('主廚星級聯名');
    if (Number(item.Protein) >= 15) badges.push(`高蛋白 ${item.Protein}g`);
    if (item.showMap) badges.push('友善時光適用');
    if (badges.length === 0) badges.push(item.category || '全家鮮食');

    return {
      id: `fm_${item.cmno || idx}`,
      chain: 'familymart' as RadarChain,
      name: cleanTitle,
      category: item.category || '全家鮮食',
      price,
      discountPrice: discPrice,
      discountLabel: '友善7折',
      imageUrl: item.picture_url || null,
      barcode: item.barcode,
      kcal: item.Calories || null,
      protein: item.Protein || null,
      description: item.Description || item.note || null,
      badges,
    };
  });
  feedCache.set(cacheKey, res);
  return res;
}

function mapSevenStoreTags(rawList: string[]): SpecialServiceTag[] {
  const joined = rawList.join(',');
  const tags: SpecialServiceTag[] = [];
  if (/雪淋霜|霜淇淋|酷聖石/.test(joined)) tags.push({ id: 'icecream', label: '霜淇淋·酷聖石', emoji: '🍦' });
  if (/思樂冰/.test(joined)) tags.push({ id: 'slurpee', label: '思樂冰', emoji: '🥤' });
  if (/熱壓土司|熱壓吐司/.test(joined)) tags.push({ id: 'panini', label: '熱壓吐司', emoji: '🥪' });
  if (/廁所/.test(joined)) tags.push({ id: 'toilet', label: '洗手間廁所', emoji: '🚻' });
  if (/座位區/.test(joined)) tags.push({ id: 'seat', label: '休憩座位區', emoji: '🪑' });
  if (/現萃茶|茶BAR/.test(joined)) tags.push({ id: 'tea', label: '現萃茶·茶BAR', emoji: '🍵' });
  if (/現蒸地瓜|現烤地瓜/.test(joined)) tags.push({ id: 'sweetpotato', label: '現蒸/烤地瓜', emoji: '🍠' });
  if (/哈燒|21TOGO/.test(joined)) tags.push({ id: 'hotfood', label: '哈燒炸烤·21TOGO', emoji: '🍗' });
  if (/Mister Donut|甜甜圈/.test(joined)) tags.push({ id: 'donut', label: 'Mister Donut', emoji: '🍩' });
  if (/精品咖啡|不可思議咖啡/.test(joined)) tags.push({ id: 'coffee', label: '精品/不可思議咖啡', emoji: '☕' });
  if (/行動電源|CHARGESPOT/.test(joined)) tags.push({ id: 'powerbank', label: '借行動電源', emoji: '🔋' });
  return tags;
}

function mapFamilyStoreTags(rawCodes: string[], twoiceFlag?: string | null): SpecialServiceTag[] {
  const set = new Set(rawCodes.map((c) => c.trim()));
  const tags: SpecialServiceTag[] = [];
  if (set.has('Famiice') || set.has('ice') || set.has('icecream') || set.has('twoice') || twoiceFlag === 'Y') {
    tags.push({ id: 'famiice', label: 'Fami!ce霜淇淋', emoji: '🍦' });
  }
  if (set.has('twoice') || twoiceFlag === 'Y') {
    tags.push({ id: 'twoice', label: '雙口味霜淇淋', emoji: '🍨' });
  }
  if (set.has('Toilet')) tags.push({ id: 'toilet', label: '洗手間廁所', emoji: '🚻' });
  if (set.has('Rest')) tags.push({ id: 'seat', label: '休憩座位區', emoji: '🪑' });
  if (set.has('SWEETPOTATO') || set.has('Rpotato')) {
    tags.push({ id: 'sweetpotato', label: '夯番薯·烤馬鈴薯', emoji: '🍠' });
  }
  if (set.has('grill') || set.has('cooknow')) {
    tags.push({ id: 'grill', label: 'SOHOT炎選烤炸物', emoji: '🍢' });
  }
  if (set.has('Tea')) tags.push({ id: 'tea', label: 'Let’s Café私品茶', emoji: '🍵' });
  if (set.has('fresh') || set.has('veg')) tags.push({ id: 'fresh', label: '生鮮好蔬專區', emoji: '🥬' });
  if (set.has('CS')) tags.push({ id: 'powerbank', label: 'ChargeSpot電源', emoji: '🔋' });
  return tags;
}

const specialStoreCache = new Map<string, SpecialStoreItem[]>();

/**
 * 同步立即回傳周邊特殊機台門市（0ms 免等待），依使用者座標所在縣市行政區動態顯示
 */
export function getInstantSpecialServiceStores(
  chain: RadarChain,
  lat: number,
  lng: number,
): SpecialStoreItem[] {
  const { city, town, nearbyDistricts } = resolveTaiwanCityTownSync(lat, lng);
  const cached = specialStoreCache.get(`${chain}__${city}__${town}`);
  if (cached && cached.length > 0) {
    return cached;
  }

  const d0 = nearbyDistricts[0] || { city, town, lat, lng };
  const d1 = nearbyDistricts[1] || d0;

  if (chain === '7-eleven') {
    return [
      {
        id: `711_inst_${d0.town}_1`,
        chain: '7-eleven',
        name: `7-ELEVEN ${d0.town}中心門市`,
        address: `${d0.city}${d0.town}`,
        distance: Math.max(150, haversineMeters(lat, lng, d0.lat, d0.lng)),
        latitude: d0.lat,
        longitude: d0.lng,
        is24H: true,
        serviceTags: [
          { id: 'icecream', label: '霜淇淋·酷聖石', emoji: '🍦' },
          { id: 'slurpee', label: '思樂冰', emoji: '🥤' },
          { id: 'panini', label: '熱壓吐司', emoji: '🥪' },
          { id: 'seat', label: '休憩座位區', emoji: '🪑' },
          { id: 'toilet', label: '洗手間廁所', emoji: '🚻' },
        ],
        rawServices: ['雪淋霜霜淇淋', '思樂冰', '原賞熱壓土司', '座位區', '廁所'],
      },
      {
        id: `711_inst_${d1.town}_2`,
        chain: '7-eleven',
        name: `7-ELEVEN ${d1.town}站前門市`,
        address: `${d1.city}${d1.town}`,
        distance: Math.max(290, haversineMeters(lat, lng, d1.lat, d1.lng)),
        latitude: d1.lat,
        longitude: d1.lng,
        is24H: true,
        serviceTags: [
          { id: 'tea', label: '現萃茶·茶BAR', emoji: '🍵' },
          { id: 'sweetpotato', label: '現蒸/烤地瓜', emoji: '🍠' },
          { id: 'coffee', label: '精品/不可思議咖啡', emoji: '☕' },
          { id: 'donut', label: 'Mister Donut', emoji: '🍩' },
          { id: 'powerbank', label: '借行動電源', emoji: '🔋' },
        ],
        rawServices: ['現萃茶', '現蒸地瓜', '精品咖啡', 'Mister Donut', '行動電源'],
      },
    ];
  }

  return [
    {
      id: `fm_inst_${d0.town}_1`,
      chain: 'familymart',
      name: `全家 ${d0.town}中心店`,
      address: `${d0.city}${d0.town}`,
      distance: Math.max(180, haversineMeters(lat, lng, d0.lat, d0.lng)),
      latitude: d0.lat,
      longitude: d0.lng,
      is24H: true,
      serviceTags: [
        { id: 'famiice', label: 'Fami!ce霜淇淋', emoji: '🍦' },
        { id: 'twoice', label: '雙口味霜淇淋', emoji: '🍨' },
        { id: 'sweetpotato', label: '夯番薯·烤馬鈴薯', emoji: '🍠' },
        { id: 'seat', label: '休憩座位區', emoji: '🪑' },
        { id: 'toilet', label: '洗手間廁所', emoji: '🚻' },
      ],
      rawServices: ['Fami!ce霜淇淋', '雙口味霜淇淋', '夯番薯', '休憩座位區', '洗手間廁所'],
    },
    {
      id: `fm_inst_${d1.town}_2`,
      chain: 'familymart',
      name: `全家 ${d1.town}文化店`,
      address: `${d1.city}${d1.town}`,
      distance: Math.max(320, haversineMeters(lat, lng, d1.lat, d1.lng)),
      latitude: d1.lat,
      longitude: d1.lng,
      is24H: true,
      serviceTags: [
        { id: 'grill', label: 'SOHOT炎選烤炸物', emoji: '🍢' },
        { id: 'tea', label: 'Let’s Café私品茶', emoji: '🍵' },
        { id: 'fresh', label: '生鮮好蔬專區', emoji: '🥬' },
        { id: 'powerbank', label: 'ChargeSpot電源', emoji: '🔋' },
      ],
      rawServices: ['SOHOT炎選烤炸物', 'Let’s Café私品茶', '生鮮好蔬專區', 'ChargeSpot電源'],
    },
  ];
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 3000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSpecialServiceStores(
  chain: RadarChain,
  lat: number,
  lng: number,
): Promise<SpecialStoreItem[]> {
  const { city, town } = resolveTaiwanCityTownSync(lat, lng);

  if (chain === '7-eleven') {
    try {
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
        const getTag = (b: string, t: string) => {
          const m = b.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`, 'i'));
          return m ? m[1].trim() : '';
        };

        const stores: SpecialStoreItem[] = [];
        for (const b of blocks) {
          const poiId = getTag(b, 'POIID');
          const poiName = getTag(b, 'POIName');
          const sLng = Number(getTag(b, 'X')) / 1e6;
          const sLat = Number(getTag(b, 'Y')) / 1e6;
          const addr = getTag(b, 'Address');
          const tel = getTag(b, 'Telno');
          const opTime = getTag(b, 'OP_TIME');
          const rawTitle = getTag(b, 'StoreImageTitle');

          if (!poiName || !sLat || !sLng || isNaN(sLat) || isNaN(sLng)) continue;

          const rawServices = rawTitle
            .split(',')
            .map((s) => s.replace(/^[0-9A-Z]{2}/, '').trim())
            .filter(Boolean);
          const serviceTags = mapSevenStoreTags(rawTitle.split(','));

          stores.push({
            id: `711_${poiId || poiName}`,
            chain: '7-eleven',
            name: poiName.startsWith('7-') ? poiName : `7-ELEVEN ${poiName}門市`,
            address: addr || `${city}${town}`,
            tel: tel || undefined,
            distance: haversineMeters(lat, lng, sLat, sLng),
            latitude: sLat,
            longitude: sLng,
            is24H: opTime.includes('24'),
            serviceTags,
            rawServices,
          });
        }

        if (stores.length > 0) {
          return stores.sort((a, b) => a.distance - b.distance).slice(0, 35);
        }
      }
    } catch {
      // 退回即時門市
    }

    return getInstantSpecialServiceStores('7-eleven', lat, lng);
  }

  try {
    const url = `https://api.map.com.tw/net/familyShop.aspx?searchType=ShopList&type=&city=${encodeURIComponent(city)}&area=${encodeURIComponent(town)}&road=&fun=showStoreList&key=6F30E8BF706D653965BDE302661D1241F8BE9EBC`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Referer: 'https://www.family.com.tw/',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
      },
      2200,
    );

    if (res.ok) {
      const text = await res.text();
      const jsonStr = text.replace(/^showStoreList\(/, '').replace(/\);?\s*$/, '');
      const arr: any[] = JSON.parse(jsonStr);
      const stores: SpecialStoreItem[] = [];

      for (const s of arr) {
        const sLat = Number(s.py);
        const sLng = Number(s.px);
        if (!s.NAME || !sLat || !sLng || isNaN(sLat) || isNaN(sLng)) continue;

        const rawCodes = String(s.all || '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        const serviceTags = mapFamilyStoreTags(rawCodes, s.twoice);

        stores.push({
          id: `fm_${s.pkey || s.SERID || s.NAME}`,
          chain: 'familymart',
          name: s.NAME,
          address: s.addr || `${city}${town}`,
          tel: s.TEL || undefined,
          distance: haversineMeters(lat, lng, sLat, sLng),
          latitude: sLat,
          longitude: sLng,
          is24H: true,
          serviceTags,
          rawServices: serviceTags.map((t) => t.label),
        });
      }

      if (stores.length > 0) {
        return stores.sort((a, b) => a.distance - b.distance).slice(0, 35);
      }
    }
  } catch {
    // 退回即時門市
  }

  return getInstantSpecialServiceStores('familymart', lat, lng);
}
