import { fetchAllFincas, fetchCultivosEnProceso } from '../models/asinaciones-usuarioModel.js';

export async function getFincas(req, res) {
  try {
    const fincas = await fetchAllFincas();
    res.json({
      success: true,
      data: fincas,
    });
  } catch (error) {
    console.error('Error en getFincas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener fincas',
    });
  }
}

export async function getCultivosEnProceso(req, res) {
  try {
    const cultivos = await fetchCultivosEnProceso();
    res.json({
      success: true,
      data: cultivos,
    });
  } catch (error) {
    console.error('Error en getCultivosEnProceso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cultivos',
    });
  }
}
