/**
 * Full Multi-Chain Daily Necessities Expansion & Cross-Chain Barcode Unification
 * Chains covered:
 * 1. PChome 24h (ecshweb.pchome.com.tw) - Official v3.3 REST API
 * 2. 全聯福利中心 PX Mart (www.pxmart.com.tw) - Life-Will classification & brand promotions
 * 3. 家樂福 Carrefour (online.uni-prosperity.com.tw) - Search catalog across daily keywords
 * 4. 好市多 Costco (www.costco.com.tw) - Official REST API v2
 * 5. 屈臣氏 Watsons (api.watsons.com.tw) - api-anything learned spec with authentic EAN-13 barcodes
 * 6. 康是美 COSMED & 寶雅 POYA - Existing high-volume base catalog
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env
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

const agent = new https.Agent({ keepAlive: true, maxSockets: 25 });

function req(url, options = {}, maxRedirects = 5) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const r = mod.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + u.search,
          method: options.method || 'GET',
          agent: u.protocol === 'https:' ? agent : undefined,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: options.accept || '*/*',
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
            ...(options.headers || {}),
          },
          timeout: options.timeout || 12000,
        },
        (res) => {
          if (
            (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) &&
            res.headers.location &&
            maxRedirects > 0
          ) {
            const next = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, url).href;
            return resolve(req(next, options, maxRedirects - 1));
          }
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: d, url }));
        },
      );
      r.on('error', (e) => resolve({ status: 0, data: '', err: e.message }));
      r.on('timeout', () => {
        r.destroy();
        resolve({ status: 0, data: '', err: 'timeout' });
      });
      if (options.body) r.write(options.body);
      r.end();
    } catch (e) {
      resolve({ status: 0, data: '', err: e.message });
    }
  });
}

function makeDeterministicBarcode(prefix, key) {
  const hash = crypto.createHash('md5').update(String(key)).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16) % 10000000;
  return `${prefix}${String(num).padStart(7, '0')}`;
}

function normalizeStrictProductKey(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, ' ')
    .replace(/買一送一|買1送1|第2件[^/\s]*|任選[^/\s]*|廠商直送|門市限定|屈臣氏|寶雅|康是美|家樂福|全聯|好市多|pchome|24h|獨家/g, ' ')
    .replace(/毫升|公撮/g, 'ml')
    .replace(/公克/g, 'g')
    .replace(/公斤/g, 'kg')
    .replace(/公升/g, 'l')
    .replace(/公尺/g, 'm')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
    .trim();
}

const EXCLUDE_RE =
  /貓|狗|犬|寵物|飼料|罐頭|零食|餅乾|巧克力|糖果|飲料|咖啡|奶茶|茶葉|泡麵|水餃|冰淇淋|蛋糕|コンドーム|保險套|衛生套|潤滑|跳蛋|按摩棒|飛機杯|情趣|隱形眼鏡|美瞳|染髮|指甲油|假睫毛|眼影|唇膏|口紅|粉底|腮紅|眉筆|眼線|遮瑕|香水|吸塵器|洗衣機|烘碗機|冷氣|除濕機|電風扇|電蚊拍|捕蚊拍|電鬍刀|鼻毛|行李秤|喇叭|相機|手電筒|玩偶|公仔|吊飾|貼紙|紅包|春聯|髮箍|髮夾|耳環|項鍊|戒指|手鍊|襪|內褲|胸罩/;

function classifyDailyCategory(name) {
  if (!name) return null;
  const s = String(name);
  if (EXCLUDE_RE.test(s)) return null;

  // 1. 電池 (Batteries) -> 居家清潔·生活百貨
  if (
    /(電池|鹼性電池|碳鋅電池|鈕扣電池|充電電池|水銀電池|鋰電池|CR2032|CR2025|CR2016|LR44|eneloop|金頂|勁量|永備|東芝電池|國際牌電池|富士通電池)/i.test(
      s,
    ) &&
    !/電動牙刷|洗臉機|導入儀|刮鬍刀|除毛刀|體重計|耳溫槍|血壓計|手電筒|時鐘|鬧鐘/.test(s)
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

const SEARCH_KEYWORDS = [
  // 1. 電池系列
  '電池', '鹼性電池', '碳鋅電池', '鈕扣電池', '充電電池', '3號電池', '4號電池', 'CR2032', 'CR2025', 'LR44',
  '金頂電池', '國際牌電池', '勁量電池', '永備電池', '東芝電池', '富士通電池',
  // 2. 牙線 / 口腔護理
  '牙線', '牙線棒', '牙間刷', '齒間刷', '牙膏', '牙刷', '漱口水', '電動牙刷', '3M牙線', '歐樂B牙線',
  '刷樂牙線', '奈森克林', '麗奇牙線', '舒酸定', '高露潔', '好來牙膏', '李施德霖', '假牙清潔錠',
  // 3. 紙品 / 濕巾 / 衛生棉
  '衛生紙', '抽取式衛生紙', '廚房紙巾', '濕紙巾', '濕巾', '純水濕巾', '衛生棉', '護墊', '夜用衛生棉',
  '安睡褲', '棉條', '化妝棉', '棉花棒', '舒潔', '五月花', '春風', '倍潔雅', '蘇菲', '靠得住', '蕾妮亞', '好自在',
  // 4. 洗沐清潔 / 個人護理
  '沐浴乳', '沐浴露', '香浴乳', '香皂', '肥皂', '洗手乳', '洗手慕斯', '洗髮精', '洗髮乳', '潤髮乳',
  '護髮油', '髮膜', '洗面乳', '潔顏乳', '卸妝水', '卸妝油', '身體乳', '護手霜', '刮鬍泡', '多芬沐浴乳',
  '澎澎香浴乳', '蜜妮沐浴乳', '麗仕沐浴乳', '依必朗', '美琪', '沙威隆', '施巴', '海倫仙度絲', '花王洗髮精',
  // 5. 居家清潔 / 洗滌 / 百貨
  '洗衣精', '洗衣球', '洗衣膠囊', '柔軟精', '漂白水', '洗碗精', '洗潔精', '菜瓜布', '抹布', '垃圾袋',
  '保鮮膜', '保鮮袋', '馬桶清潔', '浴廁清潔', '地板清潔', '廚房清潔', '水管疏通', '除濕袋', '防蚊', '殺蟲劑', '消臭'
];

async function harvestPChome() {
  console.log('\n[1/5] 正在從 PChome 24h 官方 API 擷取日常用品...');
  const results = new Map();

  for (let i = 0; i < SEARCH_KEYWORDS.length; i += 5) {
    const batch = SEARCH_KEYWORDS.slice(i, i + 5);
    await Promise.all(
      batch.map(async (kw) => {
        for (let page = 1; page <= 2; page++) {
          const res = await req(
            `https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=${encodeURIComponent(kw)}&page=${page}&sort=rnk/dc`,
            { accept: 'application/json' },
          );
          if (res.status !== 200 || !res.data) break;
          let json = null;
          try {
            json = JSON.parse(res.data);
          } catch {
            break;
          }
          const prods = json?.prods || [];
          if (prods.length === 0) break;

          for (const p of prods) {
            const title = (p.name || '').trim();
            const price = Math.round(Number(p.price || 0));
            if (!title || price <= 0 || price > 5000) continue;
            const cat = classifyDailyCategory(title);
            if (!cat) continue;

            const id = p.Id || '';
            const key = `pchome_${id || title}`;
            if (!results.has(key)) {
              const origPrice = Math.round(Number(p.originPrice || price));
              const img = p.picB ? `https://cs-a.ecimg.tw${p.picB}` : null;
              results.set(key, {
                id: `pchome-${id}`,
                name: title,
                price,
                originalPrice: origPrice > price ? origPrice : price,
                store_chain: 'pchome',
                store_name: origPrice > price ? `PChome 24h (原價$${origPrice})` : 'PChome 24h 購物',
                category: cat,
                imageUrl: img,
                sourceUrl: id ? `https://24h.pchome.com.tw/prod/${id}` : 'https://24h.pchome.com.tw/',
                barcode: makeDeterministicBarcode('471024', `${title}_${id}`),
              });
            }
          }
        }
      }),
    );
    process.stdout.write(`   已掃描關鍵字 ${Math.min(i + 5, SEARCH_KEYWORDS.length)}/${SEARCH_KEYWORDS.length}，累計 PChome 日用品: ${results.size} 項\r`);
  }
  console.log(`\n-> PChome 24h 日常用品收錄完成：共 ${results.size} 項商品！`);
  return Array.from(results.values());
}

async function harvestPXMartLifeWill() {
  console.log('\n[2/5] 正在從全聯福利中心 (PX Mart) 生活誌與各大品牌月擷取商品...');
  const results = new Map();

  const pxUrls = [
    'https://www.pxmart.com.tw/campaign/life-will/classification/個人清潔與美妝、保健用品',
    'https://www.pxmart.com.tw/campaign/life-will/classification/家用清潔品、五金耗材',
    'https://www.pxmart.com.tw/campaign/life-will/classification/家用紙品、衛生棉',
    'https://www.pxmart.com.tw/campaign/life-will/best-buy/本檔必買',
    'https://www.pxmart.com.tw/campaign/life-will/best-buy/抗漲專區',
    'https://www.pxmart.com.tw/campaign/life-will/best-buy/卡友特惠價',
    'https://www.pxmart.com.tw/campaign/life-will/best-buy/買一送一大集合',
    'https://www.pxmart.com.tw/campaign/life-will/brand/超級品牌月-金百利',
    'https://www.pxmart.com.tw/campaign/life-will/brand/超級品牌月-康那香',
    'https://www.pxmart.com.tw/campaign/life-will/brand/超級品牌月-聯合利華',
  ];

  for (const u of pxUrls) {
    const res = await req(u);
    if (res.status !== 200 || !res.data) continue;
    const m = res.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) continue;
    try {
      const json = JSON.parse(m[1]);
      const cats = json?.props?.pageProps?.categories || [];
      for (const c of cats) {
        for (const item of c.group || []) {
          const title = (item.name || '').trim();
          const price = Math.round(Number(item.price || item.memberPrice || 0));
          if (!title || price <= 0 || price > 5000) continue;
          const cat = classifyDailyCategory(title);
          if (!cat) continue;

          const key = `pxmart_${title}`;
          if (!results.has(key)) {
            const origPrice = Math.round(Number(item.suggestPrice || item.originalPrice || price));
            let img = item.picUrl || item.imgUrl || item.image || null;
            if (img && img.startsWith('//')) img = `https:${img}`;
            else if (img && img.startsWith('/')) img = `https://www.pxmart.com.tw${img}`;

            let promo = item.promotion || item.tag || '';
            if (!promo && origPrice > price) promo = `省 $${origPrice - price}`;

            let storeLabel = '全聯福利中心 門市';
            if (promo) storeLabel = `全聯福利中心 (${promo})`;

            results.set(key, {
              id: `pxmart-lw-${makeDeterministicBarcode('471099', title)}`,
              name: title,
              price,
              originalPrice: origPrice > price ? origPrice : price,
              store_chain: 'pxmart',
              store_name: storeLabel,
              category: cat,
              imageUrl: img,
              sourceUrl: u,
              barcode: makeDeterministicBarcode('471099', title),
            });
          }
        }
      }
    } catch (_) {}
  }
  console.log(`-> 全聯福利中心生活誌收錄完成：共 ${results.size} 項新品！`);
  return Array.from(results.values());
}

async function harvestCostcoDeep() {
  console.log('\n[3/5] 正在從好市多 (Costco) 官方 API 深度擷取量販日常消耗品...');
  const results = new Map();

  for (let i = 0; i < SEARCH_KEYWORDS.length; i += 6) {
    const batch = SEARCH_KEYWORDS.slice(i, i + 6);
    await Promise.all(
      batch.map(async (kw) => {
        const u = `https://www.costco.com.tw/rest/v2/taiwan/products/search?fields=FULL&query=${encodeURIComponent(
          kw,
        )}&pageSize=30&lang=zh_TW&curr=TWD`;
        const res = await req(u, { accept: 'application/json' });
        if (res.status !== 200 || !res.data) return;
        try {
          const json = JSON.parse(res.data);
          const prods = json?.products || [];
          for (const p of prods) {
            const title = (p.name || '').trim();
            const price = Math.round(Number(p.price?.value || 0));
            if (!title || price <= 0 || price > 9000) continue;
            const cat = classifyDailyCategory(title);
            if (!cat) continue;

            const code = String(p.code || '');
            const key = `costco_${code || title}`;
            if (!results.has(key)) {
              let img = null;
              if (Array.isArray(p.images) && p.images.length > 0) {
                const primary = p.images.find((x) => x.url?.includes('large') || x.url?.includes('zoom')) || p.images[0];
                const rawUrl = primary.url || '';
                img = rawUrl.startsWith('http') ? rawUrl : `https://www.costco.com.tw${rawUrl}`;
              }
              const prodUrl = p.url
                ? p.url.startsWith('http')
                  ? p.url
                  : `https://www.costco.com.tw${p.url}`
                : `https://www.costco.com.tw/p/${code}`;

              results.set(key, {
                id: `costco-${code}`,
                name: title,
                price,
                originalPrice: price,
                store_chain: 'costco',
                store_name: '好市多 Costco 賣場',
                category: cat,
                imageUrl: img,
                sourceUrl: prodUrl,
                barcode: makeDeterministicBarcode('471018', title),
              });
            }
          }
        } catch (_) {}
      }),
    );
  }
  console.log(`-> 好市多 (Costco) 深度收錄完成：共 ${results.size} 項商品！`);
  return Array.from(results.values());
}

async function harvestCarrefourDeep() {
  console.log('\n[4/5] 正在從家樂福線上購物 (Carrefour) 深度分頁擷取日常用品...');
  const results = new Map();

  for (let i = 0; i < SEARCH_KEYWORDS.length; i += 6) {
    const batch = SEARCH_KEYWORDS.slice(i, i + 6);
    await Promise.all(
      batch.map(async (kw) => {
        // Fetch up to 2 pages (page 1 and page 2)
        for (let pIdx = 0; pIdx <= 1; pIdx++) {
          const start = pIdx * 24;
          const u =
            start === 0
              ? `https://online.uni-prosperity.com.tw/zh/search/?q=${encodeURIComponent(kw)}`
              : `https://online.uni-prosperity.com.tw/zh/search/?q=${encodeURIComponent(kw)}&start=${start}&sz=24`;
          const res = await req(u);
          if (res.status !== 200 || !res.data) break;

          const blockRegex = /<a\s+class="gtm-product-alink"[\s\S]*?<\/a>/g;
          let m;
          let count = 0;
          while ((m = blockRegex.exec(res.data)) !== null) {
            const block = m[0];
            const pid = (block.match(/data-pid="([^"]*)"/) || [])[1];
            const name = (block.match(/data-name="([^"]*)"/) || [])[1];
            const priceStr = (block.match(/data-price="([^"]*)"/) || [])[1];
            const basePriceStr = (block.match(/data-baseprice="([^"]*)"/) || [])[1];
            const variant = (block.match(/data-variant="([^"]*)"/) || [])[1];
            const href = (block.match(/href="([^"]*)"/) || [])[1];
            const img = (block.match(/<img[^>]*src="([^"]*)"/) || [])[1];
            const price = Math.round(Number(priceStr));
            if (!pid || !name || !price || price <= 0 || price > 5000) continue;

            let fullName = name.trim();
            if (variant && variant !== 'null' && !/\d/.test(fullName)) {
              const cleanVar = variant.replace(/x\s*1\s*x\s*1\w+/i, '').trim();
              if (cleanVar) fullName = `${fullName} ${cleanVar}`;
            }

            const cat = classifyDailyCategory(fullName);
            if (!cat) continue;
            count++;

            const key = `carrefour_${pid}`;
            if (!results.has(key)) {
              const basePrice = Math.round(Number(basePriceStr)) || price;
              const prodImg = img ? img.replace(/&amp;/g, '&') : null;
              const prodUrl = href
                ? href.startsWith('http')
                  ? href
                  : `https://online.uni-prosperity.com.tw${href}`
                : 'https://online.uni-prosperity.com.tw/';

              results.set(key, {
                id: `carrefour-${pid}`,
                name: fullName,
                price,
                originalPrice: basePrice > price ? basePrice : price,
                store_chain: 'carrefour',
                store_name: basePrice > price ? `家樂福 量販/線上 (原價$${basePrice})` : '家樂福 量販/便利購',
                category: cat,
                imageUrl: prodImg,
                sourceUrl: prodUrl,
                barcode: makeDeterministicBarcode('471014', fullName),
              });
            }
          }
          if (count === 0) break;
        }
      }),
    );
    process.stdout.write(`   已掃描關鍵字 ${Math.min(i + 6, SEARCH_KEYWORDS.length)}/${SEARCH_KEYWORDS.length}，累計家樂福日用品: ${results.size} 項\r`);
  }
  console.log(`\n-> 家樂福 (Carrefour) 深度收錄完成：共 ${results.size} 項商品！`);
  return Array.from(results.values());
}

async function fetchAllSupabaseReports() {
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
  console.log('=== 開始全通路深度搜尋與日常用品資料庫大擴充 ===');

  // 1. 執行各通路抓取
  const pchomeItems = await harvestPChome();
  const pxmartItems = await harvestPXMartLifeWill();
  const costcoItems = await harvestCostcoDeep();
  const carrefourItems = await harvestCarrefourDeep();

  // 2. 載入現有 Supabase 資料庫
  console.log('\n[5/5] 正在載入 Supabase 現有紀錄並執行全通路條碼對齊與寫入...');
  const allRows = await fetchAllSupabaseReports();
  console.log(`   目前 Supabase 共有 ${allRows.length} 筆比價紀錄。`);

  // Build normName -> real barcode / image mapping from all authentic rows (especially Watsons & Cosmed with EAN-13)
  const normToBarcode = new Map();
  const normToImage = new Map();
  const existingChainBarcodes = new Set();
  const existingSourceUrls = new Set();

  for (const r of allRows) {
    existingChainBarcodes.add(`${r.barcode}__${r.store_chain}`);
    if (r.source_url) existingSourceUrls.add(`${r.source_url}__${r.store_chain}`);
    const norm = normalizeStrictProductKey(r.product_name);
    if (norm.length >= 4 && /\d/.test(norm)) {
      const existingBc = normToBarcode.get(norm);
      const isSynth = /^(471040|471099|471021|471014|471018|471024|471711|471004)/.test(r.barcode);
      if (!existingBc || !isSynth) {
        normToBarcode.set(norm, r.barcode);
      }
      if (r.image_url && !normToImage.has(norm)) {
        normToImage.set(norm, r.image_url);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const toInsert = [];

  function queueItem(item) {
    if (!item.name || !item.price || item.price <= 0) return;
    const norm = normalizeStrictProductKey(item.name);
    let finalBc = item.barcode;
    if (norm.length >= 4 && /\d/.test(norm)) {
      if (normToBarcode.has(norm)) {
        finalBc = normToBarcode.get(norm);
      } else {
        normToBarcode.set(norm, finalBc);
      }
    }
    const finalImg = item.imageUrl || (norm ? normToImage.get(norm) : null) || null;
    if (finalImg && norm && !normToImage.has(norm)) {
      normToImage.set(norm, finalImg);
    }

    const chainKey = `${finalBc}__${item.store_chain}`;
    const urlKey = item.sourceUrl ? `${item.sourceUrl}__${item.store_chain}` : null;
    if (existingChainBarcodes.has(chainKey) || (urlKey && existingSourceUrls.has(urlKey))) {
      return;
    }
    existingChainBarcodes.add(chainKey);
    if (urlKey) existingSourceUrls.add(urlKey);

    toInsert.push({
      id: crypto.randomUUID(),
      barcode: finalBc,
      product_name: item.name,
      price: Number(item.price),
      store_chain: item.store_chain,
      store_name: item.store_name,
      latitude: null,
      longitude: null,
      reported_at: nowIso,
      device_id: `${item.store_chain}-complete-v1`,
      image_url: finalImg,
      source_url: item.sourceUrl || null,
    });
  }

  // Queue all items
  for (const it of pchomeItems) queueItem(it);
  for (const it of pxmartItems) queueItem(it);
  for (const it of costcoItems) queueItem(it);
  for (const it of carrefourItems) queueItem(it);

  console.log(`   準備新增寫入 ${toInsert.length} 筆跨通路日常用品價格紀錄至 Supabase...`);
  let uploaded = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error } = await supabase.from('price_reports').insert(batch);
    if (error) {
      console.error(`Supabase batch ${i} error:`, error.message);
    } else {
      uploaded += batch.length;
      allRows.push(...batch);
      process.stdout.write(`   已上傳 ${uploaded}/${toInsert.length} 筆至 Supabase...\r`);
    }
  }
  console.log(`\n-> 成功新增 ${uploaded} 筆紀錄至 Supabase！目前全庫總筆數: ${allRows.length}`);

  // Cross-chain unification pass
  console.log('   正在執行全庫跨通路同商品條碼與圖片統一 (Unification)...');
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

    // Prefer real EAN-13 barcodes over synthetic prefixes
    const sorted = [...group].sort((a, b) => {
      const aSynth = /^(471040|471099|471021|471014|471018|471024)/.test(a.barcode) ? 1 : 0;
      const bSynth = /^(471040|471099|471021|471014|471018|471024)/.test(b.barcode) ? 1 : 0;
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
  console.log(`   已完成 ${unifiedGroups} 組跨通路商品條碼與圖片統一！`);

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
    console.log(`   已清理 ${dupIds.length} 筆重複紀錄。`);
  }

  // Rebuild daily_necessities.json and seed-data.json
  console.log('\n正在重建 src/constants/daily_necessities.json 與 src/constants/seed-data.json...');
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

  // Keep up to 800 items per category (up to 3,200 daily necessity products total)
  const countsByCat = {};
  const subCounts = { battery: 0, floss: 0, bodywash: 0, pchome: 0, pxmart: 0, watsons: 0 };
  const balancedDaily = [];

  for (const item of dailyList) {
    const c = item.category;
    countsByCat[c] = (countsByCat[c] || 0) + 1;
    if (countsByCat[c] <= 800) {
      const { _chainCount, _isKeyStaple, ...cleanItem } = item;
      balancedDaily.push(cleanItem);
      if (/電池/.test(cleanItem.name)) subCounts.battery++;
      if (/牙線|牙間刷|齒間/.test(cleanItem.name)) subCounts.floss++;
      if (/沐浴|香浴|潔膚露|肥皂|香皂|洗手/.test(cleanItem.name)) subCounts.bodywash++;
      if (cleanItem.prices.pchome) subCounts.pchome++;
      if (cleanItem.prices.pxmart) subCounts.pxmart++;
      if (cleanItem.prices.watsons) subCounts.watsons++;
    }
  }

  const dailyOutPath = path.resolve(__dirname, '../src/constants/daily_necessities.json');
  fs.writeFileSync(dailyOutPath, JSON.stringify(balancedDaily, null, 2), 'utf8');
  console.log(`-> 已輸出 src/constants/daily_necessities.json：共 ${balancedDaily.length} 項日常用品！`);
  console.log('   各分類總商品數:', countsByCat);
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
