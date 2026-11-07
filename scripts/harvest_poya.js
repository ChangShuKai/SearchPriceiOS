const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xydpfmwzqluglkcuomqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const STORE_NAMES = {
  poya: '寶雅 門市',
  watsons: '屈臣氏 門市',
  cosmed: '康是美 門市',
  carrefour: '家樂福 量販/便利購',
  pxmart: '全聯福利中心 門市',
  '7-eleven': '7-Eleven 門市',
  familymart: '全家便利商店 門市',
  costco: '好市多 賣場',
  'rt-mart': '大潤發 量販店',
  simplemart: '美廉社 門市',
};

// 寶雅 POYA 完整熱門商品清單 (彩妝/保養/髮品/美妝工具/衛浴個清/日韓零食)
const POYA_CATALOG = [
  // --- 1. 彩妝、眼線、睫毛膏、眉彩 ---
  {
    barcode: '4901433036948',
    name: 'KISSME 花漾美姬 瞬翹自然捲濃密防水睫毛膏 01 黑色 6g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901433036948',
    prices: { poya: 359, watsons: 369, cosmed: 369, carrefour: 389 },
  },
  {
    barcode: '4901433036955',
    name: 'KISSME 花漾美姬 瞬翹自然捲纖長防水睫毛膏 02 玫瑰棕 6g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901433036955',
    prices: { poya: 359, watsons: 369, cosmed: 369 },
  },
  {
    barcode: '4901433180801',
    name: 'KISSME 花漾美姬 一筆耀眼極細抗暈眼線液筆 01 漆黑',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901433180801',
    prices: { poya: 319, watsons: 329, cosmed: 329 },
  },
  {
    barcode: '4901433081436',
    name: 'KISSME 睫毛膏卸除精華升級版 6.6ml (卸睫神器)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901433081436',
    prices: { poya: 299, watsons: 309, cosmed: 309 },
  },
  {
    barcode: '4973167946955',
    name: 'KATE 凱婷 3D造型眉彩餅 EX-4 亮茶褐色 2.2g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4973167946955',
    prices: { poya: 280, watsons: 285, cosmed: 285, carrefour: 310 },
  },
  {
    barcode: '4973167946962',
    name: 'KATE 凱婷 3D造型眉彩餅 EX-5 濃中褐色 2.2g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4973167946962',
    prices: { poya: 280, watsons: 285, cosmed: 285 },
  },
  {
    barcode: '4973167041698',
    name: 'KATE 凱婷 怪獸級持色唇膏 03 暖陽奶茶 3g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4973167041698',
    prices: { poya: 379, watsons: 389, cosmed: 389 },
  },
  {
    barcode: '4973167041711',
    name: 'KATE 凱婷 怪獸級持色唇膏 05 炙熱無痕 3g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4973167041711',
    prices: { poya: 379, watsons: 389, cosmed: 389 },
  },
  {
    barcode: '4973167041728',
    name: 'KATE 凱婷 進化版持久液體眼線筆EX 2.0 漆黑 0.6ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4973167041728',
    prices: { poya: 320, watsons: 329, cosmed: 329 },
  },
  {
    barcode: '4713025211019',
    name: '1028 飛激濃瞬翹防水睫毛膏 黑色 8g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713025211019',
    prices: { poya: 319, watsons: 329, cosmed: 329, carrefour: 359 },
  },
  {
    barcode: '4713025211026',
    name: '1028 飛激濃瞬翹防水睫毛膏 濃縮咖 8g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713025211026',
    prices: { poya: 319, watsons: 329, cosmed: 329 },
  },
  {
    barcode: '4713025211057',
    name: '1028 超吸油嫩蜜粉 8g 膚色',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713025211057',
    prices: { poya: 169, watsons: 179, cosmed: 179, pxmart: 185 },
  },
  {
    barcode: '4713025211064',
    name: '1028 超吸油嫩蜜粉 8g 透明色',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713025211064',
    prices: { poya: 169, watsons: 179, cosmed: 179 },
  },
  {
    barcode: '4713025211071',
    name: '1028 放色線激穩抗震眼線液 濃烈黑 0.55ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713025211071',
    prices: { poya: 299, watsons: 319, cosmed: 319 },
  },
  {
    barcode: '4711234560012',
    name: 'heme 喜蜜 純色腮紅 08 Soft Tan 5.5g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4711234560012',
    prices: { poya: 199, watsons: 209, cosmed: 209 },
  },
  {
    barcode: '4711234560029',
    name: 'heme 喜蜜 六色眼影盤 柔粉 9g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4711234560029',
    prices: { poya: 299, watsons: 315, cosmed: 315 },
  },
  {
    barcode: '4711234560036',
    name: 'heme 喜蜜 極細圓芯眉筆 01 炭灰 0.09g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4711234560036',
    prices: { poya: 149, watsons: 159, cosmed: 159 },
  },
  {
    barcode: '6902395685816',
    name: 'Maybelline 媚比琳 飛天翹防水睫毛膏 8.6ml 黑色',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/6902395685816',
    prices: { poya: 399, watsons: 409, cosmed: 409, carrefour: 439 },
  },
  {
    barcode: '6902395685823',
    name: 'Maybelline 媚比琳 超持久霧感液態唇膏 117 磚紅 5ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/6902395685823',
    prices: { poya: 349, watsons: 359, cosmed: 359 },
  },
  {
    barcode: '6902395685830',
    name: 'Maybelline 媚比琳 FIT ME遮遮稱奇遮瑕膏 10 白皙 6.8ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/6902395685830',
    prices: { poya: 279, watsons: 289, cosmed: 289 },
  },
  {
    barcode: '6902395685847',
    name: 'Maybelline 媚比琳 FIT ME反孔特霧粉底液 110 白皙色 30ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/6902395685847',
    prices: { poya: 419, watsons: 429, cosmed: 429, carrefour: 449 },
  },
  {
    barcode: '4901008018393',
    name: 'CANMAKE 井田 花漾戀愛修容組 02 玫瑰花粉 6g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901008018393',
    prices: { poya: 350, watsons: 360, cosmed: 360 },
  },
  {
    barcode: '4901008309880',
    name: 'CANMAKE 井田 棉花糖蜜粉餅 MO 明亮色 10g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901008309880',
    prices: { poya: 440, watsons: 455, cosmed: 455 },
  },
  {
    barcode: '4939553040583',
    name: 'CEZANNE 塞尚 超細芯眉筆 03 自然棕 0.02g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4939553040583',
    prices: { poya: 190, watsons: 200, cosmed: 200 },
  },
  {
    barcode: '4939553040590',
    name: 'CEZANNE 塞尚 浪漫好氣色腮紅 01 粉紅 3.5g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4939553040590',
    prices: { poya: 180, watsons: 190, cosmed: 190 },
  },
  {
    barcode: '4901872324644',
    name: 'neuve 惹我 清爽吸油蜜粉 3.5g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872324644',
    prices: { poya: 135, watsons: 140, cosmed: 140, carrefour: 145, pxmart: 139, '7-eleven': 160 },
  },
  {
    barcode: '4901872324651',
    name: 'neuve 惹我 眉筆 咖啡色 1.5g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872324651',
    prices: { poya: 75, watsons: 80, cosmed: 80, carrefour: 80, pxmart: 79 },
  },

  // --- 2. 臉部保養／面膜／卸妝 (POYA 超人氣保養) ---
  {
    barcode: '4713575123018',
    name: '我的美麗日記 黑珍珠煥白面膜 8入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713575123018',
    prices: { poya: 199, watsons: 219, cosmed: 219, carrefour: 219, pxmart: 209 },
  },
  {
    barcode: '4713575123025',
    name: '我的美麗日記 官燕窩全效滋養面膜 8入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713575123025',
    prices: { poya: 199, watsons: 219, cosmed: 219, pxmart: 209 },
  },
  {
    barcode: '4713575123032',
    name: '我的美麗日記 玻尿酸極效保濕面膜 8入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713575123032',
    prices: { poya: 199, watsons: 219, cosmed: 219, carrefour: 219 },
  },
  {
    barcode: '4712852011018',
    name: '森田藥粧 玻尿酸複合精華高保濕面膜 8入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712852011018',
    prices: { poya: 189, watsons: 199, cosmed: 199, carrefour: 199, pxmart: 195 },
  },
  {
    barcode: '4712852011025',
    name: '森田藥粧 六重玻尿酸深層修護面膜 7入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712852011025',
    prices: { poya: 199, watsons: 219, cosmed: 219 },
  },
  {
    barcode: '4712852011032',
    name: 'Neogence 霓淨思 N7跑趴超貼妝保濕面膜 4入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712852011032',
    prices: { poya: 199, watsons: 219, cosmed: 219 },
  },
  {
    barcode: '4712852011049',
    name: 'Neogence 霓淨思 玻尿酸浸潤精華化妝水 150ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712852011049',
    prices: { poya: 499, watsons: 520, cosmed: 520 },
  },
  {
    barcode: '4712852011056',
    name: 'Neogence 霓淨思 水感全效防曬乳 SPF50+ 50ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712852011056',
    prices: { poya: 379, watsons: 399, cosmed: 399 },
  },
  {
    barcode: '4987241155712',
    name: '肌研 極潤保濕化粧水 170ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4987241155712',
    prices: { poya: 379, watsons: 389, cosmed: 389, carrefour: 410, pxmart: 399 },
  },
  {
    barcode: '4987241155736',
    name: '肌研 極潤保濕乳液 140ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4987241155736',
    prices: { poya: 379, watsons: 389, cosmed: 389, carrefour: 410 },
  },
  {
    barcode: '4987241155743',
    name: '肌研 白潤美白化粧水 170ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4987241155743',
    prices: { poya: 389, watsons: 399, cosmed: 399 },
  },
  {
    barcode: '3401575645851',
    name: 'BIODERMA 貝膚黛瑪 舒敏高效潔膚液 (粉紅紅腫卸妝水) 500ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/3401575645851',
    prices: { poya: 499, watsons: 529, cosmed: 529, costco: 469 },
  },
  {
    barcode: '4710185123015',
    name: '廣源良 絲瓜水噴霧 160ml (隨身噴霧)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710185123015',
    prices: { poya: 99, watsons: 109, cosmed: 109, carrefour: 109, pxmart: 105 },
  },
  {
    barcode: '4710185123022',
    name: '廣源良 絲瓜保濕水 500ml 大容量家庭裝',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710185123022',
    prices: { poya: 149, watsons: 159, cosmed: 159, carrefour: 159 },
  },
  {
    barcode: '4710185123039',
    name: '廣源良 蘆薈舒緩敷臉凝露 250g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710185123039',
    prices: { poya: 129, watsons: 139, cosmed: 139, carrefour: 135 },
  },
  {
    barcode: '4511413302164',
    name: 'DHC 純欖護唇膏 1.5g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4511413302164',
    prices: { poya: 229, watsons: 239, cosmed: 239, '7-eleven': 260, familymart: 260 },
  },
  {
    barcode: '4710088123014',
    name: '曼秀雷敦 薄荷潤唇膏 3.5g SPF15',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123014',
    prices: { poya: 89, watsons: 95, cosmed: 95, pxmart: 92, '7-eleven': 105, familymart: 105 },
  },
  {
    barcode: '4710088123021',
    name: '曼秀雷敦 頂級濃潤柔霜潤唇膏 無香料 2.4g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123021',
    prices: { poya: 169, watsons: 179, cosmed: 179 },
  },
  {
    barcode: '4710088123038',
    name: '曼秀雷敦 Acnes 抗痘洗面乳 100g 控油去黑頭',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123038',
    prices: { poya: 119, watsons: 125, cosmed: 125, carrefour: 125, pxmart: 119 },
  },
  {
    barcode: '0077320000010',
    name: 'Vaseline 凡士林 三重精煉經典修護晶凍 100ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/0077320000010',
    prices: { poya: 65, watsons: 69, cosmed: 69, carrefour: 65, pxmart: 65, simplemart: 68 },
  },
  {
    barcode: '0077320000027',
    name: 'Vaseline 凡士林 深層修護潤膚露 400ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/0077320000027',
    prices: { poya: 159, watsons: 169, cosmed: 169, carrefour: 159, pxmart: 159 },
  },
  {
    barcode: '4005808813208',
    name: 'NIVEA 妮維雅 經典妮維雅霜 (藍罐) 150ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4005808813208',
    prices: { poya: 119, watsons: 125, cosmed: 125, carrefour: 119, pxmart: 119 },
  },
  {
    barcode: '4987353190014',
    name: 'Yuskin 悠斯晶 A乳霜 120g 護手足龜裂專用',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4987353190014',
    prices: { poya: 339, watsons: 349, cosmed: 349 },
  },

  // --- 3. 美髮護髮／洗髮／精油 (POYA 搶手髮品) ---
  {
    barcode: '8806403061545',
    name: 'Mise-en-scène 魅尚萱 完美修護護髮精油 (經典款) 80ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/8806403061545',
    prices: { poya: 269, watsons: 289, cosmed: 289, carrefour: 299 },
  },
  {
    barcode: '8806403061552',
    name: 'Mise-en-scène 魅尚萱 完美修護護髮精油 (玫瑰版) 80ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/8806403061552',
    prices: { poya: 269, watsons: 289, cosmed: 289 },
  },
  {
    barcode: '4902430889247',
    name: 'Pantene 潘婷 高濃保濕膠囊精華髮膜 (密集修護) 12ml*6入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4902430889247',
    prices: { poya: 249, watsons: 269, cosmed: 269, carrefour: 279, costco: 239 },
  },
  {
    barcode: '6902395689104',
    name: 'L\'Oreal 巴黎萊雅 金緻護髮精油 金色精油 (受損髮適用) 100ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/6902395689104',
    prices: { poya: 449, watsons: 469, cosmed: 469, carrefour: 489 },
  },
  {
    barcode: '8806403061569',
    name: 'RYO 呂 滋養韌髮洗髮精 (去屑專用) 400ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/8806403061569',
    prices: { poya: 299, watsons: 319, cosmed: 319, carrefour: 329, pxmart: 315 },
  },
  {
    barcode: '4901872443512',
    name: 'Fino 高效滲透護髮膜 (沖洗型) 230g (紅罐髮膜)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872443512',
    prices: { poya: 189, watsons: 199, cosmed: 199, carrefour: 209, pxmart: 195, costco: 179 },
  },
  {
    barcode: '4901872443529',
    name: 'TSUBAKI 思波綺 瞬耀修護洗髮乳 (金色修護) 490ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872443529',
    prices: { poya: 219, watsons: 229, cosmed: 229, carrefour: 229, pxmart: 225 },
  },
  {
    barcode: '4710088456012',
    name: '花王 溫和柔順洗髮精 綠色清新 750ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088456012',
    prices: { poya: 99, watsons: 109, cosmed: 109, carrefour: 95, pxmart: 95, simplemart: 98 },
  },

  // --- 4. 美妝雜貨／工具／消臭／蒸氣眼罩 (寶雅必買生活小物) ---
  {
    barcode: '4903111478064',
    name: 'Unicharm 絲花 潤澤化妝棉 40片 (省1/2化妝水神物)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4903111478064',
    prices: { poya: 59, watsons: 65, cosmed: 65, carrefour: 65, pxmart: 62 },
  },
  {
    barcode: '4903111478071',
    name: 'Unicharm 絲花 純棉化妝棉 80片*2盒特惠組',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4903111478071',
    prices: { poya: 99, watsons: 109, cosmed: 109, carrefour: 105, pxmart: 99 },
  },
  {
    barcode: '4710688001018',
    name: '蘭韻 經典紙纖化妝棉 180片*3盒裝',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710688001018',
    prices: { poya: 99, watsons: 109, cosmed: 109, carrefour: 105, pxmart: 99 },
  },
  {
    barcode: '4711234567890',
    name: '永和三美人 經典海綿粉撲 2入 海棠 (化妝神粉撲)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4711234567890',
    prices: { poya: 35, watsons: 39, cosmed: 39 },
  },
  {
    barcode: '4901601288765',
    name: 'KAI 貝印 不鏽鋼專業指甲剪 M (防飛濺)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901601288765',
    prices: { poya: 169, watsons: 189, cosmed: 189 },
  },
  {
    barcode: '4901301348043',
    name: '花王 美舒律 蒸氣眼罩 薰衣草香 12枚入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901301348043',
    prices: { poya: 299, watsons: 329, cosmed: 329, carrefour: 349, costco: 289 },
  },
  {
    barcode: '4901301348050',
    name: '花王 美舒律 蒸氣眼罩 無香料 12枚入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901301348050',
    prices: { poya: 299, watsons: 329, cosmed: 329, carrefour: 349 },
  },
  {
    barcode: '4902430890120',
    name: 'Febreze 風倍清 織物除菌消臭噴霧 經典高效 370ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4902430890120',
    prices: { poya: 149, watsons: 159, cosmed: 159, carrefour: 159, pxmart: 149 },
  },
  {
    barcode: '4902430890137',
    name: 'Lenor 蘭諾 衣物芳香豆 晨曦玫瑰 455ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4902430890137',
    prices: { poya: 199, watsons: 219, cosmed: 219, carrefour: 219, pxmart: 199, costco: 189 },
  },

  // --- 5. 口腔、牙線、衛生棉 (個人消耗用品) ---
  {
    barcode: '4710123450019',
    name: 'Shallop 刷樂 雙卡細滑牙線棒 300支 (家庭量販包)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710123450019',
    prices: { poya: 109, watsons: 119, cosmed: 119, carrefour: 119, pxmart: 109 },
  },
  {
    barcode: '4710123450026',
    name: 'Oral-B 歐樂B 頂級微分子牙線 50公尺*2入 薄荷薄型',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710123450026',
    prices: { poya: 129, watsons: 139, cosmed: 139, carrefour: 139, pxmart: 129 },
  },
  {
    barcode: '4710088123456',
    name: '好來 (原黑人) 超氟強化琺瑯質牙膏 200g*2入組',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123456',
    prices: { poya: 115, watsons: 125, cosmed: 125, carrefour: 115, pxmart: 109, simplemart: 112 },
  },
  {
    barcode: '4710088123463',
    name: '舒酸定 專業抗敏護齦牙膏 原味 100g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123463',
    prices: { poya: 159, watsons: 169, cosmed: 169, carrefour: 169, pxmart: 159 },
  },
  {
    barcode: '4710088123470',
    name: '李施德霖 全效防護漱口水 750ml 紫色全效',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123470',
    prices: { poya: 229, watsons: 249, cosmed: 249, carrefour: 249, pxmart: 239, costco: 219 },
  },
  {
    barcode: '4710088901234',
    name: '蘇菲 超熟睡夜用細緻棉柔衛生棉 35cm 8片*3包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901234',
    prices: { poya: 149, watsons: 159, cosmed: 159, carrefour: 159, pxmart: 149 },
  },
  {
    barcode: '4710088901241',
    name: '靠得住 草本抑菌日用超薄衛生棉 23cm 15片*3包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901241',
    prices: { poya: 139, watsons: 149, cosmed: 149, carrefour: 149, pxmart: 139 },
  },
  {
    barcode: '4710088901258',
    name: '蕾妮亞 零觸感特薄羽量日用衛生棉 22.5cm 20片*2包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901258',
    prices: { poya: 129, watsons: 139, cosmed: 139, carrefour: 139, pxmart: 129 },
  },
  {
    barcode: '4710088901265',
    name: '滿意寶寶 溫和純水厚型嬰兒濕紙巾 80抽*3包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901265',
    prices: { poya: 129, watsons: 139, cosmed: 139, carrefour: 135, pxmart: 125, costco: 115 },
  },

  // --- 6. 寶雅熱門日韓休閒零食／點心 ---
  {
    barcode: '4902750898516',
    name: 'UHA 味覺糖 酷露露 Q彈葡萄果汁軟糖 48g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4902750898516',
    prices: { poya: 55, watsons: 59, cosmed: 59, '7-eleven': 65, familymart: 65, carrefour: 59 },
  },
  {
    barcode: '4902750898523',
    name: 'UHA 味覺糖 酷露露 白葡萄果汁軟糖 48g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4902750898523',
    prices: { poya: 55, watsons: 59, cosmed: 59, '7-eleven': 65, familymart: 65 },
  },
  {
    barcode: '4987240618706',
    name: '龍角散 草本潤喉糖 (原味薄荷袋裝) 88g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4987240618706',
    prices: { poya: 89, watsons: 99, cosmed: 99, '7-eleven': 105, familymart: 105, carrefour: 95 },
  },
  {
    barcode: '4987240618713',
    name: '龍角散 草本潤喉糖 (蜂蜜檸檬味) 80g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4987240618713',
    prices: { poya: 89, watsons: 99, cosmed: 99, '7-eleven': 105, familymart: 105 },
  },
  {
    barcode: '4902105002667',
    name: '日清 NISSIN 咚兵衛特盛油豆腐烏龍麵 130g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4902105002667',
    prices: { poya: 85, carrefour: 89, '7-eleven': 99, familymart: 99, pxmart: 88 },
  },
  {
    barcode: '8850157400049',
    name: 'Bento 泰國超味魷魚片 (蒜辣味紅包) 20g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/8850157400049',
    prices: { poya: 35, carrefour: 38, '7-eleven': 40, familymart: 40, pxmart: 36 },
  },
  // --- 7. POYA 暢銷追加品項 (熱門日韓彩妝、防曬、醫美保養、香氛) ---
  {
    barcode: '4964596482182',
    name: 'excel 3合1持久造型眉筆 01 自然棕 (開架眉筆之王)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4964596482182',
    prices: { poya: 520, watsons: 520, cosmed: 520 },
  },
  {
    barcode: '4964596482199',
    name: 'excel 3合1持久造型眉筆 02 焦糖棕',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4964596482199',
    prices: { poya: 520, watsons: 520, cosmed: 520 },
  },
  {
    barcode: '8809625241231',
    name: 'Rom&nd 果汁持久唇釉 06 Figfig 無花果 5.5g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/8809625241231',
    prices: { poya: 299, watsons: 319, cosmed: 319 },
  },
  {
    barcode: '8809625241248',
    name: 'Rom&nd 果汁持久唇釉 23 Nucadamia 堅果奶茶 5.5g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/8809625241248',
    prices: { poya: 299, watsons: 319, cosmed: 319 },
  },
  {
    barcode: '4901872466344',
    name: 'SENKA 專科 超微米潔顏乳 120g (藍色潔面乳霸主)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872466344',
    prices: { poya: 119, watsons: 125, cosmed: 125, carrefour: 120, pxmart: 119, '7-eleven': 135 },
  },
  {
    barcode: '4901872466351',
    name: 'SENKA 專科 完美防曬水凝膠 SPF50+ 80ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872466351',
    prices: { poya: 299, watsons: 319, cosmed: 319, carrefour: 319, pxmart: 299 },
  },
  {
    barcode: '4710088812301',
    name: 'Bioré 蜜妮 含水防曬水珠凝露 SPF50+ 50ml (水感防曬首選)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088812301',
    prices: { poya: 239, watsons: 250, cosmed: 250, carrefour: 245, pxmart: 239 },
  },
  {
    barcode: '4710088812318',
    name: 'Bioré 蜜妮 深層卸妝乳 180ml (溫和卸妝必備)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088812318',
    prices: { poya: 169, watsons: 179, cosmed: 179, carrefour: 175, pxmart: 169 },
  },
  {
    barcode: '4710088812325',
    name: 'Bioré 蜜妮 頂級深層卸妝油 230ml (手濕也可卸)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088812325',
    prices: { poya: 259, watsons: 279, cosmed: 279, carrefour: 279, pxmart: 259 },
  },
  {
    barcode: '4710088812332',
    name: 'Bioré 蜜妮 淨嫩沐浴乳 富士蘋果香 1000ml 家庭號',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088812332',
    prices: { poya: 149, watsons: 169, cosmed: 169, carrefour: 149, pxmart: 145 },
  },
  {
    barcode: '4710088812349',
    name: 'Bioré 蜜妮 淨嫩沐浴乳 京都櫻花香 1000ml 家庭號',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088812349',
    prices: { poya: 149, watsons: 169, cosmed: 169, carrefour: 149, pxmart: 145 },
  },
  {
    barcode: '4710088123045',
    name: '曼秀雷敦 Acnes 隱形痘痘貼 抗菌型 26片入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123045',
    prices: { poya: 99, watsons: 109, cosmed: 109, carrefour: 105, pxmart: 99, '7-eleven': 115 },
  },
  {
    barcode: '4710088123052',
    name: '曼秀雷敦 水潤肌超保濕水感防曬露 SPF50+ 110g 大容量',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088123052',
    prices: { poya: 299, watsons: 319, cosmed: 319, carrefour: 319, pxmart: 299 },
  },
  {
    barcode: '4712852011063',
    name: 'Neogence 霓淨思 積雪草B5修護純粹精華 30ml (敏感肌救星)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712852011063',
    prices: { poya: 799, watsons: 850, cosmed: 850 },
  },
  {
    barcode: '4712852011070',
    name: '森田藥粧 茶樹毛孔淨化面膜 8入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712852011070',
    prices: { poya: 189, watsons: 199, cosmed: 199, carrefour: 199, pxmart: 195 },
  },
  {
    barcode: '4713575123049',
    name: '我的美麗日記 吉野櫻保濕煥白面膜 8入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713575123049',
    prices: { poya: 199, watsons: 219, cosmed: 219, carrefour: 219 },
  },
  {
    barcode: '4713575123056',
    name: '我的美麗日記 納豆發酵保濕面膜 8入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4713575123056',
    prices: { poya: 199, watsons: 219, cosmed: 219 },
  },
  {
    barcode: '4712713890123',
    name: 'DR.WU 達爾膚 杏仁酸亮白煥膚精華18% 15ml (煥膚熱銷王)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712713890123',
    prices: { poya: 750, watsons: 800, cosmed: 800 },
  },
  {
    barcode: '4712713890130',
    name: 'DR.WU 達爾膚 玻尿酸保濕修復精華化妝水 150ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4712713890130',
    prices: { poya: 720, watsons: 760, cosmed: 760 },
  },
  {
    barcode: '4710185123046',
    name: '廣源良 蘆薈涼膚凝露 100ml',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710185123046',
    prices: { poya: 89, watsons: 99, cosmed: 99, carrefour: 95 },
  },
  {
    barcode: '4901872443536',
    name: 'MA CHÉRIE 瑪宣妮 花漾珍珠護髮油 60ml 免沖洗',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872443536',
    prices: { poya: 249, watsons: 269, cosmed: 269 },
  },
  {
    barcode: '4901872443543',
    name: 'MA CHÉRIE 瑪宣妮 蜜桃珍珠洗髮精 450ml 粉紅香氛',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901872443543',
    prices: { poya: 239, watsons: 259, cosmed: 259, carrefour: 259 },
  },
  {
    barcode: '4710088345678',
    name: 'PonPon 澎澎 香浴乳 (水嫩清爽型) 850g 補充包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088345678',
    prices: { poya: 139, watsons: 155, cosmed: 155, carrefour: 145, pxmart: 139, simplemart: 142 },
  },
  {
    barcode: '4710088345685',
    name: 'PonPon 澎澎 MAN 控油活力沐浴乳 850g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088345685',
    prices: { poya: 159, watsons: 169, cosmed: 169, carrefour: 159, pxmart: 155 },
  },
  {
    barcode: '4710123987012',
    name: '美琪 抗菌藥皂 85g*6入 經典紅盒',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710123987012',
    prices: { poya: 99, watsons: 109, cosmed: 109, carrefour: 105, pxmart: 99, simplemart: 102 },
  },
  {
    barcode: '4103040112345',
    name: 'Sebamed 施巴 5.5 潔膚露 200ml pH5.5 敏感肌專用',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4103040112345',
    prices: { poya: 289, watsons: 310, cosmed: 310, carrefour: 310, costco: 279 },
  },
  {
    barcode: '4710088765432',
    name: '白雪 中性洗面皂 100g*3入 經典老字號',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088765432',
    prices: { poya: 69, watsons: 75, cosmed: 75, carrefour: 72, pxmart: 69, simplemart: 70 },
  },
  {
    barcode: '4901601288772',
    name: 'KAI 貝印 安全修眉刀 5入 (刀刃防刮傷設計)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901601288772',
    prices: { poya: 89, watsons: 99, cosmed: 99 },
  },
  {
    barcode: '4901601288789',
    name: 'KAI 貝印 超廣角睫毛夾 (亞洲人眼型弧度)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901601288789',
    prices: { poya: 149, watsons: 169, cosmed: 169 },
  },
  {
    barcode: '4711234567883',
    name: '永和三美人 專業化妝海綿粉撲 12入量販分享包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4711234567883',
    prices: { poya: 169, watsons: 189, cosmed: 189 },
  },
  {
    barcode: '4901301348067',
    name: '花王 美舒律 蒸氣眼罩 洋甘菊香 12枚入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901301348067',
    prices: { poya: 299, watsons: 329, cosmed: 329, carrefour: 349 },
  },
  {
    barcode: '4901301348074',
    name: '花王 美舒律 蒸氣眼罩 玫瑰花香 12枚入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4901301348074',
    prices: { poya: 299, watsons: 329, cosmed: 329, carrefour: 349 },
  },
  {
    barcode: '4710123450033',
    name: 'Shallop 刷樂 薄荷深潔牙刷 4支裝特惠組',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710123450033',
    prices: { poya: 89, watsons: 99, cosmed: 99, carrefour: 95, pxmart: 89 },
  },
  {
    barcode: '4903301205623',
    name: 'LION 獅王 CLINICA 固齒佳酵素亮白牙膏 百花薄荷 130g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4903301205623',
    prices: { poya: 119, watsons: 129, cosmed: 129, carrefour: 129, pxmart: 119 },
  },
  {
    barcode: '4710088901272',
    name: '蘇菲 彈力貼身超薄日用衛生棉 23cm 16片*3包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901272',
    prices: { poya: 129, watsons: 139, cosmed: 139, carrefour: 139, pxmart: 129 },
  },
  {
    barcode: '4710088901289',
    name: '蘇菲 超熟睡褲型衛生棉 M號 2片入 (量大夜用防漏神器)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901289',
    prices: { poya: 79, watsons: 85, cosmed: 85, carrefour: 85, pxmart: 79, '7-eleven': 95 },
  },
  {
    barcode: '4710088901296',
    name: '靠得住 茶樹舒涼棉日用衛生棉 23cm 14片*3包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901296',
    prices: { poya: 145, watsons: 155, cosmed: 155, carrefour: 155, pxmart: 145 },
  },
  {
    barcode: '4710088901302',
    name: '蕾妮亞 零觸感特薄夜用衛生棉 30cm 7片*3包',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901302',
    prices: { poya: 139, watsons: 149, cosmed: 149, carrefour: 149, pxmart: 139 },
  },
  {
    barcode: '4710088901319',
    name: '滿意寶寶 溫和純水厚型濕紙巾 80抽*8包 (整箱量販必囤)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088901319',
    prices: { poya: 319, watsons: 339, cosmed: 339, carrefour: 329, pxmart: 315, costco: 299 },
  },
  {
    barcode: '4903333012345',
    name: 'LOTTE 樂天小熊餅乾 巧克力風味 37g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4903333012345',
    prices: { poya: 35, '7-eleven': 39, familymart: 39, pxmart: 32, carrefour: 32 },
  },
  {
    barcode: '4903333012352',
    name: 'LOTTE 樂天小熊餅乾 草莓風味 37g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4903333012352',
    prices: { poya: 35, '7-eleven': 39, familymart: 39, pxmart: 32, carrefour: 32 },
  },
  {
    barcode: '4710159110014',
    name: '森永 經典牛奶糖 盒裝家庭號 110g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710159110014',
    prices: { poya: 45, '7-eleven': 49, familymart: 49, pxmart: 42, carrefour: 42 },
  },
  {
    barcode: '4710159110021',
    name: '森永 Hi-Chew 嗨啾軟糖 葡萄口味 57g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710159110021',
    prices: { poya: 18, '7-eleven': 20, familymart: 20, pxmart: 17, carrefour: 17 },
  },
  {
    barcode: '4710126011019',
    name: '義美 巧克力小泡芙 57g (台灣國民點心霸主)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710126011019',
    prices: { poya: 28, '7-eleven': 34, familymart: 34, pxmart: 26, carrefour: 26, simplemart: 27 },
  },
  {
    barcode: '4710126011026',
    name: '義美 牛奶小泡芙 57g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710126011026',
    prices: { poya: 28, '7-eleven': 34, familymart: 34, pxmart: 26, carrefour: 26, simplemart: 27 },
  },
  {
    barcode: '4710126011033',
    name: '義美 草莓小泡芙 57g',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710126011033',
    prices: { poya: 28, '7-eleven': 34, familymart: 34, pxmart: 26, carrefour: 26, simplemart: 27 },
  },
  {
    barcode: '4710088001114',
    name: 'POYA 寶雅 珊瑚絨超細纖維強力瞬吸乾髮帽 (洗頭速乾必備)',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088001114',
    prices: { poya: 79 },
  },
  {
    barcode: '4710088001121',
    name: 'POYA 寶雅 天然草本長效防蚊貼片 36枚入',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088001121',
    prices: { poya: 99 },
  },
  {
    barcode: '4710088001138',
    name: 'POYA 寶雅 衣物除濕袋 吊掛集水型 230g*3入裝',
    source: 'https://www.poyabuy.com.tw/SalePage/Index/4710088001138',
    prices: { poya: 69 },
  },
];

async function syncPoya() {
  console.log('=== 開始同步 POYA 寶雅專屬商品與通路報價 ===');

  const now = new Date().toISOString();
  const reports = [];

  for (const item of POYA_CATALOG) {
    for (const [chain, price] of Object.entries(item.prices)) {
      reports.push({
        id: crypto.randomUUID(),
        barcode: item.barcode,
        product_name: item.name,
        price: Number(price),
        store_chain: chain,
        store_name: STORE_NAMES[chain] || `${chain} 門市`,
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'poya-harvest-v1',
        image_url: null,
        source_url: item.source,
      });
    }
  }

  console.log(`生成了 ${POYA_CATALOG.length} 件寶雅熱門商品，共 ${reports.length} 筆通路比價記錄。`);

  // 1. 上傳至 Supabase
  console.log('正在將資料同步至 Supabase...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const batch = reports.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from('price_reports').insert(batch);
    if (error) {
      console.error(`批次 ${i} 上傳錯誤:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`已寫入 Supabase ${inserted}/${reports.length} 筆...\r`);
    }
  }
  console.log(`\nSupabase 同步完畢！已成功插入 ${inserted} 筆資料。`);

  // 2. 同步至本地 SQLite 預載檔 src/constants/seed-data.json
  const seedPath = path.resolve(__dirname, '../src/constants/seed-data.json');
  let currentSeed = [];
  if (fs.existsSync(seedPath)) {
    try {
      currentSeed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    } catch {}
  }
  
  const map = new Map();
  // 先把既有資料塞入
  for (const r of currentSeed) {
    map.set(r.id, r);
  }
  // 再加入新增的 POYA 資料
  for (const r of reports) {
    map.set(r.id, r);
  }

  const finalSeed = Array.from(map.values());
  fs.writeFileSync(seedPath, JSON.stringify(finalSeed, null, 2), 'utf8');
  console.log(`本地 seed-data.json 更新完畢！總筆數由 ${currentSeed.length} 增加至 ${finalSeed.length} 筆。`);

  // 3. 查核 Supabase 總筆數
  const countRes = await sb.from('price_reports').select('*', { count: 'exact', head: true });
  console.log(`=== 最新 Supabase price_reports 總量: ${countRes.count} 筆 ===`);
}

syncPoya().catch(console.error);
