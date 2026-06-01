const http = require('http');
const urls = [
  'http://localhost:3000/api/unidades-medida',
  'http://localhost:3000/api/tipos-precio',
  'http://localhost:3000/api/cultivos/2/cosechas',
];

function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ url, status: res.statusCode, body: data }));
    }).on('error', (err) => resolve({ url, error: err.message }));
  });
}

(async () => {
  for (const url of urls) {
    const r = await get(url);
    console.log('===', url);
    if (r.error) {
      console.log('ERROR', r.error);
    } else {
      console.log('Status:', r.status);
      console.log(r.body);
    }
  }
})();
