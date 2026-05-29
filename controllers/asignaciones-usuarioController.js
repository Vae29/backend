import { fetchAllFincas, fetchCultivosEnProceso, fetchCultivosPorFinca, fetchTiposCultivo, fetchEstados, fetchEstadoById, createCultivo, updateCultivo } from '../models/asinaciones-usuarioModel.js';

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

export async function getTiposCultivo(req, res) {
  try {
    const tipos = await fetchTiposCultivo();
    res.json({
      success: true,
      data: tipos,
    });
  } catch (error) {
    console.error('Error en getTiposCultivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de cultivo',
    });
  }
}

export async function postCultivo(req, res) {
  try {
    const { nombre, idtipocultivo, idfinca } = req.body;
    if (!nombre || !idtipocultivo || !idfinca) {
      return res.status(400).json({
        success: false,
        message: 'Información incompleta para crear el cultivo',
      });
    }

    const cultivo = await createCultivo({ nombre: nombre.trim(), idtipocultivo, idfinca });
    res.status(201).json({
      success: true,
      data: cultivo,
    });
  } catch (error) {
    console.error('Error en postCultivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el cultivo',
    });
  }
}

export async function getEstados(req, res) {
  try {
    const estados = await fetchEstados();
    res.json({
      success: true,
      data: estados,
    });
  } catch (error) {
    console.error('Error en getEstados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estados',
    });
  }
}

export async function putCultivo(req, res) {
  try {
    const { id } = req.params;
    const cultivoId = Number(id);
    if (!cultivoId || isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo inválido' });
    }

    const { nombre, idtipocultivo, idestado, fecha_inicio } = req.body;
    if (!nombre || !idtipocultivo || !idestado) {
      return res.status(400).json({ success: false, message: 'Datos incompletos para actualizar cultivo' });
    }

    // Determinar si el nuevo estado es 'Finalizado'
    const estadoNombre = await fetchEstadoById(Number(idestado));
    const estadoLower = typeof estadoNombre === 'string' ? estadoNombre.toLowerCase() : '';
    // Si el estado es finalizado, perdido o suspendido, establecer fecha_final a la fecha actual
    const fecha_final = ['finalizado', 'perdido', 'suspendido'].includes(estadoLower) ? new Date() : null;

    const updated = await updateCultivo(cultivoId, {
      nombre: nombre.trim(),
      idtipocultivo: Number(idtipocultivo),
      idestado: Number(idestado),
      fecha_inicio: fecha_inicio || null,
      fecha_final,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error en putCultivo:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar cultivo' });
  }
}
