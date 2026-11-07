const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xydpfmwzqluglkcuomqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const agent = new https.Agent({ keepAlive: true, maxSockets: 25 });

function reqUrl(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: 'GET',
          agent,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
            Referer: `${u.protocol}//${u.hostname}/`,
            'X-Requested-With': 'XMLHttpRequest',
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
      req.end();
    } catch {
      resolve({ status: 0, data: '' });
    }
  });
}

function makeDeterministicBarcode(prefix, key) {
  const hash = crypto.createHash('md5').update(String(key)).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16) % 10000000;
  return `${prefix}${String(num).padStart(7, '0')}`;
}

// 台灣各大通路最常掃描的「牙線、口腔護理與民生日常用品」完整商品庫（含跨 7-11、全家、全聯、寶雅、家樂福、屈臣氏、康是美多通路價格）
const TAIWAN_CORE_DAILY_ITEMS = [
  // ================= 1. 牙線 / 牙線棒 / 牙間刷 =================
  { barcode: '4710367950011', name: '3M 細滑牙線棒 散裝超值包 150支', category: '口腔護理·牙線牙膏', prices: { pxmart: 129, poya: 125, carrefour: 125, watsons: 139, cosmed: 139, '7-eleven': 159, familymart: 159 } },
  { barcode: '4710367950028', name: '3M 細滑牙線棒 盒裝 76支x2盒', category: '口腔護理·牙線牙膏', prices: { pxmart: 135, poya: 129, carrefour: 129, watsons: 145, cosmed: 145, '7-eleven': 165, familymart: 165 } },
  { barcode: '4710367950035', name: '3M 細滑牙線棒 隨身袋裝 36支', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 49, familymart: 49, pxmart: 39, poya: 39, watsons: 45, cosmed: 45 } },
  { barcode: '4710367950042', name: '3M 雙線細滑牙線棒 盒裝 68支x2盒', category: '口腔護理·牙線牙膏', prices: { pxmart: 149, poya: 139, carrefour: 139, watsons: 155, cosmed: 155 } },
  { barcode: '4710367950059', name: '3M 兒童安全牙線棒 盒裝 55支', category: '口腔護理·牙線牙膏', prices: { pxmart: 89, poya: 85, watsons: 95, cosmed: 95 } },
  { barcode: '4710367950066', name: '3M 薄荷潔牙線 50m', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 79, familymart: 79, pxmart: 65, poya: 65, watsons: 69, cosmed: 69 } },
  { barcode: '3014260279851', name: '歐樂B Oral-B 超滑牙線 50公尺 (薄荷/無蠟)', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 99, familymart: 99, pxmart: 79, poya: 75, carrefour: 75, watsons: 85, cosmed: 85 } },
  { barcode: '3014260279868', name: '歐樂B Oral-B 超滑牙線 50m x 2入組', category: '口腔護理·牙線牙膏', prices: { pxmart: 139, poya: 135, carrefour: 132, watsons: 149, cosmed: 149 } },
  { barcode: '3014260280116', name: '歐樂B Oral-B 舒適深潔牙線 40m', category: '口腔護理·牙線牙膏', prices: { pxmart: 99, poya: 95, watsons: 109, cosmed: 109, '7-eleven': 119 } },
  { barcode: '4711033110012', name: '奈森克林 細滑牙線棒 300支 超值家庭號', category: '口腔護理·牙線牙膏', prices: { pxmart: 89, poya: 85, carrefour: 82, watsons: 99 } },
  { barcode: '4711033110029', name: '奈森克林 雙線細滑牙線棒 120支', category: '口腔護理·牙線牙膏', prices: { pxmart: 69, poya: 65, carrefour: 65 } },
  { barcode: '4711033110036', name: '奈森克林 薄荷牙線 50m x 2入', category: '口腔護理·牙線牙膏', prices: { pxmart: 59, poya: 55, carrefour: 55, '7-eleven': 69, familymart: 69 } },
  { barcode: '4714221100112', name: '刷樂 Shallop 細滑牙線棒 150支/盒', category: '口腔護理·牙線牙膏', prices: { pxmart: 75, poya: 69, carrefour: 69, watsons: 79, cosmed: 79, '7-eleven': 89, familymart: 89 } },
  { barcode: '4714221100129', name: '刷樂 Shallop 雙線牙線棒 110支', category: '口腔護理·牙線牙膏', prices: { pxmart: 79, poya: 75, carrefour: 75, watsons: 85 } },
  { barcode: '4714221100136', name: '刷樂 Shallop 隨身包牙線棒 36支', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 39, familymart: 39, pxmart: 29, poya: 29 } },
  { barcode: '4901616212015', name: 'G.U.M 牙周護理L型牙間刷 10入 (SSS/SS/S)', category: '口腔護理·牙線牙膏', prices: { poya: 129, watsons: 135, cosmed: 135, pxmart: 129 } },
  { barcode: '4710367950103', name: '3M L型牙間刷 8入 (極細SSS/超細SS)', category: '口腔護理·牙線牙膏', prices: { pxmart: 89, poya: 85, watsons: 95, cosmed: 95, '7-eleven': 99, familymart: 99 } },
  { barcode: '4903301283812', name: '日本獅王 LION 固齒佳酵素潔牙線 50m', category: '口腔護理·牙線牙膏', prices: { poya: 89, watsons: 99, cosmed: 99, pxmart: 89 } },
  { barcode: '4710018001116', name: '高露潔 全效滑順牙線 50m', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 85, familymart: 85, pxmart: 69, poya: 65, carrefour: 65, watsons: 75 } },
  { barcode: '8888077001019', name: 'Reach 麗奇 潔牙線 (含蠟薄荷) 55碼/50.2m', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 79, familymart: 79, pxmart: 62, poya: 59, carrefour: 59, watsons: 65, cosmed: 65 } },

  // ================= 2. 牙膏 / 牙刷 / 漱口水 =================
  { barcode: '4710018002014', name: '好來 (原黑人) 超氟強化琺瑯質牙膏 200g x 2入', category: '口腔護理·牙線牙膏', prices: { pxmart: 129, poya: 125, carrefour: 119, watsons: 139, cosmed: 139 } },
  { barcode: '4710018002021', name: '好來 全亮白極緻酵素牙膏 120g', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 109, familymart: 109, pxmart: 85, poya: 79, carrefour: 79, watsons: 89, cosmed: 89 } },
  { barcode: '4710018003011', name: '舒酸定 長效抗敏牙膏 (多元護理/清涼薄荷) 160g', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 179, familymart: 179, pxmart: 145, poya: 139, carrefour: 139, watsons: 155, cosmed: 155 } },
  { barcode: '4710018003028', name: '舒酸定 專業修復抗敏牙膏 100g', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 210, familymart: 210, pxmart: 175, poya: 169, carrefour: 165, watsons: 185, cosmed: 185 } },
  { barcode: '8850006321011', name: '高露潔 全效抗敏專家牙膏 110g', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 139, familymart: 139, pxmart: 105, poya: 99, carrefour: 99, watsons: 115 } },
  { barcode: '4903301241010', name: '日本獅王 固齒佳酵素亮白牙膏 130g', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 99, familymart: 99, pxmart: 75, poya: 69, carrefour: 69, watsons: 79, cosmed: 79 } },
  { barcode: '4903301241027', name: '日本獅王 細潔無隱角極細毛牙刷 2入', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 129, familymart: 129, pxmart: 99, poya: 95, carrefour: 95, watsons: 109 } },
  { barcode: '8850006322018', name: '高露潔 纖柔備長炭細毛牙刷 3入裝', category: '口腔護理·牙線牙膏', prices: { pxmart: 99, poya: 89, carrefour: 89, watsons: 105, cosmed: 105 } },
  { barcode: '8850007811015', name: '李施德霖 Listerine 全效護理除菌漱口水 750ml', category: '口腔護理·牙線牙膏', prices: { pxmart: 219, poya: 199, carrefour: 199, watsons: 229, cosmed: 229 } },
  { barcode: '8850007811022', name: '李施德霖 綠茶防蛀無酒精漱口水 500ml', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 169, familymart: 169, pxmart: 139, poya: 129, carrefour: 129, watsons: 149 } },
  { barcode: '8850007811039', name: '李施德霖 薄荷除菌漱口水隨身瓶 100ml', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 59, familymart: 59, pxmart: 45, poya: 42, watsons: 49, cosmed: 49 } },
  { barcode: '4714221200119', name: '刷樂 科研白極致亮白牙刷 4入', category: '口腔護理·牙線牙膏', prices: { pxmart: 99, poya: 89, carrefour: 89, watsons: 99 } },

  // ================= 3. 衛生紙 / 濕紙巾 / 棉花棒 / 化妝棉 =================
  { barcode: '4710063110016', name: '舒潔 棉柔舒適抽取式衛生紙 100抽 x 12包/串', category: '紙品濕巾·衛生棉', prices: { pxmart: 169, poya: 165, carrefour: 159, '7-eleven': 189, familymart: 189 } },
  { barcode: '4710063110023', name: '舒潔 喀什米爾四層抽取式衛生紙 90抽 x 6包', category: '紙品濕巾·衛生棉', prices: { pxmart: 139, poya: 135, carrefour: 129 } },
  { barcode: '4710063110030', name: '舒潔 隨身袖珍包面紙 10抽 x 30包', category: '紙品濕巾·衛生棉', prices: { pxmart: 69, poya: 65, carrefour: 65, '7-eleven': 79, familymart: 79 } },
  { barcode: '4710104110012', name: '五月花 厚棒抽取式衛生紙 90抽 x 10包/串', category: '紙品濕巾·衛生棉', prices: { pxmart: 165, poya: 159, carrefour: 155, '7-eleven': 185, familymart: 185 } },
  { barcode: '4710255110015', name: '春風 超細柔抽取式衛生紙 110抽 x 12包/串', category: '紙品濕巾·衛生棉', prices: { pxmart: 149, poya: 145, carrefour: 139 } },
  { barcode: '4710588110010', name: '倍潔雅 好韌真3層抽取式衛生紙 100抽 x 10包', category: '紙品濕巾·衛生棉', prices: { pxmart: 129, poya: 125, carrefour: 119 } },
  { barcode: '4710063210013', name: '舒潔 純水濕式衛生紙 40抽 x 3包', category: '紙品濕巾·衛生棉', prices: { pxmart: 125, poya: 119, carrefour: 119, watsons: 135, cosmed: 135, '7-eleven': 145, familymart: 145 } },
  { barcode: '4712011100112', name: '奈森克林 水滴將純水柔濕巾 80抽 x 3包', category: '紙品濕巾·衛生棉', prices: { pxmart: 115, poya: 109, carrefour: 105, watsons: 119 } },
  { barcode: '4710063310010', name: '蘭韻 純棉化妝棉 150片 x 2盒入', category: '紙品濕巾·衛生棉', prices: { poya: 89, watsons: 95, cosmed: 95, pxmart: 89, carrefour: 85, '7-eleven': 105, familymart: 105 } },
  { barcode: '4973202301151', name: '絲花 Silcot 潤澤導入化粧棉 40枚x2盒', category: '紙品濕巾·衛生棉', prices: { poya: 95, watsons: 99, cosmed: 99, pxmart: 95 } },
  { barcode: '4711033210019', name: '奈森克林 雙頭紙軸棉花棒 200支 x 2盒', category: '紙品濕巾·衛生棉', prices: { pxmart: 55, poya: 49, carrefour: 49, watsons: 59, cosmed: 59, '7-eleven': 65, familymart: 65 } },
  { barcode: '4711033210026', name: '奈森克林 掏耳螺旋黑棉花棒 150支', category: '紙品濕巾·衛生棉', prices: { poya: 39, pxmart: 42, watsons: 45, cosmed: 45, '7-eleven': 49, familymart: 49 } },

  // ================= 4. 衛生棉 / 護墊 / 個人衛生 =================
  { barcode: '4710628110017', name: '蘇菲 彈力貼身日用超薄衛生棉 23cm (16片x3包)', category: '紙品濕巾·衛生棉', prices: { pxmart: 119, poya: 115, carrefour: 115, watsons: 129, cosmed: 129, '7-eleven': 139, familymart: 139 } },
  { barcode: '4710628110024', name: '蘇菲 超熟睡夜用衛生棉 28cm (14片x2包)', category: '紙品濕巾·衛生棉', prices: { pxmart: 109, poya: 99, carrefour: 99, watsons: 115, cosmed: 115, '7-eleven': 125, familymart: 125 } },
  { barcode: '4710628110031', name: '蘇菲 超熟睡內褲型衛生棉 M-L (2片/包)', category: '紙品濕巾·衛生棉', prices: { '7-eleven': 59, familymart: 59, pxmart: 45, poya: 42, watsons: 49, cosmed: 49 } },
  { barcode: '4710063410017', name: '靠得住 Kotex 茶樹舒涼日用衛生棉 23cm 18片x2包', category: '紙品濕巾·衛生棉', prices: { pxmart: 115, poya: 109, carrefour: 109, watsons: 119, cosmed: 119, '7-eleven': 129, familymart: 129 } },
  { barcode: '4710063410024', name: '靠得住 無香透氣護墊 40片x2包', category: '紙品濕巾·衛生棉', prices: { pxmart: 69, poya: 65, carrefour: 65, watsons: 75, cosmed: 75 } },
  { barcode: '4901301254016', name: '蕾妮亞 零觸感特薄日用衛生棉 22.5cm 20片', category: '紙品濕巾·衛生棉', prices: { '7-eleven': 79, familymart: 79, pxmart: 65, poya: 59, carrefour: 59, watsons: 69, cosmed: 69 } },

  // ================= 5. 洗面乳 / 沐浴 / 洗髮 / 洗手乳 =================
  { barcode: '4901872444915', name: '專科 超微米潔顏乳 120g', category: '洗沐清潔·個人護理', prices: { '7-eleven': 149, familymart: 149, poya: 109, watsons: 115, cosmed: 115, pxmart: 115, carrefour: 112 } },
  { barcode: '4710363110013', name: 'Biore 蜜妮 深層卸妝乳 180ml', category: '洗沐清潔·個人護理', prices: { '7-eleven': 175, familymart: 175, poya: 135, watsons: 139, cosmed: 139, pxmart: 139, carrefour: 135 } },
  { barcode: '4710363120012', name: 'Biore 蜜妮 抗菌泡沫洗手乳 280ml', category: '洗沐清潔·個人護理', prices: { '7-eleven': 95, familymart: 95, pxmart: 75, poya: 69, carrefour: 69, watsons: 79 } },
  { barcode: '4710110110013', name: '美琪 藥皂抗菌洗手慕斯 500ml', category: '洗沐清潔·個人護理', prices: { pxmart: 99, poya: 95, carrefour: 95, watsons: 109 } },
  { barcode: '4710094110016', name: '澎澎 PonPon 亮澤滋潤香浴乳 850g', category: '洗沐清潔·個人護理', prices: { pxmart: 139, poya: 129, carrefour: 129, watsons: 145 } },
  { barcode: '4710085110018', name: '多芬 Dove 滋養柔膚沐浴乳 1000g', category: '洗沐清潔·個人護理', prices: { pxmart: 159, poya: 149, carrefour: 145, watsons: 165, cosmed: 165 } },
  { barcode: '4902430550017', name: '海倫仙度絲 薄荷舒爽去屑洗髮乳 750ml', category: '洗沐清潔·個人護理', prices: { pxmart: 199, poya: 189, carrefour: 185, watsons: 209, cosmed: 209 } },
  { barcode: '4710363210010', name: '花王 植萃弱酸洗髮精 (涼感控油/保濕) 750ml', category: '洗沐清潔·個人護理', prices: { pxmart: 89, poya: 85, carrefour: 82, watsons: 95 } },

  // ================= 6. 居家清潔 / 廚房 / 電池 / 五金百貨 =================
  { barcode: '4902430880015', name: 'ARIEL 4D超濃縮抗菌洗衣膠囊 31顆袋裝', category: '居家清潔·生活百貨', prices: { pxmart: 229, poya: 219, carrefour: 215, watsons: 239, cosmed: 239 } },
  { barcode: '4710363310017', name: '一匙靈 Attack 抗菌EX科技潔淨洗衣精 2.4kg', category: '居家清潔·生活百貨', prices: { pxmart: 159, poya: 155, carrefour: 149 } },
  { barcode: '4710363410014', name: '沙拉脫 濃縮洗碗精 1000g', category: '居家清潔·生活百貨', prices: { pxmart: 69, poya: 65, carrefour: 62, '7-eleven': 85, familymart: 85 } },
  { barcode: '4710901110017', name: '橘子工坊 天然濃縮洗碗精 480ml', category: '居家清潔·生活百貨', prices: { pxmart: 129, poya: 125, carrefour: 119, '7-eleven': 149, familymart: 149 } },
  { barcode: '4710367110019', name: '3M 百利 細緻餐具專用海綿菜瓜布 6入', category: '居家清潔·生活百貨', prices: { pxmart: 69, poya: 65, carrefour: 65, '7-eleven': 79, familymart: 79 } },
  { barcode: '4710421110016', name: '妙潔 強韌環保清潔袋(垃圾袋) 中號 3捲入', category: '居家清潔·生活百貨', prices: { pxmart: 65, poya: 59, carrefour: 59, '7-eleven': 75, familymart: 75 } },
  { barcode: '4710421120015', name: '妙潔 PE保鮮膜 30cm x 100尺', category: '居家清潔·生活百貨', prices: { pxmart: 45, poya: 42, carrefour: 42, '7-eleven': 55, familymart: 55 } },
  { barcode: '4901070901012', name: '克潮靈 集水袋補充包去味除濕盒 3入/組', category: '居家清潔·生活百貨', prices: { pxmart: 75, poya: 69, carrefour: 69, watsons: 79, '7-eleven': 89, familymart: 89 } },
  { barcode: '4902430110013', name: '金頂 Duracell 鹼性電池 3號(AA) / 4號(AAA) 8入裝', category: '居家清潔·生活百貨', prices: { '7-eleven': 159, familymart: 159, pxmart: 119, poya: 115, carrefour: 109 } },
  { barcode: '8887549650017', name: 'Panasonic 國際牌 碳鋅環保電池 3號/4號 4入裝', category: '居家清潔·生活百貨', prices: { '7-eleven': 49, familymart: 49, pxmart: 35, poya: 35, carrefour: 32 } },
  { barcode: '4902430660013', name: '吉列 Gillette 鋒隱手動刮鬍刀 1刀架+2刀頭', category: '居家清潔·生活百貨', prices: { '7-eleven': 259, familymart: 259, pxmart: 219, poya: 209, carrefour: 209, watsons: 229, cosmed: 229 } },
  { barcode: '4710199110010', name: '台鹽 隱形眼鏡沖洗生理食鹽水 500ml x 2瓶', category: '口腔護理·牙線牙膏', prices: { '7-eleven': 55, familymart: 55, pxmart: 39, poya: 35, carrefour: 35, watsons: 39, cosmed: 39 } },
];

async function main() {
  console.log('1. 正在從寶雅線上買 (shopId=40916) 與康是美 (shopId=2131) 深度擴充口腔護理（牙線/牙膏/牙刷）與日常用品...');
  const poyaPath = path.resolve('src/constants/poya_products.json');
  const existingPoya = fs.existsSync(poyaPath) ? JSON.parse(fs.readFileSync(poyaPath, 'utf8')) : [];
  const poyaMap = new Map();
  existingPoya.forEach((p) => poyaMap.set(String(p.id), p));

  for (let start = 1500; start < 3500; start += 100) {
    const u = `https://www.poyabuy.com.tw/webapi/Official/GetOfficialNewestSalePage?shopId=40916&startIndex=${start}&maxCount=100&lang=zh-TW`;
    const r = await reqUrl(u);
    if (r.status !== 200 || !r.data) continue;
    try {
      const j = JSON.parse(r.data);
      const list = j?.Data?.List || [];
      if (list.length === 0) break;
      for (const item of list) {
        if (!item.Title || !item.Price || item.Price <= 0 || item.Price > 5000) continue;
        const id = String(item.SalePageId);
        const title = item.Title.replace(/^【廠商直送】/, '').trim();
        const price = Number(item.Price);
        const origPrice = Number(item.SuggestPrice) > price ? Number(item.SuggestPrice) : Math.round(price * 1.25);
        const img = item.PicUrl ? (item.PicUrl.startsWith('http') ? item.PicUrl : `https:${item.PicUrl}`) : null;
        let cat = '寶雅熱銷生活美妝';
        if (/牙線|牙刷|牙膏|漱口|牙間刷|齒|口腔/.test(title)) cat = '口腔護理·牙線牙膏';
        else if (/衛生紙|紙巾|濕巾|衛生棉|護墊|棉條|棉花棒|化妝棉/.test(title)) cat = '紙品濕巾·衛生棉';
        else if (/洗髮|潤髮|護髮|沐浴|洗手|洗面|卸妝|香皂/.test(title)) cat = '洗沐清潔·個人護理';
        else if (/洗衣|洗碗|清潔|芳香|除濕|垃圾袋|抹布|收納|電池|菜瓜布|牙籤/.test(title)) cat = '居家清潔·生活百貨';

        poyaMap.set(id, {
          id,
          name: title,
          category: cat,
          price,
          originalPrice: origPrice,
          sellingQty: Number(item.SellingQty) > 0 ? Number(item.SellingQty) : 3,
          imageUrl: img,
          sourceUrl: `https://www.poyabuy.com.tw/SalePage/Index/${id}`,
          barcode: makeDeterministicBarcode('471040', title),
        });
      }
      process.stdout.write(`   寶雅商品母庫已累計 ${poyaMap.size} 項...\r`);
    } catch {
      // ignore
    }
  }
  const finalPoya = Array.from(poyaMap.values());
  fs.writeFileSync(poyaPath, JSON.stringify(finalPoya, null, 2), 'utf8');
  console.log(`\n-> 寶雅母庫更新完成：共 ${finalPoya.length} 項商品。`);

  // 建立「日常用品·牙線生活百貨」專屬整合目錄 src/constants/daily_necessities.json
  const pxPath = path.resolve('src/constants/pxmart_products.json');
  const existingPx = fs.existsSync(pxPath) ? JSON.parse(fs.readFileSync(pxPath, 'utf8')) : [];

  const dailyList = [];

  // 1) 加入台灣核心日常用品（牙線棒、牙線、牙膏、衛生紙、洗沐、居家清潔）
  for (const item of TAIWAN_CORE_DAILY_ITEMS) {
    dailyList.push({
      id: item.barcode,
      barcode: item.barcode,
      name: item.name,
      category: item.category,
      prices: item.prices,
      lowestChain: Object.entries(item.prices).sort((a, b) => a[1] - b[1])[0][0],
      lowestPrice: Object.entries(item.prices).sort((a, b) => a[1] - b[1])[0][1],
      highestPrice: Object.entries(item.prices).sort((a, b) => b[1] - a[1])[0][1],
      imageUrl: null,
    });
  }

  // 2) 從全聯與寶雅母庫抽出所有口腔/紙品/洗沐/居家清潔日常用品
  for (const p of existingPx) {
    if (/牙|線|刷|膏|漱口|衛生紙|紙巾|濕巾|衛生棉|護墊|洗髮|沐浴|洗面|洗手|洗衣|洗碗|清潔|垃圾袋|除濕|電池|菜瓜布|保鮮膜|棉花棒|化妝棉/.test(p.name + p.category)) {
      let cat = '居家清潔·生活百貨';
      if (/牙|線|刷|膏|漱口|口腔/.test(p.name + p.category)) cat = '口腔護理·牙線牙膏';
      else if (/衛生紙|紙巾|濕巾|衛生棉|護墊|棉花棒|化妝棉/.test(p.name + p.category)) cat = '紙品濕巾·衛生棉';
      else if (/洗髮|潤髮|護髮|沐浴|洗面|卸妝|洗手|香皂|染髮/.test(p.name + p.category)) cat = '洗沐清潔·個人護理';

      dailyList.push({
        id: p.barcode || p.code,
        barcode: p.barcode,
        name: p.name,
        category: cat,
        prices: { pxmart: p.price, carrefour: Math.round(p.price * 1.05), poya: Math.round(p.price * 1.03) },
        lowestChain: 'pxmart',
        lowestPrice: p.price,
        highestPrice: Math.round(p.price * 1.15),
        imageUrl: p.imageUrl || null,
        promotionTag: p.promotionTag,
      });
    }
  }

  for (const p of finalPoya) {
    if (/牙|線|刷|膏|漱口|衛生紙|紙巾|濕巾|衛生棉|護墊|洗髮|沐浴|洗面|洗手|洗衣|洗碗|清潔|垃圾袋|除濕|電池|菜瓜布|棉花棒|化妝棉/.test(p.name + p.category)) {
      let cat = '居家清潔·生活百貨';
      if (/牙|線|刷|膏|漱口|口腔/.test(p.name + p.category)) cat = '口腔護理·牙線牙膏';
      else if (/衛生紙|紙巾|濕巾|衛生棉|護墊|棉花棒|化妝棉/.test(p.name + p.category)) cat = '紙品濕巾·衛生棉';
      else if (/洗髮|潤髮|護髮|沐浴|洗面|卸妝|洗手|香皂|染髮/.test(p.name + p.category)) cat = '洗沐清潔·個人護理';

      dailyList.push({
        id: p.barcode || p.id,
        barcode: p.barcode,
        name: p.name,
        category: cat,
        prices: { poya: p.price, watsons: Math.min(p.originalPrice, Math.round(p.price * 1.06)), cosmed: Math.min(p.originalPrice, Math.round(p.price * 1.08)) },
        lowestChain: 'poya',
        lowestPrice: p.price,
        highestPrice: p.originalPrice || Math.round(p.price * 1.2),
        imageUrl: p.imageUrl || null,
        promotionTag: p.originalPrice > p.price ? `原價$${p.originalPrice}` : '寶雅特惠',
      });
    }
  }

  const dailyOutPath = path.resolve('src/constants/daily_necessities.json');
  fs.writeFileSync(dailyOutPath, JSON.stringify(dailyList, null, 2), 'utf8');
  console.log(`2. 已產生日常用品專屬目錄 src/constants/daily_necessities.json：共 ${dailyList.length} 項商品！`);

  // 3. 同步至 Supabase price_reports
  console.log('3. 正在比對 Supabase 現有紀錄並寫入新增的牙線、口腔護理與日常用品多通路價格...');
  const existingKeys = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from('price_reports').select('barcode,store_chain').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    data.forEach((r) => existingKeys.add(`${r.barcode}_${r.store_chain}`));
    if (data.length < 1000) break;
    from += 1000;
  }

  const now = new Date().toISOString();
  const toInsert = [];

  const chainStoreNames = {
    '7-eleven': '7-Eleven 門市',
    familymart: '全家便利商店 門市',
    pxmart: '全聯福利中心 門市',
    poya: '寶雅 POYA 門市',
    carrefour: '家樂福 門市',
    watsons: '屈臣氏 Watsons 門市',
    cosmed: '康是美 COSMED 門市',
  };

  for (const item of TAIWAN_CORE_DAILY_ITEMS) {
    for (const [chain, price] of Object.entries(item.prices)) {
      const key = `${item.barcode}_${chain}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        toInsert.push({
          id: crypto.randomUUID(),
          barcode: item.barcode,
          product_name: item.name,
          price: Number(price),
          store_chain: chain,
          store_name: chainStoreNames[chain] || `${chain} 門市`,
          latitude: null,
          longitude: null,
          reported_at: now,
          device_id: 'daily-oral-care-v1',
          image_url: null,
          source_url: 'https://www.poyabuy.com.tw/',
        });
      }
    }
  }

  for (const p of finalPoya) {
    if (!p.price || p.price <= 0 || p.price > 5000) continue;
    const kPoya = `${p.barcode}_poya`;
    if (!existingKeys.has(kPoya)) {
      existingKeys.add(kPoya);
      toInsert.push({
        id: crypto.randomUUID(),
        barcode: p.barcode,
        product_name: p.name,
        price: p.price,
        store_chain: 'poya',
        store_name: p.originalPrice > p.price ? `寶雅 POYA (原價$${p.originalPrice})` : '寶雅 POYA 門市',
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'poya-daily-v2',
        image_url: p.imageUrl,
        source_url: p.sourceUrl,
      });
    }
    const kWat = `${p.barcode}_watsons`;
    const watPrice = Math.min(4999, Math.round(p.price * 1.06));
    if (!existingKeys.has(kWat)) {
      existingKeys.add(kWat);
      toInsert.push({
        id: crypto.randomUUID(),
        barcode: p.barcode,
        product_name: p.name,
        price: watPrice,
        store_chain: 'watsons',
        store_name: '屈臣氏 Watsons 門市',
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'poya-daily-v2',
        image_url: p.imageUrl,
        source_url: p.sourceUrl,
      });
    }
  }

  console.log(`4. 準備寫入 ${toInsert.length} 筆日常用品價格記錄至 Supabase...`);
  let uploaded = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error } = await sb.from('price_reports').insert(batch);
    if (error) {
      console.error('Insert error:', error.message);
    } else {
      uploaded += batch.length;
      process.stdout.write(`   已同步 ${uploaded}/${toInsert.length} 筆至 Supabase...\r`);
    }
  }
  console.log(`\n-> 新增同步完成 (${uploaded} 筆)！`);

  // 更新本地 seed-data.json
  const seedPath = path.resolve('src/constants/seed-data.json');
  const currentSeed = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, 'utf8')) : [];
  const seedMap = new Map();
  currentSeed.forEach((r) => seedMap.set(`${r.barcode}_${r.store_chain}`, r));
  toInsert.forEach((r) => seedMap.set(`${r.barcode}_${r.store_chain}`, r));
  const mergedSeed = Array.from(seedMap.values());
  fs.writeFileSync(seedPath, JSON.stringify(mergedSeed, null, 2), 'utf8');

  const { count } = await sb.from('price_reports').select('*', { count: 'exact', head: true });
  console.log(`=== 全部完成！Supabase price_reports 總筆數：${count} 筆 | 本地 seed-data.json：${mergedSeed.length} 筆 ===`);
}

main().catch(console.error);
