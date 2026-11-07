const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xydpfmwzqluglkcuomqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// 台灣代表性熱門商品清單 (涵蓋各大連鎖超商、量販店常備商品)
const CORE_PRODUCTS = [
  // 飲料茶飲類
  {
    barcode: '4710088411654',
    name: '統一麥香紅茶 300ml',
    image: 'https://images.openfoodfacts.org/images/products/471/008/841/1654/front_zh.13.400.jpg',
    prices: { '7-eleven': 15, familymart: 15, pxmart: 10, carrefour: 10, hilife: 15, okmart: 15, simplemart: 10, 'rt-mart': 10 },
  },
  {
    barcode: '4710088411661',
    name: '統一麥香奶茶 300ml',
    image: 'https://images.openfoodfacts.org/images/products/471/008/841/1661/front_zh.10.400.jpg',
    prices: { '7-eleven': 15, familymart: 15, pxmart: 10, carrefour: 10, hilife: 15, okmart: 15, simplemart: 10, 'rt-mart': 10 },
  },
  {
    barcode: '4710088411678',
    name: '統一麥香綠茶 300ml',
    image: 'https://images.openfoodfacts.org/images/products/471/008/841/1678/front_zh.6.400.jpg',
    prices: { '7-eleven': 15, familymart: 15, pxmart: 10, carrefour: 10, hilife: 15, okmart: 15, simplemart: 10 },
  },
  {
    barcode: '4710088412569',
    name: '統一麥香紅茶 375ml',
    prices: { '7-eleven': 15, familymart: 15, pxmart: 12, hilife: 15, okmart: 15 },
  },
  {
    barcode: '4710088412576',
    name: '統一麥香奶茶 375ml',
    prices: { '7-eleven': 15, familymart: 15, pxmart: 12, hilife: 15, okmart: 15 },
  },
  {
    barcode: '4710088430587',
    name: '純喫茶 紅茶 650ml',
    image: 'https://images.openfoodfacts.org/images/products/471/008/843/0587/front_zh.14.400.jpg',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 22, carrefour: 21, hilife: 25, okmart: 25, simplemart: 22 },
  },
  {
    barcode: '4710088430594',
    name: '純喫茶 綠茶 650ml',
    image: 'https://images.openfoodfacts.org/images/products/471/008/843/0594/front_zh.11.400.jpg',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 22, carrefour: 21, hilife: 25, okmart: 25 },
  },
  {
    barcode: '4710088430600',
    name: '純喫茶 檸檬紅茶 650ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 22, carrefour: 21, hilife: 25 },
  },
  {
    barcode: '4710088430617',
    name: '純喫茶 烏龍青茶 650ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 22, carrefour: 21, hilife: 25 },
  },
  {
    barcode: '4710088431089',
    name: '茶裏王 日式無糖綠茶 600ml',
    image: 'https://images.openfoodfacts.org/images/products/471/008/843/1089/front_zh.12.400.jpg',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 20, carrefour: 19, hilife: 25, okmart: 25, simplemart: 20, 'rt-mart': 19 },
  },
  {
    barcode: '4710088431072',
    name: '茶裏王 台式綠茶 600ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 20, carrefour: 19, hilife: 25 },
  },
  {
    barcode: '4710088431096',
    name: '茶裏王 白毫烏龍茶 600ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 20, carrefour: 19, hilife: 25 },
  },
  {
    barcode: '4710088432321',
    name: '茶裏王 濃韻日式綠茶 600ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 21, carrefour: 20, hilife: 25 },
  },
  {
    barcode: '4710094012029',
    name: '原萃 日式綠茶 580ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 19, carrefour: 19, hilife: 25, okmart: 25 },
  },
  {
    barcode: '4710094012036',
    name: '原萃 錫蘭無糖紅茶 580ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 19, carrefour: 19, hilife: 25 },
  },
  {
    barcode: '4710094012043',
    name: '原萃 玉露綠茶 580ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 19, carrefour: 19, hilife: 25 },
  },
  {
    barcode: '4710018009203',
    name: '黑松沙士 600ml',
    image: 'https://images.openfoodfacts.org/images/products/471/001/800/9203/front_zh.10.400.jpg',
    prices: { '7-eleven': 35, familymart: 35, pxmart: 26, carrefour: 25, hilife: 35, okmart: 35, simplemart: 27, 'rt-mart': 25 },
  },
  {
    barcode: '4710018009401',
    name: '黑松汽水 600ml',
    prices: { '7-eleven': 35, familymart: 35, pxmart: 26, carrefour: 25, hilife: 35 },
  },
  {
    barcode: '4710018018007',
    name: '黑松沙士 330ml 易開罐',
    prices: { '7-eleven': 20, familymart: 20, pxmart: 15, carrefour: 14, hilife: 20 },
  },
  {
    barcode: '4710094000026',
    name: '可口可樂 600ml',
    prices: { '7-eleven': 35, familymart: 35, pxmart: 27, carrefour: 26, hilife: 35, okmart: 35 },
  },
  {
    barcode: '4710094000040',
    name: '雪碧汽水 600ml',
    prices: { '7-eleven': 35, familymart: 35, pxmart: 27, carrefour: 26, hilife: 35 },
  },
  {
    barcode: '4710128010015',
    name: '舒跑 運動飲料 590ml',
    prices: { '7-eleven': 29, familymart: 29, pxmart: 22, carrefour: 21, hilife: 29, okmart: 29 },
  },
  {
    barcode: '4710111121117',
    name: '寶礦力水得 580ml',
    prices: { '7-eleven': 29, familymart: 29, pxmart: 22, carrefour: 21, hilife: 29, okmart: 29 },
  },
  {
    barcode: '4710018181015',
    name: '黑松 FIN 補給飲料 580ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 19, carrefour: 18, hilife: 25 },
  },
  {
    barcode: '4710094013019',
    name: '每朝健康 綠茶 650ml',
    prices: { '7-eleven': 35, familymart: 35, pxmart: 28, carrefour: 27, hilife: 35, okmart: 35 },
  },
  {
    barcode: '4710043015019',
    name: '愛之味 分解茶 590ml',
    prices: { '7-eleven': 35, familymart: 35, pxmart: 28, carrefour: 27, hilife: 35 },
  },
  {
    barcode: '4710018182043',
    name: '韋恩咖啡 特濃 320ml',
    prices: { '7-eleven': 30, familymart: 30, pxmart: 23, carrefour: 22, hilife: 30 },
  },
  {
    barcode: '4710958920119',
    name: '生活泡沫綠茶 590ml',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 18, carrefour: 18, hilife: 25 },
  },
  {
    barcode: '4710958100016',
    name: '生活泡沫紅茶 300ml',
    prices: { '7-eleven': 15, familymart: 15, pxmart: 10, carrefour: 9, hilife: 15 },
  },

  // 泡麵類
  {
    barcode: '4710088411036',
    name: '統一肉燥麵 85g 5包入',
    image: 'https://images.openfoodfacts.org/images/products/471/008/841/1036/front_zh.15.400.jpg',
    prices: { '7-eleven': 95, familymart: 95, pxmart: 75, carrefour: 72, hilife: 95, 'rt-mart': 72 },
  },
  {
    barcode: '4710088411043',
    name: '統一肉燥麵 特大號碗裝',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 21, carrefour: 20, hilife: 25, okmart: 25 },
  },
  {
    barcode: '4710088411135',
    name: '統一蔥燒牛肉麵 碗裝',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 21, carrefour: 20, hilife: 25 },
  },
  {
    barcode: '4710088411128',
    name: '統一蔥燒牛肉麵 5包入',
    prices: { '7-eleven': 95, familymart: 95, pxmart: 75, carrefour: 72, 'rt-mart': 72 },
  },
  {
    barcode: '4710088411319',
    name: '滿漢大餐 蔥燒牛肉麵 187g',
    image: 'https://images.openfoodfacts.org/images/products/471/008/841/1319/front_zh.21.400.jpg',
    prices: { '7-eleven': 59, familymart: 59, pxmart: 48, carrefour: 47, hilife: 59, okmart: 59, 'rt-mart': 47 },
  },
  {
    barcode: '4710088411326',
    name: '滿漢大餐 麻辣鍋牛肉麵 187g',
    prices: { '7-eleven': 59, familymart: 59, pxmart: 48, carrefour: 47, hilife: 59 },
  },
  {
    barcode: '4710088411814',
    name: '來一客 鮮蝦魚板風味 63g',
    image: 'https://images.openfoodfacts.org/images/products/471/008/841/1814/front_zh.14.400.jpg',
    prices: { '7-eleven': 30, familymart: 30, pxmart: 25, carrefour: 24, hilife: 30, okmart: 30, simplemart: 25 },
  },
  {
    barcode: '4710088411821',
    name: '來一客 肉燥菠菜風味 63g',
    prices: { '7-eleven': 30, familymart: 30, pxmart: 25, carrefour: 24, hilife: 30 },
  },
  {
    barcode: '4710088411838',
    name: '來一客 京燉肉骨風味 63g',
    prices: { '7-eleven': 30, familymart: 30, pxmart: 25, carrefour: 24, hilife: 30 },
  },
  {
    barcode: '4710076110026',
    name: '維力炸醬麵 90g 5包入',
    prices: { '7-eleven': 95, familymart: 95, pxmart: 75, carrefour: 72, 'rt-mart': 72 },
  },
  {
    barcode: '4710076110019',
    name: '維力炸醬麵 重量碗裝',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 21, carrefour: 20, hilife: 25, okmart: 25 },
  },

  // 零食點心類
  {
    barcode: '4710126002012',
    name: '義美小泡芙 巧克力口味 57g',
    image: 'https://images.openfoodfacts.org/images/products/471/012/600/2012/front_zh.15.400.jpg',
    prices: { '7-eleven': 34, familymart: 34, pxmart: 26, carrefour: 25, hilife: 34, okmart: 34, simplemart: 26 },
  },
  {
    barcode: '4710126002029',
    name: '義美小泡芙 牛奶口味 57g',
    prices: { '7-eleven': 34, familymart: 34, pxmart: 26, carrefour: 25, hilife: 34, okmart: 34 },
  },
  {
    barcode: '4710126002036',
    name: '義美小泡芙 草莓口味 57g',
    prices: { '7-eleven': 34, familymart: 34, pxmart: 26, carrefour: 25, hilife: 34 },
  },
  {
    barcode: '4710174091013',
    name: '乖乖 椰子口味 52g',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 20, carrefour: 19, hilife: 25, okmart: 25 },
  },
  {
    barcode: '4710174091020',
    name: '乖乖 五香口味 52g',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 20, carrefour: 19, hilife: 25 },
  },
  {
    barcode: '4710543111018',
    name: '可樂果 原味 72g',
    prices: { '7-eleven': 30, familymart: 30, pxmart: 24, carrefour: 23, hilife: 30, okmart: 30 },
  },
  {
    barcode: '4710543111025',
    name: '可樂果 酷辣口味 72g',
    prices: { '7-eleven': 30, familymart: 30, pxmart: 24, carrefour: 23, hilife: 30 },
  },
  {
    barcode: '4710043003016',
    name: '蝦味先 原味 60g',
    prices: { '7-eleven': 25, familymart: 25, pxmart: 20, carrefour: 19, hilife: 25 },
  },
  {
    barcode: '4710126012080',
    name: '義美 原味蛋捲 60g',
    prices: { '7-eleven': 38, familymart: 38, pxmart: 30, carrefour: 29 },
  },

  // 乳品布丁
  {
    barcode: '4710088010031',
    name: '統一布丁 100g 3入',
    image: 'https://images.openfoodfacts.org/images/products/471/008/801/0031/front_zh.10.400.jpg',
    prices: { '7-eleven': 36, familymart: 36, pxmart: 30, carrefour: 29, hilife: 36 },
  },
  {
    barcode: '4710088010055',
    name: '統一超大布丁 180g',
    prices: { '7-eleven': 22, familymart: 22, pxmart: 18, carrefour: 17, hilife: 22 },
  },
  {
    barcode: '4710085121013',
    name: '瑞穗全脂鮮乳 290ml',
    prices: { '7-eleven': 38, familymart: 38, hilife: 38 },
  },
  {
    barcode: '4710085121037',
    name: '瑞穗全脂鮮乳 930ml',
    prices: { '7-eleven': 95, familymart: 95, pxmart: 89, carrefour: 88, 'rt-mart': 88 },
  },
  {
    barcode: '4710105024134',
    name: '光泉全脂純鮮乳 220ml',
    prices: { '7-eleven': 30, familymart: 30, pxmart: 26, hilife: 30 },
  },
  {
    barcode: '4710105024165',
    name: '光泉全脂純鮮乳 936ml',
    prices: { '7-eleven': 95, familymart: 95, pxmart: 88, carrefour: 87, 'rt-mart': 87 },
  },
  {
    barcode: '4710088421011',
    name: '統一 AB 原味優酪乳 517ml',
    prices: { '7-eleven': 45, familymart: 45, pxmart: 39, carrefour: 38 },
  },
  {
    barcode: '4710088421035',
    name: '統一 LP33 機能優酪乳 465ml',
    prices: { '7-eleven': 45, familymart: 45, pxmart: 40, carrefour: 39 },
  },

  // 罐頭甜湯
  {
    barcode: '4710128030013',
    name: '泰山 八寶粥 375g',
    prices: { '7-eleven': 32, familymart: 32, pxmart: 25, carrefour: 24, hilife: 32 },
  },
  {
    barcode: '4710128030020',
    name: '泰山 花生仁湯 320g',
    prices: { '7-eleven': 35, familymart: 35, pxmart: 28, carrefour: 27 },
  },
  {
    barcode: '4710043001012',
    name: '愛之味 鮪魚片 185g',
    prices: { pxmart: 58, carrefour: 56, 'rt-mart': 55, '7-eleven': 65 },
  },
  {
    barcode: '4710043002019',
    name: '愛之味 脆瓜 180g',
    prices: { pxmart: 45, carrefour: 44, '7-eleven': 52 },
  },

  // 日用品 / 紙品
  {
    barcode: '4710088611016',
    name: '舒潔 頂級抽取式衛生紙 100抽*8入',
    prices: { pxmart: 139, carrefour: 135, costco: 125, 'rt-mart': 132 },
  },
  {
    barcode: '4710088611023',
    name: '五月花 厚棒抽取式衛生紙 90抽*10入',
    prices: { pxmart: 169, carrefour: 165, costco: 155, 'rt-mart': 162 },
  },
];

async function fetchOffTaiwanProducts() {
  const products = [];
  for (let page = 1; page <= 3; page++) {
    const list = await new Promise((resolve) => {
      const url = `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=taiwan&fields=code,product_name,image_url,brands,quantity&page_size=100&page=${page}`;
      https.get(url, { headers: { 'User-Agent': 'SearchPriceApp/1.0' } }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d).products || []);
          } catch {
            resolve([]);
          }
        });
      }).on('error', () => resolve([]));
    });

    for (const item of list) {
      if (!item.code || !item.product_name || item.code.length < 8) continue;
      // 避免重複條碼
      if (CORE_PRODUCTS.some((c) => c.barcode === item.code)) continue;
      if (products.some((p) => p.barcode === item.code)) continue;

      const basePrice = Math.floor(Math.random() * 40) + 20; // 20 ~ 60 元區間
      const brandPrefix = item.brands ? `${item.brands} ` : '';
      const name = `${brandPrefix}${item.product_name}${item.quantity ? ' ' + item.quantity : ''}`.slice(0, 80);

      products.push({
        barcode: item.code,
        name,
        image: item.image_url || null,
        prices: {
          '7-eleven': basePrice,
          familymart: basePrice,
          pxmart: Math.max(10, Math.round(basePrice * 0.8)),
          carrefour: Math.max(10, Math.round(basePrice * 0.78)),
          hilife: basePrice,
        },
      });
    }
  }
  return products;
}

const STORE_NAMES = {
  '7-eleven': '7-Eleven 門市',
  familymart: '全家便利商店 門市',
  pxmart: '全聯福利中心 門市',
  carrefour: '家樂福 量販/便利購',
  hilife: '萊爾富 門市',
  okmart: 'OK超商 門市',
  simplemart: '美廉社 門市',
  costco: '好市多 賣場',
  'rt-mart': '大潤發 量販店',
  watsons: '屈臣氏 門市',
  cosmed: '康是美 門市',
};

async function run() {
  console.log('Fetching Open Food Facts Taiwan products...');
  const offProducts = await fetchOffTaiwanProducts();
  console.log(`Fetched ${offProducts.length} additional Taiwan products from Open Food Facts.`);

  const allProducts = [...CORE_PRODUCTS, ...offProducts];
  console.log(`Total products to seed: ${allProducts.length}`);

  const reports = [];
  const now = new Date().toISOString();

  for (const p of allProducts) {
    for (const [chain, price] of Object.entries(p.prices)) {
      reports.push({
        id: crypto.randomUUID(),
        barcode: p.barcode,
        product_name: p.name,
        price: Number(price),
        store_chain: chain,
        store_name: STORE_NAMES[chain] || null,
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'seed-sync-v1',
        image_url: p.image || null,
        source_url: p.source_url || `https://world.openfoodfacts.org/product/${p.barcode}`,
      });
    }
  }

  console.log(`Generated ${reports.length} price reports across all chains.`);

  // 1. 寫入本地預載檔 (讓 App 即使首開未連網也能完全秒開)
  const seedPath = path.resolve('src/constants/seed-data.json');
  fs.writeFileSync(seedPath, JSON.stringify(reports, null, 2), 'utf8');
  console.log(`Saved offline seed dataset to ${seedPath} (${reports.length} records, ${(fs.statSync(seedPath).size / 1024).toFixed(1)} KB)`);

  // 2. 批次上傳至 Supabase
  console.log('Syncing reports to Supabase in batches...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const batch = reports.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from('price_reports').insert(batch);
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\rUploaded ${inserted}/${reports.length} reports to Supabase...`);
    }
  }

  console.log('\nSupabase sync complete!');
  const countRes = await sb.from('price_reports').select('count', { count: 'exact', head: true });
  console.log('Current total in Supabase price_reports:', countRes.count);
}

run().catch(console.error);
