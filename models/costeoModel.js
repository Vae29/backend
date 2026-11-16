import pool from '../config/db.js';

export async function getCostingConfiguration() {
  const [types, stages, catalogStages, units, categories] = await Promise.all([
    pool.query(
      `SELECT idtipocultivo AS id, nombre, estado_registro AS activo
       FROM tipos_cultivo
       ORDER BY nombre`
    ),
    pool.query(
      `SELECT idtipocultivo AS "tipoCultivoId", idetapa AS "etapaId",
              orden, estado_registro AS activo
       FROM etapas_tipo_cultivo
       ORDER BY idtipocultivo, orden, idetapa`
    ),
    pool.query(
      `SELECT idetapa AS id, nombre_etapa AS nombre, descripcion,
              estado_registro AS activo
       FROM etapas ORDER BY nombre_etapa`
    ),
    pool.query(
      `SELECT idunidadmedida AS id, nombre
       FROM unidades_medidas
       ORDER BY nombre`
    ),
    pool.query(
      `SELECT c.idcategoria AS id, c.nombre, c.codigo_contable AS "codigoContable",
              s.idsubcategoria AS "subcategoriaId", s.nombre AS "subcategoria",
              s.codigo_contable AS "codigoSubcategoria",
              s.incluir_costo_unitario AS "incluirCostoUnitario"
       FROM categoria_costo c
       LEFT JOIN subcategoria_costo s ON s.idcategoria = c.idcategoria
       ORDER BY c.nombre, s.nombre`
    ),
  ]);
  return {
    tiposCultivo: types.rows,
    etapasPorTipo: stages.rows,
    catalogoEtapas: catalogStages.rows,
    unidades: units.rows,
    cuentas: categories.rows,
  };
}

export async function createCropType(nombre) {
  const duplicate = await pool.query(
    'SELECT 1 FROM tipos_cultivo WHERE lower(btrim(nombre)) = lower(btrim($1)) LIMIT 1',
    [nombre]
  );
  if (duplicate.rowCount) {
    throw Object.assign(new Error('Ya existe un tipo de cultivo con ese nombre.'), { statusCode: 409 });
  }
  const result = await pool.query(
    `INSERT INTO tipos_cultivo (nombre)
     VALUES ($1)
     RETURNING idtipocultivo AS id, nombre`,
    [nombre]
  );
  return result.rows[0];
}

export async function createStage({ nombre, descripcion }) {
  const duplicate = await pool.query(
    'SELECT 1 FROM etapas WHERE lower(btrim(nombre_etapa)) = lower(btrim($1)) LIMIT 1',
    [nombre]
  );
  if (duplicate.rowCount) {
    throw Object.assign(new Error('Ya existe una etapa con ese nombre.'), { statusCode: 409 });
  }
  const result = await pool.query(
    `INSERT INTO etapas (nombre_etapa, descripcion)
     VALUES ($1, $2)
     RETURNING idetapa AS id, nombre_etapa AS nombre, descripcion`,
    [nombre, descripcion || null]
  );
  return result.rows[0];
}

export async function updateStage(id, { nombre, descripcion }) {
  const duplicate = await pool.query(
    `SELECT 1 FROM etapas
     WHERE lower(btrim(nombre_etapa)) = lower(btrim($1))
       AND idetapa <> $2 LIMIT 1`,
    [nombre, id]
  );
  if (duplicate.rowCount) {
    throw Object.assign(new Error('Ya existe una etapa con ese nombre.'), { statusCode: 409 });
  }
  const result = await pool.query(
    `UPDATE etapas
     SET nombre_etapa = $2, descripcion = $3
     WHERE idetapa = $1 AND estado_registro = 1
     RETURNING idetapa AS id, nombre_etapa AS nombre, descripcion`,
    [id, nombre, descripcion || null]
  );
  return result.rows[0] || null;
}

export async function setStageState(id, active) {
  const result = await pool.query(
    `UPDATE etapas
     SET estado_registro = $2
     WHERE idetapa = $1
     RETURNING idetapa AS id, nombre_etapa AS nombre, estado_registro AS activo`,
    [id, active ? 1 : 0]
  );
  return result.rows[0] || null;
}

export async function updateCropType(id, nombre) {
  const duplicate = await pool.query(
    `SELECT 1 FROM tipos_cultivo
     WHERE lower(btrim(nombre)) = lower(btrim($1))
       AND idtipocultivo <> $2 LIMIT 1`,
    [nombre, id]
  );
  if (duplicate.rowCount) {
    throw Object.assign(new Error('Ya existe un tipo de cultivo con ese nombre.'), { statusCode: 409 });
  }
  const result = await pool.query(
    `UPDATE tipos_cultivo
     SET nombre = $2
     WHERE idtipocultivo = $1 AND estado_registro = 1
     RETURNING idtipocultivo AS id, nombre`,
    [id, nombre]
  );
  return result.rows[0] || null;
}

export async function setCropTypeState(id, active) {
  if (!active) {
    const assigned = await pool.query(
      'SELECT 1 FROM cultivo WHERE idtipocultivo = $1 LIMIT 1',
      [id]
    );
    if (assigned.rowCount) {
      throw Object.assign(new Error('No se puede desactivar un tipo asociado a cultivos existentes.'), {
        statusCode: 409,
      });
    }
  }
  const result = await pool.query(
    `UPDATE tipos_cultivo
     SET estado_registro = $2
     WHERE idtipocultivo = $1
     RETURNING idtipocultivo AS id, nombre, estado_registro AS activo`,
    [id, active ? 1 : 0]
  );
  return result.rows[0] || null;
}

export async function replaceCropTypeStages(typeId, stageIds) {
  const [type, stages] = await Promise.all([
    pool.query('SELECT 1 FROM tipos_cultivo WHERE idtipocultivo = $1 AND estado_registro = 1', [typeId]),
    stageIds.length
      ? pool.query(
        'SELECT COUNT(*)::int AS count FROM etapas WHERE idetapa = ANY($1::int[]) AND estado_registro = 1',
        [stageIds]
      )
      : Promise.resolve({ rows: [{ count: 0 }] }),
  ]);
  if (!type.rowCount || stages.rows[0].count !== stageIds.length) {
    throw Object.assign(new Error('Tipo de cultivo o etapas inexistentes/inactivos.'), { statusCode: 400 });
  }
  await pool.query(
    `UPDATE etapas_tipo_cultivo
     SET estado_registro = 0
     WHERE idtipocultivo = $1`,
    [typeId]
  );
  for (const [index, stageId] of stageIds.entries()) {
    await pool.query(
      `INSERT INTO etapas_tipo_cultivo (idtipocultivo, idetapa, orden, estado_registro)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (idtipocultivo, idetapa)
       DO UPDATE SET orden = EXCLUDED.orden, estado_registro = 1`,
      [typeId, stageId, index + 1]
    );
  }
}

export async function getGeneralCostAllocations(fincaId) {
  const result = await pool.query(
    `SELECT p.idcultivo AS "cultivoId", c.nombre AS cultivo,
            p.porcentaje
     FROM prorrateo_costos_generales p
     JOIN cultivo c ON c.idcultivo = p.idcultivo
     WHERE p.idfinca = $1
     ORDER BY c.nombre`,
    [fincaId]
  );
  return result.rows;
}

export async function replaceGeneralCostAllocations(fincaId, allocations) {
  const farm = await pool.query(
    'SELECT 1 FROM finca WHERE idfinca = $1 AND estado_registro = 1',
    [fincaId]
  );
  if (!farm.rowCount) {
    throw Object.assign(new Error('La finca no existe o está archivada.'), { statusCode: 400 });
  }
  if (allocations.length) {
    const cropIds = allocations.map((item) => item.cultivoId);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM cultivo
       WHERE idfinca = $1 AND estado_registro = 1
         AND idcultivo = ANY($2::int[])`,
      [fincaId, cropIds]
    );
    if (result.rows[0].count !== cropIds.length) {
      throw Object.assign(new Error('Todos los cultivos deben estar activos y pertenecer a la finca seleccionada.'), {
        statusCode: 400,
      });
    }
  }
  await pool.query(
    'DELETE FROM prorrateo_costos_generales WHERE idfinca = $1',
    [fincaId]
  );
  for (const allocation of allocations) {
    await pool.query(
      `INSERT INTO prorrateo_costos_generales (idfinca, idcultivo, porcentaje)
       VALUES ($1, $2, $3)`,
      [fincaId, allocation.cultivoId, allocation.porcentaje]
    );
  }
}

export async function getUnitConversions(typeId = null) {
  const result = await pool.query(
    `SELECT conv.idtipocultivo AS "tipoCultivoId",
            conv.idunidadmedida AS "unidadId",
            um.nombre AS unidad,
            conv.factor_a_unidad_base AS factor,
            conv.es_unidad_base AS "esUnidadBase"
     FROM conversion_unidades_cultivo conv
     JOIN unidades_medidas um ON um.idunidadmedida = conv.idunidadmedida
     WHERE ($1::int IS NULL OR conv.idtipocultivo = $1)
     ORDER BY conv.idtipocultivo, conv.es_unidad_base DESC, um.nombre`,
    [typeId]
  );
  return result.rows;
}

export async function replaceUnitConversions(typeId, conversions) {
  const type = await pool.query(
    'SELECT 1 FROM tipos_cultivo WHERE idtipocultivo = $1 AND estado_registro = 1',
    [typeId]
  );
  if (!type.rowCount) {
    throw Object.assign(new Error('Tipo de cultivo inexistente o inactivo.'), { statusCode: 400 });
  }
  if (conversions.length) {
    const unitIds = conversions.map((item) => item.unidadId);
    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM unidades_medidas WHERE idunidadmedida = ANY($1::int[])',
      [unitIds]
    );
    if (result.rows[0].count !== unitIds.length) {
      throw Object.assign(new Error('Una o más unidades de medida no existen.'), { statusCode: 400 });
    }
  }
  await pool.query(
    'DELETE FROM conversion_unidades_cultivo WHERE idtipocultivo = $1',
    [typeId]
  );
  for (const conversion of conversions) {
    await pool.query(
      `INSERT INTO conversion_unidades_cultivo
        (idtipocultivo, idunidadmedida, factor_a_unidad_base, es_unidad_base)
       VALUES ($1, $2, $3, $4)`,
      [typeId, conversion.unidadId, conversion.factor, conversion.esUnidadBase]
    );
  }
}

export async function updateCostSubcategoryConfig(id, codigoContable, incluirCostoUnitario) {
  const result = await pool.query(
    `UPDATE subcategoria_costo
     SET codigo_contable = $2,
         incluir_costo_unitario = $3
     WHERE idsubcategoria = $1
     RETURNING idsubcategoria AS id, nombre,
               codigo_contable AS "codigoContable",
               incluir_costo_unitario AS "incluirCostoUnitario"`,
    [id, codigoContable, incluirCostoUnitario]
  );
  return result.rows[0] || null;
}

export async function getInventoryProducts(fincaId) {
  const result = await pool.query(
    `SELECT p.id_producto AS id, p.nombre,
            pp.unidad_contenido AS unidad,
            COALESCE(stock.disponible, 0) AS disponible
     FROM inventario.producto p
     JOIN inventario.presentacion_producto pp ON pp.id_producto = p.id_producto
     LEFT JOIN LATERAL (
       SELECT SUM(l.cantidad_disponible * pp.contenido_por_envase) AS disponible
       FROM inventario.kardex_lote l
       WHERE l.id_producto = p.id_producto
         AND l.id_finca = p.id_finca
         AND l.cantidad_disponible > 0
         AND (l.fecha_vencimiento IS NULL OR l.fecha_vencimiento >= CURRENT_TIMESTAMP)
     ) stock ON TRUE
     WHERE p.id_finca = $1 AND p.activo IS TRUE
     ORDER BY p.nombre`,
    [fincaId]
  );
  return result.rows;
}

export async function registerInventoryConsumption({
  userId,
  fincaId,
  cultivoId,
  etapaId,
  estadoPagoId,
  subcategoriaId,
  productoId,
  cantidad,
  unidad,
  descripcion,
  fecha,
}) {
  const subcategory = await pool.query(
    `SELECT 1
     FROM subcategoria_costo sc
     JOIN categoria_costo cc ON cc.idcategoria = sc.idcategoria
     WHERE sc.idsubcategoria = $1
       AND cc.codigo_contable = '7105'`,
    [subcategoriaId]
  );
  if (!subcategory.rowCount) {
    throw Object.assign(new Error('La subcategoría seleccionada no pertenece a Materia Prima (7105).'), {
      statusCode: 400,
    });
  }

  const validStage = await pool.query(
    `SELECT 1
     FROM cultivo c
     JOIN etapa_cultivo ec ON ec.idcultivo = c.idcultivo
     JOIN etapas et ON et.idetapa = ec.idetapa AND et.estado_registro = 1
     WHERE c.idcultivo = $1 AND c.idfinca = $2
       AND c.estado_registro = 1
       AND ec.idetapacultivo = $3
       AND ec.idestadocultivo = 1 AND ec.estado_registro = 1
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
       )`,
    [cultivoId, fincaId, etapaId]
  );
  if (!validStage.rowCount) {
    throw Object.assign(new Error('La etapa no está activa o no corresponde al tipo de cultivo.'), {
      statusCode: 400,
    });
  }
  const result = await pool.query(
    `SELECT public.fn_registrar_costo_materia_prima(
       $1::integer, $2::integer, $3::integer, $4::integer,
       $5::integer, $6::integer, $7::integer, $8::numeric,
       $9::text, $10::text, $11::date
     ) AS "costoId"`,
    [
      userId, fincaId, cultivoId, etapaId, estadoPagoId,
      subcategoriaId, productoId, cantidad, unidad,
      descripcion || null, fecha || null,
    ]
  );
  return result.rows[0]?.costoId;
}

export async function registerLaborPayment({
  fincaId,
  cultivoId,
  etapaId,
  trabajadorId,
  subcategoriaId,
  estadoPagoId,
  valor,
  fecha,
  descripcion,
  registradoPor,
}) {
  const subcategory = await pool.query(
    `SELECT 1
     FROM subcategoria_costo sc
     JOIN categoria_costo cc ON cc.idcategoria = sc.idcategoria
     WHERE sc.idsubcategoria = $1
       AND cc.codigo_contable = '7205'`,
    [subcategoriaId]
  );
  if (!subcategory.rowCount) {
    throw Object.assign(new Error('La subcategoría seleccionada no pertenece a Mano de Obra Directa.'), {
      statusCode: 400,
    });
  }

  const result = await pool.query(
    `INSERT INTO costo (
       descripcion, valor, fecha, idcultivo, idetapa_cultivo, id_usuario,
       idsubcategoria, idfinca, idestado_pago
     )
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
     WHERE EXISTS (
       SELECT 1 FROM cultivo c
       WHERE c.idcultivo = $4 AND c.idfinca = $8 AND c.estado_registro = 1
     )
       AND EXISTS (
       SELECT 1
       FROM etapa_cultivo ec
       JOIN cultivo crop ON crop.idcultivo = ec.idcultivo
       JOIN etapas et ON et.idetapa = ec.idetapa AND et.estado_registro = 1
       WHERE ec.idetapacultivo = $5 AND ec.idcultivo = $4
         AND ec.estado_registro = 1 AND ec.idestadocultivo = 1
         AND crop.idfinca = $8 AND crop.estado_registro = 1
         AND (
           NOT EXISTS (
             SELECT 1 FROM etapas_tipo_cultivo configured
             WHERE configured.idtipocultivo = crop.idtipocultivo
               AND configured.estado_registro = 1
           )
           OR EXISTS (
             SELECT 1 FROM etapas_tipo_cultivo configured
             WHERE configured.idtipocultivo = crop.idtipocultivo
               AND configured.idetapa = ec.idetapa
               AND configured.estado_registro = 1
           )
         )
     )
       AND EXISTS (
       SELECT 1 FROM usuario u
       JOIN roles r ON r.id_roles = u.id_roles
       WHERE u.id_usuario = $10 AND u.estado_registro = 1
         AND lower(r.nombre) IN ('trabajador', 'worker')
     )
     RETURNING idcosto AS id`,
    [
      descripcion || null, valor, fecha, cultivoId, etapaId, registradoPor,
      subcategoriaId, fincaId, estadoPagoId, trabajadorId,
    ]
  );
  if (!result.rowCount) {
    throw Object.assign(new Error('Cultivo, etapa, finca o trabajador inválido/inactivo.'), {
      statusCode: 400,
    });
  }

  const paymentId = result.rows[0].id;
  await pool.query(
    `INSERT INTO pago_mano_obra (idcosto, id_trabajador)
     VALUES ($1, $2)`,
    [paymentId, trabajadorId]
  );
  return { id: paymentId };
}

export async function listLaborPayments({ fincaId, cultivoId, trabajadorId } = {}) {
  const result = await pool.query(
    `SELECT co.idcosto AS id, co.idfinca AS "fincaId", co.idcultivo AS "cultivoId",
            c.nombre AS cultivo, t.idtipocultivo AS "tipoCultivoId", t.nombre AS "tipoCultivo",
            co.idetapa_cultivo AS "etapaId", et.nombre_etapa AS etapa,
            pm.id_trabajador AS "trabajadorId",
            u.primer_nombre || ' ' || u.primer_apellido AS trabajador,
            co.idsubcategoria AS "subcategoriaId", sc.nombre AS subcategoria,
            co.valor, co.fecha, co.descripcion
     FROM pago_mano_obra pm
     JOIN costo co ON co.idcosto = pm.idcosto AND co.estado_registro = 1
     JOIN usuario u ON u.id_usuario = pm.id_trabajador
     JOIN cultivo c ON c.idcultivo = co.idcultivo
     JOIN tipos_cultivo t ON t.idtipocultivo = c.idtipocultivo
     LEFT JOIN etapa_cultivo ec ON ec.idetapacultivo = co.idetapa_cultivo
     LEFT JOIN etapas et ON et.idetapa = ec.idetapa
     JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
     WHERE pm.estado_registro = 1
       AND ($1::int IS NULL OR co.idfinca = $1)
       AND ($2::int IS NULL OR co.idcultivo = $2)
       AND ($3::int IS NULL OR pm.id_trabajador = $3)
     ORDER BY co.fecha DESC, co.idcosto DESC`,
    [fincaId || null, cultivoId || null, trabajadorId || null]
  );
  return result.rows;
}
