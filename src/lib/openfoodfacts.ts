export type OffProduct = {
  barcode: string;
  name: string | null;
  brand: string | null;
  quantity: string | null;
  imageUrl: string | null;
  categories: string | null;
  nutriscore: string | null;
  countries: string | null;
  url: string;
  source: 'Open Food Facts' | 'Open Products Facts' | 'Open Beauty Facts';
};

const FIELDS = [
  'product_name',
  'product_name_zh',
  'product_name_zh-TW',
  'generic_name',
  'brands',
  'quantity',
  'image_front_url',
  'image_url',
  'categories',
  'nutriscore_grade',
  'countries',
].join(',');

const SERVERS = [
  { name: 'Open Food Facts', base: 'https://world.openfoodfacts.org' },
  { name: 'Open Products Facts', base: 'https://world.openproductsfacts.org' },
  { name: 'Open Beauty Facts', base: 'https://world.openbeautyfacts.org' },
] as const;

/**
 * 依序聯合查詢 Open Food Facts、Open Products Facts（日用品）及 Open Beauty Facts（美妝藥妝）
 */
export async function fetchOpenFoodFacts(barcode: string, signal?: AbortSignal): Promise<OffProduct | null> {
  for (const s of SERVERS) {
    try {
      const res = await fetch(
        `${s.base}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
        {
          signal,
          headers: { 'User-Agent': 'SearchPrice/1.0 (Expo React Native)', Accept: 'application/json' },
        },
      );
      if (res.status === 404) continue;
      if (!res.ok) continue;

      const json = (await res.json()) as { status: number; product?: Record<string, string | undefined> };
      if (json.status !== 1 || !json.product) continue;

      const p = json.product;
      const pick = (...vals: (string | undefined)[]) => vals.find((v) => v && v.trim())?.trim() ?? null;
      const foundName = pick(p['product_name_zh-TW'], p.product_name_zh, p.product_name, p.generic_name);

      if (foundName) {
        return {
          barcode,
          name: foundName,
          brand: pick(p.brands),
          quantity: pick(p.quantity),
          imageUrl: pick(p.image_front_url, p.image_url),
          categories: pick(p.categories),
          nutriscore: pick(p.nutriscore_grade),
          countries: pick(p.countries),
          url: `${s.base}/product/${barcode}`,
          source: s.name,
        };
      }
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }

  return null;
}

/**
 * 當使用者回報價格時，若該條碼尚未存在於 Open Food Facts，自動將使用者填寫的品名非同步回饋到全球開放資料庫
 */
export async function contributeToOpenFoodFacts(barcode: string, productName: string): Promise<void> {
  try {
    const formData = new URLSearchParams();
    formData.append('code', barcode);
    formData.append('product_name', productName);
    formData.append('countries', 'Taiwan');
    formData.append('lang', 'zh-TW');

    await fetch('https://world.openfoodfacts.org/cgi/product_jqm2.pl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SearchPrice/1.0 (Crowdsourced Taiwan Contributor)',
      },
      body: formData.toString(),
    });
  } catch {
    // 貢獻為最佳努力 (best effort)，不影響主要業務流程
  }
}
