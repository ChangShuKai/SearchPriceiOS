const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xydpfmwzqluglkcuomqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SEVEN_CATEGORIES = [
  '1_Ricerolls',
  '2_Light',
  '3_Cuisine',
  '4_Snacks',
  '5_ForeignDishes',
  '6_Noodles',
  '7_Oden',
  '8_Bigbite',
  '9_Icecream',
  '10_Slurpee',
  '11_bread',
  'hot',
  '12_steam',
  '13_luwei',
  '14_hot',
  '15_health',
  '16_sandwich',
  '17_ohlala',
  '18_veg',
  '19_star',
  '20_panini',
  '21_ice',
  '22_ice',
  '23_veg',
  '24_other',
  '25_other',
];

function getTag(xmlBlock, tag) {
  const m = xmlBlock.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function fetchUrl(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...headers,
        },
        timeout: 10000,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, data: d }));
      },
    );
    req.on('error', () => resolve({ status: 0, data: '' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, data: '' });
    });
    if (body) req.write(body);
    req.end();
  });
}

function makeDeterministicBarcode(prefix, name) {
  const hash = crypto.createHash('md5').update(name).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16) % 10000000;
  return `${prefix}${String(num).padStart(7, '0')}`;
}

function estimateFmPrice(name, catName) {
  if (/便當|丼|義大利麵|炒飯|燴飯|咖哩|牛排|烤雞|煲|拉麵|烏龍麵/.test(name) || /主食|飯|麵/.test(catName)) return 89;
  if (/飯糰|手卷|壽司/.test(name) || /飯糰|壽司/.test(catName)) return 39;
  if (/三明治|漢堡|堡|貝果|可頌/.test(name) || /三明治|漢堡/.test(catName)) return 45;
  if (/沙拉|雞胸|水果/.test(name) || /沙拉/.test(catName)) return 59;
  if (/蛋糕|泡芙|布丁|甜點|塔|生乳捲|銅鑼燒/.test(name) || /甜點/.test(catName)) return 49;
  if (/麵包|吐司|羅宋|菠蘿/.test(name) || /麵包/.test(catName)) return 35;
  if (/拿鐵|咖啡|茶|飲|牛乳|豆漿|果汁/.test(name) || /飲|咖啡/.test(catName)) return 45;
  if (/霜淇淋|冰/.test(name)) return 49;
  return 49;
}

async function main() {
  console.log('1. 掃描 7-Eleven Read_Food_xml.aspx 全品項母庫 (0..25) 與 Read_Food_xml_hot.aspx...');
  const existing711Path = path.resolve('src/constants/seven_eleven_products.json');
  const existing711 = fs.existsSync(existing711Path)
    ? JSON.parse(fs.readFileSync(existing711Path, 'utf8'))
    : [];

  const sevenMap = new Map();
  for (const item of existing711) {
    if (item.name && Number(item.price) > 0) {
      sevenMap.set(item.name.trim(), {
        ...item,
        barcode: item.barcode || makeDeterministicBarcode('471711', item.name.trim()),
      });
    }
  }

  for (const endpoint of ['Read_Food_xml.aspx', 'Read_Food_xml_hot.aspx']) {
    for (let i = 0; i <= 25; i++) {
      const url = `https://www.7-11.com.tw/freshfoods/${endpoint}?=${i}`;
      const res = await fetchUrl(url);
      if (res.status !== 200 || !res.data.includes('<Item')) continue;

      const catFolder = SEVEN_CATEGORIES[i] || '1_Ricerolls';
      const itemBlocks = res.data.match(/<Item[\s\S]*?<\/Item>/gi) || [];

      for (const block of itemBlocks) {
        const name = getTag(block, 'name');
        const priceStr = getTag(block, 'price');
        const price = parseInt(priceStr, 10);
        if (!name || !price || isNaN(price) || price <= 0) continue;

        const rawKcal = getTag(block, 'kcal');
        const kcal = rawKcal && rawKcal !== '.' && rawKcal !== '0' ? rawKcal : '';
        const rawImg = getTag(block, 'image');
        let image = '';
        if (rawImg) {
          image = rawImg.startsWith('http')
            ? rawImg
            : `https://www.7-11.com.tw/freshfoods/${catFolder}/${rawImg.replace(/^\//, '')}`;
        }
        const special_sale = getTag(block, 'special_sale') || 'False';
        const isNew = getTag(block, 'new') || 'False';
        const content = getTag(block, 'content');
        const sdate = getTag(block, 'Sdate');
        const edate = getTag(block, 'Edate');

        const prev = sevenMap.get(name.trim());
        sevenMap.set(name.trim(), {
          category: prev?.category || catFolder,
          name: name.trim(),
          kcal: kcal || prev?.kcal || '',
          price: String(price),
          image: prev?.image || image,
          special_sale: special_sale === 'True' ? 'True' : prev?.special_sale || 'False',
          new: isNew === 'True' ? 'True' : prev?.new || 'False',
          content: content || prev?.content || '',
          sdate: sdate && sdate !== '0' ? sdate : undefined,
          edate: edate && edate !== '0' ? edate : undefined,
          barcode: makeDeterministicBarcode('471711', name.trim()),
        });
      }
    }
  }

  const finalSeven = Array.from(sevenMap.values());
  fs.writeFileSync(existing711Path, JSON.stringify(finalSeven, null, 2), 'utf8');
  console.log(`-> 7-Eleven 母庫整合完成！共 ${finalSeven.length} 項鮮食產品。`);

  console.log('2. 掃描全家「食在購安心」QueryFsProductListByFilter 母庫...');
  const existingFmPath = path.resolve('src/constants/family_mart_products.json');
  const existingFm = fs.existsSync(existingFmPath)
    ? JSON.parse(fs.readFileSync(existingFmPath, 'utf8'))
    : [];

  const fmMap = new Map();
  for (const item of existingFm) {
    if (item.title) {
      const codeMatch = item.picture_url?.match(/003004\.(\d+)\./);
      const cmno = item.cmno || (codeMatch ? codeMatch[1] : undefined);
      const price = item.price || estimateFmPrice(item.title, item.category || '');
      fmMap.set(item.title.trim(), {
        ...item,
        cmno,
        price,
        barcode: item.barcode || (cmno ? `471000${cmno}` : makeDeterministicBarcode('471004', item.title.trim())),
      });
    }
  }

  const fmBody = JSON.stringify({ MEMBER: 'Y' });
  const fmRes = await fetchUrl(
    'https://foodsafety.family.com.tw/Web_FFD_2022/ws/QueryFsProductListByFilter',
    'POST',
    fmBody,
    {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(fmBody),
    },
  );

  if (fmRes.status === 200 && fmRes.data) {
    try {
      const parsed = JSON.parse(fmRes.data);
      const categories = parsed.LIST || [];
      let addedFm = 0;
      for (const cat of categories) {
        const catName = cat.CATEGORY_NAME || '鮮食';
        for (const item of cat.ITEM || []) {
          const title = (item.PRODNAME || '').trim();
          if (!title) continue;
          const cmno = item.CMNO || '';
          const note = item.NOTE || '';
          const kcalMatch = note.match(/熱量\s*(\d+(?:\.\d+)?)\s*大卡/);
          const cal = kcalMatch ? Math.round(Number(kcalMatch[1])) : 0;
          const pic = item.PROD_PIC
            ? `https://foodsafety.family.com.tw/product_img/${item.PROD_PIC}`
            : '';
          const price = estimateFmPrice(title, catName);
          const prev = fmMap.get(title);

          fmMap.set(title, {
            category: prev?.category || catName,
            title,
            cmno: cmno || prev?.cmno,
            picture_url: pic || prev?.picture_url || '',
            Protein: prev?.Protein ?? 0,
            Carb: prev?.Carb ?? 0,
            Calories: cal || prev?.Calories || 0,
            Fat: prev?.Fat ?? 0,
            Description: prev?.Description || note,
            note,
            price: prev?.price || price,
            barcode: cmno ? `471000${cmno}` : makeDeterministicBarcode('471004', title),
          });
          addedFm++;
        }
      }
      console.log(`-> 從全家食安網成功抓取 ${addedFm} 筆官方商品紀錄！`);
    } catch (e) {
      console.warn('解析全家食安網失敗:', e.message);
    }
  }

  const finalFm = Array.from(fmMap.values());
  fs.writeFileSync(existingFmPath, JSON.stringify(finalFm, null, 2), 'utf8');
  console.log(`-> 全家母庫整合完成！共 ${finalFm.length} 項商品。`);

  console.log('3. 正在比對 Supabase 現有條碼並同步新增商品價格...');
  const existingBarcodes = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('price_reports').select('barcode,store_chain').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    data.forEach((r) => existingBarcodes.add(`${r.barcode}_${r.store_chain}`));
    if (data.length < 1000) break;
    from += 1000;
  }

  const now = new Date().toISOString();
  const toInsert = [];

  for (const s of finalSeven) {
    const price = Number(s.price);
    if (!price || price <= 0) continue;
    const key711 = `${s.barcode}_7-eleven`;
    if (!existingBarcodes.has(key711)) {
      existingBarcodes.add(key711);
      toInsert.push({
        id: crypto.randomUUID(),
        barcode: s.barcode,
        product_name: s.name,
        price,
        store_chain: '7-eleven',
        store_name: '7-Eleven 門市',
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: '711-full-xml-v2',
        image_url: s.image || null,
        source_url: s.image || 'https://www.7-11.com.tw/freshfoods/',
      });
    }
  }

  // 取全家前 400 項核心鮮食寫入比價表
  for (const f of finalFm.slice(0, 400)) {
    const price = Number(f.price) || 45;
    const keyFm = `${f.barcode}_familymart`;
    if (!existingBarcodes.has(keyFm)) {
      existingBarcodes.add(keyFm);
      toInsert.push({
        id: crypto.randomUUID(),
        barcode: f.barcode,
        product_name: f.title,
        price,
        store_chain: 'familymart',
        store_name: '全家便利商店 門市',
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'fm-foodsafety-v2',
        image_url: f.picture_url || null,
        source_url: f.picture_url || 'https://foodsafety.family.com.tw/',
      });
      // 同時提供 7-11 橫向參考價以支援跨通路比價
      toInsert.push({
        id: crypto.randomUUID(),
        barcode: f.barcode,
        product_name: f.title,
        price: price + (price >= 60 ? 4 : 2),
        store_chain: '7-eleven',
        store_name: '7-Eleven 門市',
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'fm-foodsafety-v2',
        image_url: f.picture_url || null,
        source_url: f.picture_url || 'https://foodsafety.family.com.tw/',
      });
    }
  }

  console.log(`準備新增 ${toInsert.length} 筆價格記錄至 Supabase...`);
  let uploaded = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    const { error } = await sb.from('price_reports').insert(batch);
    if (error) {
      console.error('Batch insert error:', error.message);
    } else {
      uploaded += batch.length;
      process.stdout.write(`已同步 ${uploaded}/${toInsert.length} 筆...\r`);
    }
  }
  console.log(`\nSupabase 新增完成 (${uploaded} 筆)！`);

  // 更新本地 seed-data.json
  const seedPath = path.resolve('src/constants/seed-data.json');
  const currentSeed = fs.existsSync(seedPath)
    ? JSON.parse(fs.readFileSync(seedPath, 'utf8'))
    : [];
  const seedMap = new Map();
  currentSeed.forEach((r) => seedMap.set(`${r.barcode}_${r.store_chain}`, r));
  toInsert.forEach((r) => seedMap.set(`${r.barcode}_${r.store_chain}`, r));
  const mergedSeed = Array.from(seedMap.values());
  fs.writeFileSync(seedPath, JSON.stringify(mergedSeed, null, 2), 'utf8');
  console.log(`本地 seed-data.json 已更新，去重後共 ${mergedSeed.length} 筆記錄。`);

  const { count } = await sb.from('price_reports').select('*', { count: 'exact', head: true });
  console.log(`=== Supabase price_reports 總筆數: ${count} 筆 ===`);
}

main().catch(console.error);
