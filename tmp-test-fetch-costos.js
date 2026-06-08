import { fetchCostosPorFinca } from './models/asinaciones-usuarioModel.js';

(async () => {
  try {
    const res = await fetchCostosPorFinca(2);
    console.log('RESULT:', JSON.stringify(res.slice(0, 10), null, 2));
  } catch (err) {
    console.error('ERROR running fetchCostosPorFinca:', err);
    process.exit(1);
  }
})();
