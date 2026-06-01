import { fetchAllFincas, fetchCultivosEnProceso, fetchCultivosPorFinca, fetchCultivoDetalleById, fetchCategoriasCosto, fetchSubcategoriasPorCategoria, fetchEstadosPago, fetchEtapaEnProcesoPorCultivo, validateCultivoCanAddCosto, createCosto, fetchTiposCultivo, fetchEstados, fetchEstadoById, createCultivo, updateCultivo, fetchCultivosPorUsuario, fetchFincasPorUsuario, deleteOrDeactivateEtapaById } from '../models/asinaciones-usuarioModel.js';
import { fetchEtapasPorCultivo, fetchAllEtapasCatalog, finalizeEtapaEnProceso, createEtapaParaCultivo } from '../models/asinaciones-usuarioModel.js';
import { deleteCultivoById } from '../models/asinaciones-usuarioModel.js';

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

export async function getFincasPorUsuario(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }
    const fincas = await fetchFincasPorUsuario(Number(userId))
    res.json({ success: true, data: fincas })
  } catch (error) {
    console.error('Error en getFincasPorUsuario:', error)
    res.status(500).json({ success: false, message: 'Error al obtener fincas del usuario' })
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

export async function getCultivoDetalle(req, res) {
  try {
    const cultivoId = Number(req.params.id);
    if (!cultivoId || Number.isNaN(cultivoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cultivo inválido',
      });
    }

    const detalle = await fetchCultivoDetalleById(cultivoId);
    res.json({
      success: true,
      data: detalle,
    });
  } catch (error) {
    console.error('Error en getCultivoDetalle:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el detalle del cultivo',
    });
  }
}

export async function getCategoriasCosto(req, res) {
  try {
    const data = await fetchCategoriasCosto();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en getCategoriasCosto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías de costo',
    });
  }
}

export async function getSubcategoriasPorCategoria(req, res) {
  try {
    const { categoriaId } = req.params;
    const idcategoria = Number(categoriaId);
    if (!idcategoria || Number.isNaN(idcategoria)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido',
      });
    }

    const data = await fetchSubcategoriasPorCategoria(idcategoria);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en getSubcategoriasPorCategoria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener subcategorías',
    });
  }
}

export async function getEstadosPago(req, res) {
  try {
    const data = await fetchEstadosPago();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en getEstadosPago:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estados de pago',
    });
  }
}

export async function getEtapaEnProcesoPorCultivo(req, res) {
  try {
    const { cultivoId } = req.params;
    const idcultivo = Number(cultivoId);
    if (!idcultivo || Number.isNaN(idcultivo)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cultivo inválido',
      });
    }

    const data = await fetchEtapaEnProcesoPorCultivo(idcultivo);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en getEtapaEnProcesoPorCultivo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener etapa en proceso',
    });
  }
}

export async function getEtapasPorCultivo(req, res) {
  try {
    const cultivoId = Number(req.params.cultivoId)
    if (!cultivoId || Number.isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo inválido' })
    }
    const data = await fetchEtapasPorCultivo(cultivoId)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error en getEtapasPorCultivo:', error)
    res.status(500).json({ success: false, message: 'Error al obtener etapas del cultivo' })
  }
}

export async function getCultivosPorUsuario(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }
    const fincaId = req.query.fincaId ? Number(req.query.fincaId) : null
    console.log('[DEBUG] getCultivosPorUsuario - req.user.id:', userId, 'fincaId:', fincaId)
    const data = await fetchCultivosPorUsuario(Number(userId), fincaId)
    console.log('[DEBUG] getCultivosPorUsuario - result count:', Array.isArray(data) ? data.length : 0)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error en getCultivosPorUsuario:', error)
    res.status(500).json({ success: false, message: 'Error al obtener cultivos del usuario' })
  }
}

export async function getEtapasCatalog(req, res) {
  try {
    const data = await fetchAllEtapasCatalog()
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error en getEtapasCatalog:', error)
    res.status(500).json({ success: false, message: 'Error al obtener catálogo de etapas' })
  }
}

export async function postEtapaPorCultivo(req, res) {
  try {
    const cultivoId = Number(req.params.cultivoId)
    if (!cultivoId || Number.isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo inválido' })
    }
    const { idetapa, descripcion, forceFinalize } = req.body
    if (!idetapa) {
      return res.status(400).json({ success: false, message: 'ID de etapa requerido' })
    }

    // If requested, finalize existing in-process etapa(s)
    let finalized = []
    if (forceFinalize) {
      finalized = await finalizeEtapaEnProceso(cultivoId)
    }

    // Create new etapa as 'En Proceso'
    const created = await createEtapaParaCultivo({ idcultivo: cultivoId, idetapa, descripcion })

    res.status(201).json({ success: true, data: { finalized, created } })
  } catch (error) {
    console.error('Error en postEtapaPorCultivo:', error)
    res.status(500).json({ success: false, message: 'Error al crear etapa para cultivo' })
  }
}

export async function deleteEtapaPorCultivo(req, res) {
  try {
    const etapaCultivoId = Number(req.params.etapaCultivoId)
    if (!etapaCultivoId || Number.isNaN(etapaCultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de etapa inválido' })
    }

    const result = await deleteOrDeactivateEtapaById(etapaCultivoId)
    if (!result || !result.record) {
      return res.status(404).json({ success: false, message: 'Etapa no encontrada' })
    }

    const message = result.action === 'deactivated'
      ? 'La etapa tiene costos asociados. Se ha desactivado en lugar de eliminarse permanentemente.'
      : 'Etapa eliminada correctamente.'

    res.json({
      success: true,
      data: {
        id: result.record.id,
        action: result.action,
        costCount: result.costCount,
      },
      message,
    })
  } catch (error) {
    console.error('Error en deleteEtapaPorCultivo:', error)
    res.status(500).json({ success: false, message: 'Error al eliminar la etapa' })
  }
}

export async function validateCultivoForCost(req, res) {
  try {
    const { cultivoId } = req.params;
    const idcultivo = Number(cultivoId);
    if (!idcultivo || Number.isNaN(idcultivo)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cultivo inválido',
      });
    }

    const result = await validateCultivoCanAddCosto(idcultivo);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error en validateCultivoForCost:', error);
    res.status(500).json({
      success: false,
      message: 'Error validando cultivo',
    });
  }
}

export async function postCosto(req, res) {
  try {
    console.log('[DEBUG postCosto] req.body:', req.body);
    const { descripcion, valor, idcultivo, idetapa_cultivo, idusuario, idsubcategoria, idfinca, idestado_pago } = req.body;

    // Parse numeric inputs robustly to avoid falsy checks failing (e.g., valor === 0)
    const parsedValor = Number(valor);
    const parsedIdcultivo = Number(idcultivo);
    const parsedIdusuario = Number(idusuario);
    const parsedIdsubcategoria = Number(req.body.idsubcategoria ?? idsubcategoria);
    const parsedIdfinca = Number(idfinca);
    const parsedIdestadoPago = Number(idestado_pago);

    const missing = [];
    if (!Number.isFinite(parsedValor) || parsedValor <= 0) missing.push('valor');
    if (!Number.isFinite(parsedIdcultivo) || parsedIdcultivo <= 0) missing.push('idcultivo');
    if (!Number.isFinite(parsedIdusuario) || parsedIdusuario <= 0) missing.push('idusuario');
    if (!Number.isFinite(parsedIdsubcategoria) || parsedIdsubcategoria <= 0) missing.push('idsubcategoria');
    if (!Number.isFinite(parsedIdfinca) || parsedIdfinca <= 0) missing.push('idfinca');
    if (!Number.isFinite(parsedIdestadoPago) || parsedIdestadoPago <= 0) missing.push('idestado_pago');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Información incompleta o inválida para crear el costo',
        missing,
        received: req.body,
      });
    }

    const costo = await createCosto({
      descripcion,
      valor: parsedValor,
      idcultivo: parsedIdcultivo,
      idetapa_cultivo,
      idusuario: parsedIdusuario,
      idsubcategoria: parsedIdsubcategoria,
      idfinca: parsedIdfinca,
      idestado_pago: parsedIdestadoPago,
    });
    res.status(201).json({
      success: true,
      data: costo,
    });
  } catch (error) {
    console.error('Error en postCosto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el costo',
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

export async function deleteCultivo(req, res) {
  try {
    const { id } = req.params;
    const cultivoId = Number(id);
    if (!cultivoId || isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo inválido' });
    }

    const deleted = await deleteCultivoById(cultivoId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Cultivo no encontrado' });
    }

    res.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Error en deleteCultivo:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar cultivo' });
  }
}
