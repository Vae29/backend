import pool, { getRequestDatabaseClient } from '../config/db.js';
import { toDatabaseRegistroState } from '../utils/registroEstado.js';

async function assertManualMateriaPrimaNotUsed(subcategoryId, costId = null) {
  const migration = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'categoria_costo'
         AND column_name = 'codigo_contable'
     ) AS applied`
  );
  if (!migration.rows[0].applied) return;

  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM subcategoria_costo sc
       JOIN categoria_costo cc ON cc.idcategoria = sc.idcategoria
       WHERE sc.idsubcategoria = $1
         AND cc.codigo_contable = '7105'
     ) OR EXISTS (
       SELECT 1
       FROM costo co
       LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
       LEFT JOIN categoria_costo cc ON cc.idcategoria = sc.idcategoria
       WHERE co.idcosto = $2
         AND (
           cc.codigo_contable = '7105'
           OR EXISTS (
             SELECT 1 FROM costo_insumo ci WHERE ci.idcosto = co.idcosto
           )
         )
     ) AS administrado_por_inventario`,
    [subcategoryId, costId]
  );
  if (result.rows[0].administrado_por_inventario) {
    throw Object.assign(
      new Error('Materia Prima se registra desde la salida de inventario. No se puede crear, modificar, eliminar ni anular este costo manualmente.'),
      { statusCode: costId ? 409 : 400 }
    );
  }
}

export async function fetchAllFincas() {
  try {
    const result = await pool.query(
      "SELECT idfinca AS id, nombre, ubicacion FROM finca WHERE estado_registro = 1 ORDER BY nombre"
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching fincas:', error);
    throw error;
  }
}

export async function fetchCultivosEnProceso() {
  try {
    const result = await pool.query(
      `SELECT c.idcultivo AS id, c.nombre, c.idestadocultivo AS idestado, c.idfinca, f.nombre AS finca_nombre
       FROM cultivo c
       LEFT JOIN finca f ON c.idfinca = f.idfinca
       WHERE c.idestadocultivo = 1
         AND c.estado_registro = 1
         AND f.estado_registro = 1
       ORDER BY f.nombre, c.nombre`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching cultivos en proceso:', error);
    throw error;
  }
}

export async function fetchCultivosPorFinca(fincaId, estado = 'ACTIVO') {
  try {
    const result = await pool.query(
      `SELECT 
        c.idcultivo AS id, 
        c.nombre, 
        c.idtipocultivo AS idtipocultivo,
        c.idfinca AS idfinca,
        tc.nombre AS tipo,
        c.fecha_inicio AS "fechaInicio",
        c.fecha_final AS "fechaCosecha",
        e.nombre AS estado,
        c.idestadocultivo AS idestado,
        CASE WHEN c.estado_registro = 1 THEN 'ACTIVO' ELSE 'ARCHIVADO' END AS estado_registro,
        c.estado_registro = 1 AS activo,
        etapa_activa.nombre AS "etapaActual",
        etapa_activa.fecha_inicio AS "etapaActualInicio"
       FROM cultivo c
       LEFT JOIN tipos_cultivo tc ON c.idtipocultivo = tc.idtipocultivo
       LEFT JOIN estado_cultivo e ON c.idestadocultivo = e.idestadocultivo
       LEFT JOIN finca f ON c.idfinca = f.idfinca
       LEFT JOIN LATERAL (
         SELECT et.nombre_etapa AS nombre, ec.fecha_inicio
         FROM etapa_cultivo ec
         LEFT JOIN etapas et ON ec.idetapa = et.idetapa
         WHERE ec.idcultivo = c.idcultivo
           AND ec.idestadocultivo = 1
           AND ec.estado_registro = 1
         ORDER BY ec.fecha_inicio DESC
         LIMIT 1
       ) etapa_activa ON TRUE
       WHERE c.idfinca = $1
         AND c.estado_registro = $2
       ORDER BY c.nombre`,
      [fincaId, toDatabaseRegistroState(estado)]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching cultivos por finca:', error);
    throw error;
  }
}

export async function fetchCultivosPorUsuario(idUsuario, fincaId = null, estado = 'ACTIVO') {
  try {
    const params = [idUsuario, estado]
    let filtroFinca = ''
    if (fincaId) {
      params.push(fincaId)
      filtroFinca = 'AND c.idfinca = $3'
    }
    const result = await pool.query(
      `SELECT
         c.idcultivo AS id,
         c.nombre,
         c.idtipocultivo AS idtipocultivo,
         tc.nombre AS tipo,
         c.fecha_inicio AS "fechaInicio",
         c.fecha_final AS "fechaCosecha",
         e.nombre AS estado,
         c.idestadocultivo AS idestado,
         c.idfinca,
         f.nombre AS finca_nombre
       FROM cultivo c
       LEFT JOIN tipos_cultivo tc ON c.idtipocultivo = tc.idtipocultivo
       LEFT JOIN estado_cultivo e ON c.idestadocultivo = e.idestadocultivo
       LEFT JOIN finca f ON c.idfinca = f.idfinca
       INNER JOIN usuario_cultivo uc ON uc.idcultivo = c.idcultivo
       WHERE uc.id_usuario = $1
         AND c.estado_registro = $2
         ${filtroFinca}
       ORDER BY c.nombre`,
      [idUsuario, toDatabaseRegistroState(estado), ...params.slice(2)]
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching cultivos por usuario:', error)
    throw error
  }
}

export const FINCAS_POR_USUARIO_QUERY = `SELECT
  f.idfinca AS id,
  f.nombre,
  f.ubicacion,
  'ACTIVO'::text AS estado_registro
FROM finca f
WHERE f.estado_registro = 1
  AND (
    EXISTS (
      SELECT 1
      FROM usuario_finca uf
      WHERE uf.idfinca = f.idfinca
        AND uf.id_usuario = $1
    )
    OR EXISTS (
      SELECT 1
      FROM cultivo c
      INNER JOIN usuario_cultivo uc ON uc.idcultivo = c.idcultivo
      WHERE c.idfinca = f.idfinca
        AND uc.id_usuario = $1
        AND c.estado_registro = 1
    )
  )
ORDER BY f.nombre`

export async function fetchFincasPorUsuario(idUsuario) {
  try {
    const result = await pool.query(FINCAS_POR_USUARIO_QUERY, [idUsuario])
    return result.rows
  } catch (error) {
    console.error('Error fetching fincas por usuario:', error)
    throw error
  }
}

export async function fetchCultivoDetalleById(idcultivo) {
  try {
    const result = await pool.query(
      `SELECT
        co.idcosto AS id,
        co.fecha,
        co.descripcion,
        co.valor,
        COALESCE(u.primer_nombre || ' ' || u.primer_apellido, '') AS usuario,
        sc.idsubcategoria AS "subcategoriaId",
        sc.nombre AS subcategoria,
        cc.idcategoria AS "categoriaId",
        cc.nombre AS categoria,
        et.nombre_etapa AS etapa,
        CASE WHEN co.estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro,
        ep.idestado_pago AS "estadoPagoId",
        ep.nombre AS estado_pago
      FROM costo co
      LEFT JOIN subcategoria_costo sc ON co.idsubcategoria = sc.idsubcategoria
      LEFT JOIN categoria_costo cc ON sc.idcategoria = cc.idcategoria
      LEFT JOIN usuario u ON co.id_usuario = u.id_usuario
      LEFT JOIN etapa_cultivo ec ON co.idetapa_cultivo = ec.idetapacultivo
      LEFT JOIN etapas et ON ec.idetapa = et.idetapa
      LEFT JOIN estado_pago ep ON co.idestado_pago = ep.idestado_pago
      WHERE co.idcultivo = $1
      ORDER BY co.fecha DESC`,
      [idcultivo]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching detalle de cultivo:', error);
    throw error;
  }
}

export async function fetchCostosPorFinca(idfinca) {
  try {
    const result = await pool.query(
      `SELECT
        co.idcosto AS id,
        co.fecha,
        co.descripcion,
        co.valor,
        COALESCE(u.primer_nombre || ' ' || u.primer_apellido, '') AS usuario,
        sc.idsubcategoria AS "subcategoriaId",
        sc.nombre AS subcategoria,
        cc.idcategoria AS "categoriaId",
        cc.nombre AS categoria,
        cu.nombre AS cultivo,
        CASE WHEN co.estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro,
        ep.idestado_pago AS "estadoPagoId",
        ep.nombre AS estado_pago
      FROM costo co
      LEFT JOIN usuario u ON co.id_usuario = u.id_usuario
      LEFT JOIN subcategoria_costo sc ON co.idsubcategoria = sc.idsubcategoria
      LEFT JOIN categoria_costo cc ON sc.idcategoria = cc.idcategoria
      LEFT JOIN cultivo cu ON co.idcultivo = cu.idcultivo
      LEFT JOIN estado_pago ep ON co.idestado_pago = ep.idestado_pago
      WHERE co.idfinca = $1
      ORDER BY co.fecha DESC`,
      [idfinca]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching costos por finca:', error);
    throw error;
  }
}

export async function fetchEtapasPorCultivo(idcultivo) {
  try {
    const result = await pool.query(
      `SELECT
         ec.idetapacultivo AS id,
         et.nombre_etapa AS nombre,
         ec.descripcion,
         ec.fecha_inicio AS "fechaInicio",
         ec.fecha_final AS "fechaFinal",
         ec.idestadocultivo AS idestado,
         e.nombre AS estado,
         CASE WHEN ec.estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro,
         ec.estado_registro = 1 AS activo
       FROM etapa_cultivo ec
       LEFT JOIN etapas et ON ec.idetapa = et.idetapa
       LEFT JOIN estado_cultivo e ON ec.idestadocultivo = e.idestadocultivo
       WHERE ec.idcultivo = $1
       ORDER BY ec.fecha_inicio DESC`,
      [idcultivo]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching etapas por cultivo:', error);
    throw error;
  }
}

export async function fetchAllEtapasCatalog(tipoCultivoId = null) {
  try {
    const mappingTable = await pool.query(
      `SELECT to_regclass('public.etapas_tipo_cultivo') IS NOT NULL AS available`
    )
    const hasTypeStageMapping = mappingTable.rows[0].available
    const result = hasTypeStageMapping
      ? await pool.query(
        `SELECT et.idetapa AS id, et.nombre_etapa AS nombre
         FROM public.etapas et
         WHERE COALESCE(to_jsonb(et) ->> 'estado_registro', '1') = '1'
           AND ($1::int IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM public.etapas_tipo_cultivo etc
              WHERE etc.idtipocultivo = $1
                AND COALESCE(to_jsonb(etc) ->> 'estado_registro', '1') = '1'
            )
            OR EXISTS (
              SELECT 1 FROM public.etapas_tipo_cultivo etc
              WHERE etc.idtipocultivo = $1
                AND etc.idetapa = et.idetapa
                AND COALESCE(to_jsonb(etc) ->> 'estado_registro', '1') = '1'
            ))
         ORDER BY et.nombre_etapa`,
        [tipoCultivoId]
      )
      : await pool.query(
        `SELECT et.idetapa AS id, et.nombre_etapa AS nombre
         FROM public.etapas et
         WHERE COALESCE(to_jsonb(et) ->> 'estado_registro', '1') = '1'
         ORDER BY et.nombre_etapa`
      )
    return result.rows
  } catch (error) {
    console.error('Error fetching etapas catalog:', error)
    throw error
  }
}

export async function validateEtapaAllowedForCultivo(idcultivo, idetapa) {
  const result = await pool.query(
    `SELECT
       EXISTS (
         SELECT 1 FROM etapas_tipo_cultivo etc
         WHERE etc.idtipocultivo = c.idtipocultivo
           AND etc.estado_registro = 1
       ) AS has_configured_stages,
       EXISTS (
         SELECT 1 FROM etapas_tipo_cultivo etc
         WHERE etc.idtipocultivo = c.idtipocultivo
           AND etc.idetapa = $2
           AND etc.estado_registro = 1
       ) AS stage_is_configured,
       EXISTS (
         SELECT 1 FROM etapas et
         WHERE et.idetapa = $2 AND et.estado_registro = 1
       ) AS stage_is_active
     FROM cultivo c
     WHERE c.idcultivo = $1 AND c.estado_registro = 1`,
    [idcultivo, idetapa]
  );
  const crop = result.rows[0];
  return Boolean(
    crop?.stage_is_active &&
    (!crop.has_configured_stages || crop.stage_is_configured)
  );
}

export async function validateEtapaAllowedForEtapaCultivo(etapaCultivoId, idetapa) {
  const result = await pool.query(
    `SELECT ec.idcultivo
     FROM etapa_cultivo ec
     WHERE ec.idetapacultivo = $1`,
    [etapaCultivoId]
  );
  if (!result.rows[0]) return false;
  return validateEtapaAllowedForCultivo(result.rows[0].idcultivo, idetapa);
}

export async function finalizeEtapaEnProceso(idcultivo) {
  try {
    const estadoRes = await pool.query(
      "SELECT idestadocultivo FROM estado_cultivo WHERE LOWER(nombre) LIKE 'finaliz%' LIMIT 1"
    )
    const finalizadoId = estadoRes.rows[0]?.idestadocultivo
    if (!finalizadoId) throw new Error('No existe el estado de cultivo Finalizado')
    const result = await pool.query(
      `UPDATE etapa_cultivo
       SET idestadocultivo = $2, fecha_final = CURRENT_DATE
       WHERE idcultivo = $1 AND idestadocultivo = 1
       RETURNING idetapacultivo AS id, idetapa, descripcion,
                 fecha_inicio AS "fechaInicio", fecha_final AS "fechaFinal",
                 idestadocultivo AS idestado,
                 CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro,
                 estado_registro = 1 AS activo`,
      [idcultivo, finalizadoId]
    )
    return result.rows
  } catch (error) {
    console.error('Error finalizing etapa en proceso:', error)
    throw error
  }
}

export async function createEtapaParaCultivo({ idcultivo, idetapa, descripcion }) {
  try {
    const inProcessId = 1
    const result = await pool.query(
      `INSERT INTO etapa_cultivo (idetapa, idcultivo, descripcion, fecha_inicio, idestadocultivo, estado_registro)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, 1)
       RETURNING idetapacultivo AS id, idetapa, descripcion,
                 fecha_inicio AS "fechaInicio", fecha_final AS "fechaFinal",
                 idestadocultivo AS idestado, 'ACTIVO'::text AS estado_registro,
                 TRUE AS activo`,
      [idetapa, idcultivo, descripcion || null, inProcessId]
    )
    return result.rows[0]
  } catch (error) {
    console.error('Error creating etapa para cultivo:', error)
    throw error
  }
}

export async function updateEtapaParaCultivo(
  idetapacultivo,
  { idetapa, descripcion, idestado },
  { forceFinalize = false, forceEnProceso = false } = {}
) {
  try {
    const etapaResult = await pool.query(
      'SELECT idcultivo FROM etapa_cultivo WHERE idetapacultivo = $1',
      [idetapacultivo]
    )

    if (!etapaResult.rows.length) {
      return null
    }

    const cultivoId = etapaResult.rows[0].idcultivo
    const inProcessId = 1
    const finalizadoRes = await pool.query(
      "SELECT idestadocultivo FROM estado_cultivo WHERE LOWER(nombre) LIKE 'finaliz%' LIMIT 1"
    )
    const finalizadoId = finalizadoRes.rows[0]?.idestadocultivo
    if (!finalizadoId) throw new Error('No existe el estado de cultivo Finalizado')

    if (forceFinalize && cultivoId && finalizadoId) {
      await pool.query(
        `UPDATE etapa_cultivo
         SET idestadocultivo = $1, fecha_final = CURRENT_DATE
         WHERE idcultivo = $2 AND idestadocultivo = $3 AND idetapacultivo != $4`,
        [finalizadoId, cultivoId, inProcessId, idetapacultivo]
      )
    }

    const setClauses = []
    const values = []
    let paramIndex = 1

    if (idetapa !== undefined) {
      setClauses.push(`idetapa = $${paramIndex++}`)
      values.push(idetapa)
    }

    if (descripcion !== undefined) {
      setClauses.push(`descripcion = $${paramIndex++}`)
      values.push(descripcion)
    }

    if (idestado !== undefined) {
      setClauses.push(`idestadocultivo = $${paramIndex++}`)
      values.push(idestado)
    }

    if (forceEnProceso) {
      setClauses.push('fecha_final = NULL')
    } else if (idestado !== undefined && idestado === finalizadoId) {
      setClauses.push('fecha_final = CURRENT_DATE')
    }

    if (setClauses.length === 0) {
      return null
    }

    const query = `UPDATE etapa_cultivo
      SET ${setClauses.join(', ')}
      WHERE idetapacultivo = $${paramIndex}
      RETURNING idetapacultivo AS id, idetapa, descripcion,
                fecha_inicio AS "fechaInicio", fecha_final AS "fechaFinal",
                idestadocultivo AS idestado,
                CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro,
                estado_registro = 1 AS activo`
    values.push(idetapacultivo)

    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating etapa para cultivo:', error)
    throw error
  }
}

export async function deleteOrDeactivateEtapaById(idetapaCultivo) {
  const requestClient = getRequestDatabaseClient()
  const client = requestClient || await pool.connect()
  const ownsClient = !requestClient
  try {
    if (ownsClient) await client.query('BEGIN')

    const countResult = await client.query(
      'SELECT COUNT(*) AS count FROM costo WHERE idetapa_cultivo = $1',
      [idetapaCultivo]
    )
    const costCount = Number(countResult.rows[0]?.count || 0)

    let action = 'deleted'
    let result
    if (costCount > 0) {
      result = await client.query(
        "UPDATE etapa_cultivo SET estado_registro = 0 WHERE idetapacultivo = $1 RETURNING idetapacultivo AS id",
        [idetapaCultivo]
      )
      action = 'deactivated'
    } else {
      result = await client.query(
        'DELETE FROM etapa_cultivo WHERE idetapacultivo = $1 RETURNING idetapacultivo AS id',
        [idetapaCultivo]
      )
    }

    if (ownsClient) await client.query('COMMIT')
    return {
      action,
      costCount,
      record: result.rows[0] || null,
    }
  } catch (error) {
    if (ownsClient) await client.query('ROLLBACK')
    console.error('Error deleting or deactivating etapa:', error)
    throw error
  } finally {
    if (ownsClient) client.release()
  }
}

export async function fetchTiposCultivo() {
  try {
    const result = await pool.query(
      `SELECT tc.idtipocultivo AS id, tc.nombre
       FROM public.tipos_cultivo tc
       WHERE COALESCE(to_jsonb(tc) ->> 'estado_registro', '1') = '1'
       ORDER BY tc.nombre`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching tipos de cultivo:', error);
    throw error;
  }
}

export async function fetchEstados() {
  try {
    const result = await pool.query(
      'SELECT idestadocultivo AS id, idestadocultivo AS idestado, nombre FROM estado_cultivo ORDER BY nombre'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching estados:', error);
    throw error;
  }
}

export async function fetchEstadoById(idestado) {
  try {
    const result = await pool.query(
      'SELECT nombre FROM estado_cultivo WHERE idestadocultivo = $1 LIMIT 1',
      [idestado]
    );
    return result.rows[0]?.nombre || null;
  } catch (error) {
    console.error('Error fetching estado by id:', error);
    throw error;
  }
}

export async function updateCultivo(idcultivo, { nombre, idtipocultivo, idestado, fecha_inicio, fecha_final = null }) {
  try {
    const result = await pool.query(
      `UPDATE cultivo
       SET nombre = $1,
           idtipocultivo = $2,
           idestadocultivo = $3,
           fecha_inicio = $4,
           fecha_final = $5
       WHERE idcultivo = $6
       RETURNING idcultivo AS id, nombre, idfinca, idtipocultivo,
                 idestadocultivo AS idestado, fecha_inicio AS "fechaInicio",
                 fecha_final AS "fechaCosecha"`,
      [nombre, idtipocultivo, idestado, fecha_inicio, fecha_final, idcultivo]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating cultivo:', error);
    throw error;
  }
}

export async function createCultivo({ nombre, idtipocultivo, idfinca }) {
  try {
    const result = await pool.query(
      `INSERT INTO cultivo (nombre, idtipocultivo, idfinca, idestadocultivo, fecha_inicio)
       VALUES ($1, $2, $3, 1, CURRENT_DATE)
       RETURNING idcultivo AS id, nombre, idfinca, idtipocultivo`,
      [nombre, idtipocultivo, idfinca]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating cultivo:', error);
    throw error;
  }
}

export async function assignFincasToUser(userId, fincaIds) {
  try {
    // Eliminar asignaciones previas
    await pool.query(
      'DELETE FROM usuario_finca WHERE id_usuario = $1',
      [userId]
    );

    // Insertar nuevas asignaciones
    if (fincaIds && fincaIds.length > 0) {
      const values = fincaIds.map((fincaId, idx) => `($1, $${idx + 2})`).join(',');
      const query = `INSERT INTO usuario_finca (id_usuario, idfinca) VALUES ${values}`;
      const params = [userId, ...fincaIds];
      await pool.query(query, params);
    }

    return true;
  } catch (error) {
    console.error('Error assigning fincas to user:', error);
    throw error;
  }
}

export async function assignCultivosToUser(userId, cultivoIds) {
  try {
    // Eliminar asignaciones previas
    await pool.query(
      'DELETE FROM usuario_cultivo WHERE id_usuario = $1',
      [userId]
    );

    // Insertar nuevas asignaciones
    if (cultivoIds && cultivoIds.length > 0) {
      const values = cultivoIds.map((cultivoId, idx) => `($1, $${idx + 2})`).join(',');
      const query = `INSERT INTO usuario_cultivo (id_usuario, idcultivo) VALUES ${values}`;
      const params = [userId, ...cultivoIds];
      await pool.query(query, params);
    }

    return true;
  } catch (error) {
    console.error('Error assigning cultivos to user:', error);
    throw error;
  }
}

export async function fetchCategoriasCosto() {
  try {
    const result = await pool.query(
      'SELECT idcategoria AS id, nombre FROM categoria_costo ORDER BY nombre'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching categorias costo:', error);
    throw error;
  }
}

export async function fetchSubcategoriasPorCategoria(idcategoria) {
  try {
    const result = await pool.query(
      'SELECT idsubcategoria AS id, nombre FROM subcategoria_costo WHERE idcategoria = $1 ORDER BY nombre',
      [idcategoria]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching subcategorias:', error);
    throw error;
  }
}

export async function fetchEstadosPago() {
  try {
    const result = await pool.query(
      'SELECT idestado_pago AS id, nombre FROM estado_pago ORDER BY nombre'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching estados pago:', error);
    throw error;
  }
}

export async function fetchEtapaEnProcesoPorCultivo(idcultivo) {
  try {
    const result = await pool.query(
      `SELECT ec.idetapacultivo, et.nombre_etapa
       FROM etapa_cultivo ec
       LEFT JOIN etapas et ON ec.idetapa = et.idetapa
       WHERE ec.idcultivo = $1 AND ec.idestadocultivo = 1 AND ec.estado_registro = 1
       LIMIT 1`,
      [idcultivo]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching etapa en proceso:', error);
    throw error;
  }
}

export async function validateCultivoCanAddCosto(idcultivo) {
  try {
    // Verificar si el cultivo está en estado "En Proceso" (idestado = 1)
    const cultivoResult = await pool.query(
      "SELECT idestadocultivo AS idestado FROM cultivo WHERE idcultivo = $1 AND estado_registro = 1",
      [idcultivo]
    );
    if (!cultivoResult.rows.length) {
      return { valid: false, reason: 'cultivo_not_found' };
    }

    const cultivo = cultivoResult.rows[0];
    // Asumiendo que 1 es "En Proceso"
    if (cultivo.idestado !== 1) {
      return { valid: false, reason: 'cultivo_not_in_process' };
    }

    // Verificar si hay etapas registradas
    const etapasResult = await pool.query(
      'SELECT COUNT(*) as count FROM etapa_cultivo WHERE idcultivo = $1',
      [idcultivo]
    );
    if (etapasResult.rows[0].count === 0) {
      return { valid: false, reason: 'no_etapas' };
    }

    // Verificar si hay etapa activa en proceso
    const etapaEnProcesoResult = await pool.query(
      "SELECT COUNT(*) as count FROM etapa_cultivo WHERE idcultivo = $1 AND idestadocultivo = 1 AND estado_registro = 1",
      [idcultivo]
    );

    if (etapaEnProcesoResult.rows[0].count === 0) {
      return { valid: false, reason: 'no_active_etapa_en_proceso' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating cultivo for cost:', error);
    throw error;
  }
}

export async function validateCultivoCanAddCosecha(idcultivo) {
  try {
    const result = await pool.query(
      `SELECT ec.idetapacultivo
       FROM etapa_cultivo ec
       LEFT JOIN etapas et ON ec.idetapa = et.idetapa
       WHERE ec.idcultivo = $1
         AND ec.idestadocultivo = 1
         AND ec.estado_registro = 1
         AND LOWER(et.nombre_etapa) = LOWER('Cosecha')
       LIMIT 1`,
      [idcultivo]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error validating cultivo for cosecha:', error);
    throw error;
  }
}

export async function fetchCosechasPorCultivo(idcultivo) {
  try {
    const result = await pool.query(
      `SELECT
         c.idcosecha AS id,
         c.idcultivo,
         c.idetapa_cultivo AS "etapaId",
         et.nombre_etapa AS etapa,
         c.fecha_cosecha AS fecha,
         c.cantidad_cosechada AS cantidad,
         c.precio_unitario AS precio,
         c.idunidadmedida AS unidadMedidaId,
         um.nombre AS unidad,
         c.idtipoprecio AS tipoPrecioId,
         tp.nombre AS tipoPrecio,
         CASE WHEN c.estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro
       FROM cosecha c
       LEFT JOIN unidades_medidas um ON c.idunidadmedida = um.idunidadmedida
       LEFT JOIN tipo_precio tp ON c.idtipoprecio = tp.idtipoprecio
       LEFT JOIN etapa_cultivo ec ON ec.idetapacultivo = c.idetapa_cultivo
       LEFT JOIN etapas et ON et.idetapa = ec.idetapa
       WHERE c.idcultivo = $1
       ORDER BY c.fecha_cosecha DESC`,
      [idcultivo]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching cosechas por cultivo:', error);
    throw error;
  }
}

export async function fetchUnidadesMedida() {
  try {
    const result = await pool.query(
      'SELECT idunidadmedida AS id, nombre FROM unidades_medidas ORDER BY nombre'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching unidades de medida:', error);
    throw error;
  }
}

export async function fetchTiposPrecio() {
  try {
    const result = await pool.query(
      'SELECT idtipoprecio AS id, nombre FROM tipo_precio ORDER BY nombre'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching tipos de precio:', error);
    throw error;
  }
}

export async function createCosecha({ idcultivo, idetapa_cultivo, cantidad_cosechada, idunidadmedida, precio_unitario, idtipo_precio }) {
  try {
    const result = await pool.query(
      `INSERT INTO cosecha (idcultivo, idetapa_cultivo, cantidad_cosechada, idunidadmedida, precio_unitario, idtipoprecio, fecha_cosecha)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       RETURNING idcosecha AS id, idcultivo, idetapa_cultivo AS "etapaId",
                 cantidad_cosechada AS cantidad, idunidadmedida,
                 precio_unitario AS precio, idtipoprecio AS "tipoPrecioId",
                 fecha_cosecha AS fecha`,
      [idcultivo, idetapa_cultivo, cantidad_cosechada, idunidadmedida, precio_unitario, idtipo_precio]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating cosecha:', error);
    throw error;
  }
}

export async function updateCosecha(idcosecha, { cantidad_cosechada, idunidadmedida, precio_unitario, idtipo_precio }) {
  try {
    const result = await pool.query(
      `UPDATE cosecha
       SET cantidad_cosechada = $1,
           idunidadmedida = $2,
           precio_unitario = $3,
           idtipoprecio = $4
       WHERE idcosecha = $5
       RETURNING idcosecha AS id, idcultivo, cantidad_cosechada AS cantidad, idunidadmedida, precio_unitario AS precio, idtipoprecio AS tipoPrecioId, fecha_cosecha AS fecha`,
      [cantidad_cosechada, idunidadmedida, precio_unitario, idtipo_precio, idcosecha]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating cosecha:', error);
    throw error;
  }
}

export async function deleteCosechaById(idcosecha) {
  try {
    const result = await pool.query(
      'DELETE FROM cosecha WHERE idcosecha = $1 RETURNING idcosecha AS id',
      [idcosecha]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting cosecha:', error);
    throw error;
  }
}

export async function validateActiveEtapaForCultivo(idetapacultivo, idcultivo) {
  try {
    const result = await pool.query(
      `SELECT 1
       FROM etapa_cultivo ec
       JOIN cultivo c ON c.idcultivo = ec.idcultivo
       JOIN etapas et ON et.idetapa = ec.idetapa AND et.estado_registro = 1
       WHERE ec.idetapacultivo = $1
         AND ec.idcultivo = $2
         AND ec.idestadocultivo = 1
         AND ec.estado_registro = 1
         AND c.estado_registro = 1
         AND (
           NOT EXISTS (
             SELECT 1 FROM etapas_tipo_cultivo configured
             WHERE configured.idtipocultivo = c.idtipocultivo
               AND configured.estado_registro = 1
           )
           OR EXISTS (
             SELECT 1 FROM etapas_tipo_cultivo configured
             WHERE configured.idtipocultivo = c.idtipocultivo
               AND configured.idetapa = ec.idetapa
               AND configured.estado_registro = 1
           )
         )
       LIMIT 1`,
      [idetapacultivo, idcultivo]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error validating active etapa for cultivo:', error);
    throw error;
  }
}

export async function createCosto({ descripcion, valor, idcultivo, idetapa_cultivo, idusuario, idsubcategoria, idfinca, idestado_pago }) {
  try {
    await assertManualMateriaPrimaNotUsed(idsubcategoria);
    const result = await pool.query(
      `INSERT INTO costo (descripcion, valor, fecha, idcultivo, idetapa_cultivo, id_usuario, idsubcategoria, idfinca, idestado_pago)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
       RETURNING idcosto AS id, descripcion, valor, fecha, idcultivo, idetapa_cultivo AS etapaCultivoId`,
      [descripcion || null, valor, idcultivo, idetapa_cultivo, idusuario, idsubcategoria, idfinca, idestado_pago]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating costo:', error);
    throw error;
  }
}

export async function updateCosto(idcosto, { descripcion, valor, idsubcategoria, idestado_pago }) {
  try {
    await assertManualMateriaPrimaNotUsed(idsubcategoria, idcosto);
    const result = await pool.query(
      `UPDATE costo
       SET descripcion = $1,
           valor = $2,
           idsubcategoria = $3,
           idestado_pago = $4
       WHERE idcosto = $5
       RETURNING idcosto AS id, descripcion, valor, fecha, idcultivo, idetapa_cultivo AS etapaCultivoId, idsubcategoria, idestado_pago`,
      [descripcion || null, valor, idsubcategoria, idestado_pago, idcosto]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating costo:', error);
    throw error;
  }
}

export async function deleteCostoById(idcosto) {
  try {
    await assertManualMateriaPrimaNotUsed(null, idcosto);
    const result = await pool.query(
      'DELETE FROM costo WHERE idcosto = $1 RETURNING idcosto AS id',
      [idcosto]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting costo:', error);
    throw error;
  }
}

export async function deleteCultivoById(idcultivo) {
  const result = await pool.query(
    "UPDATE cultivo SET estado_registro = 0 WHERE idcultivo = $1 RETURNING idcultivo AS id, nombre",
    [idcultivo]
  );
  return result.rows[0] || null;
}

export async function changeCultivoState(idcultivo, nuevoEstado) {
  const result = await pool.query(
    `UPDATE cultivo
     SET estado_registro = $1
     WHERE idcultivo = $2
     RETURNING idcultivo AS id, nombre,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ARCHIVADO' END AS estado_registro`,
    [toDatabaseRegistroState(nuevoEstado), idcultivo]
  );
  return result.rows[0] || null;
}

export async function changeCostoState(idcosto, nuevoEstado) {
  await assertManualMateriaPrimaNotUsed(null, idcosto);
  const result = await pool.query(
    `UPDATE costo
     SET estado_registro = $1
     WHERE idcosto = $2
     RETURNING idcosto AS id,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro`,
    [toDatabaseRegistroState(nuevoEstado), idcosto]
  );
  return result.rows[0] || null;
}

export async function changeEtapaState(idetapacultivo, nuevoEstado) {
  const result = await pool.query(
    `UPDATE etapa_cultivo
     SET estado_registro = $1
     WHERE idetapacultivo = $2
     RETURNING idetapacultivo AS id,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro`,
    [toDatabaseRegistroState(nuevoEstado), idetapacultivo]
  );
  return result.rows[0] || null;
}

export async function changeCosechaState(idcosecha, nuevoEstado) {
  const result = await pool.query(
    `UPDATE cosecha
     SET estado_registro = $1
     WHERE idcosecha = $2
     RETURNING idcosecha AS id,
               CASE WHEN estado_registro = 1 THEN 'ACTIVO' ELSE 'ANULADO' END AS estado_registro`,
    [toDatabaseRegistroState(nuevoEstado), idcosecha]
  );
  return result.rows[0] || null;
}
