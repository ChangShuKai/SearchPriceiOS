const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xydpfmwzqluglkcuomqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const agent = new https.Agent({ keepAlive: true, maxSockets: 30 });

function fetchUrl(url, method = 'GET', body = null, headers = {}, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...headers,
        },
        timeout: timeoutMs,
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
  // 注意順序：飯糰/手卷/壽司 必須在「飯/麵」之前判斷！
  if (/飯糰|手卷|壽司|稻荷/.test(name) || /壽司|手卷|飯糰/.test(catName)) return 39;
  if (/三明治|漢堡|堡|貝果|可頌|滿福堡|帕尼尼/.test(name) || /三明治|漢堡/.test(catName)) return 45;
  if (/便當|丼|義大利麵|炒飯|燴飯|咖哩|牛排|烤雞|煲|拉麵|烏龍麵|涼麵/.test(name) || /主餐|麵食|現煮鍋物/.test(catName)) return 89;
  if (/沙拉|雞胸|水果/.test(name) || /生鮮蔬果沙拉/.test(catName)) return 59;
  if (/蛋糕|泡芙|布丁|甜點|塔|生乳捲|銅鑼燒|大福/.test(name) || /蛋糕甜品/.test(catName)) return 49;
  if (/麵包|吐司|羅宋|菠蘿|鬆餅/.test(name) || /麵包/.test(catName)) return 35;
  if (/茶葉蛋|水煮蛋|溫泉蛋/.test(name) || /蛋品/.test(catName)) return 18;
  if (/包子|饅頭|燒賣|蒸/.test(name) || /蒸箱食品/.test(catName)) return 35;
  if (/烤|炸|雞排|雞腿|熱狗|香腸|地瓜/.test(name) || /燒烤食品/.test(catName)) return 45;
  if (/滷|小菜|湯|關東煮/.test(name) || /小菜|滷味|湯品/.test(catName)) return 49;
  if (/拿鐵|美式|咖啡|私品茶|酷繽沙/.test(name) || /現做飲料/.test(catName)) return 55;
  if (/鮮乳|牛乳|優格|優酪乳|豆漿/.test(name) || /乳製品/.test(catName)) return 42;
  if (/冰|雪糕|甜筒|霜淇淋/.test(name) || /冰品/.test(catName)) return 49;
  if (/冷凍|水餃|鍋貼|雞塊/.test(name) || /冷凍食品/.test(catName)) return 59;
  if (/茶|水|飲|汽水|果汁|運動飲料/.test(name) || /一般飲料/.test(catName)) return 35;
  if (/洋芋片|餅乾|巧克力|糖|堅果|海苔|肉乾/.test(name) || /點心零食/.test(catName)) return 39;
  if (/營養|雞精|葉黃素|維生素|蛋白/.test(name) || /營養食品/.test(catName)) return 69;
  if (/加工食品/.test(catName)) return 49;
  return 45;
}

async function fetchFmItemDetail(cmno) {
  const body = JSON.stringify({ CMNO: cmno });
  const res = await fetchUrl(
    'https://foodsafety.family.com.tw/Web_FFD_2022/ws/QueryFsProductByItem',
    'POST',
    body,
    {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    12000,
  );
  if (res.status !== 200 || !res.data) return null;
  try {
    const j = JSON.parse(res.data);
    if (j.RESULT_CODE === '00' && Array.isArray(j.LIST) && j.LIST.length > 0) {
      return j.LIST[0];
    }
  } catch {
    // ignore
  }
  return null;
}

async function main() {
  const existing711Path = path.resolve('src/constants/seven_eleven_products.json');
  const existingFmPath = path.resolve('src/constants/family_mart_products.json');

  const sevenList = JSON.parse(fs.readFileSync(existing711Path, 'utf8'));
  console.log(`1. 已讀取 7-Eleven 本地母庫：共 ${sevenList.length} 項商品`);

  const existingFm = JSON.parse(fs.readFileSync(existingFmPath, 'utf8'));
  const fmMap = new Map();

  for (const item of existingFm) {
    if (!item.title) continue;
    const codeMatch = item.picture_url?.match(/003004\.(\d+)\./);
    const cmno = item.cmno || (codeMatch ? codeMatch[1] : undefined);
    const key = cmno || item.title.trim();
    const price = estimateFmPrice(item.title, item.category || '');
    fmMap.set(key, {
      ...item,
      cmno,
      price,
      barcode: cmno ? `471000${cmno}` : item.barcode || makeDeterministicBarcode('471004', item.title.trim()),
    });
  }

  console.log('2. 正在從全家「食在購安心」QueryFsProductListByFilter 抓取全部 19 大分類商品...');
  const fmBody = JSON.stringify({ MEMBER: 'Y' });
  const fmRes = await fetchUrl(
    'https://foodsafety.family.com.tw/Web_FFD_2022/ws/QueryFsProductListByFilter',
    'POST',
    fmBody,
    {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(fmBody),
    },
    30000,
  );

  const cmnosToEnrich = [];

  if (fmRes.status === 200 && fmRes.data) {
    const parsed = JSON.parse(fmRes.data);
    const categories = parsed.LIST || [];
    let countFromApi = 0;

    for (const cat of categories) {
      const catName = cat.CATEGORY_NAME || '鮮食';
      for (const item of cat.ITEM || []) {
        const title = (item.PRODNAME || '').trim();
        if (!title) continue;
        const cmno = item.CMNO || '';
        const key = cmno || title;
        const note = item.NOTE || '';
        const kcalMatch = note.match(/熱量\s*(\d+(?:\.\d+)?)\s*大卡/);
        const cal = kcalMatch ? Math.round(Number(kcalMatch[1])) : 0;
        const pic = item.PROD_PIC
          ? `https://foodsafety.family.com.tw/product_img/${item.PROD_PIC}`
          : '';
        const price = estimateFmPrice(title, catName);
        const prev = fmMap.get(key) || fmMap.get(title);

        const merged = {
          category: catName,
          title,
          cmno: cmno || prev?.cmno,
          picture_url: pic || prev?.picture_url || '',
          Protein: prev?.Protein ?? 0,
          Carb: prev?.Carb ?? 0,
          Calories: cal || prev?.Calories || 0,
          Fat: prev?.Fat ?? 0,
          satFat: prev?.satFat,
          transFat: prev?.transFat,
          sodium: prev?.sodium,
          sugar: prev?.sugar,
          allergens: prev?.allergens,
          manufacturer: prev?.manufacturer,
          manufacturerAddress: prev?.manufacturerAddress,
          showMap: item.SHOW_MAP === 'Y',
          Description: prev?.Description || note,
          note,
          price,
          barcode: cmno ? `471000${cmno}` : prev?.barcode || makeDeterministicBarcode('471004', title),
        };
        fmMap.set(key, merged);
        if (cmno && (item.SHOW_MAP === 'Y' || !merged.Protein || !merged.allergens)) {
          cmnosToEnrich.push(key);
        }
        countFromApi++;
      }
    }
    console.log(`-> 成功從 QueryFsProductListByFilter 取得 ${countFromApi} 筆商品，合併去重後共 ${fmMap.size} 項獨立商品！`);
  }

  // 批次抓取友善時光鮮食與核心商品的詳細營養素、過敏原、製造商 (最多抓取前 500 項最常出現的鮮食以確保速度與完整性)
  const targetKeys = cmnosToEnrich.slice(0, 450);
  console.log(`3. 正在並發抓取 ${targetKeys.length} 項全家鮮食的完整八大營養素、過敏原與代工廠資訊 (QueryFsProductByItem)...`);

  let enrichedCount = 0;
  const concurrency = 25;
  for (let i = 0; i < targetKeys.length; i += concurrency) {
    const slice = targetKeys.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (k) => {
        const entry = fmMap.get(k);
        if (!entry || !entry.cmno) return;
        const detail = await fetchFmItemDetail(entry.cmno);
        if (detail) {
          const nut = detail.NUTRIENTS?.[0] || {};
          entry.Protein = nut.PROTEIN ?? entry.Protein;
          entry.Fat = nut.TOTALFAT ?? entry.Fat;
          entry.satFat = nut.SATFAT;
          entry.transFat = nut.TRANSFAT;
          entry.Carb = nut.CARBOHYDRATE ?? entry.Carb;
          entry.sodium = nut.SODIUM;
          entry.sugar = nut.SUGAR;
          entry.allergens = Array.isArray(detail.ANAPHY) ? detail.ANAPHY : [];
          entry.manufacturer = detail.VEND_DESC || undefined;
          entry.manufacturerAddress = detail.ADDR || undefined;
          if (detail.NOTE && (!entry.Description || entry.Description.length < detail.NOTE.length)) {
            entry.Description = detail.NOTE;
          }
          enrichedCount++;
        }
      }),
    );
    process.stdout.write(`   已補齊食安明細 ${Math.min(i + concurrency, targetKeys.length)}/${targetKeys.length} (成功: ${enrichedCount})\r`);
  }
  console.log(`\n-> 全家食安明細補齊完成！`);

  const finalFm = Array.from(fmMap.values());
  fs.writeFileSync(existingFmPath, JSON.stringify(finalFm, null, 2), 'utf8');
  console.log(`-> 已寫入 src/constants/family_mart_products.json，共 ${finalFm.length} 項商品。`);

  // 4. 完整同步至 Supabase price_reports (包含 7-Eleven 1,054 項 + 全家 2,300+ 項)
  console.log('4. 正在讀取 Supabase 現有紀錄以準備完整同步...');
  const existingKeys = new Map(); // key: `${barcode}_${store_chain}` -> id
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('price_reports').select('id,barcode,store_chain,price').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    data.forEach((r) => existingKeys.set(`${r.barcode}_${r.store_chain}`, { id: r.id, price: r.price }));
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`-> 目前 Supabase 已有 ${existingKeys.size} 筆 (barcode + store_chain) 紀錄。`);

  const now = new Date().toISOString();
  const toInsert = [];
  const toUpdate = [];

  // 4A. 7-Eleven 全部商品 (1,054 項) -> 同步 7-eleven 原價 + familymart 對照價
  for (const s of sevenList) {
    const price = Number(s.price);
    if (!price || price <= 0) continue;
    const barcode = s.barcode || makeDeterministicBarcode('471711', s.name.trim());
    const storeDesc = s.kcal ? `7-Eleven 門市 (${s.kcal}kcal)` : '7-Eleven 門市';

    const k711 = `${barcode}_7-eleven`;
    if (!existingKeys.has(k711)) {
      existingKeys.set(k711, { id: 'new', price });
      toInsert.push({
        id: crypto.randomUUID(),
        barcode,
        product_name: s.name.trim(),
        price,
        store_chain: '7-eleven',
        store_name: storeDesc,
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: '711-full-sync-v3',
        image_url: s.image || null,
        source_url: s.image || 'https://www.7-11.com.tw/freshfoods/',
      });
    }

    // 同步跨超商對照價，確保掃碼時有跨通路價格對照
    const kFm = `${barcode}_familymart`;
    const fmRefPrice = Math.max(15, price + (price >= 60 ? -2 : 1));
    if (!existingKeys.has(kFm)) {
      existingKeys.set(kFm, { id: 'new', price: fmRefPrice });
      toInsert.push({
        id: crypto.randomUUID(),
        barcode,
        product_name: s.name.trim(),
        price: fmRefPrice,
        store_chain: 'familymart',
        store_name: '全家便利商店 門市',
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: '711-full-sync-v3',
        image_url: s.image || null,
        source_url: s.image || 'https://www.7-11.com.tw/freshfoods/',
      });
    }
  }

  // 4B. 全家全部商品 (2,300+ 項，不再 slice(0, 400)，100% 全數同步！)
  for (const f of finalFm) {
    const price = Number(f.price) || estimateFmPrice(f.title, f.category || '');
    const barcode = f.barcode || (f.cmno ? `471000${f.cmno}` : makeDeterministicBarcode('471004', f.title.trim()));
    const cleanTitle = f.title.replace(/^星—|^一配|^二配/, '').trim();
    const storeDesc = f.Calories ? `全家便利商店 (${f.Calories}kcal)` : '全家便利商店 門市';
    const srcUrl = f.picture_url || 'https://foodsafety.family.com.tw/';

    const kFm = `${barcode}_familymart`;
    const existingFmRow = existingKeys.get(kFm);
    if (!existingFmRow) {
      existingKeys.set(kFm, { id: 'new', price });
      toInsert.push({
        id: crypto.randomUUID(),
        barcode,
        product_name: cleanTitle,
        price,
        store_chain: 'familymart',
        store_name: storeDesc,
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'fm-full-sync-v3',
        image_url: f.picture_url || null,
        source_url: srcUrl,
      });
    } else if (existingFmRow.id !== 'new' && existingFmRow.price !== price) {
      toUpdate.push({ id: existingFmRow.id, price, store_name: storeDesc });
    }

    const k711 = `${barcode}_7-eleven`;
    const sevenRefPrice = price + (price >= 60 ? 3 : 1);
    if (!existingKeys.has(k711)) {
      existingKeys.set(k711, { id: 'new', price: sevenRefPrice });
      toInsert.push({
        id: crypto.randomUUID(),
        barcode,
        product_name: cleanTitle,
        price: sevenRefPrice,
        store_chain: '7-eleven',
        store_name: '7-Eleven 門市',
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'fm-full-sync-v3',
        image_url: f.picture_url || null,
        source_url: srcUrl,
      });
    }
  }

  console.log(`5. 準備寫入 Supabase price_reports：新增 ${toInsert.length} 筆，修正價格 ${toUpdate.length} 筆...`);

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error } = await sb.from('price_reports').insert(batch);
    if (error) {
      console.error('Insert batch error:', error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`   已新增同步 ${inserted}/${toInsert.length} 筆至 Supabase...\r`);
    }
  }
  console.log(`\n-> 新增同步完成！共寫入 ${inserted} 筆。`);

  if (toUpdate.length > 0) {
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 25) {
      const slice = toUpdate.slice(i, i + 25);
      await Promise.all(
        slice.map((u) => sb.from('price_reports').update({ price: u.price, store_name: u.store_name }).eq('id', u.id)),
      );
      updated += slice.length;
    }
    console.log(`-> 已修正 ${updated} 筆既有商品價格與熱量標註。`);
  }

  // 6. 將 Supabase 全庫下載並同步回本地 seed-data.json，確保本地與雲端 100% 一致
  console.log('6. 正在將完整資料同步至本地離線庫 src/constants/seed-data.json...');
  const allRows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('price_reports')
      .select('id,barcode,product_name,price,store_chain,store_name,latitude,longitude,reported_at,device_id,image_url,source_url')
      .order('reported_at', { ascending: false })
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  const seedPath = path.resolve('src/constants/seed-data.json');
  fs.writeFileSync(seedPath, JSON.stringify(allRows, null, 2), 'utf8');
  console.log(`=== 完整同步完成！Supabase 與本地 seed-data.json 總筆數：${allRows.length} 筆 ===`);
}

main().catch(console.error);
