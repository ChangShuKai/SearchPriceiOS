/**
 * Harvests authentic Watsons Taiwan (屈臣氏) daily necessities using the
 * API operation learned by api-anything (~/.api-anything/sites/watsons-tw.json).
 *
 * Includes real 13-digit EAN/GTIN barcodes (`ean`), product names, images,
 * prices, original prices, and promotion tags, and syncs them into:
 *   1. Supabase `price_reports` (with cross-chain EAN barcode unification)
 *   2. `src/constants/daily_necessities.json` (DailyNecessityItem schema)
 *   3. `src/constants/seed-data.json`
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Load learned headers from ~/.api-anything/sites/watsons-tw.json
const specPath = path.join(os.homedir(), '.api-anything', 'sites', 'watsons-tw.json');
let learnedHeaders = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'cache-control': 'no-cache, no-store, must-revalidate, post-check=0, pre-check=0',
  'origin': 'https://www.watsons.com.tw',
  'referer': 'https://www.watsons.com.tw/',
  'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
};
if (fs.existsSync(specPath)) {
  try {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    if (spec.operations?.[0]?.request?.headers) {
      learnedHeaders = { ...learnedHeaders, ...spec.operations[0].request.headers };
    }
  } catch (_) {}
}

function fetchWatsonsSearch(query, currentPage = 0, pageSize = 64) {
  return new Promise((resolve) => {
    const url = `https://api.watsons.com.tw/api/v2/wtctw/products/search?fields=FULL&query=${encodeURIComponent(query)}&pageSize=${pageSize}&currentPage=${currentPage}&sort=mostRelevant&brandRedirect=true&ignoreSort=false&skipRedirect=false&lang=zh_TW&curr=TWD`;
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        ...learnedHeaders,
        'queue-target': `https://www.watsons.com.tw/search?text=${encodeURIComponent(query)}`,
      },
      timeout: 12000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, json: null });
        }
      });
    });
    req.on('error', () => resolve({ status: 0, json: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, json: null }); });
    req.end();
  });
}

function normalizeStrictProductKey(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, ' ')
    .replace(/買一送一|買1送1|第2件[^/\s]*|任選[^/\s]*|廠商直送|門市限定|屈臣氏|寶雅|康是美|家樂福|全聯|好市多/g, ' ')
    .replace(/毫升|公撮/g, 'ml')
    .replace(/公克/g, 'g')
    .replace(/公斤/g, 'kg')
    .replace(/公升/g, 'l')
    .replace(/公尺/g, 'm')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
    .trim();
}

const EXCLUDE_FOOD_OR_PET_RE =
  /貓|狗|犬|寵物|飼料|罐頭|零食|餅乾|巧克力|糖果|飲料|咖啡|奶茶|茶葉|泡麵|水餃|冰淇淋|蛋糕|コンドーム|保險套|衛生套|潤滑|跳蛋|按摩棒|飛機杯|情趣|隱形眼鏡|美瞳|染髮|指甲油|假睫毛|眼影|唇膏|口紅|粉底|腮紅|眉筆|眼線|遮瑕|香水|吸塵器|洗衣機|烘碗機|冷氣|除濕機|電風扇|電蚊拍|捕蚊拍|電鬍刀|鼻毛|行李秤|喇叭|相機|手電筒|玩偶|公仔|吊飾|貼紙|紅包|春聯|髮箍|髮夾|耳環|項鍊|戒指|手鍊|襪|內褲|胸罩/;

function classifyDailyCategory(name) {
  if (!name) return null;
  const s = String(name);
  if (EXCLUDE_FOOD_OR_PET_RE.test(s)) return null;

  // 1. 電池 (Batteries) -> 居家清潔·生活百貨
  if (
    /(電池|鹼性電池|碳鋅電池|鈕扣電池|充電電池|水銀電池|鋰電池|CR2032|CR2025|CR2016|LR44|eneloop|金頂|勁量|永備|東芝電池|國際牌電池|富士通電池)/i.test(
      s,
    ) &&
    !/電動牙刷|洗臉機|導入儀|刮鬍刀|除毛刀|體重計|耳溫槍|血壓計/.test(s)
  ) {
    return '居家清潔·生活百貨';
  }

  // 2. 口腔護理·牙線牙膏
  if (
    /(牙線|牙線棒|牙間刷|齒間刷|牙膏|牙刷|漱口水|電動牙刷|替換刷頭|口腔噴霧|口氣清新|潔牙|固齒|舒酸定|好來|黑人牙膏|高露潔|歐樂B|Oral-B|麗奇|Reach|G\.U\.M|李施德霖|刷樂|牙周|舌苔|假牙清潔|保麗淨)/i.test(
      s,
    )
  ) {
    return '口腔護理·牙線牙膏';
  }

  // 3. 紙品濕巾·衛生棉
  if (
    /(衛生紙|抽取式|面紙|廚房紙巾|擦手紙|紙手帕|袖珍包|濕巾|濕紙巾|濕式衛生紙|衛生棉|護墊|棉條|安睡褲|夜用褲|熟睡褲|生理褲|化妝棉|棉花棒|棉棒|舒潔|五月花|春風|倍潔雅|蒲公英|靠得住|蘇菲|蕾妮亞|好自在|康乃馨)/i.test(
      s,
    )
  ) {
    return '紙品濕巾·衛生棉';
  }

  // 4. 洗沐清潔·個人護理
  if (
    /(沐浴乳|沐浴露|沐浴慕斯|香浴乳|潔膚露|沐浴精|沐浴膠|沐浴油|沐浴鹽|浴鹽|泡澡|肥皂|香皂|藥皂|洗面乳|洗顏|潔顏|潔面|洗手乳|洗手慕斯|洗手露|乾洗手|洗髮精|洗髮乳|洗髮露|潤髮乳|護髮|髮膜|髮油|養髮|卸妝|卸粧|身體乳|潤膚乳|護手霜|體香|止汗|爽身|刮鬍|除毛|私密潔淨|私密洗|生理食鹽水|痘痘貼|OK繃)/i.test(
      s,
    )
  ) {
    return '洗沐清潔·個人護理';
  }

  // 5. 居家清潔·生活百貨
  if (
    /(洗衣精|洗衣粉|洗衣球|洗衣膠囊|洗衣皂|柔軟精|衣物柔軟|香氛豆|漂白水|彩漂|衣領精|去漬|洗碗精|洗潔精|蔬果洗潔|廚房清潔|浴廁清潔|馬桶清潔|洁廁|地板清潔|玻璃清潔|多用途清潔|除霉|去黴|水垢|水管疏通|小蘇打|檸檬酸|過碳酸鈉|菜瓜布|海綿|科技海綿|抹布|百潔布|拖把|除塵紙|靜電拖|黏毛滾輪|垃圾袋|保鮮膜|保鮮袋|密封袋|夾鏈袋|鋁箔紙|烘焙紙|免洗|樟腦|防蚊|驅蚊|防蟲|殺蟲|蟑螂|螞蟻|果蠅|除濕盒|除濕袋|除濕桶|克潮靈|芳香劑|消臭|除臭|酒精|消毒)/i.test(
      s,
    )
  ) {
    return '居家清潔·生活百貨';
  }

  return null;
}

const WATSONS_KEYWORDS = [
  // 1. 電池
  '電池', '鹼性電池', '碳鋅電池', '鈕扣電池', '充電電池', '3號電池', '4號電池', '勁量', '金頂', '永備',
  // 2. 牙線 / 口腔護理
  '牙線', '牙線棒', '牙間刷', '牙膏', '牙刷', '漱口水', '電動牙刷', '口腔噴霧', '假牙清潔', '3M牙線', '歐樂B', '麗奇', '刷樂', '舒酸定', '高露潔', '好來', '李施德霖',
  // 3. 紙品 / 濕巾 / 衛生棉
  '衛生紙', '抽取式衛生紙', '面紙', '廚房紙巾', '濕紙巾', '濕巾', '抗菌濕巾', '純水濕巾', '衛生棉', '護墊', '夜用衛生棉', '安睡褲', '棉條', '化妝棉', '棉花棒', '紙手帕', '舒潔', '蘇菲', '靠得住', '蕾妮亞', '好自在',
  // 4. 洗沐清潔 / 個人護理
  '沐浴乳', '沐浴露', '沐浴慕斯', '香浴乳', '香皂', '肥皂', '洗手乳', '洗手慕斯', '洗髮精', '洗髮露', '潤髮乳', '護髮素', '髮膜', '洗面乳', '潔顏乳', '洗顏慕斯', '卸妝水', '卸妝油', '身體乳', '護手霜', '止汗', '體香', '刮鬍刀', '刮鬍泡', '乾洗手', '私密清潔', '生理食鹽水', '痘痘貼', '多芬', '澎澎', '蜜妮', '麗仕', '美琪', '沙威隆', '施巴',
  // 5. 居家清潔 / 生活百貨
  '洗衣精', '洗衣球', '洗衣膠囊', '柔軟精', '漂白水', '衣領精', '洗碗精', '除濕', '除濕袋', '防蚊', '殺蟲', '垃圾袋', '保鮮膜', '保鮮袋', '菜瓜布', '海綿', '抹布', '馬桶清潔', '浴廁清潔', '地板清潔', '廚房清潔', '水管疏通', '酒精', '芳香劑', '消臭'
];

async function fetchAllPriceReports() {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('price_reports')
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log('=== [1/4] 透過 api-anything watsons-tw 規格擷取屈臣氏真實日常用品 ===');
  const watsonsMap = new Map();

  for (let i = 0; i < WATSONS_KEYWORDS.length; i += 6) {
    const batch = WATSONS_KEYWORDS.slice(i, i + 6);
    await Promise.all(
      batch.map(async (kw) => {
        for (let page = 0; page < 2; page++) {
          const res = await fetchWatsonsSearch(kw, page, 64);
          if (res.status !== 200 || !res.json || !Array.isArray(res.json.products)) break;
          const products = res.json.products;
          if (products.length === 0) break;

          for (const p of products) {
            const title = (p.elabProductName || p.name || '').trim();
            const price = Math.round(
              Number(p.price?.value || p.elabMarkDownPrice?.value || p.elabPrice?.value || 0),
            );
            if (!title || price <= 0 || price > 4000) continue;
            const cat = classifyDailyCategory(title);
            if (!cat) continue;

            const ean =
              p.ean && /^\d{8,14}$/.test(String(p.ean).trim())
                ? String(p.ean).trim()
                : null;
            if (!ean) continue; // Keep authentic EAN items

            if (!watsonsMap.has(ean)) {
              const origPrice = Math.round(
                Number(p.elabOldPrice?.value || p.strikeThroughPrice || price),
              );
              const promoTag = p.promotionFirstTag || p.topPromotion?.tag?.label || '';
              let imgUrl = p.images?.[0]?.url || null;
              if (imgUrl && imgUrl.startsWith('/')) {
                imgUrl = `https://medias.watsons.com.tw${imgUrl}`;
              }
              const prodUrl = p.url
                ? p.url.startsWith('http')
                  ? p.url
                  : `https://www.watsons.com.tw${p.url}`
                : 'https://www.watsons.com.tw/';

              let storeLabel = '屈臣氏 Watsons 門市';
              if (origPrice > price && promoTag) {
                storeLabel = `屈臣氏 Watsons (原價$${origPrice}·${promoTag})`;
              } else if (origPrice > price) {
                storeLabel = `屈臣氏 Watsons (原價$${origPrice})`;
              } else if (promoTag) {
                storeLabel = `屈臣氏 Watsons (${promoTag})`;
              }

              watsonsMap.set(ean, {
                barcode: ean,
                name: title,
                price,
                originalPrice: origPrice > price ? origPrice : price,
                promoTag,
                category: cat,
                store_name: storeLabel,
                image_url: imgUrl,
                source_url: prodUrl,
              });
            }
          }
          const totalPages = Number(res.json.pagination?.totalPages || 1);
          if (page + 1 >= totalPages) break;
        }
      }),
    );
    process.stdout.write(
      `   已掃描關鍵字 ${Math.min(i + 6, WATSONS_KEYWORDS.length)}/${WATSONS_KEYWORDS.length}，累計屈臣氏日常用品: ${watsonsMap.size} 項\r`,
    );
  }

  console.log(`\n-> 屈臣氏 (Watsons) 共擷取 ${watsonsMap.size} 項具官方國際條碼 (EAN) 之日常用品！`);

  console.log('\n=== [2/4] 載入現有 Supabase price_reports 並同步屈臣氏資料 ===');
  const allRows = await fetchAllPriceReports();
  console.log(`   目前 Supabase price_reports 共有 ${allRows.length} 筆紀錄。`);

  const existingChainBarcodes = new Set();
  for (const r of allRows) {
    existingChainBarcodes.add(`${r.barcode}__${r.store_chain}`);
  }

  const nowIso = new Date().toISOString();
  const toInsert = [];
  for (const item of watsonsMap.values()) {
    const chainKey = `${item.barcode}__watsons`;
    if (existingChainBarcodes.has(chainKey)) continue;
    existingChainBarcodes.add(chainKey);
    toInsert.push({
      id: crypto.randomUUID(),
      barcode: item.barcode,
      product_name: item.name,
      price: item.price,
      store_chain: 'watsons',
      store_name: item.store_name,
      latitude: null,
      longitude: null,
      reported_at: nowIso,
      device_id: 'watsons-api-anything-v1',
      image_url: item.image_url,
      source_url: item.source_url,
    });
  }

  console.log(`   準備新增寫入 ${toInsert.length} 筆屈臣氏真實價格紀錄至 Supabase...`);
  let uploaded = 0;
  for (let i = 0; i < toInsert.length; i += 250) {
    const batch = toInsert.slice(i, i + 250);
    const { error } = await supabase.from('price_reports').insert(batch);
    if (error) {
      console.error('Insert batch error:', error.message);
    } else {
      uploaded += batch.length;
      allRows.push(...batch);
      process.stdout.write(`   已上傳 ${uploaded}/${toInsert.length} 筆至 Supabase...\r`);
    }
  }
  console.log(`\n-> 成功新增 ${uploaded} 筆屈臣氏紀錄至 Supabase (總計 ${allRows.length} 筆)！`);

  console.log('\n=== [3/4] 執行跨通路同名同規格商品真實 EAN 條碼對齊 (Unification) ===');
  const normGroups = new Map();
  for (const r of allRows) {
    if (
      r.device_id === '711-full-xml-v2' ||
      r.device_id === 'fami-ffd-v1' ||
      r.device_id === 'fm-full-sync-v3' ||
      r.device_id === '711-full-sync-v3'
    ) {
      continue;
    }
    const norm = normalizeStrictProductKey(r.product_name);
    if (norm.length < 4 || !/\d/.test(norm)) continue;
    if (!normGroups.has(norm)) normGroups.set(norm, []);
    normGroups.get(norm).push(r);
  }

  let unifiedGroups = 0;
  for (const [, group] of normGroups.entries()) {
    const chains = new Set(group.map((g) => g.store_chain));
    if (chains.size < 2) continue;

    // Prefer real manufacturer EAN barcodes (like Watsons' ean) over synthetic prefixes
    const sorted = [...group].sort((a, b) => {
      const aSynth = /^(471040|471099|471021|471014|471018)/.test(a.barcode) ? 1 : 0;
      const bSynth = /^(471040|471099|471021|471014|471018)/.test(b.barcode) ? 1 : 0;
      if (aSynth !== bSynth) return aSynth - bSynth;
      return String(a.id).localeCompare(String(b.id));
    });

    const canonicalBarcode = sorted[0].barcode;
    const canonicalImg = sorted.find((x) => x.image_url)?.image_url || null;
    let groupChanged = false;

    for (const r of group) {
      if (r.barcode !== canonicalBarcode || (!r.image_url && canonicalImg)) {
        r.barcode = canonicalBarcode;
        if (!r.image_url && canonicalImg) r.image_url = canonicalImg;
        groupChanged = true;
        await supabase
          .from('price_reports')
          .update({ barcode: canonicalBarcode, image_url: r.image_url })
          .eq('id', r.id);
      }
    }
    if (groupChanged) unifiedGroups++;
  }
  console.log(`   已完成 ${unifiedGroups} 組跨通路商品真實 EAN 條碼與圖片統一！`);

  // Deduplicate any (barcode, store_chain) collisions
  const seenBC = new Map();
  const dupIds = [];
  const cleanAllRows = [];
  for (const r of allRows) {
    const k = `${r.barcode}__${r.store_chain}`;
    if (seenBC.has(k)) {
      dupIds.push(r.id);
    } else {
      seenBC.set(k, r);
      cleanAllRows.push(r);
    }
  }
  if (dupIds.length > 0) {
    for (let i = 0; i < dupIds.length; i += 250) {
      await supabase.from('price_reports').delete().in('id', dupIds.slice(i, i + 250));
    }
    console.log(`   已清理 ${dupIds.length} 筆重複 (barcode, store_chain) 紀錄。`);
  }

  console.log('\n=== [4/4] 重建 src/constants/daily_necessities.json 與 src/constants/seed-data.json ===');
  const byBarcode = new Map();
  for (const r of cleanAllRows) {
    if (!byBarcode.has(r.barcode)) byBarcode.set(r.barcode, []);
    byBarcode.get(r.barcode).push(r);
  }

  const dailyList = [];
  for (const [barcode, rows] of byBarcode.entries()) {
    const primary = rows.find((x) => x.image_url) || rows[0];
    const name = primary.product_name || '';
    const category = classifyDailyCategory(name);
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
      if (
        !promotionTag &&
        r.store_name &&
        /原價\$\d+|買一送一|買1送1|第2件|特價|結帳享|折/.test(r.store_name + r.product_name)
      ) {
        const m = (r.store_name + ' ' + r.product_name).match(
          /原價\$\d+|買一送一|買1送1|第2件[^】)\s]*|不限金額結帳享\d+折/,
        );
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
      _isKeyStaple: /電池|牙線|牙間刷|沐浴|香浴|衛生紙|洗衣/.test(name) ? 1 : 0,
    });
  }

  dailyList.sort((a, b) => {
    if (a._chainCount !== b._chainCount) return b._chainCount - a._chainCount;
    if (a._isKeyStaple !== b._isKeyStaple) return b._isKeyStaple - a._isKeyStaple;
    return (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0);
  });

  // Keep up to 750 items per category (up to 3,000 daily necessity products total)
  const countsByCat = {};
  const subCounts = { battery: 0, floss: 0, bodywash: 0, watsons: 0 };
  const balancedDaily = [];

  for (const item of dailyList) {
    const c = item.category;
    countsByCat[c] = (countsByCat[c] || 0) + 1;
    if (countsByCat[c] <= 750) {
      const { _chainCount, _isKeyStaple, ...cleanItem } = item;
      balancedDaily.push(cleanItem);
      if (/電池/.test(cleanItem.name)) subCounts.battery++;
      if (/牙線|牙間刷|齒間/.test(cleanItem.name)) subCounts.floss++;
      if (/沐浴|香浴|潔膚露|肥皂|香皂|洗手/.test(cleanItem.name)) subCounts.bodywash++;
      if (cleanItem.prices.watsons) subCounts.watsons++;
    }
  }

  const dailyOutPath = path.resolve(__dirname, '../src/constants/daily_necessities.json');
  fs.writeFileSync(dailyOutPath, JSON.stringify(balancedDaily, null, 2), 'utf8');
  console.log(`-> 已輸出 src/constants/daily_necessities.json：共 ${balancedDaily.length} 項日常用品！`);
  console.log('   各分類總商品數 (池):', countsByCat);
  console.log('   精選日常用品統計:', subCounts);

  const seedOutPath = path.resolve(__dirname, '../src/constants/seed-data.json');
  const seedExport = cleanAllRows.map((r, idx) => ({
    id: String(r.id || `seed_${r.barcode}_${r.store_chain}_${idx}`),
    barcode: String(r.barcode),
    product_name: String(r.product_name),
    price: Number(r.price),
    store_chain: String(r.store_chain),
    store_name: r.store_name || null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    reported_at: r.reported_at || r.created_at || nowIso,
    device_id: r.device_id || 'seed-authentic-v15',
    image_url: r.image_url || null,
    source_url: r.source_url || null,
  }));
  fs.writeFileSync(seedOutPath, JSON.stringify(seedExport, null, 2), 'utf8');
  console.log(`-> 已輸出 src/constants/seed-data.json：共 ${seedExport.length} 筆完整比價紀錄！`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
