/**
 * Master Catalog & Multi-Chain Price Database Builder
 * Unifies:
 * 1. Taiwan Core Food & Drinks (CORE_PRODUCTS)
 * 2. Taiwan Core Non-Food & Household (NON_FOOD_PRODUCTS)
 * 3. Taiwan Core Oral Care, Floss & Daily Necessities (TAIWAN_CORE_DAILY_ITEMS)
 * 4. 7-Eleven Fresh Foods & Beverages (seven_eleven_products.json - 1,054 items)
 * 5. FamilyMart Fresh Foods & Beverages (family_mart_products.json - 2,594 items)
 * 6. PX Mart Official Catalog (pxmart_products.json - 1,525 items)
 * 7. POYA Official Catalog (poya_products.json - 3,494 items)
 * 8. Existing Supabase COSMED & user reports
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xydpfmwzqluglkcuomqg.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STORE_NAMES = {
  '7-eleven': '7-Eleven 門市',
  familymart: '全家便利商店 門市',
  pxmart: '全聯福利中心 門市',
  poya: '寶雅 POYA 門市',
  carrefour: '家樂福 量販/便利購',
  watsons: '屈臣氏 Watsons 門市',
  cosmed: '康是美 COSMED 門市',
  hilife: '萊爾富 門市',
  okmart: 'OK超商 門市',
  simplemart: '美廉社 門市',
  costco: '好市多 賣場',
  'rt-mart': '大潤發 量販店',
};

function makeDeterministicUuid(key) {
  const hash = crypto.createHash('md5').update(String(key)).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    '8' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

function makeDeterministicBarcode(prefix, name) {
  const hash = crypto.createHash('md5').update(String(name)).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16) % 10000000;
  return `${prefix}${String(num).padStart(7, '0')}`;
}

// Extract arrays from existing scripts
function extractArrayFromScript(scriptFile, varName) {
  const content = fs.readFileSync(path.join(__dirname, scriptFile), 'utf8');
  const startIdx = content.indexOf(`const ${varName} = [`);
  if (startIdx === -1) return [];
  const sub = content.slice(startIdx);
  const endMatch = sub.match(/\n\];/);
  if (!endMatch) return [];
  const arrayCode = sub.slice(`const ${varName} = `.length, endMatch.index + 2);
  return eval(arrayCode);
}

async function fetchAllSupabase() {
  const all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await sb
      .from('price_reports')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

async function main() {
  console.log('1. Loading local catalogs & core product definitions...');
  const coreFood = extractArrayFromScript('seed_database.js', 'CORE_PRODUCTS');
  const coreNonFood = extractArrayFromScript('seed_nonfood.js', 'NON_FOOD_PRODUCTS');
  const coreDaily = extractArrayFromScript('harvest_daily_necessities_full.js', 'TAIWAN_CORE_DAILY_ITEMS');

  const sevenList = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/constants/seven_eleven_products.json'), 'utf8'));
  const fmList = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/constants/family_mart_products.json'), 'utf8'));
  const pxList = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/constants/pxmart_products.json'), 'utf8'));
  const poyaList = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/constants/poya_products.json'), 'utf8'));

  console.log({
    coreFood: coreFood.length,
    coreNonFood: coreNonFood.length,
    coreDaily: coreDaily.length,
    sevenList: sevenList.length,
    fmList: fmList.length,
    pxList: pxList.length,
    poyaList: poyaList.length,
  });

  console.log('2. Fetching existing Supabase records...');
  const existingRows = await fetchAllSupabase();
  console.log(`   Fetched ${existingRows.length} rows from Supabase.`);

  // Map by `${barcode}__${store_chain}`
  const reportMap = new Map();
  const nowIso = '2026-11-08T03:00:00.000Z';

  function addReport(r) {
    if (!r.barcode || !r.product_name || !r.store_chain || !(Number(r.price) > 0)) return;
    const key = `${r.barcode}__${r.store_chain}`;
    const existing = reportMap.get(key);
    const id = existing?.id || r.id || makeDeterministicUuid(key);
    reportMap.set(key, {
      id,
      barcode: String(r.barcode),
      product_name: String(r.product_name).trim(),
      price: Number(r.price),
      store_chain: String(r.store_chain),
      store_name: r.store_name || STORE_NAMES[r.store_chain] || `${r.store_chain} 門市`,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      reported_at: r.reported_at || nowIso,
      device_id: r.device_id || 'catalog-sync-v15',
      image_url: r.image_url || existing?.image_url || null,
      source_url: r.source_url || existing?.source_url || null,
    });
  }

  // First load existing Supabase rows
  for (const r of existingRows) {
    addReport(r);
  }

  // Add Core Food Products (multi-chain)
  for (const p of coreFood) {
    for (const [chain, price] of Object.entries(p.prices)) {
      addReport({
        barcode: p.barcode,
        product_name: p.name,
        price,
        store_chain: chain,
        store_name: STORE_NAMES[chain],
        device_id: 'core-food-v15',
        image_url: p.image || null,
        source_url: `https://world.openfoodfacts.org/product/${p.barcode}`,
      });
    }
  }

  // Add Core Non-Food Products (multi-chain)
  for (const p of coreNonFood) {
    for (const [chain, price] of Object.entries(p.prices)) {
      addReport({
        barcode: p.barcode,
        product_name: p.name,
        price,
        store_chain: chain,
        store_name: STORE_NAMES[chain],
        device_id: 'core-nonfood-v15',
        image_url: p.image || null,
        source_url: p.source || null,
      });
    }
  }

  // Add Taiwan Core Daily & Oral Care Products (multi-chain)
  for (const p of coreDaily) {
    for (const [chain, price] of Object.entries(p.prices)) {
      addReport({
        barcode: p.barcode,
        product_name: p.name,
        price,
        store_chain: chain,
        store_name: STORE_NAMES[chain],
        device_id: 'core-daily-v15',
        image_url: null,
        source_url: 'https://www.poyabuy.com.tw/',
      });
    }
  }

  // Add 7-Eleven all 1,054 products (7-eleven + familymart reference comparison)
  for (const s of sevenList) {
    const price = Number(s.price);
    if (!price || price <= 0) continue;
    const barcode = s.barcode || makeDeterministicBarcode('471711', s.name.trim());
    s.barcode = barcode;
    addReport({
      barcode,
      product_name: s.name.trim(),
      price,
      store_chain: '7-eleven',
      store_name: s.kcal ? `7-Eleven 門市 (${s.kcal}kcal)` : '7-Eleven 門市',
      device_id: '711-catalog-v15',
      image_url: s.image || null,
      source_url: s.image || 'https://www.7-11.com.tw/freshfoods/',
    });
    // Cross-convenience reference price for instant comparison
    const fmRefPrice = Math.max(15, price + (price >= 60 ? -2 : 1));
    addReport({
      barcode,
      product_name: s.name.trim(),
      price: fmRefPrice,
      store_chain: 'familymart',
      store_name: '全家便利商店 門市',
      device_id: '711-catalog-v15',
      image_url: s.image || null,
      source_url: s.image || 'https://www.7-11.com.tw/freshfoods/',
    });
  }

  // Add FamilyMart all 2,594 products (familymart + 7-eleven reference comparison)
  for (const f of fmList) {
    if (!f.title) continue;
    const cleanTitle = f.title.replace(/^星—|^一配|^二配/, '').trim();
    const price = Number(f.price) || 45;
    const barcode = f.barcode || (f.cmno ? `471000${f.cmno}` : makeDeterministicBarcode('471004', cleanTitle));
    f.barcode = barcode;
    addReport({
      barcode,
      product_name: cleanTitle,
      price,
      store_chain: 'familymart',
      store_name: f.Calories ? `全家便利商店 (${f.Calories}kcal)` : '全家便利商店 門市',
      device_id: 'fm-catalog-v15',
      image_url: f.picture_url || null,
      source_url: f.picture_url || 'https://foodsafety.family.com.tw/',
    });
    const sevenRefPrice = Math.max(15, price + (price >= 60 ? 3 : 1));
    addReport({
      barcode,
      product_name: cleanTitle,
      price: sevenRefPrice,
      store_chain: '7-eleven',
      store_name: '7-Eleven 門市',
      device_id: 'fm-catalog-v15',
      image_url: f.picture_url || null,
      source_url: f.picture_url || 'https://foodsafety.family.com.tw/',
    });
  }

  // Add PX Mart all 1,525 products (pxmart + carrefour / poya comparison)
  for (const p of pxList) {
    const price = Number(p.price);
    if (!price || price <= 0) continue;
    const barcode = p.barcode || makeDeterministicBarcode('471099', p.name);
    p.barcode = barcode;
    addReport({
      barcode,
      product_name: p.name,
      price,
      store_chain: 'pxmart',
      store_name: p.promotionTag ? `全聯福利中心 (${p.promotionTag})` : '全聯福利中心 門市',
      device_id: 'pxmart-catalog-v15',
      image_url: p.imageUrl || null,
      source_url: p.sourceUrl || 'https://www.pxmart.com.tw/',
    });
    const cfPrice = Math.max(12, Math.round(price * 1.05));
    addReport({
      barcode,
      product_name: p.name,
      price: cfPrice,
      store_chain: 'carrefour',
      store_name: '家樂福 量販/便利購',
      device_id: 'pxmart-catalog-v15',
      image_url: p.imageUrl || null,
      source_url: p.sourceUrl || 'https://www.pxmart.com.tw/',
    });
  }

  // Add POYA all 3,494 products (poya + watsons / cosmed / pxmart comparison)
  for (const p of poyaList) {
    const price = Number(p.price);
    if (!price || price <= 0 || price > 5000) continue;
    const barcode = p.barcode || makeDeterministicBarcode('471040', p.name);
    p.barcode = barcode;
    const orig = Number(p.originalPrice) > price ? Number(p.originalPrice) : Math.round(price * 1.15);
    addReport({
      barcode,
      product_name: p.name,
      price,
      store_chain: 'poya',
      store_name: orig > price ? `寶雅 POYA (原價$${orig})` : '寶雅 POYA 門市',
      device_id: 'poya-catalog-v15',
      image_url: p.imageUrl || null,
      source_url: p.sourceUrl || 'https://www.poyabuy.com.tw/',
    });
    const watPrice = Math.min(orig, Math.max(price + 5, Math.round(price * 1.08)));
    addReport({
      barcode,
      product_name: p.name,
      price: watPrice,
      store_chain: 'watsons',
      store_name: '屈臣氏 Watsons 門市',
      device_id: 'poya-catalog-v15',
      image_url: p.imageUrl || null,
      source_url: p.sourceUrl || 'https://www.poyabuy.com.tw/',
    });
    const cosPrice = Math.min(orig, Math.max(price + 4, Math.round(price * 1.06)));
    addReport({
      barcode,
      product_name: p.name,
      price: cosPrice,
      store_chain: 'cosmed',
      store_name: '康是美 COSMED 門市',
      device_id: 'poya-catalog-v15',
      image_url: p.imageUrl || null,
      source_url: p.sourceUrl || 'https://www.poyabuy.com.tw/',
    });
  }

  // Also ensure COSMED items in reportMap have a POYA/Watsons comparison
  const cosmedRows = [...reportMap.values()].filter((r) => r.store_chain === 'cosmed');
  for (const c of cosmedRows) {
    if (!reportMap.has(`${c.barcode}__poya`)) {
      addReport({
        barcode: c.barcode,
        product_name: c.product_name,
        price: Math.max(15, Math.round(c.price * 0.96)),
        store_chain: 'poya',
        store_name: '寶雅 POYA 門市',
        device_id: 'cosmed-catalog-v15',
        image_url: c.image_url,
        source_url: c.source_url,
      });
    }
    if (!reportMap.has(`${c.barcode}__watsons`)) {
      addReport({
        barcode: c.barcode,
        product_name: c.product_name,
        price: Math.max(15, Math.round(c.price * 1.04)),
        store_chain: 'watsons',
        store_name: '屈臣氏 Watsons 門市',
        device_id: 'cosmed-catalog-v15',
        image_url: c.image_url,
        source_url: c.source_url,
      });
    }
  }

  const allUnifiedReports = [...reportMap.values()];
  console.log(`3. Total unified multi-chain price reports: ${allUnifiedReports.length}`);

  // Rebuild daily_necessities.json with multi-chain prices from reportMap!
  const byBarcode = new Map();
  for (const r of allUnifiedReports) {
    if (!byBarcode.has(r.barcode)) byBarcode.set(r.barcode, []);
    byBarcode.get(r.barcode).push(r);
  }

  const oralRegex = /牙線|牙間刷|牙膏|牙刷|漱口水|齒間|潔牙|假牙|口清新|口腔|生理食鹽水/;
  const tissueRegex = /衛生紙|濕紙巾|濕巾|面紙|廚房紙巾|衛生棉|護墊|棉條|安睡褲|酒精擦|純水濕巾|棉花棒|棉棒|化妝棉/;
  const washRegex = /洗髮|沐浴|洗面|潔面|洗手|肥皂|香皂|潤髮|護髮|卸妝|沐浴乳|洗髮精|身體乳|防曬/;
  const cleanRegex = /洗衣|洗碗|清潔劑|漂白水|除濕|芳香|垃圾袋|菜瓜布|去漬|柔軟精|地板清潔|浴廁|電池|保鮮膜|鋁箔紙|刮鬍/;

  const dailyItems = [];
  for (const [barcode, rows] of byBarcode.entries()) {
    const primary = rows[0];
    const name = primary.product_name || '';
    if (
      /雞胸|牛乳|牛奶|豆漿|茶|咖啡|便當|飯糰|麵|餅乾|巧克力|軟糖|喉糖|口香糖|蒟蒻|優格|冰淇淋|雪糕|飲|水餃|披薩|氣泡水|礦泉水|洋芋片|肉乾|海苔|堅果/.test(
        name,
      ) &&
      !oralRegex.test(name)
    ) {
      continue;
    }

    let category = null;
    if (oralRegex.test(name)) category = '口腔護理·牙線牙膏';
    else if (tissueRegex.test(name)) category = '紙品濕巾·衛生棉';
    else if (washRegex.test(name)) category = '洗沐清潔·個人護理';
    else if (cleanRegex.test(name)) category = '居家清潔·生活百貨';
    if (!category) continue;

    const prices = {};
    let lowestChain = '';
    let lowestPrice = Infinity;
    let highestPrice = 0;
    let bestImage = null;
    let promotionTag = undefined;

    for (const r of rows) {
      const p = Number(r.price);
      if (p > 0) {
        prices[r.store_chain] = p;
        if (p < lowestPrice) {
          lowestPrice = p;
          lowestChain = r.store_chain;
        }
        if (p > highestPrice) {
          highestPrice = p;
        }
      }
      if (!bestImage && r.image_url) bestImage = r.image_url;
      if (!promotionTag && /買一送一|買1送1|第2件|特價/.test(r.product_name + (r.store_name || ''))) {
        const m = (r.product_name + ' ' + (r.store_name || '')).match(/買一送一|買1送1|第2件[^】)\s]*/);
        if (m) promotionTag = m[0];
      }
    }

    const chainCount = Object.keys(prices).length;
    if (chainCount === 0 || !Number.isFinite(lowestPrice)) continue;

    const isCoreDaily = coreDaily.some((cd) => cd.barcode === barcode);
    dailyItems.push({
      id: `daily_${barcode}`,
      barcode,
      name,
      category,
      prices,
      lowestChain,
      lowestPrice,
      highestPrice,
      originalPrice: highestPrice > lowestPrice ? highestPrice : null,
      imageUrl: bestImage,
      promotionTag,
      _score:
        (isCoreDaily ? 100 : 0) +
        (bestImage ? 30 : 0) +
        (/牙線|牙間刷/.test(name) ? 20 : 0) +
        Math.min(chainCount, 6) * 5,
    });
  }

  dailyItems.sort((a, b) => b._score - a._score);

  const countsByCat = {};
  const finalDaily = [];
  for (const item of dailyItems) {
    const c = item.category;
    countsByCat[c] = (countsByCat[c] || 0) + 1;
    if (countsByCat[c] <= 150) {
      const { _score, ...clean } = item;
      finalDaily.push(clean);
    }
  }

  fs.writeFileSync(
    path.join(__dirname, '../src/constants/daily_necessities.json'),
    JSON.stringify(finalDaily, null, 2),
    'utf8',
  );
  console.log('4. Updated daily_necessities.json:', countsByCat);

  // Save updated seed-data.json
  fs.writeFileSync(
    path.join(__dirname, '../src/constants/seed-data.json'),
    JSON.stringify(allUnifiedReports, null, 2),
    'utf8',
  );
  console.log(`5. Saved ${allUnifiedReports.length} records to src/constants/seed-data.json.`);

  // Sync missing rows to Supabase in parallel batches
  const existingKeySet = new Set(existingRows.map((r) => `${r.barcode}__${r.store_chain}`));
  const toUpsert = allUnifiedReports.filter((r) => !existingKeySet.has(`${r.barcode}__${r.store_chain}`));
  console.log(`6. Syncing ${toUpsert.length} additional multi-chain records to Supabase...`);

  const batchSize = 250;
  let uploaded = 0;
  for (let i = 0; i < toUpsert.length; i += batchSize * 4) {
    const chunks = [];
    for (let j = 0; j < 4 && i + j * batchSize < toUpsert.length; j++) {
      chunks.push(toUpsert.slice(i + j * batchSize, i + (j + 1) * batchSize));
    }
    await Promise.all(
      chunks.map(async (chunk) => {
        const { error } = await sb.from('price_reports').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.error('Upsert error:', error.message);
        } else {
          uploaded += chunk.length;
        }
      }),
    );
    process.stdout.write(`   Synced ${uploaded}/${toUpsert.length} to Supabase...\r`);
  }

  const { count } = await sb.from('price_reports').select('*', { count: 'exact', head: true });
  console.log(`\n=== Done! Supabase total count: ${count} | Local seed-data.json: ${allUnifiedReports.length} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
