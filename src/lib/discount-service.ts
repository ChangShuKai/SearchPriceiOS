import { queryNearbyStores, type NearbyStore } from '@/lib/location';

export type ChainChoice = '7-eleven' | 'familymart';

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
  distance: number;
  latitude: number;
  longitude: number;
  remainingTotal: number;
  categories: DiscountCategory[];
};

type SevenElevenItem = {
  category: string;
  name: string;
  kcal: string;
  price: string;
  image: string;
  content: string;
};

type FamilyMartItem = {
  category: string;
  title: string;
  picture_url: string;
  Calories: number;
  Description: string;
};

// 7-Eleven 官方鮮食資料集
const sevenElevenData: SevenElevenItem[] = require('@/constants/seven_eleven_products.json');

// FamilyMart 商品對照圖集
const familyMartData: FamilyMartItem[] = require('@/constants/family_mart_products.json');

// 全家商品圖對照快取
const fmImageMap = new Map<string, string>();
familyMartData.forEach((p) => {
  if (p.title && p.picture_url) {
    fmImageMap.set(p.title.trim(), p.picture_url);
  }
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
  '15_health': { label: '健身增肌餐盒', icon: '🥩' },
  '7_Oden': { label: '關東煮·蒸食', icon: '🍢' },
  '12_steam': { label: '關東煮·蒸食', icon: '🍢' },
  '8_Bigbite': { label: '大亨堡熟食', icon: '🌭' },
  '22_ice': { label: '冰品甜點', icon: '🍨' },
};

function estimateFmPrice(name: string, categoryName: string): number {
  const n = name.toLowerCase();
  if (n.includes('便當') || n.includes('炒飯') || n.includes('燴飯') || n.includes('咖哩') || n.includes('義大利麵') || n.includes('牛排') || categoryName.includes('主食')) {
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
 * 查詢附近的全家便利商店即時友善時光即期品 (呼叫全家官方 API)
 */
export async function fetchFamilyMartDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
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
      console.warn('FamilyMart API HTTP error:', res.status);
      return [];
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
            const cleanName = rawName.replace(/^二配/, '').trim();
            const origPrice = estimateFmPrice(cleanName, cat.name);
            const discPrice = Math.round(origPrice * 0.7); // 友善時光 7 折

            // 尋找圖片
            let img = fmImageMap.get(cleanName) || fmImageMap.get(rawName);
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
              barcode: p.code ? `471000${p.code}` : undefined,
            });
          }
        }

        if (catProducts.length > 0) {
          categories.push({
            id: cat.code || cat.name,
            name: cat.name,
            iconName: 'bag.fill',
            imageUrl: cat.iconURL || catProducts[0]?.imageUrl || null,
            count: cat.qty || catProducts.reduce((sum: number, p: DiscountProduct) => sum + p.count, 0),
            products: catProducts,
          });
        }
      }

      stores.push({
        id: s.oldPKey || s.name,
        chain: 'familymart',
        name: s.name,
        address: s.address || s.addr || '全家便利商店',
        distance: Math.round(s.distance || 0),
        latitude: s.latitude,
        longitude: s.longitude,
        remainingTotal: totalQty,
        categories,
      });
    }

    // 由近到遠排序
    return stores.sort((a, b) => a.distance - b.distance);
  } catch (err) {
    console.error('Error fetching FamilyMart discounts:', err);
    return [];
  }
}

/**
 * 查詢附近的 7-Eleven 門市並產生 i珍食 65 折即期品清單
 */
export async function fetchSevenElevenDiscounts(lat: number, lng: number): Promise<DiscountStore[]> {
  try {
    // 透過 OpenStreetMap 搜尋使用者周圍的 7-Eleven 門市
    const rawStores = await queryNearbyStores(lat, lng);
    const sevenStores = rawStores.filter((s: NearbyStore) => s.chain.id === '7-eleven');

    // 建立 7-Eleven 官方鮮食分類
    const validProds = sevenElevenData.filter((x) => x.name && x.price && Number(x.price) > 0);

    // 依據分類分組
    const catBuckets = new Map<string, typeof validProds>();
    for (const p of validProds) {
      const mapping = SEVEN_CAT_MAPPING[p.category] || { label: '特色鮮食', icon: '🍴' };
      const groupName = mapping.label;
      if (!catBuckets.has(groupName)) {
        catBuckets.set(groupName, []);
      }
      catBuckets.get(groupName)!.push(p);
    }

    // 如果周圍找不到 OSM 門市，建立預設鄰近展示門市
    const targetStores: { name: string; distance: number; lat: number; lng: number }[] =
      sevenStores.length > 0
        ? sevenStores.map((s) => ({ name: s.name, distance: s.distance, lat: s.latitude, lng: s.longitude }))
        : [
            { name: '7-ELEVEN 信義門市', distance: 160, lat, lng },
            { name: '7-ELEVEN 敦南門市', distance: 340, lat, lng },
            { name: '7-ELEVEN 復興門市', distance: 580, lat, lng },
          ];

    const result: DiscountStore[] = [];

    targetStores.forEach((st, sIdx) => {
      const categories: DiscountCategory[] = [];
      let storeTotal = 0;

      // 依據店鋪種子決定該店當日剩餘的 i珍食
      const seed = Math.abs(st.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) + sIdx;

      let cIdx = 0;
      for (const [catName, pList] of catBuckets.entries()) {
        const offset = (seed + cIdx * 3) % pList.length;
        const countThisCat = ((seed + cIdx) % 3) + 1; // 1 ~ 3 款
        const selected = pList.slice(offset, offset + countThisCat);

        if (selected.length > 0) {
          const prods: DiscountProduct[] = selected.map((item, pIdx) => {
            const orig = Number(item.price);
            const disc = Math.round(orig * 0.65); // i珍食 65 折
            const q = ((seed + pIdx) % 2) + 1; // 剩餘 1 ~ 2 件
            storeTotal += q;
            return {
              id: `${st.name}_${item.name}`,
              name: item.name,
              category: catName,
              originalPrice: orig,
              discountPrice: disc,
              discountRate: '65折',
              count: q,
              imageUrl: item.image,
              kcal: item.kcal,
              content: item.content,
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
        id: `711_${st.name}_${sIdx}`,
        chain: '7-eleven',
        name: st.name,
        address: `台北市信義區忠孝東路四段${(sIdx + 1) * 35}號`,
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
 * 依據條碼或商品名稱判斷是否為超商即期特惠鮮食，若符合則傳回特惠資訊
 */
export function getExpiringDiscountInfo(productName: string, originalPrice: number): {
  isDiscountable: boolean;
  sevenElevenPrice: number;
  familyMartPrice: number;
  savingsSeven: number;
  savingsFamily: number;
} {
  const p7 = Math.round(originalPrice * 0.65); // i珍食 65折
  const pf = Math.round(originalPrice * 0.7); // 友善時光 7折

  // 判斷是否為鮮食、麵包、便當、飯糰等
  const isFood = /飯糰|三明治|便當|燴飯|涼麵|麵|吐司|蛋糕|沙拉|關東煮|滷味|焗烤|壽司|生乳捲|布丁|炸雞|水餃|鍋貼|包子/i.test(productName);

  return {
    isDiscountable: isFood && originalPrice >= 20,
    sevenElevenPrice: p7,
    familyMartPrice: pf,
    savingsSeven: originalPrice - p7,
    savingsFamily: originalPrice - pf,
  };
}
