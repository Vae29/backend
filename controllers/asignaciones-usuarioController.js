import { fetchAllFincas, fetchCultivosEnProceso, fetchCultivosPorFinca } from '../models/asinaciones-usuarioModel.js';

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

export async function getCultivosPorFinca(req, res) {
  try {
    const { fincaId } = req.params;
    if (!fincaId || isNaN(fincaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de finca inválido',
      });
    }
    const cultivos = await fetchCultivosPorFinca(Number(fincaId));
    res.json({
      success: true,
      data: cultivos,
    });
  } catch (error) {
    console.error('Error en getCultivosPorFinca:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cultivos de la finca',
    });
  }
}
