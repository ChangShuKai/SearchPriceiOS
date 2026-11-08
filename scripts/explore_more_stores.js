const https = require('https');
const http = require('http');

function req(url, options = {}) {
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
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: options.accept || '*/*',
            ...(options.headers || {}),
          },
          timeout: 10000,
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () =>
            resolve({
              url,
              status: res.statusCode,
              headers: res.headers,
              data: d,
            }),
          );
        },
      );
      r.on('error', (e) => resolve({ url, status: 0, err: e.message }));
      r.on('timeout', () => {
        r.destroy();
        resolve({ url, status: 0, err: 'timeout' });
      });
      if (options.body) r.write(options.body);
      r.end();
    } catch (e) {
      resolve({ url, status: 0, err: e.message });
    }
  });
}

async function main() {
  console.log('=== 探索更多通路 API ===');

  // 1. PChome 24h API
  const pchome = await req('https://ecapi-cdn.pchome.com.tw/ecshop/prodapi/v2/prod/search?q=' + encodeURIComponent('電池') + '&fields=Id,Name,Price,Nick,Pic');
  console.log('PChome API status:', pchome.status, 'len:', pchome.data.length);
  if (pchome.status === 200) {
    try {
      const j = JSON.parse(pchome.data);
      console.log('  PChome sample:', j.rows?.slice(0, 2).map(r => ({ name: r.Name, price: r.Price?.P, id: r.Id })));
    } catch (e) {
      console.log('  PChome parse err:', e.message);
    }
  }

  // 1b. PChome 24h v5 search api
  const pchome5 = await req('https://ecshweb.pchome.com.tw/search/v3.3/all/results?q=' + encodeURIComponent('電池') + '&page=1&sort=rnk/dc');
  console.log('PChome v3.3 status:', pchome5.status, 'len:', pchome5.data.length);
  if (pchome5.status === 200) {
    try {
      const j = JSON.parse(pchome5.data);
      console.log('  PChome v3.3 sample:', j.prods?.slice(0, 2).map(p => ({ name: p.name, price: p.price, id: p.Id })));
    } catch (e) {
      console.log('  PChome v3.3 parse err:', e.message);
    }
  }

  // 2. momo 搜尋 API
  const momo = await req('https://m.momoshop.com.tw/search.momo?_advFirst=N&_advSecond=N&searchType=1&curPage=1&priceS=&priceE=&searchKeyword=' + encodeURIComponent('電池'));
  console.log('momo mobile search status:', momo.status, 'len:', momo.data.length);

  // 3. 全聯線上購物 / 全聯生活誌
  const px1 = await req('https://www.pxmart.com.tw/#/lifestyle');
  console.log('PXMart lifestyle status:', px1.status, 'len:', px1.data.length);

  // 4. 愛買 a.mart
  const amart = await req('https://www.fe-amart.com.tw/');
  console.log('a.mart status:', amart.status, 'len:', amart.data.length);

  // 5. 美廉社 SimpleMart DM / Products
  const simple = await req('https://www.simplemart.com.tw/product.aspx');
  console.log('SimpleMart product page status:', simple.status, 'len:', simple.data.length);
}

main().catch(console.error);
