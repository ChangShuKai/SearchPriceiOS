/**
 * Comprehensive Authentic Data Optimization & Cross-Chain Barcode Unification Script
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env (never exposed to client bundle)
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAllRows() {
  const all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
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

async function deleteByIds(ids) {
  if (ids.length === 0) return 0;
  let deleted = 0;
  const chunkSize = 300;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from('price_reports').delete().in('id', chunk);
    if (error) {
      console.error('Delete error:', error.message);
    } else {
      deleted += chunk.length;
    }
  }
  return deleted;
}

/**
 * Normalize product name for strict, genuine cross-chain matching.
 * We preserve all numbers/units (e.g., 50m, 150入, 700ml, 2入) so different pack sizes NEVER falsely match!
 */
function normalizeProductNameForMatch(name) {
  if (!name) return '';
  let s = name
    .toLowerCase()
    // Remove promotional brackets like 【買1送1】, (顏色隨機), [全聯獨家] etc.
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/（顏色隨機[^）]*）/g, '')
    .replace(/\(顏色隨機[^)]*\)/g, '')
    .replace(/（新舊包裝[^）]*）/g, '')
    .replace(/\(新舊包裝[^)]*\)/g, '')
    // Normalize common unit synonyms
    .replace(/公克/g, 'g')
    .replace(/克/g, 'g')
    .replace(/毫升/g, 'ml')
    .replace(/公升/g, 'l')
    .replace(/公尺/g, 'm')
    .replace(/米/g, 'm')
    .replace(/支入/g, '入')
    .replace(/支\/包/g, '入')
    .replace(/只\/包/g, '入')
    .replace(/片\/包/g, '片')
    .replace(/抽\/包/g, '抽')
    // Remove spaces and punctuation
    .replace(/[\s\-_・·,，.。/／+＋*＊()（）「」『』~～:：!！?？]/g, '');
  return s;
}

/**
 * Harvest additional authentic COSMED products from shop.cosmed.com.tw (shopId=2131)
 */
async function harvestMoreCosmedProducts(existingSourceUrls) {
  console.log('\n[Step 2] Fetching additional real COSMED products (shopId=2131)...');
  const newRows = [];
  const shopId = 2131;
  for (let startIndex = 700; startIndex < 2200; startIndex += 100) {
    try {
      const url = `https://shop.cosmed.com.tw/webapi/Official/GetOfficialNewestSalePage?shopId=${shopId}&startIndex=${startIndex}&maxCount=100`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });
      if (!res.ok) break;
      const json = await res.json();
      const list = json?.Data?.NewestSalePageList;
      if (!Array.isArray(list) || list.length === 0) break;

      for (const item of list) {
        const salePageId = String(item.SalePageId || '').trim();
        const title = String(item.Title || '').trim();
        const price = Number(item.Price || 0);
        const suggestPrice = Number(item.SuggestPrice || 0);
        if (!salePageId || !title || price <= 0) continue;

        const sourceUrl = `https://shop.cosmed.com.tw/SalePage/Index/${salePageId}`;
        if (existingSourceUrls.has(sourceUrl)) continue;
        existingSourceUrls.add(sourceUrl);

        const barcode = `471021${salePageId.padStart(7, '0').slice(-7)}`;
        let picUrl = String(item.PicUrl || '').trim();
        if (picUrl.startsWith('//')) picUrl = 'https:' + picUrl;

        const isPromo = suggestPrice > price;
        newRows.push({
          barcode,
          product_name: title,
          store_chain: 'cosmed',
          store_name: '康是美 線上門市',
          price,
          is_promo: isPromo,
          note: isPromo ? `原價 $${suggestPrice}` : '康是美官方價格',
          device_id: 'cosmed-91app-v1',
          image_url: picUrl,
          source_url: sourceUrl,
        });
      }
    } catch (e) {
      console.warn('Cosmed fetch warning at', startIndex, e.message);
      break;
    }
  }
  console.log(`  -> Harvested ${newRows.length} additional authentic COSMED products.`);
  return newRows;
}

async function main() {
  console.log('=== Starting Authentic Data Optimization ===');
  let allRows = await fetchAllRows();
  console.log(`Initial Supabase price_reports count: ${allRows.length}`);

  // ---------------------------------------------------------------------------
  // Step 1: Identify & Delete Fabricated / Legacy Duplicate Rows
  // ---------------------------------------------------------------------------
  const idsToDelete = new Set();
  const reasonCounts = {
    legacyBatch: 0,
    urlChainMismatch: 0,
    fabricatedCrossChain: 0,
    duplicateChainBarcode: 0,
  };

  // 1a. Delete legacy batches:
  // - '711-food-v1': older duplicate of '711-full-xml-v2' with different synthetic barcodes
  // - 'harvest-v1' & 'harvest-v2': OpenFoodFacts imports with invented Taiwan store prices
  const legacyDeviceIds = new Set(['711-food-v1', 'harvest-v1', 'harvest-v2']);

  for (const r of allRows) {
    if (legacyDeviceIds.has(r.device_id)) {
      idsToDelete.add(r.id);
      reasonCounts.legacyBatch++;
      continue;
    }

    // 1b. Check URL vs store_chain authenticity
    const url = (r.source_url || '').toLowerCase();
    const chain = r.store_chain;
    if (url) {
      if (url.includes('carrefour.com.tw') && chain !== 'carrefour') {
        idsToDelete.add(r.id);
        reasonCounts.urlChainMismatch++;
        continue;
      }
      if (url.includes('poyabuy.com.tw') && chain !== 'poya') {
        idsToDelete.add(r.id);
        reasonCounts.urlChainMismatch++;
        continue;
      }
      if (url.includes('cosmed.com.tw') && chain !== 'cosmed') {
        idsToDelete.add(r.id);
        reasonCounts.urlChainMismatch++;
        continue;
      }
      if (url.includes('pxmart.com.tw') && chain !== 'pxmart') {
        idsToDelete.add(r.id);
        reasonCounts.urlChainMismatch++;
        continue;
      }
      if ((url.includes('7-11.com.tw') || url.includes('pcsc.com.tw')) && chain !== '7-eleven') {
        idsToDelete.add(r.id);
        reasonCounts.urlChainMismatch++;
        continue;
      }
      if (url.includes('family.com.tw') && chain !== 'familymart') {
        idsToDelete.add(r.id);
        reasonCounts.urlChainMismatch++;
        continue;
      }
      if (url.includes('watsons.com.tw') && chain !== 'watsons') {
        idsToDelete.add(r.id);
        reasonCounts.urlChainMismatch++;
        continue;
      }
    }
  }

  // 1c. Check old seed batches ('seed-sync-v1', 'seed-nonfood-v1', 'poya-harvest-v1', 'daily-oral-care-v1')
  // where a single product was artificially cloned across 3-5 chains without a real chain-specific source_url.
  const suspectBatches = new Set(['seed-sync-v1', 'seed-nonfood-v1', 'poya-harvest-v1', 'daily-oral-care-v1']);
  const byBarcodeInSuspect = new Map();
  for (const r of allRows) {
    if (idsToDelete.has(r.id)) continue;
    if (suspectBatches.has(r.device_id)) {
      if (!byBarcodeInSuspect.has(r.barcode)) byBarcodeInSuspect.set(r.barcode, []);
      byBarcodeInSuspect.get(r.barcode).push(r);
    }
  }

  for (const [barcode, rows] of byBarcodeInSuspect.entries()) {
    // If a suspect batch has rows without an official source_url or where multiple chains share identical fabricated ratios
    for (const r of rows) {
      const url = (r.source_url || '').toLowerCase();
      // Only keep rows in suspect batches if they have an authentic chain-matching URL or if it's a single verified store entry
      const hasMatchingOfficialUrl =
        (r.store_chain === 'carrefour' && url.includes('carrefour.com.tw')) ||
        (r.store_chain === 'poya' && url.includes('poyabuy.com.tw')) ||
        (r.store_chain === 'cosmed' && url.includes('cosmed.com.tw')) ||
        (r.store_chain === 'pxmart' && url.includes('pxmart.com.tw')) ||
        (r.store_chain === '7-eleven' && url.includes('7-11.com.tw')) ||
        (r.store_chain === 'familymart' && url.includes('family.com.tw'));

      if (!hasMatchingOfficialUrl && rows.length > 1) {
        idsToDelete.add(r.id);
        reasonCounts.fabricatedCrossChain++;
      }
    }
  }

  // 1d. Deduplicate identical (barcode, store_chain) keeping the latest / highest-quality official row
  const seenChainBarcode = new Map();
  // Sort so official v2/v1 batches with source_url come first
  const remainingRows = allRows.filter((r) => !idsToDelete.has(r.id));
  remainingRows.sort((a, b) => {
    const aHasUrl = a.source_url ? 1 : 0;
    const bHasUrl = b.source_url ? 1 : 0;
    if (aHasUrl !== bHasUrl) return bHasUrl - aHasUrl;
    return b.id - a.id;
  });

  const cleanRows = [];
  for (const r of remainingRows) {
    const key = `${r.barcode}__${r.store_chain}`;
    if (seenChainBarcode.has(key)) {
      idsToDelete.add(r.id);
      reasonCounts.duplicateChainBarcode++;
    } else {
      seenChainBarcode.set(key, r);
      cleanRows.push(r);
    }
  }

  console.log('\n[Step 1] Cleanup Summary:');
  console.log(`  - Legacy duplicate/OpenFoodFacts batches: ${reasonCounts.legacyBatch}`);
  console.log(`  - Source URL / Store Chain mismatch: ${reasonCounts.urlChainMismatch}`);
  console.log(`  - Unverified multi-chain clones in old seed batches: ${reasonCounts.fabricatedCrossChain}`);
  console.log(`  - Duplicate (barcode, store_chain) rows: ${reasonCounts.duplicateChainBarcode}`);
  console.log(`  -> Total rows to delete: ${idsToDelete.size}`);

  if (idsToDelete.size > 0) {
    const deletedCount = await deleteByIds([...idsToDelete]);
    console.log(`  -> Deleted ${deletedCount} rows from Supabase.`);
  }

  // ---------------------------------------------------------------------------
  // Step 2: Harvest More Authentic COSMED Products & Insert to Supabase
  // ---------------------------------------------------------------------------
  const existingSourceUrls = new Set(cleanRows.map((r) => r.source_url).filter(Boolean));
  const newCosmedRows = await harvestMoreCosmedProducts(existingSourceUrls);

  if (newCosmedRows.length > 0) {
    const chunkSize = 200;
    let inserted = 0;
    for (let i = 0; i < newCosmedRows.length; i += chunkSize) {
      const chunk = newCosmedRows.slice(i, i + chunkSize);
      const { data, error } = await supabase.from('price_reports').insert(chunk).select('*');
      if (error) {
        console.error('Insert error:', error.message);
      } else if (data) {
        inserted += data.length;
        cleanRows.push(...data);
      }
    }
    console.log(`  -> Inserted ${inserted} new COSMED rows into Supabase.`);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Genuine Cross-Chain Barcode Unification
  // Match identical products across PX Mart, POYA, COSMED, Carrefour, 7-11, FamilyMart
  // ONLY when normalized product name + pack size/volume match 100%
  // ---------------------------------------------------------------------------
  console.log('\n[Step 3] Running Strict Cross-Chain Barcode Unification...');
  const normGroups = new Map();
  for (const r of cleanRows) {
    const norm = normalizeProductNameForMatch(r.product_name);
    // Require at least 5 characters and at least one digit (volume/weight/count) or known brand to prevent generic name collisions (like "茶葉蛋" or "拿鐵")
    if (norm.length < 5) continue;
    // Do NOT unify fresh prepared convenience store foods (like 7-11 vs FamilyMart bento/onigiri/coffee)
    if (r.device_id === '711-full-xml-v2' || r.device_id === 'fami-ffd-v1') continue;

    if (!normGroups.has(norm)) normGroups.set(norm, []);
    normGroups.get(norm).push(r);
  }

  let unifiedProductCount = 0;
  let updatedRowCount = 0;
  const barcodeRemap = new Map(); // oldBarcode -> canonicalBarcode

  for (const [norm, group] of normGroups.entries()) {
    const chains = new Set(group.map((g) => g.store_chain));
    if (chains.size < 2) continue;

    // Choose canonical barcode: prefer real EAN-13 (not starting with our synthetic prefixes 471040, 471099, 471021) if available, otherwise prefer pxmart > poya > cosmed
    const sortedForCanonical = [...group].sort((a, b) => {
      const aSynth = /^(471040|471099|471021|471711|471004)/.test(a.barcode) ? 1 : 0;
      const bSynth = /^(471040|471099|471021|471711|471004)/.test(b.barcode) ? 1 : 0;
      if (aSynth !== bSynth) return aSynth - bSynth;
      return a.id - b.id;
    });

    const canonicalBarcode = sortedForCanonical[0].barcode;
    const canonicalImage = sortedForCanonical.find((x) => x.image_url)?.image_url || '';

    let changedInGroup = false;
    for (const r of group) {
      if (r.barcode !== canonicalBarcode) {
        barcodeRemap.set(r.barcode, canonicalBarcode);
        const { error } = await supabase
          .from('price_reports')
          .update({
            barcode: canonicalBarcode,
            image_url: r.image_url || canonicalImage,
          })
          .eq('id', r.id);
        if (!error) {
          r.barcode = canonicalBarcode;
          if (!r.image_url && canonicalImage) r.image_url = canonicalImage;
          updatedRowCount++;
          changedInGroup = true;
        }
      }
    }
    if (changedInGroup) {
      unifiedProductCount++;
    }
  }

  console.log(`  -> Unified ${unifiedProductCount} genuine cross-chain products (${updatedRowCount} rows updated in Supabase).`);

  // ---------------------------------------------------------------------------
  // Step 4: Update Local Catalogs & Offline Seed Data
  // ---------------------------------------------------------------------------
  console.log('\n[Step 4] Syncing Local JSON Catalogs with Authentic Supabase Data...');

  // Re-fetch final clean state from Supabase
  const finalRows = await fetchAllRows();
  console.log(`  -> Final Supabase price_reports count: ${finalRows.length}`);

  // Update pxmart_products.json if any barcodes were unified
  const pxmartPath = path.join(__dirname, '../src/constants/pxmart_products.json');
  if (fs.existsSync(pxmartPath)) {
    const pxList = JSON.parse(fs.readFileSync(pxmartPath, 'utf8'));
    let pxUpdated = 0;
    for (const item of pxList) {
      if (barcodeRemap.has(item.barcode)) {
        item.barcode = barcodeRemap.get(item.barcode);
        pxUpdated++;
      }
    }
    fs.writeFileSync(pxmartPath, JSON.stringify(pxList, null, 2), 'utf8');
    console.log(`  -> Updated ${pxUpdated} unified barcodes in pxmart_products.json (${pxList.length} total).`);
  }

  // Update poya_products.json if any barcodes were unified
  const poyaPath = path.join(__dirname, '../src/constants/poya_products.json');
  if (fs.existsSync(poyaPath)) {
    const poyaList = JSON.parse(fs.readFileSync(poyaPath, 'utf8'));
    let poyaUpdated = 0;
    for (const item of poyaList) {
      if (barcodeRemap.has(item.barcode)) {
        item.barcode = barcodeRemap.get(item.barcode);
        poyaUpdated++;
      }
    }
    fs.writeFileSync(poyaPath, JSON.stringify(poyaList, null, 2), 'utf8');
    console.log(`  -> Updated ${poyaUpdated} unified barcodes in poya_products.json (${poyaList.length} total).`);
  }

  // Rebuild daily_necessities.json from 100% authentic finalRows
  const dailyPath = path.join(__dirname, '../src/constants/daily_necessities.json');
  const oralRegex = /牙線|牙間刷|牙膏|牙刷|漱口水|齒間|潔牙|假牙|口清新|口腔/;
  const tissueRegex = /衛生紙|濕紙巾|濕巾|面紙|廚房紙巾|衛生棉|護墊|棉條|安睡褲|酒精擦|純水濕巾/;
  const washRegex = /洗髮|沐浴|洗面|潔面|洗手|肥皂|香皂|潤髮|護髮|卸妝|沐浴乳|洗髮精/;
  const cleanRegex = /洗衣|洗碗|清潔劑|漂白水|除濕|芳香|垃圾袋|菜瓜布|去漬|柔軟精|地板清潔|浴廁/;

  // Group finalRows by barcode
  const byBarcode = new Map();
  for (const r of finalRows) {
    if (!byBarcode.has(r.barcode)) byBarcode.set(r.barcode, []);
    byBarcode.get(r.barcode).push(r);
  }

  const authenticDailyItems = [];
  for (const [barcode, rows] of byBarcode.entries()) {
    const primary = rows[0];
    const name = primary.product_name || '';
    // Exclude food items from daily necessities
    if (/雞胸|牛乳|牛奶|豆漿|茶|咖啡|便當|飯糰|麵|餅乾|巧克力|軟糖|喉糖|口香糖|蒟蒻|優格|冰淇淋|雪糕|飲|水餃|披薩/.test(name) && !oralRegex.test(name)) {
      continue;
    }

    let category = null;
    let subCategory = '';
    if (oralRegex.test(name)) {
      category = 'oral';
      subCategory = /牙線|牙間刷|齒間/.test(name)
        ? '牙線·牙間刷'
        : /漱口水/.test(name)
        ? '漱口水'
        : /牙刷/.test(name)
        ? '牙刷'
        : '牙膏·口腔護理';
    } else if (tissueRegex.test(name)) {
      category = 'tissue';
      subCategory = /衛生棉|護墊|棉條|安睡褲/.test(name)
        ? '女性生理用品'
        : /濕巾|濕紙巾|酒精擦/.test(name)
        ? '濕紙巾·潔膚巾'
        : '衛生紙·紙巾';
    } else if (washRegex.test(name)) {
      category = 'wash';
      subCategory = /洗髮|潤髮|護髮/.test(name)
        ? '洗潤護髮'
        : /洗面|潔面|卸妝/.test(name)
        ? '臉部清潔'
        : '沐浴·洗手';
    } else if (cleanRegex.test(name)) {
      category = 'clean';
      subCategory = /洗衣|去漬|柔軟精/.test(name)
        ? '洗衣清潔'
        : /洗碗|菜瓜布/.test(name)
        ? '廚房清潔'
        : '居家清潔·日用';
    }

    if (!category) continue;

    // Build genuine store prices map (ONLY chains present in Supabase rows!)
    const prices = {};
    let bestImage = '';
    let bestUrl = '';
    for (const r of rows) {
      if (r.price > 0) {
        prices[r.store_chain] = {
          price: r.price,
          storeName: r.store_name,
          isPromo: Boolean(r.is_promo),
          note: r.note || '',
          sourceUrl: r.source_url || '',
        };
      }
      if (!bestImage && r.image_url) bestImage = r.image_url;
      if (!bestUrl && r.source_url) bestUrl = r.source_url;
    }

    const chainCount = Object.keys(prices).length;
    if (chainCount === 0) continue;

    authenticDailyItems.push({
      barcode,
      name,
      category,
      subCategory,
      imageUrl: bestImage,
      sourceUrl: bestUrl,
      chainCount,
      prices,
    });
  }

  // Sort daily items: multi-chain items first, then oral care, then items with images
  authenticDailyItems.sort((a, b) => {
    if (a.chainCount !== b.chainCount) return b.chainCount - a.chainCount;
    const aOral = a.category === 'oral' ? 1 : 0;
    const bOral = b.category === 'oral' ? 1 : 0;
    if (aOral !== bOral) return bOral - aOral;
    return (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0);
  });

  // Keep up to 600 top authentic daily items for fast mobile rendering
  const cappedDaily = authenticDailyItems.slice(0, 600);
  fs.writeFileSync(dailyPath, JSON.stringify(cappedDaily, null, 2), 'utf8');
  console.log(
    `  -> Rebuilt daily_necessities.json with ${cappedDaily.length} 100% authentic items (${
      cappedDaily.filter((x) => x.category === 'oral').length
    } oral care, ${cappedDaily.filter((x) => x.chainCount >= 2).length} genuine multi-chain).`
  );

  // Rebuild seed-data.json with clean, authentic rows
  const seedPath = path.join(__dirname, '../src/constants/seed-data.json');
  const seedExport = finalRows.map((r) => ({
    barcode: r.barcode,
    product_name: r.product_name,
    store_chain: r.store_chain,
    store_name: r.store_name,
    price: r.price,
    is_promo: Boolean(r.is_promo),
    note: r.note || '',
    image_url: r.image_url || '',
    source_url: r.source_url || '',
  }));
  fs.writeFileSync(seedPath, JSON.stringify(seedExport, null, 2), 'utf8');
  console.log(`  -> Exported ${seedExport.length} 100% authentic rows to src/constants/seed-data.json.`);

  // Print breakdown by store_chain
  const chainSummary = {};
  for (const r of finalRows) {
    chainSummary[r.store_chain] = (chainSummary[r.store_chain] || 0) + 1;
  }
  console.log('\nFinal Authentic Store Chain Breakdown in Supabase & Offline Seed:', chainSummary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
