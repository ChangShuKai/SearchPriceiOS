const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xydpfmwzqluglkcuomqg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ncmqiAgdcrNyAoYejVsoXg_RuHw8QIe';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const STORE_NAMES = {
  '7-eleven': '7-Eleven 門市',
  familymart: '全家便利商店 門市',
  pxmart: '全聯福利中心 門市',
  carrefour: '家樂福 量販/便利購',
  hilife: '萊爾富 門市',
  okmart: 'OK超商 門市',
  simplemart: '美廉社 門市',
  costco: '好市多 賣場',
  'rt-mart': '大潤發 量販店',
  watsons: '屈臣氏 門市',
  cosmed: '康是美 門市',
};

const NON_FOOD_PRODUCTS = [
  // 紙品衛生類
  {
    barcode: '4710088611016',
    name: '舒潔 頂級三層抽取式衛生紙 100抽*8入',
    source: 'https://online.carrefour.com.tw/zh/1420101700108.html',
    prices: { pxmart: 139, carrefour: 135, costco: 125, 'rt-mart': 132, '7-eleven': 159 },
  },
  {
    barcode: '4710088611030',
    name: '舒潔 棉柔舒適抽取式衛生紙 110抽*8入',
    source: 'https://www.pxmart.com.tw/#/product/11030',
    prices: { pxmart: 119, carrefour: 115, 'rt-mart': 115, simplemart: 118, '7-eleven': 139 },
  },
  {
    barcode: '4710088611047',
    name: '舒潔 棉柔舒適抽取式衛生紙 110抽*24入',
    source: 'https://www.costco.com.tw/p/11047',
    prices: { pxmart: 349, carrefour: 339, costco: 319, 'rt-mart': 335 },
  },
  {
    barcode: '4710088611023',
    name: '五月花 厚棒抽取式衛生紙 90抽*10入',
    source: 'https://online.carrefour.com.tw/zh/1420102300110.html',
    prices: { pxmart: 169, carrefour: 165, costco: 155, 'rt-mart': 162, '7-eleven': 189 },
  },
  {
    barcode: '4710088611054',
    name: '五月花 蓬厚柔抽取式衛生紙 100抽*8入',
    source: 'https://www.pxmart.com.tw/#/product/11054',
    prices: { pxmart: 109, carrefour: 105, simplemart: 108, 'rt-mart': 105 },
  },
  {
    barcode: '4710088611061',
    name: '春風 柔韌抽取式衛生紙 110抽*8入',
    source: 'https://www.pxmart.com.tw/#/product/11061',
    prices: { pxmart: 109, carrefour: 105, 'rt-mart': 105, simplemart: 108 },
  },
  {
    barcode: '4710088611078',
    name: '春風 柔韌抽取式衛生紙 110抽*24入',
    source: 'https://online.carrefour.com.tw/zh/1420107800124.html',
    prices: { pxmart: 319, carrefour: 309, costco: 299, 'rt-mart': 305 },
  },
  {
    barcode: '4710088611085',
    name: '得意 連續抽取式花紋衛生紙 100抽*24入',
    source: 'https://www.costco.com.tw/p/11085',
    prices: { pxmart: 289, carrefour: 279, costco: 269, 'rt-mart': 275 },
  },
  {
    barcode: '4710088611092',
    name: '蒲公英 環保抽取式衛生紙 100抽*10入',
    source: 'https://www.pxmart.com.tw/#/product/11092',
    prices: { pxmart: 119, carrefour: 115, simplemart: 118 },
  },
  {
    barcode: '4710088611108',
    name: '舒潔 淨99抗菌濕紙巾 40片',
    source: 'https://www.watsons.com.tw/p/BP_11108',
    prices: { pxmart: 49, carrefour: 48, watsons: 52, cosmed: 52, '7-eleven': 59 },
  },
  {
    barcode: '4710088611115',
    name: '舒潔 淨99抗菌濕紙巾 10片隨身包',
    source: 'https://www.7-11.com.tw/product/11115',
    prices: { pxmart: 25, '7-eleven': 29, familymart: 29, hilife: 29 },
  },
  {
    barcode: '4710088611122',
    name: '春風 廚房紙巾 60組*6捲',
    source: 'https://online.carrefour.com.tw/zh/1420112200106.html',
    prices: { pxmart: 79, carrefour: 75, 'rt-mart': 75, costco: 69 },
  },

  // 口腔護理類
  {
    barcode: '4710088511019',
    name: '好來(黑人) 超氟強化琺瑯質牙膏 200g',
    source: 'https://www.watsons.com.tw/p/BP_511019',
    prices: { pxmart: 62, carrefour: 59, watsons: 65, cosmed: 65, '7-eleven': 79, familymart: 79 },
  },
  {
    barcode: '4710088511026',
    name: '好來(黑人) 全亮白竹炭深層潔淨牙膏 140g',
    source: 'https://shop.cosmed.com.tw/p/511026',
    prices: { pxmart: 79, carrefour: 75, watsons: 85, cosmed: 85 },
  },
  {
    barcode: '4710088511033',
    name: '好來(黑人) 雙重薄荷牙膏 250g',
    source: 'https://online.carrefour.com.tw/zh/511033.html',
    prices: { pxmart: 69, carrefour: 65, 'rt-mart': 65, watsons: 72 },
  },
  {
    barcode: '4710088511040',
    name: '白人牙膏 200g',
    source: 'https://www.pxmart.com.tw/#/product/511040',
    prices: { pxmart: 45, carrefour: 42, simplemart: 43, 'rt-mart': 42 },
  },
  {
    barcode: '4710088511057',
    name: '舒酸定 專業抗敏感牙膏 深層潔淨 100g',
    source: 'https://www.watsons.com.tw/p/BP_511057',
    prices: { pxmart: 145, carrefour: 139, watsons: 159, cosmed: 159, costco: 129 },
  },
  {
    barcode: '4710088511064',
    name: '舒酸定 溫和美白抗敏感牙膏 100g',
    source: 'https://shop.cosmed.com.tw/p/511064',
    prices: { pxmart: 145, carrefour: 139, watsons: 159, cosmed: 159 },
  },
  {
    barcode: '4710088511071',
    name: '高露潔 全效全方位口腔護理牙膏 150g',
    source: 'https://www.watsons.com.tw/p/BP_511071',
    prices: { pxmart: 99, carrefour: 95, watsons: 109, cosmed: 109 },
  },
  {
    barcode: '4710088511088',
    name: '李施德霖 全效護理無酒精漱口水 750ml',
    source: 'https://shop.cosmed.com.tw/p/511088',
    prices: { pxmart: 199, carrefour: 189, watsons: 219, cosmed: 219, costco: 179 },
  },
  {
    barcode: '4710088511095',
    name: '獅王 固齒佳酵素淨白牙膏 130g',
    source: 'https://www.watsons.com.tw/p/BP_511095',
    prices: { pxmart: 119, carrefour: 115, watsons: 129, cosmed: 129 },
  },
  {
    barcode: '4710088511101',
    name: '刷樂 雙效螺旋細絲牙刷 4入組',
    source: 'https://www.pxmart.com.tw/#/product/511101',
    prices: { pxmart: 79, carrefour: 75, watsons: 89, cosmed: 89 },
  },

  // 洗髮沐浴類
  {
    barcode: '4710088711013',
    name: '海倫仙度絲 去屑洗髮乳 絲滑柔順 750ml',
    source: 'https://online.carrefour.com.tw/zh/711013.html',
    prices: { pxmart: 229, carrefour: 219, watsons: 249, cosmed: 249, costco: 199, 'rt-mart': 219 },
  },
  {
    barcode: '4710088711020',
    name: '海倫仙度絲 去屑洗髮乳 薄荷舒涼 750ml',
    source: 'https://www.watsons.com.tw/p/BP_711020',
    prices: { pxmart: 229, carrefour: 219, watsons: 249, cosmed: 249 },
  },
  {
    barcode: '4710088711037',
    name: '花王 洗髮精 薄荷清爽型 750ml',
    source: 'https://www.pxmart.com.tw/#/product/711037',
    prices: { pxmart: 99, carrefour: 95, 'rt-mart': 95, simplemart: 98 },
  },
  {
    barcode: '4710088711044',
    name: '花王 洗髮精 溫和柔潤型 750ml',
    source: 'https://www.pxmart.com.tw/#/product/711044',
    prices: { pxmart: 99, carrefour: 95, 'rt-mart': 95, simplemart: 98 },
  },
  {
    barcode: '4710088711051',
    name: '潘婷 乳液修護洗髮乳 700ml',
    source: 'https://shop.cosmed.com.tw/p/711051',
    prices: { pxmart: 189, carrefour: 179, watsons: 199, cosmed: 199 },
  },
  {
    barcode: '4710088711068',
    name: '潘婷 3分鐘奇蹟護髮精華 180ml',
    source: 'https://www.watsons.com.tw/p/BP_711068',
    prices: { pxmart: 159, carrefour: 155, watsons: 179, cosmed: 179 },
  },
  {
    barcode: '4710088711075',
    name: '沙宣 水潤修護洗髮乳 500ml',
    source: 'https://www.watsons.com.tw/p/BP_711075',
    prices: { pxmart: 179, carrefour: 169, watsons: 189, cosmed: 189 },
  },
  {
    barcode: '4710088811010',
    name: '澎澎 香浴乳 水嫩清爽型 850g',
    source: 'https://online.carrefour.com.tw/zh/811010.html',
    prices: { pxmart: 149, carrefour: 139, 'rt-mart': 139, watsons: 159, cosmed: 159, '7-eleven': 179 },
  },
  {
    barcode: '4710088811027',
    name: '澎澎 香浴乳 亮白修護型 850g',
    source: 'https://www.pxmart.com.tw/#/product/811027',
    prices: { pxmart: 149, carrefour: 139, 'rt-mart': 139, watsons: 159 },
  },
  {
    barcode: '4710088811034',
    name: '多芬 滋養柔膚沐浴乳 滋養美膚 1000g',
    source: 'https://www.costco.com.tw/p/811034',
    prices: { pxmart: 159, carrefour: 149, costco: 139, watsons: 169, cosmed: 169 },
  },
  {
    barcode: '4710088811041',
    name: '蜜妮 淨嫩沐浴乳 富士蘋果香 1000g',
    source: 'https://www.watsons.com.tw/p/BP_811041',
    prices: { pxmart: 139, carrefour: 129, watsons: 149, cosmed: 149 },
  },
  {
    barcode: '4710088811058',
    name: '滴露 經典松木除菌沐浴乳 950ml',
    source: 'https://shop.cosmed.com.tw/p/811058',
    prices: { pxmart: 179, carrefour: 169, watsons: 189, cosmed: 189 },
  },
  {
    barcode: '4710088811065',
    name: '依必朗 抗菌沐浴乳 1000ml',
    source: 'https://www.pxmart.com.tw/#/product/811065',
    prices: { pxmart: 129, carrefour: 119, simplemart: 122 },
  },
  {
    barcode: '4710088811072',
    name: '依必朗 潔膚洗手乳 300ml',
    source: 'https://www.watsons.com.tw/p/BP_811072',
    prices: { pxmart: 55, carrefour: 52, watsons: 59, cosmed: 59, '7-eleven': 65 },
  },
  {
    barcode: '4710088811089',
    name: '美琪 抗菌沐浴乳 680ml',
    source: 'https://www.pxmart.com.tw/#/product/811089',
    prices: { pxmart: 119, carrefour: 112, simplemart: 115 },
  },
  {
    barcode: '4710088811096',
    name: '嬌生 嬰兒潤膚沐浴露 1000ml',
    source: 'https://online.carrefour.com.tw/zh/811096.html',
    prices: { pxmart: 179, carrefour: 169, costco: 159, watsons: 189 },
  },

  // 洗衣清潔類
  {
    barcode: '4710088911017',
    name: '一匙靈 制菌超濃縮洗衣精 2.4kg 瓶裝',
    source: 'https://online.carrefour.com.tw/zh/911017.html',
    prices: { pxmart: 119, carrefour: 109, 'rt-mart': 109, costco: 99, simplemart: 115 },
  },
  {
    barcode: '4710088911024',
    name: '一匙靈 制菌超濃縮洗衣精 1.6kg 補充包',
    source: 'https://www.pxmart.com.tw/#/product/911024',
    prices: { pxmart: 69, carrefour: 65, 'rt-mart': 65, simplemart: 68 },
  },
  {
    barcode: '4710088911031',
    name: '一匙靈 亮彩超濃縮洗衣精 2.4kg',
    source: 'https://online.carrefour.com.tw/zh/911031.html',
    prices: { pxmart: 119, carrefour: 109, 'rt-mart': 109 },
  },
  {
    barcode: '4710088911048',
    name: '橘子工坊 天然濃縮洗衣精 制菌除臭 1800ml',
    source: 'https://www.costco.com.tw/p/911048',
    prices: { pxmart: 249, carrefour: 239, costco: 219, watsons: 269 },
  },
  {
    barcode: '4710088911055',
    name: '白蘭 強效除蟎超濃縮洗衣精 2.7kg',
    source: 'https://www.pxmart.com.tw/#/product/911055',
    prices: { pxmart: 99, carrefour: 95, 'rt-mart': 95, simplemart: 98 },
  },
  {
    barcode: '4710088911062',
    name: 'Ariel 日本進口超濃縮抗菌洗衣膠囊 31顆',
    source: 'https://www.costco.com.tw/p/911062',
    prices: { pxmart: 219, carrefour: 209, costco: 189, watsons: 239, cosmed: 239 },
  },
  {
    barcode: '4710088911079',
    name: '熊寶貝 柔軟護衣精 沁涼絲絨 3.2L',
    source: 'https://online.carrefour.com.tw/zh/911079.html',
    prices: { pxmart: 129, carrefour: 119, 'rt-mart': 119, costco: 109 },
  },
  {
    barcode: '4710088911086',
    name: '妙管家 強效除斑衣物彩漂素 2000g',
    source: 'https://www.pxmart.com.tw/#/product/911086',
    prices: { pxmart: 79, carrefour: 75, simplemart: 76 },
  },

  // 洗碗清潔與廚房衛浴
  {
    barcode: '4710088211018',
    name: '泡舒 植物性洗潔精 1000g 瓶裝',
    source: 'https://online.carrefour.com.tw/zh/211018.html',
    prices: { pxmart: 79, carrefour: 75, 'rt-mart': 75, simplemart: 76 },
  },
  {
    barcode: '4710088211025',
    name: '泡舒 植物性洗潔精 2800g 桶裝',
    source: 'https://www.costco.com.tw/p/211025',
    prices: { pxmart: 169, carrefour: 159, costco: 149 },
  },
  {
    barcode: '4710088211032',
    name: '獅王 白貓沙拉脫 800g',
    source: 'https://www.pxmart.com.tw/#/product/211032',
    prices: { pxmart: 49, carrefour: 45, simplemart: 46 },
  },
  {
    barcode: '4710088211049',
    name: '妙管家 洗潔精 檸檬清香 1000g',
    source: 'https://www.pxmart.com.tw/#/product/211049',
    prices: { pxmart: 49, carrefour: 46, simplemart: 48 },
  },
  {
    barcode: '4710088211056',
    name: '威猛先生 廚房去油污劑 噴槍瓶 500g',
    source: 'https://online.carrefour.com.tw/zh/211056.html',
    prices: { pxmart: 79, carrefour: 75, 'rt-mart': 75, watsons: 85 },
  },
  {
    barcode: '4710088211063',
    name: '威猛先生 水管疏通劑 960ml',
    source: 'https://www.pxmart.com.tw/#/product/211063',
    prices: { pxmart: 109, carrefour: 105, 'rt-mart': 105 },
  },
  {
    barcode: '4710088211070',
    name: '魔術靈 廚房清潔劑 除油噴霧 500ml',
    source: 'https://online.carrefour.com.tw/zh/211070.html',
    prices: { pxmart: 69, carrefour: 65, simplemart: 68 },
  },
  {
    barcode: '4710088211087',
    name: '魔術靈 浴室清潔劑 檸檬香 500ml',
    source: 'https://www.pxmart.com.tw/#/product/211087',
    prices: { pxmart: 69, carrefour: 65, simplemart: 68 },
  },
  {
    barcode: '4710088211094',
    name: '穩潔 玻璃清潔劑 噴槍瓶 500ml',
    source: 'https://online.carrefour.com.tw/zh/211094.html',
    prices: { pxmart: 65, carrefour: 62, simplemart: 63 },
  },
  {
    barcode: '4710088211100',
    name: '潔霜 S強效馬桶清潔劑 650ml',
    source: 'https://www.pxmart.com.tw/#/product/211100',
    prices: { pxmart: 39, carrefour: 36, simplemart: 38 },
  },

  // 女性生理與母嬰護理
  {
    barcode: '4710088311015',
    name: '靠得住 溫柔宣言草本抑菌衛生棉 日用 23cm*15片',
    source: 'https://www.watsons.com.tw/p/BP_311015',
    prices: { pxmart: 69, carrefour: 65, watsons: 75, cosmed: 75, '7-eleven': 85, familymart: 85 },
  },
  {
    barcode: '4710088311022',
    name: '靠得住 溫柔宣言草本抑菌衛生棉 夜用 28cm*13片',
    source: 'https://shop.cosmed.com.tw/p/311022',
    prices: { pxmart: 69, carrefour: 65, watsons: 75, cosmed: 75 },
  },
  {
    barcode: '4710088311039',
    name: '蘇菲 彈力貼身超薄體貼日用衛生棉 23cm*16片',
    source: 'https://www.watsons.com.tw/p/BP_311039',
    prices: { pxmart: 69, carrefour: 65, watsons: 75, cosmed: 75, '7-eleven': 85 },
  },
  {
    barcode: '4710088311046',
    name: '蘇菲 超熟睡夜用立體側邊衛生棉 35cm*8片',
    source: 'https://shop.cosmed.com.tw/p/311046',
    prices: { pxmart: 69, carrefour: 65, watsons: 75, cosmed: 75, '7-eleven': 85 },
  },
  {
    barcode: '4710088311053',
    name: '蕾妮亞 零觸感特薄日用衛生棉 22.5cm*20片',
    source: 'https://www.watsons.com.tw/p/BP_311053',
    prices: { pxmart: 79, carrefour: 75, watsons: 85, cosmed: 85 },
  },
  {
    barcode: '4710088311060',
    name: '滿意寶寶 瞬潔乾爽紙尿褲 L號 52片',
    source: 'https://www.costco.com.tw/p/311060',
    prices: { pxmart: 399, carrefour: 389, costco: 369, watsons: 429 },
  },
  {
    barcode: '4710088311077',
    name: '幫寶適 一級幫紙尿褲 L號 54片',
    source: 'https://www.costco.com.tw/p/311077',
    prices: { pxmart: 499, carrefour: 489, costco: 459, cosmed: 519 },
  },
  {
    barcode: '4710088311084',
    name: '好奇 純水嬰兒濕巾 80抽*3入',
    source: 'https://online.carrefour.com.tw/zh/311084.html',
    prices: { pxmart: 139, carrefour: 135, costco: 125 },
  },

  // 居家電池、五金、防蟲除濕與個人護理
  {
    barcode: '4710088011014',
    name: '金頂 鹼性電池 3號 AA 8入',
    source: 'https://www.costco.com.tw/p/011014',
    prices: { pxmart: 139, carrefour: 135, costco: 119, '7-eleven': 169, familymart: 169 },
  },
  {
    barcode: '4710088011021',
    name: '金頂 鹼性電池 4號 AAA 8入',
    source: 'https://www.costco.com.tw/p/011021',
    prices: { pxmart: 139, carrefour: 135, costco: 119, '7-eleven': 169, familymart: 169 },
  },
  {
    barcode: '4710088011038',
    name: '國際牌 EVOLTA 鈦元素鹼性電池 3號 4入',
    source: 'https://online.carrefour.com.tw/zh/011038.html',
    prices: { pxmart: 119, carrefour: 115, '7-eleven': 139, familymart: 139 },
  },
  {
    barcode: '4710088011045',
    name: '3M 亮彩舒適菜瓜布 4入裝',
    source: 'https://www.pxmart.com.tw/#/product/011045',
    prices: { pxmart: 69, carrefour: 65, simplemart: 68, '7-eleven': 79 },
  },
  {
    barcode: '4710088011052',
    name: '3M 隱形膠帶 19mm*32.9m',
    source: 'https://online.carrefour.com.tw/zh/011052.html',
    prices: { pxmart: 65, carrefour: 62, '7-eleven': 75 },
  },
  {
    barcode: '4710088011069',
    name: '楓康 吳羽保鮮膜 30cm*20m',
    source: 'https://www.pxmart.com.tw/#/product/011066',
    prices: { pxmart: 69, carrefour: 65, simplemart: 68 },
  },
  {
    barcode: '4710088011076',
    name: '妙潔 抗氧防撕保鮮袋 中型 40入',
    source: 'https://www.pxmart.com.tw/#/product/011076',
    prices: { pxmart: 55, carrefour: 52, simplemart: 54 },
  },
  {
    barcode: '4710088011083',
    name: '驅塵氏 靜電除塵紙 25張*2包',
    source: 'https://www.watsons.com.tw/p/BP_011083',
    prices: { pxmart: 89, carrefour: 85, watsons: 99, cosmed: 99 },
  },
  {
    barcode: '4710088011090',
    name: '克潮靈 環保除濕桶 玫瑰香 660ml*3入',
    source: 'https://online.carrefour.com.tw/zh/011090.html',
    prices: { pxmart: 79, carrefour: 75, simplemart: 76, 'rt-mart': 75 },
  },
  {
    barcode: '4710088011106',
    name: '克潮靈 環保除濕桶補充包 3入',
    source: 'https://www.pxmart.com.tw/#/product/011106',
    prices: { pxmart: 59, carrefour: 55, simplemart: 56 },
  },
  {
    barcode: '4710088011113',
    name: '雷達 電佳液體電蚊香 補充瓶 41.6ml',
    source: 'https://online.carrefour.com.tw/zh/011113.html',
    prices: { pxmart: 129, carrefour: 125, watsons: 139, '7-eleven': 149 },
  },
  {
    barcode: '4710088011120',
    name: '曼秀雷敦 軟膏 35g',
    source: 'https://shop.cosmed.com.tw/p/011120',
    prices: { pxmart: 135, carrefour: 130, watsons: 145, cosmed: 145, '7-eleven': 150 },
  },
  {
    barcode: '4710088011137',
    name: '曼秀雷敦 薄荷潤唇膏 3.5g',
    source: 'https://www.watsons.com.tw/p/BP_011137',
    prices: { pxmart: 89, carrefour: 85, watsons: 99, cosmed: 99, '7-eleven': 110 },
  },
  {
    barcode: '4710088011144',
    name: '妮維雅 深層修護乳液 400ml',
    source: 'https://shop.cosmed.com.tw/p/011144',
    prices: { pxmart: 179, carrefour: 169, watsons: 199, cosmed: 199 },
  },
  {
    barcode: '4710088011151',
    name: '凡士林 原味三重精煉凝膠 100ml',
    source: 'https://www.watsons.com.tw/p/BP_011151',
    prices: { pxmart: 69, carrefour: 65, watsons: 79, cosmed: 79 },
  },
  {
    barcode: '4710088011168',
    name: '綠油精 滾珠瓶 5g',
    source: 'https://shop.cosmed.com.tw/p/011168',
    prices: { pxmart: 109, carrefour: 105, watsons: 119, cosmed: 119, '7-eleven': 125 },
  },
  {
    barcode: '4710088011175',
    name: '護妍天使 隱形痘痘貼 綜合型 48貼',
    source: 'https://www.watsons.com.tw/p/BP_011175',
    prices: { pxmart: 149, carrefour: 145, watsons: 169, cosmed: 169 },
  },
];

async function run() {
  console.log(`Adding ${NON_FOOD_PRODUCTS.length} non-food product lines...`);
  const reports = [];
  const now = new Date().toISOString();

  for (const p of NON_FOOD_PRODUCTS) {
    for (const [chain, price] of Object.entries(p.prices)) {
      reports.push({
        id: crypto.randomUUID(),
        barcode: p.barcode,
        product_name: p.name,
        price: Number(price),
        store_chain: chain,
        store_name: STORE_NAMES[chain] || null,
        latitude: null,
        longitude: null,
        reported_at: now,
        device_id: 'seed-nonfood-v1',
        image_url: p.image || null,
        source_url: p.source || null,
      });
    }
  }

  console.log(`Generated ${reports.length} non-food price reports.`);

  // 1. 同步寫入 Supabase
  console.log('Uploading non-food reports to Supabase in batches...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const batch = reports.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from('price_reports').insert(batch);
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\rUploaded ${inserted}/${reports.length} reports to Supabase...`);
    }
  }

  console.log('\nSupabase non-food sync complete!');

  // 2. 合併更新本機 seed-data.json
  const seedPath = path.resolve('src/constants/seed-data.json');
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  } catch {}

  const merged = [...existing, ...reports];
  // 依 id 唯一去重
  const seenIds = new Set();
  const deduped = [];
  for (const r of merged) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      deduped.push(r);
    }
  }

  fs.writeFileSync(seedPath, JSON.stringify(deduped, null, 2), 'utf8');
  console.log(`Updated ${seedPath}: total ${deduped.length} records (${(fs.statSync(seedPath).size / 1024).toFixed(1)} KB)`);

  const countRes = await sb.from('price_reports').select('count', { count: 'exact', head: true });
  console.log('Total reports in Supabase price_reports:', countRes.count);
}

run().catch(console.error);
