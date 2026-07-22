import { fetchAllFincas, fetchCultivosEnProceso, fetchCultivosPorFinca, fetchCultivoDetalleById, fetchCostosPorFinca, fetchCategoriasCosto, fetchSubcategoriasPorCategoria, fetchEstadosPago, fetchEtapaEnProcesoPorCultivo, validateCultivoCanAddCosto, validateActiveEtapaForCultivo, createCosto, updateCosto, deleteCostoById, fetchTiposCultivo, fetchEstados, fetchEstadoById, createCultivo, updateCultivo, fetchCultivosPorUsuario, fetchFincasPorUsuario, deleteOrDeactivateEtapaById, deleteCultivoById, changeCultivoState, changeCostoState, changeEtapaState, changeCosechaState, fetchEtapasPorCultivo, fetchAllEtapasCatalog, finalizeEtapaEnProceso, createEtapaParaCultivo, updateEtapaParaCultivo, fetchCosechasPorCultivo, fetchUnidadesMedida, fetchTiposPrecio, validateCultivoCanAddCosecha, createCosecha, updateCosecha, deleteCosechaById } from '../models/asinaciones-usuarioModel.js';
import { parseCurrencyValue } from '../utils/currency.js'
import { registrarAuditoria, contextoAuditoria } from '../models/auditoriaModel.js';

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
    const estado = String(req.query.estado || 'ACTIVO').toUpperCase();
    const allowedEstados = ['ACTIVO', 'ARCHIVADO'];

    if (!fincaId || isNaN(fincaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de finca inválido',
      });
    }
    if (!allowedEstados.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido',
      });
    }

    const cultivos = await fetchCultivosPorFinca(Number(fincaId), estado);
    console.log(`[getCultivosPorFinca] fincaId=${fincaId} estado=${estado} -> rows=${Array.isArray(cultivos) ? cultivos.length : 0}`)
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
        message: 'InformaciÃ³n incompleta para crear el cultivo',
      });
    }

    const cultivo = await createCultivo({ nombre: nombre.trim(), idtipocultivo, idfinca });
    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'CREAR_CULTIVO', descripcion: 'Cultivo creado',
      tablaAfectada: 'cultivo', registroId: cultivo?.id,
      nuevo: { nombre: nombre.trim(), idtipocultivo, idfinca },
    }));
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
        message: 'ID de cultivo invÃ¡lido',
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

export async function getCostosPorFinca(req, res) {
  try {
    const fincaId = Number(req.params.fincaId);
    if (!fincaId || Number.isNaN(fincaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de finca invÃ¡lido',
      });
    }

    const costos = await fetchCostosPorFinca(fincaId);
    res.json({
      success: true,
      data: costos,
    });
  } catch (error) {
    console.error('Error en getCostosPorFinca:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los costos de la finca',
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
      message: 'Error al obtener categorÃ­as de costo',
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
        message: 'ID de categorÃ­a invÃ¡lido',
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
      message: 'Error al obtener subcategorÃ­as',
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
        message: 'ID de cultivo invÃ¡lido',
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

export async function getCosechasPorCultivo(req, res) {
  try {
    const cultivoId = Number(req.params.cultivoId)
    if (!cultivoId || Number.isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo inválido' })
    }
    const data = await fetchCosechasPorCultivo(cultivoId)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error en getCosechasPorCultivo:', error)
    res.status(500).json({ success: false, message: 'Error al obtener cosechas del cultivo' })
  }
}

export async function getUnidadesMedida(req, res) {
  try {
    const data = await fetchUnidadesMedida()
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error en getUnidadesMedida:', error)
    res.status(500).json({ success: false, message: 'Error al obtener unidades de medida' })
  }
}

export async function getTiposPrecio(req, res) {
  try {
    const data = await fetchTiposPrecio()
    res.json({ success: true, data })
  } catch (error) {
    console.error('Error en getTiposPrecio:', error)
    res.status(500).json({ success: false, message: 'Error al obtener tipos de precio' })
  }
}

export async function postCosecha(req, res) {
  try {
    const cultivoId = Number(req.params.cultivoId)
    const cantidad = parseCurrencyValue(req.body.cantidad)
    const idunidadmedida = Number(req.body.idunidadmedida)
    const precio = parseCurrencyValue(req.body.precio)
    const idtipo_precio = Number(req.body.idtipo_precio)

    const missing = []
    if (!Number.isFinite(cantidad) || cantidad < 0) missing.push('cantidad')
    if (!Number.isFinite(idunidadmedida) || idunidadmedida <= 0) missing.push('idunidadmedida')
    if (!Number.isFinite(precio) || precio < 0) missing.push('precio')
    if (!Number.isFinite(idtipo_precio) || idtipo_precio <= 0) missing.push('idtipo_precio')
    if (!Number.isFinite(cultivoId) || cultivoId <= 0) missing.push('cultivoId')

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Información incompleta o inválida para crear la cosecha',
        missing,
      })
    }

    const etapaActiva = await validateCultivoCanAddCosecha(cultivoId)
    if (!etapaActiva) {
      return res.status(400).json({
        success: false,
        message: 'No es posible registrar una cosecha debido a que el cultivo no se encuentra actualmente en etapa de cosecha activa.',
      })
    }

    const cosecha = await createCosecha({
      idcultivo: cultivoId,
      cantidad_cosechada: cantidad,
      idunidadmedida,
      precio_unitario: precio,
      idtipo_precio,
    })

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'CREAR_COSECHA', descripcion: 'Cosecha creada',
      tablaAfectada: 'cosecha', registroId: cosecha?.id,
      nuevo: { idcultivo: cultivoId, cantidad, idunidadmedida, precio, idtipo_precio },
    }));

    res.status(201).json({ success: true, data: cosecha })
  } catch (error) {
    console.error('Error en postCosecha:', error)
    res.status(500).json({ success: false, message: 'Error al crear la cosecha' })
  }
}

export async function putCosecha(req, res) {
  try {
    const id = Number(req.params.id)
    const cantidad = parseCurrencyValue(req.body.cantidad)
    const idunidadmedida = Number(req.body.idunidadmedida)
    const precio = parseCurrencyValue(req.body.precio)
    const idtipo_precio = Number(req.body.idtipo_precio)

    const missing = []
    if (!id || Number.isNaN(id)) missing.push('id')
    if (!Number.isFinite(cantidad) || cantidad < 0) missing.push('cantidad')
    if (!Number.isFinite(idunidadmedida) || idunidadmedida <= 0) missing.push('idunidadmedida')
    if (!Number.isFinite(precio) || precio < 0) missing.push('precio')
    if (!Number.isFinite(idtipo_precio) || idtipo_precio <= 0) missing.push('idtipo_precio')

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Información incompleta o inválida para actualizar la cosecha',
        missing,
      })
    }

    const updated = await updateCosecha(id, {
      cantidad_cosechada: cantidad,
      idunidadmedida,
      precio_unitario: precio,
      idtipo_precio,
    })

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Cosecha no encontrada' })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'EDITAR_COSECHA', descripcion: 'Cosecha actualizada',
      tablaAfectada: 'cosecha', registroId: id,
      nuevo: { cantidad, idunidadmedida, precio, idtipo_precio },
    }));

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error en putCosecha:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar la cosecha' })
  }
}

export async function deleteCosecha(req, res) {
  try {
    const id = Number(req.params.id)
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID de cosecha inválido' })
    }

    const deleted = await deleteCosechaById(id)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Cosecha no encontrada' })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'ELIMINAR_COSECHA', descripcion: 'Cosecha eliminada',
      tablaAfectada: 'cosecha', registroId: id,
    }));

    res.json({ success: true, data: deleted })
  } catch (error) {
    console.error('Error en deleteCosecha:', error)
    res.status(500).json({ success: false, message: 'Error al eliminar la cosecha' })
  }
}

export async function getCultivosPorUsuario(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' })
    }
    const fincaId = req.query.fincaId ? Number(req.query.fincaId) : null
    const estado = String(req.query.estado || 'ACTIVO').toUpperCase()
    const allowedEstados = ['ACTIVO', 'ARCHIVADO']

    if (!allowedEstados.includes(estado)) {
      return res.status(400).json({ success: false, message: 'Estado inválido' })
    }

    console.log('[DEBUG] getCultivosPorUsuario - req.user.id:', userId, 'fincaId:', fincaId, 'estado:', estado)
    const data = await fetchCultivosPorUsuario(Number(userId), fincaId, estado)
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
    res.status(500).json({ success: false, message: 'Error al obtener catÃ¡logo de etapas' })
  }
}

export async function postEtapaPorCultivo(req, res) {
  try {
    const cultivoId = Number(req.params.cultivoId)
    if (!cultivoId || Number.isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo invÃ¡lido' })
    }
    const { idetapa, descripcion, forceFinalize } = req.body
    if (!idetapa) {
      return res.status(400).json({ success: false, message: 'ID de etapa requerido' })
    }

    let finalized = []
    if (forceFinalize) {
      finalized = await finalizeEtapaEnProceso(cultivoId)
    }

    const created = await createEtapaParaCultivo({ idcultivo: cultivoId, idetapa, descripcion })

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'CREAR_ETAPA', descripcion: 'Etapa agregada al cultivo',
      tablaAfectada: 'etapa_cultivo', registroId: created?.id,
      nuevo: { idcultivo: cultivoId, idetapa, descripcion, forceFinalize: Boolean(forceFinalize) },
    }));

    res.status(201).json({ success: true, data: { finalized, created } })
  } catch (error) {
    console.error('Error en postEtapaPorCultivo:', error)
    res.status(500).json({ success: false, message: 'Error al crear etapa para cultivo' })
  }
}

export async function putEtapaPorCultivo(req, res) {
  try {
    const etapaId = Number(req.params.id)
    if (!etapaId || Number.isNaN(etapaId)) {
      return res.status(400).json({ success: false, message: 'ID de etapa invÃ¡lido' })
    }

    const { idetapa, descripcion, idestado, forceFinalize, forceEnProceso } = req.body
    const updated = await updateEtapaParaCultivo(
      etapaId,
      {
        idetapa: idetapa !== undefined ? Number(idetapa) : undefined,
        descripcion: descripcion !== undefined ? descripcion : undefined,
        idestado: idestado !== undefined ? Number(idestado) : undefined,
      },
      {
        forceFinalize: Boolean(forceFinalize),
        forceEnProceso: Boolean(forceEnProceso),
      }
    )

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Etapa no encontrada' })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'EDITAR_ETAPA', descripcion: 'Etapa del cultivo actualizada',
      tablaAfectada: 'etapa_cultivo', registroId: etapaId,
      nuevo: { idetapa, descripcion, idestado, forceFinalize: Boolean(forceFinalize), forceEnProceso: Boolean(forceEnProceso) },
    }));

    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error en putEtapaPorCultivo:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar etapa del cultivo' })
  }
}

export async function deleteEtapaPorCultivo(req, res) {
  try {
    const etapaCultivoId = Number(req.params.etapaCultivoId)
    if (!etapaCultivoId || Number.isNaN(etapaCultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de etapa invÃ¡lido' })
    }

    const result = await deleteOrDeactivateEtapaById(etapaCultivoId)
    if (!result || !result.record) {
      return res.status(404).json({ success: false, message: 'Etapa no encontrada' })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: result.action === 'deactivated' ? 'ANULAR_ETAPA' : 'ELIMINAR_ETAPA',
      descripcion: result.action === 'deactivated' ? 'Etapa anulada por tener costos asociados' : 'Etapa eliminada',
      tablaAfectada: 'etapa_cultivo', registroId: etapaCultivoId,
      metadatos: { action: result.action, costCount: result.costCount },
    }));

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
        message: 'ID de cultivo invÃ¡lido',
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
    const descripcion = req.body.descripcion?.trim() || null
    const parsedValor = parseCurrencyValue(req.body.valor)
    const rawIdcultivo = req.body.idcultivo
    const parsedIdcultivo = rawIdcultivo == null || rawIdcultivo === '' ? null : Number(rawIdcultivo)
    const rawIdetapaCultivo = req.body.idetapa_cultivo
    const parsedIdetapaCultivo = rawIdetapaCultivo == null || rawIdetapaCultivo === '' ? null : Number(rawIdetapaCultivo)
    const idetapa_cultivo = parsedIdetapaCultivo == null || Number.isNaN(parsedIdetapaCultivo) || parsedIdetapaCultivo <= 0 ? null : parsedIdetapaCultivo
    const parsedIdusuario = Number(req.user?.id ?? req.body.idusuario)
    const parsedIdsubcategoria = Number(req.body.idsubcategoria)
    const parsedIdfinca = Number(req.body.idfinca)
    const parsedIdestadoPago = Number(req.body.idestado_pago)

    const missing = []
    if (!Number.isFinite(parsedValor) || parsedValor <= 0) missing.push('valor')
    if (parsedIdcultivo !== null && (!Number.isFinite(parsedIdcultivo) || parsedIdcultivo <= 0)) missing.push('idcultivo')
    if (!Number.isFinite(parsedIdusuario) || parsedIdusuario <= 0) missing.push('idusuario')
    if (!Number.isFinite(parsedIdsubcategoria) || parsedIdsubcategoria <= 0) missing.push('idsubcategoria')
    if (!Number.isFinite(parsedIdfinca) || parsedIdfinca <= 0) missing.push('idfinca')
    if (!Number.isFinite(parsedIdestadoPago) || parsedIdestadoPago <= 0) missing.push('idestado_pago')
    if (idetapa_cultivo !== null && parsedIdcultivo === null) missing.push('idcultivo')

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Información incompleta o inválida para crear el costo',
        missing,
        received: req.body,
      })
    }

    if (parsedIdcultivo !== null && !idetapa_cultivo) {
      return res.status(400).json({
        success: false,
        message: 'No puede registrar el costo porque el cultivo no tiene una etapa activa en proceso con activo:true.',
      })
    }

    if (idetapa_cultivo !== null) {
      const etapaResult = await validateActiveEtapaForCultivo(parsedIdetapaCultivo, parsedIdcultivo)
      if (!etapaResult) {
        return res.status(400).json({
          success: false,
          message: 'No puede registrar el costo porque la etapa seleccionada no es una etapa activa en proceso con activo:true.',
        })
      }
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
    })

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Costos', accion: 'REGISTRAR_COSTO', descripcion: 'Costo registrado',
      tablaAfectada: 'costo', registroId: costo?.id,
      nuevo: { descripcion, valor: parsedValor, idcultivo: parsedIdcultivo, idetapa_cultivo, idsubcategoria: parsedIdsubcategoria, idfinca: parsedIdfinca, idestado_pago: parsedIdestadoPago },
    }));

    res.status(201).json({
      success: true,
      data: costo,
    })
  } catch (error) {
    console.error('Error en postCosto:', error)
    if (error?.code === '23503') {
      return res.status(400).json({
        success: false,
        message: error.detail || 'Referencia inválida al crear el costo',
      })
    }
    res.status(500).json({
      success: false,
      message: 'Error al crear el costo',
    })
  }
}

export async function putCosto(req, res) {
  try {
    const { id } = req.params
    const idcosto = Number(id)
    if (!idcosto || Number.isNaN(idcosto)) {
      return res.status(400).json({ success: false, message: 'ID de costo inválido' })
    }

    const descripcion = req.body.descripcion?.trim() || null
    const parsedValor = parseCurrencyValue(req.body.valor)
    const parsedIdsubcategoria = Number(req.body.idsubcategoria)
    const parsedIdestadoPago = Number(req.body.idestado_pago)

    const missing = []
    if (!Number.isFinite(parsedValor) || parsedValor <= 0) missing.push('valor')
    if (!Number.isFinite(parsedIdsubcategoria) || parsedIdsubcategoria <= 0) missing.push('idsubcategoria')
    if (!Number.isFinite(parsedIdestadoPago) || parsedIdestadoPago <= 0) missing.push('idestado_pago')

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Información incompleta o inválida para actualizar el costo',
        missing,
      })
    }

    const updatedCosto = await updateCosto(idcosto, {
      descripcion,
      valor: parsedValor,
      idsubcategoria: parsedIdsubcategoria,
      idestado_pago: parsedIdestadoPago,
    })

    if (!updatedCosto) {
      return res.status(404).json({ success: false, message: 'Costo no encontrado' })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Costos', accion: 'EDITAR_COSTO', descripcion: 'Costo actualizado',
      tablaAfectada: 'costo', registroId: idcosto,
      nuevo: { descripcion, valor: parsedValor, idsubcategoria: parsedIdsubcategoria, idestado_pago: parsedIdestadoPago },
    }));

    res.json({ success: true, data: updatedCosto })
  } catch (error) {
    console.error('Error en putCosto:', error)
    if (error?.code === '23503') {
      return res.status(400).json({
        success: false,
        message: error.detail || 'Referencia inválida al actualizar el costo',
      })
    }
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el costo',
    })
  }
}

export async function deleteCosto(req, res) {
  try {
    const { id } = req.params
    const idcosto = Number(id)
    if (!idcosto || Number.isNaN(idcosto)) {
      return res.status(400).json({ success: false, message: 'ID de costo inválido' })
    }

    const deleted = await deleteCostoById(idcosto)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Costo no encontrado' })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Costos', accion: 'ELIMINAR_COSTO', descripcion: 'Costo eliminado',
      tablaAfectada: 'costo', registroId: idcosto,
    }));

    res.json({ success: true, data: deleted })
  } catch (error) {
    console.error('Error en deleteCosto:', error)
    res.status(500).json({ success: false, message: 'Error al eliminar el costo' })
  }
}

export async function putCultivo(req, res) {
  try {
    const { id } = req.params;
    const cultivoId = Number(id);
    if (!cultivoId || isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo invÃ¡lido' });
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

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'EDITAR_CULTIVO', descripcion: 'Cultivo actualizado',
      tablaAfectada: 'cultivo', registroId: cultivoId,
      nuevo: { nombre: nombre.trim(), idtipocultivo: Number(idtipocultivo), idestado: Number(idestado), fecha_inicio: fecha_inicio || null, fecha_final },
    }));

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

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'ELIMINAR_CULTIVO', descripcion: 'Cultivo archivado/eliminado',
      tablaAfectada: 'cultivo', registroId: cultivoId,
    }));

    res.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Error en deleteCultivo:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar cultivo' });
  }
}

export async function changeCultivoStateController(req, res) {
  try {
    const { id } = req.params;
    const cultivoId = Number(id);
    const { nuevoEstado, motivo } = req.body;
    const usuarioId = req.user?.id;
    const allowedEstados = ['ACTIVO', 'ARCHIVADO'];

    if (!cultivoId || isNaN(cultivoId)) {
      return res.status(400).json({ success: false, message: 'ID de cultivo inválido' });
    }
    if (!nuevoEstado || !allowedEstados.includes(nuevoEstado)) {
      return res.status(400).json({ success: false, message: 'Estado inválido' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, message: 'Motivo es obligatorio' });
    }
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    const updated = await changeCultivoState(cultivoId, nuevoEstado, motivo.trim(), usuarioId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Cultivo no encontrado' });
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: 'CAMBIAR_ESTADO_CULTIVO', descripcion: motivo.trim(),
      tablaAfectada: 'cultivo', registroId: cultivoId, nuevo: { estado: nuevoEstado },
    }));

    res.json({
      success: true,
      message: 'Estado del cultivo actualizado exitosamente',
      data: updated,
    });
  } catch (error) {
    console.error('Error en changeCultivoStateController:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar el estado del cultivo' });
  }
}

export async function changeCostoStateController(req, res) {
  try {
    const { id } = req.params;
    const costoId = Number(id);
    const { nuevoEstado, motivo } = req.body;
    const usuarioId = req.user?.id;
    const allowedEstados = ['ACTIVO', 'ANULADO'];

    if (!costoId || isNaN(costoId)) {
      return res.status(400).json({ success: false, message: 'ID de costo inválido' });
    }
    if (!nuevoEstado || !allowedEstados.includes(nuevoEstado)) {
      return res.status(400).json({ success: false, message: 'Estado inválido' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, message: 'Motivo es obligatorio' });
    }
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    const updated = await changeCostoState(costoId, nuevoEstado, motivo.trim(), usuarioId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Costo no encontrado' });
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Costos', accion: nuevoEstado === 'ANULADO' ? 'ANULAR_COSTO' : 'ACTIVAR_COSTO', descripcion: motivo.trim(),
      tablaAfectada: 'costo', registroId: costoId, nuevo: { estado: nuevoEstado },
    }));

    res.json({ success: true, message: 'Estado del costo actualizado exitosamente', data: updated });
  } catch (error) {
    console.error('Error en changeCostoStateController:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar el estado del costo' });
  }
}

export async function changeEtapaStateController(req, res) {
  try {
    const { id } = req.params;
    const etapaId = Number(id);
    const { nuevoEstado, motivo } = req.body;
    const usuarioId = req.user?.id;
    const allowedEstados = ['ACTIVO', 'ANULADO'];

    if (!etapaId || isNaN(etapaId)) {
      return res.status(400).json({ success: false, message: 'ID de etapa inválido' });
    }
    if (!nuevoEstado || !allowedEstados.includes(nuevoEstado)) {
      return res.status(400).json({ success: false, message: 'Estado inválido' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, message: 'Motivo es obligatorio' });
    }
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    const updated = await changeEtapaState(etapaId, nuevoEstado, motivo.trim(), usuarioId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Etapa no encontrada' });
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Cultivos', accion: nuevoEstado === 'ANULADO' ? 'ANULAR_ETAPA' : 'ACTIVAR_ETAPA', descripcion: motivo.trim(),
      tablaAfectada: 'etapa_cultivo', registroId: etapaId, nuevo: { estado: nuevoEstado },
    }));

    res.json({ success: true, message: 'Estado de la etapa actualizado exitosamente', data: updated });
  } catch (error) {
    console.error('Error en changeEtapaStateController:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar el estado de la etapa' });
  }
}

export async function changeCosechaStateController(req, res) {
  try {
    const { id } = req.params;
    const cosechaId = Number(id);
    const { nuevoEstado, motivo } = req.body;
    const usuarioId = req.user?.id;
    const allowedEstados = ['ACTIVO', 'ANULADO'];

    if (!cosechaId || isNaN(cosechaId)) {
      return res.status(400).json({ success: false, message: 'ID de cosecha inválido' });
    }
    if (!nuevoEstado || !allowedEstados.includes(nuevoEstado)) {
      return res.status(400).json({ success: false, message: 'Estado inválido' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ success: false, message: 'Motivo es obligatorio' });
    }
    if (!usuarioId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    const updated = await changeCosechaState(cosechaId, nuevoEstado, motivo.trim(), usuarioId);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Cosecha no encontrada' });
    }

    res.json({ success: true, message: 'Estado de la cosecha actualizado exitosamente', data: updated });
  } catch (error) {
    console.error('Error en changeCosechaStateController:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar el estado de la cosecha' });
  }
}

