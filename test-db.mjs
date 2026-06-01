import { fetchUnidadesMedida, fetchTiposPrecio, fetchCosechasPorCultivo } from './models/asinaciones-usuarioModel.js';

async function run() {
  try {
    console.log('fetchUnidadesMedida');
    const u = await fetchUnidadesMedida();
    console.log(u);
  } catch (error) {
    console.error('fetchUnidadesMedida error:', error);
  }

  try {
    console.log('fetchTiposPrecio');
    const t = await fetchTiposPrecio();
    console.log(t);
  } catch (error) {
    console.error('fetchTiposPrecio error:', error);
  }

  try {
    console.log('fetchCosechasPorCultivo');
    const c = await fetchCosechasPorCultivo(2);
    console.log(c);
  } catch (error) {
    console.error('fetchCosechasPorCultivo error:', error);
  }
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
