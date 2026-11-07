/**
 * Fix seed-data.json & daily_necessities.json schemas and unify bilingual brand names across PX Mart, POYA, and COSMED
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

/**
 * Strict product normalization that unifies bilingual brand prefixes (e.g. "Oral-B歐樂B" === "歐樂B")
 * while strictly keeping product variant and exact volume/weight/count (e.g. 50m, 160g, 2入).
 */
function normalizeStrictProductKey(name) {
  if (!name) return '';
  let s = name
    .toLowerCase()
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/（顏色隨機[^）]*）/g, '')
    .replace(/\(顏色隨機[^)]*\)/g, '')
    .replace(/（新舊包裝[^）]*）/g, '')
    .replace(/\(新舊包裝[^)]*\)/g, '')
    .replace(/\(包裝隨機[^)]*\)/g, '')
    .replace(/（包裝隨機[^）]*）/g, '')
    // Bilingual brand unification
    .replace(/oral[\s\-]*b\s*歐樂b/g, '歐樂b')
    .replace(/sensodyne\s*舒酸定/g, '舒酸定')
    .replace(/colgate\s*高露潔/g, '高露潔')
    .replace(/listerine\s*李施德霖/g, '李施德霖')
    .replace(/darlie\s*好來/g, '好來')
    .replace(/黑人/g, '好來')
    .replace(/sofy\s*蘇菲/g, '蘇菲')
    .replace(/kotex\s*靠得住/g, '靠得住')
    .replace(/laurier\s*蕾妮亞/g, '蕾妮亞')
    .replace(/whisper\s*好自在/g, '好自在')
    .replace(/biore\s*蜜妮/g, '蜜妮')
    .replace(/kleenex\s*舒潔/g, '舒潔')
    .replace(/scott\s*舒潔/g, '舒潔')
    .replace(/mayflower\s*五月花/g, '五月花')
    .replace(/tempo\s*得寶/g, '得寶')
    .replace(/dove\s*多芬/g, '多芬')
    .replace(/lux\s*麗仕/g, '麗仕')
    .replace(/pantene\s*潘婷/g, '潘婷')
    .replace(/pert\s*飛柔/g, '飛柔')
    .replace(/rejoice\s*飛柔/g, '飛柔')
    .replace(/head\s*&?\s*shoulders\s*海倫仙度絲/g, '海倫仙度絲')
    .replace(/clear\s*淨/g, '淨')
    .replace(/ponds\s*旁氏/g, '旁氏')
    .replace(/senka\s*專科/g, '專科')
    .replace(/mentholatum\s*曼秀雷敦/g, '曼秀雷敦')
    .replace(/nivea\s*妮維雅/g, '妮維雅')
    .replace(/vaseline\s*凡士林/g, '凡士林')
    .replace(/persil\s*寶瀅/g, '寶瀅')
    .replace(/ariel/g, 'ariel')
    .replace(/attack\s*一匙靈/g, '一匙靈')
    .replace(/farcent\s*花仙子/g, '花仙子')
    .replace(/3m\s*百利/g, '3m')
    // Unit normalization
    .replace(/公克/g, 'g')
    .replace(/克/g, 'g')
    .replace(/毫升/g, 'ml')
    .replace(/公升/g, 'l')
    .replace(/公尺/g, 'm')
    .replace(/米/g, 'm')
    .replace(/支入/g, '入')
    .replace(/支\/包/g, '入')
    .replace(/只\/包/g, '入')
    .replace(/入\/包/g, '入')
    .replace(/包入/g, '包')
    .replace(/片入/g, '片')
    .replace(/抽\/包/g, '抽')
    .replace(/[\s\-_・·,，.。/／+＋*＊()（）「」『』~～:：!！?？]/g, '');
  return s;
}

async function main() {
  console.log('Fetching all rows from Supabase...');
  let allRows = await fetchAllRows();
  console.log(`Loaded ${allRows.length} rows.`);

  // 1. Run strict cross-chain barcode unification with bilingual brand normalization
  const normGroups = new Map();
  for (const r of allRows) {
    if (r.device_id === '711-full-xml-v2' || r.device_id === 'fami-ffd-v1' || r.device_id === 'fm-full-sync-v3' || r.device_id === '711-full-sync-v3') {
      continue;
    }
    const norm = normalizeStrictProductKey(r.product_name);
    if (norm.length < 5) continue;
    // Require at least one number/spec in the normalized key so generic names never collide
    if (!/\d/.test(norm)) continue;

    if (!normGroups.has(norm)) normGroups.set(norm, []);
    normGroups.get(norm).push(r);
  }

  let unifiedGroups = 0;
  let updatedRows = 0;
  const barcodeRemap = new Map();

  for (const [norm, group] of normGroups.entries()) {
    const chains = new Set(group.map((g) => g.store_chain));
    if (chains.size < 2) continue;

    // Pick canonical barcode (prefer standard EAN-13 if present, otherwise lowest ID)
    const sorted = [...group].sort((a, b) => {
      const aSynth = /^(471040|471099|471021)/.test(a.barcode) ? 1 : 0;
      const bSynth = /^(471040|471099|471021)/.test(b.barcode) ? 1 : 0;
      if (aSynth !== bSynth) return aSynth - bSynth;
      return String(a.id).localeCompare(String(b.id));
    });

    const canonicalBarcode = sorted[0].barcode;
    const canonicalImage = sorted.find((x) => x.image_url)?.image_url || '';

    let groupChanged = false;
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
          updatedRows++;
          groupChanged = true;
        }
      }
    }
    if (groupChanged) {
      unifiedGroups++;
      console.log(`  [Unified] ${group[0].product_name} -> ${canonicalBarcode} (${[...chains].join(', ')})`);
    }
  }
  console.log(`Unified ${unifiedGroups} additional cross-chain product groups (${updatedRows} rows updated).`);

  // Deduplicate if unifying barcodes created any duplicate (barcode, store_chain)
  const seenKey = new Set();
  const dupIds = [];
  for (const r of allRows) {
    const k = `${r.barcode}__${r.store_chain}`;
    if (seenKey.has(k)) {
      dupIds.push(r.id);
    } else {
      seenKey.add(k);
    }
  }
  if (dupIds.length > 0) {
    await supabase.from('price_reports').delete().in('id', dupIds);
    allRows = allRows.filter((r) => !dupIds.includes(r.id));
    console.log(`Removed ${dupIds.length} duplicate (barcode, store_chain) rows after unification.`);
  }

  // Update pxmart_products.json & poya_products.json if any barcodes remapped
  if (barcodeRemap.size > 0) {
    for (const file of ['pxmart_products.json', 'poya_products.json']) {
      const p = path.join(__dirname, '../src/constants', file);
      if (fs.existsSync(p)) {
        const list = JSON.parse(fs.readFileSync(p, 'utf8'));
        for (const item of list) {
          if (barcodeRemap.has(item.barcode)) {
            item.barcode = barcodeRemap.get(item.barcode);
          }
        }
        fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
      }
    }
  }

  // 2. Build daily_necessities.json matching EXACT DailyNecessityItem TypeScript interface in src/lib/radar-service.ts:
  // {
  //   id: string;
  //   barcode: string;
  //   name: string;
  //   category: '口腔護理·牙線牙膏' | '紙品濕巾·衛生棉' | '洗沐清潔·個人護理' | '居家清潔·生活百貨';
  //   prices: Record<string, number>;
  //   lowestChain: string;
  //   lowestPrice: number;
  //   highestPrice: number;
  //   originalPrice?: number | null;
  //   imageUrl?: string | null;
  //   promotionTag?: string;
  // }
  const oralRegex = /牙線|牙間刷|牙膏|牙刷|漱口水|齒間|潔牙|假牙|口清新|口腔/;
  const tissueRegex = /衛生紙|濕紙巾|濕巾|面紙|廚房紙巾|衛生棉|護墊|棉條|安睡褲|酒精擦|純水濕巾|棉花棒|棉棒|化妝棉/;
  const washRegex = /洗髮|沐浴|洗面|潔面|洗手|肥皂|香皂|潤髮|護髮|卸妝|沐浴乳|洗髮精|身體乳|防曬/;
  const cleanRegex = /洗衣|洗碗|清潔劑|漂白水|除濕|芳香|垃圾袋|菜瓜布|去漬|柔軟精|地板清潔|浴廁|電池|保鮮膜|鋁箔紙/;

  const byBarcode = new Map();
  for (const r of allRows) {
    if (!byBarcode.has(r.barcode)) byBarcode.set(r.barcode, []);
    byBarcode.get(r.barcode).push(r);
  }

  const dailyList = [];
  for (const [barcode, rows] of byBarcode.entries()) {
    const primary = rows[0];
    const name = primary.product_name || '';
    // Exclude food & drinks
    if (/雞胸|牛乳|牛奶|豆漿|茶|咖啡|便當|飯糰|麵|餅乾|巧克力|軟糖|喉糖|口香糖|蒟蒻|優格|冰淇淋|雪糕|飲|水餃|披薩|氣泡水|礦泉水|洋芋片|肉乾|海苔|堅果/.test(name) && !oralRegex.test(name)) {
      continue;
    }

    let category = null;
    if (oralRegex.test(name)) {
      category = '口腔護理·牙線牙膏';
    } else if (tissueRegex.test(name)) {
      category = '紙品濕巾·衛生棉';
    } else if (washRegex.test(name)) {
      category = '洗沐清潔·個人護理';
    } else if (cleanRegex.test(name)) {
      category = '居家清潔·生活百貨';
    }
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
      if (!promotionTag && /買一送一|買1送1|第2件|特價/.test(r.product_name)) {
        const m = r.product_name.match(/買一送一|買1送1|第2件[^】\s]*/);
        if (m) promotionTag = m[0];
      }
    }

    const chainCount = Object.keys(prices).length;
    if (chainCount === 0 || !Number.isFinite(lowestPrice)) continue;

    dailyList.push({
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
      _chainCount: chainCount,
    });
  }

  // Sort each category so multi-chain items and oral floss/interdental items appear first
  dailyList.sort((a, b) => {
    if (a._chainCount !== b._chainCount) return b._chainCount - a._chainCount;
    const aFloss = /牙線|牙間刷/.test(a.name) ? 1 : 0;
    const bFloss = /牙線|牙間刷/.test(b.name) ? 1 : 0;
    if (aFloss !== bFloss) return bFloss - aFloss;
    return (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0);
  });

  // Keep up to 150 items per category (600 total)
  const countsByCat = {};
  const balancedDaily = [];
  for (const item of dailyList) {
    const c = item.category;
    countsByCat[c] = (countsByCat[c] || 0) + 1;
    if (countsByCat[c] <= 150) {
      const { _chainCount, ...cleanItem } = item;
      balancedDaily.push(cleanItem);
    }
  }

  const dailyPath = path.join(__dirname, '../src/constants/daily_necessities.json');
  fs.writeFileSync(dailyPath, JSON.stringify(balancedDaily, null, 2), 'utf8');
  console.log('Rebuilt daily_necessities.json with exact DailyNecessityItem schema. Category counts:', countsByCat);

  // 3. Export seed-data.json matching EXACT PriceReport TypeScript interface in src/lib/db.ts:
  // id, barcode, product_name, price, store_chain, store_name, latitude, longitude, reported_at, device_id, image_url, source_url
  const seedPath = path.join(__dirname, '../src/constants/seed-data.json');
  const nowIso = new Date().toISOString();
  const seedExport = allRows.map((r, idx) => ({
    id: String(r.id || `seed_${r.barcode}_${r.store_chain}_${idx}`),
    barcode: String(r.barcode),
    product_name: String(r.product_name),
    price: Number(r.price),
    store_chain: String(r.store_chain),
    store_name: r.store_name || null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    reported_at: r.reported_at || r.created_at || nowIso,
    device_id: r.device_id || 'seed-authentic-v14',
    image_url: r.image_url || null,
    source_url: r.source_url || null,
  }));
  fs.writeFileSync(seedPath, JSON.stringify(seedExport, null, 2), 'utf8');
  console.log(`Exported ${seedExport.length} rows to src/constants/seed-data.json with full PriceReport schema.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
