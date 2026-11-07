const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xydpfmwzqluglkcuomqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeProductName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, '')
    .replace(/\s+/g, '')
    .trim();
}

async function main() {
  console.log('1. 正在掃描 Supabase price_reports，移除所有非真實販售通路的模擬跨店價格...');

  const allRows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('price_reports')
      .select('id,barcode,product_name,price,store_chain,store_name,latitude,longitude,reported_at,device_id,image_url,source_url')
      .range(offset, offset + 999);
    if (error || !data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  console.log(`-> 已讀取 Supabase 全庫共 ${allRows.length} 筆記錄。`);

  const idsToDelete = [];

  for (const r of allRows) {
    const dev = r.device_id || '';
    const bc = r.barcode || '';
    const src = r.source_url || '';
    const chain = r.store_chain;

    // 1) 7-Eleven 專屬鮮食卻被標記為其他通路 (如 familymart)
    if (
      (dev === '711-full-sync-v3' || dev === '711-full-xml-v2' || bc.startsWith('471711') || src.includes('7-11.com.tw')) &&
      chain !== '7-eleven'
    ) {
      idsToDelete.push(r.id);
      continue;
    }

    // 2) 全家專屬商品卻被標記為其他通路 (如 7-eleven)
    if (
      (dev === 'fm-full-sync-v3' ||
        dev === 'fm-foodsafety-v2' ||
        bc.startsWith('471000') ||
        bc.startsWith('471004') ||
        src.includes('family.com.tw')) &&
      chain !== 'familymart'
    ) {
      idsToDelete.push(r.id);
      continue;
    }

    // 3) 全聯官方商品卻被程式自動乘以 1.05 模擬成家樂福
    if ((dev === 'pxmart-official-v1' || src.includes('pxmart.com.tw')) && chain !== 'pxmart') {
      idsToDelete.push(r.id);
      continue;
    }

    // 4) 寶雅 91APP 官方商品卻被程式自動乘以 1.06 模擬成屈臣氏
    if ((dev === 'poya-91app-v1' || dev === 'poya-daily-v2' || src.includes('poyabuy.com.tw')) && chain !== 'poya') {
      idsToDelete.push(r.id);
      continue;
    }

    // 5) 康是美 91APP 官方商品卻被程式自動乘以 0.98 模擬成寶雅
    if ((dev === 'cosmed-91app-v1' || src.includes('cosmed.com.tw')) && chain !== 'cosmed') {
      idsToDelete.push(r.id);
      continue;
    }
  }

  console.log(`-> 偵測到 ${idsToDelete.length} 筆非該通路實際販售的模擬跨通路價格，正在從 Supabase 刪除...`);

  let deleted = 0;
  for (let i = 0; i < idsToDelete.length; i += 200) {
    const batch = idsToDelete.slice(i, i + 200);
    const { error } = await sb.from('price_reports').delete().in('id', batch);
    if (error) {
      console.error('Delete batch error:', error.message);
    } else {
      deleted += batch.length;
      process.stdout.write(`   已刪除 ${deleted}/${idsToDelete.length} 筆...\r`);
    }
  }
  console.log(`\n-> 已成功從 Supabase 移除 ${deleted} 筆模擬價格！`);

  // 2. 重建 src/constants/daily_necessities.json：只保留各通路真實販售的價格（不自己乘係數造假其他通路）
  console.log('2. 正在以 100% 真實通路資料重建 src/constants/daily_necessities.json...');
  const pxPath = path.resolve('src/constants/pxmart_products.json');
  const poyaPath = path.resolve('src/constants/poya_products.json');
  const pxList = fs.existsSync(pxPath) ? JSON.parse(fs.readFileSync(pxPath, 'utf8')) : [];
  const poyaList = fs.existsSync(poyaPath) ? JSON.parse(fs.readFileSync(poyaPath, 'utf8')) : [];

  // 用正規化商品名稱比對「全聯」與「寶雅」真的都有賣的同款商品
  const dailyMap = new Map();

  const getDailyCat = (text) => {
    if (/牙線|牙刷|牙膏|漱口|牙間刷|齒|口腔|食鹽水/.test(text)) return '口腔護理·牙線牙膏';
    if (/衛生紙|紙巾|濕巾|衛生棉|護墊|棉條|棉花棒|化妝棉/.test(text)) return '紙品濕巾·衛生棉';
    if (/洗髮|潤髮|護髮|沐浴|洗面|卸妝|洗手|香皂|染髮/.test(text)) return '洗沐清潔·個人護理';
    if (/洗衣|洗碗|清潔|芳香|除濕|垃圾袋|抹布|收納|電池|菜瓜布|保鮮膜|刮鬍/.test(text)) return '居家清潔·生活百貨';
    return null;
  };

  for (const p of pxList) {
    const cat = getDailyCat(p.name + (p.category || ''));
    if (!cat) continue;
    const norm = normalizeProductName(p.name);
    const key = norm || p.barcode;
    const prev = dailyMap.get(key);
    const prices = prev ? { ...prev.prices, pxmart: p.price } : { pxmart: p.price };
    const entries = Object.entries(prices).sort((a, b) => a[1] - b[1]);

    dailyMap.set(key, {
      id: prev?.id || p.barcode || p.code,
      barcode: prev?.barcode || p.barcode,
      name: prev?.name || p.name,
      category: cat,
      prices,
      lowestChain: entries[0][0],
      lowestPrice: entries[0][1],
      highestPrice: entries[entries.length - 1][1],
      originalPrice: prev?.originalPrice || null,
      imageUrl: prev?.imageUrl || p.imageUrl || null,
      promotionTag: p.promotionTag || prev?.promotionTag,
    });
  }

  for (const p of poyaList) {
    const cat = getDailyCat(p.name + (p.category || ''));
    if (!cat) continue;
    const norm = normalizeProductName(p.name);
    const key = norm || p.barcode;
    const prev = dailyMap.get(key);
    const prices = prev ? { ...prev.prices, poya: p.price } : { poya: p.price };
    const entries = Object.entries(prices).sort((a, b) => a[1] - b[1]);

    dailyMap.set(key, {
      id: prev?.id || p.barcode || p.id,
      barcode: prev?.barcode || p.barcode,
      name: prev?.name || p.name,
      category: cat,
      prices,
      lowestChain: entries[0][0],
      lowestPrice: entries[0][1],
      highestPrice: entries[entries.length - 1][1],
      originalPrice: p.originalPrice > p.price ? p.originalPrice : prev?.originalPrice || null,
      imageUrl: p.imageUrl || prev?.imageUrl || null,
      promotionTag: p.originalPrice > p.price ? `原價 $${p.originalPrice}` : prev?.promotionTag,
    });
  }

  // 把真正全聯與寶雅優先排在前面（尤其是牙線、牙線棒、牙膏、衛生紙）
  const finalDaily = Array.from(dailyMap.values()).sort((a, b) => {
    const aFloss = /牙線|牙間刷/.test(a.name) ? 1 : 0;
    const bFloss = /牙線|牙間刷/.test(b.name) ? 1 : 0;
    if (aFloss !== bFloss) return bFloss - aFloss;
    const aMulti = Object.keys(a.prices).length;
    const bMulti = Object.keys(b.prices).length;
    return bMulti - aMulti;
  });

  const dailyOutPath = path.resolve('src/constants/daily_necessities.json');
  fs.writeFileSync(dailyOutPath, JSON.stringify(finalDaily, null, 2), 'utf8');
  console.log(`-> 已重建 src/constants/daily_necessities.json：共 ${finalDaily.length} 項真實日常商品（絕無人工偽造跨店價）！`);

  // 3. 重新從 Supabase 下載乾淨的全庫並寫入 src/constants/seed-data.json
  console.log('3. 正在將清理後的 Supabase 真實資料庫同步回本地 src/constants/seed-data.json...');
  const cleanSet = new Set(idsToDelete);
  const cleanRows = allRows.filter((r) => !cleanSet.has(r.id));
  const seedPath = path.resolve('src/constants/seed-data.json');
  fs.writeFileSync(seedPath, JSON.stringify(cleanRows, null, 2), 'utf8');

  const { count } = await sb.from('price_reports').select('*', { count: 'exact', head: true });
  console.log(`=== 清理與同步完成！Supabase 真實總筆數：${count} 筆 | 本地 seed-data.json：${cleanRows.length} 筆 ===`);
}

main().catch(console.error);
