import pool from '../config/db.js';

// Model: consultas para la sección de reportes.
// Todas las funciones reciben filtros y devuelven filas desde PostgreSQL.

const includeInUnitCostExpression = `COALESCE(
  (to_jsonb(sc) ->> 'incluir_costo_unitario')::boolean,
  NOT (
    lower(btrim(COALESCE(cat.nombre, ''))) = 'costos indirectos'
    AND lower(btrim(COALESCE(sc.nombre, ''))) = 'impuesto de renta'
  )
)`;

export async function getFilters(fincaId) {
  try {
    const filterFinca = Number.isInteger(Number(fincaId)) && Number(fincaId) > 0 ? Number(fincaId) : null;

    const cultivosQuery = `
      SELECT idcultivo AS id, nombre, idfinca, idtipocultivo AS idtipocultivo
      FROM cultivo
      WHERE estado_registro = 1
        AND ($1::int IS NULL OR idfinca = $1)
      ORDER BY nombre
    `;
    const usuariosQuery = `
      SELECT u.id_usuario AS id, u.primer_nombre AS nombre,
             u.primer_apellido AS apellidos, u.correo AS email,
             r.nombre AS rol
      FROM usuario u
      LEFT JOIN roles r ON r.id_roles = u.id_roles
      WHERE u.estado_registro = 1
      ORDER BY u.primer_nombre
    `;
    const estadosQuery = `
      SELECT idestadocultivo AS id, idestadocultivo AS "idestado", nombre
      FROM estado_cultivo
      ORDER BY nombre
    `;
    const categoriasQuery = `
      SELECT idcategoria AS id, nombre,
             to_jsonb(cat) ->> 'codigo_contable' AS "codigoContable"
      FROM categoria_costo AS cat
      ORDER BY cat.nombre
    `;
    const subcategoriasQuery = `
      SELECT sc.idsubcategoria AS id, sc.nombre, sc.idcategoria AS "categoriaId",
             to_jsonb(sc) ->> 'codigo_contable' AS "codigoContable",
             ${includeInUnitCostExpression} AS "incluirCostoUnitario"
      FROM subcategoria_costo sc
      LEFT JOIN categoria_costo cat ON cat.idcategoria = sc.idcategoria
      ORDER BY sc.nombre
    `;
    const tiposCultivoQuery = `
      SELECT idtipocultivo AS id, nombre
      FROM tipos_cultivo
      WHERE estado_registro = 1
      ORDER BY nombre
    `;
    const etapasQuery = `
      SELECT idetapa AS id, nombre_etapa AS nombre
      FROM etapas
      WHERE estado_registro = 1
      ORDER BY nombre_etapa
    `;

    const [
      cultivosRes,
      usuariosRes,
      estadosRes,
      categoriasRes,
      subcategoriasRes,
      tiposCultivoRes,
      etapasRes,
    ] = await Promise.all([
      pool.query(cultivosQuery, [filterFinca]),
      pool.query(usuariosQuery),
      pool.query(estadosQuery),
      pool.query(categoriasQuery),
      pool.query(subcategoriasQuery),
      pool.query(tiposCultivoQuery),
      pool.query(etapasQuery),
    ]);

    return {
      cultivos: cultivosRes.rows,
      usuarios: usuariosRes.rows,
      estados: estadosRes.rows,
      categorias: categoriasRes.rows,
      subcategorias: subcategoriasRes.rows,
      tiposCultivo: tiposCultivoRes.rows,
      etapas: etapasRes.rows,
    };
  } catch (error) {
    console.error('Error in getFilters:', error);
    throw error;
  }
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeFilters(filters = {}) {
  return {
    fincaId: positiveInteger(filters.fincaId),
    cultivoId: positiveInteger(filters.cultivoId),
    categoriaId: positiveInteger(filters.categoriaId),
    subcategoriaId: positiveInteger(filters.subcategoriaId),
    usuarioId: positiveInteger(filters.usuarioId),
    estadoId: positiveInteger(filters.estadoId),
    tipoCultivoId: positiveInteger(filters.tipoCultivoId),
    etapaId: positiveInteger(filters.etapaId),
    estado: filters.estado || null,
    fechaInicio: filters.fechaInicio || null,
    fechaFin: filters.fechaFin || null,
  };
}

function addDateConditions(where, params, alias, column, filters) {
  if (filters.fechaInicio) {
    params.push(filters.fechaInicio);
    where.push(`${alias}.${column} >= $${params.length}::date`);
  }
  if (filters.fechaFin) {
    params.push(filters.fechaFin);
    where.push(`${alias}.${column} < ($${params.length}::date + INTERVAL '1 day')`);
  }
}

function buildFilteredCrops(filters, params, includeBaseUnit = false, hasUnitConversions = true) {
  const where = [`cu.estado_registro = 1`];

  if (filters.fincaId) {
    params.push(filters.fincaId);
    where.push(`cu.idfinca = $${params.length}`);
  }
  if (filters.cultivoId) {
    params.push(filters.cultivoId);
    where.push(`cu.idcultivo = $${params.length}`);
  }
  if (filters.tipoCultivoId) {
    params.push(filters.tipoCultivoId);
    where.push(`cu.idtipocultivo = $${params.length}`);
  }
  if (filters.usuarioId) {
    params.push(filters.usuarioId);
    where.push(`EXISTS (
      SELECT 1 FROM usuario_cultivo uc
      WHERE uc.idcultivo = cu.idcultivo AND uc.id_usuario = $${params.length}
    )`);
  }
  if (filters.estadoId) {
    params.push(filters.estadoId);
    where.push(`cu.idestadocultivo = $${params.length}`);
  } else if (filters.estado) {
    params.push(String(filters.estado));
    where.push(`LOWER(e.nombre) = LOWER($${params.length})`);
  }

  const baseUnitSelection = includeBaseUnit && hasUnitConversions
    ? `, (SELECT um.nombre
         FROM conversion_unidades_cultivo base_conv
         JOIN unidades_medidas um ON um.idunidadmedida = base_conv.idunidadmedida
         WHERE base_conv.idtipocultivo = cu.idtipocultivo
           AND base_conv.es_unidad_base = TRUE
         LIMIT 1) AS unidad_base`
    : includeBaseUnit
      ? ', NULL::text AS unidad_base'
      : '';

  return `filtered_crops AS (
    SELECT cu.idcultivo, cu.nombre, cu.idestadocultivo AS idestado, e.nombre AS estado,
           cu.idtipocultivo, tc.nombre AS tipo_cultivo${baseUnitSelection}
    FROM cultivo cu
    LEFT JOIN estado_cultivo e ON e.idestadocultivo = cu.idestadocultivo
    LEFT JOIN tipos_cultivo tc ON tc.idtipocultivo = cu.idtipocultivo
    WHERE ${where.join(' AND ')}
  )`;
}

function buildCostConditions(filters, params) {
  const where = [`co.estado_registro = 1`];

  if (filters.categoriaId) {
    params.push(filters.categoriaId);
    where.push(`sc.idcategoria = $${params.length}`);
  }
  if (filters.subcategoriaId) {
    params.push(filters.subcategoriaId);
    where.push(`co.idsubcategoria = $${params.length}`);
  }
  if (filters.etapaId) {
    params.push(filters.etapaId);
    where.push(`EXISTS (
      SELECT 1 FROM etapa_cultivo ec
      WHERE ec.idetapacultivo = co.idetapa_cultivo
        AND ec.idetapa = $${params.length}
    )`);
  }
  addDateConditions(where, params, 'co', 'fecha', filters);
  return where.join(' AND ');
}

function buildHarvestConditions(filters, params, hasHarvestStage = true) {
  const where = [`cc.estado_registro = 1`];
  if (filters.etapaId) {
    if (hasHarvestStage) {
      params.push(filters.etapaId);
      where.push(`EXISTS (
        SELECT 1 FROM etapa_cultivo ec
        WHERE ec.idetapacultivo = cc.idetapa_cultivo
          AND ec.idetapa = $${params.length}
      )`);
    } else {
      where.push('FALSE');
    }
  }
  addDateConditions(where, params, 'cc', 'fecha_cosecha', filters);
  return where.join(' AND ');
}

export function buildReportQuery(reportType, rawFilters = {}, schemaCapabilities = {}) {
  const filters = normalizeFilters(rawFilters);
  const hasUnitConversions = schemaCapabilities.hasUnitConversions !== false;
  const hasGeneralCostProration = schemaCapabilities.hasGeneralCostProration !== false;
  const hasHarvestStage = schemaCapabilities.hasHarvestStage !== false;
  const params = [];
  const filteredCrops = buildFilteredCrops(
    filters,
    params,
    reportType === 'costos',
    hasUnitConversions,
  );
  const ctes = [filteredCrops];
  let costConditions;

  if (['por-cultivo', 'costos', 'rentabilidad', 'trabajador'].includes(reportType)) {
    costConditions = buildCostConditions(filters, params);
    if (reportType === 'costos') {
      const fincaCondition = filters.fincaId
        ? `co.idfinca = $${params.indexOf(filters.fincaId) + 1}`
        : 'TRUE';
      const stageUnfiltered = filters.etapaId ? 'FALSE' : 'TRUE';
      const allocatedGeneralCte = hasGeneralCostProration
        ? `allocated_general AS (
            SELECT gc.idcosto AS id_costo, fc.idcultivo AS id_cultivo,
                   NULL::integer AS id_etapa_cultivo,
                   COALESCE(gc.codigo_subcategoria, gc.codigo_categoria) AS codigo_contable,
                   gc.categoria, gc.subcategoria, fc.nombre AS cultivo,
                   fc.tipo_cultivo, fc.unidad_base, NULL::text AS etapa, NULL::integer AS "etapaId",
                   gc.descripcion,
                   round(gc.valor * p.porcentaje / 100, 2) AS valor,
                   gc.fecha, 'PRORRATEADO'::text AS origen,
                   p.porcentaje AS porcentaje_prorrateo
            FROM general_costs gc
            JOIN public.prorrateo_costos_generales p ON p.idfinca = gc.idfinca
            JOIN filtered_crops fc ON fc.idcultivo = p.idcultivo
            WHERE ${stageUnfiltered}
          )`
        : `allocated_general AS (
            SELECT gc.idcosto AS id_costo, NULL::integer AS id_cultivo,
                   NULL::integer AS id_etapa_cultivo,
                   COALESCE(gc.codigo_subcategoria, gc.codigo_categoria) AS codigo_contable,
                   gc.categoria, gc.subcategoria, NULL::text AS cultivo,
                   NULL::text AS tipo_cultivo, NULL::text AS unidad_base,
                   NULL::text AS etapa, NULL::integer AS "etapaId",
                   gc.descripcion, NULL::numeric AS valor, gc.fecha,
                   'PRORRATEADO'::text AS origen, NULL::numeric AS porcentaje_prorrateo
            FROM general_costs gc
            WHERE FALSE
          )`;
      const unallocatedGeneralCondition = hasGeneralCostProration
        ? `AND NOT EXISTS (
                SELECT 1 FROM public.prorrateo_costos_generales p
                 WHERE p.idfinca = gc.idfinca
              )`
        : '';
      return {
        query: `WITH ${filteredCrops},
          general_costs AS (
            SELECT co.idcosto, co.idfinca, co.id_usuario, co.idsubcategoria,
                   co.descripcion, co.valor, co.fecha,
                   cat.nombre AS categoria,
                   to_jsonb(cat) ->> 'codigo_contable' AS codigo_categoria,
                   sc.nombre AS subcategoria,
                   to_jsonb(sc) ->> 'codigo_contable' AS codigo_subcategoria
            FROM costo co
            LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
            LEFT JOIN categoria_costo cat ON cat.idcategoria = sc.idcategoria
            WHERE ${costConditions}
              AND co.idcultivo IS NULL
              AND ${fincaCondition}
          ),
          direct_costs AS (
            SELECT co.idcosto AS id_costo, fc.idcultivo AS id_cultivo,
                   co.idetapa_cultivo AS id_etapa_cultivo,
                   COALESCE(
                     to_jsonb(sc) ->> 'codigo_contable',
                     to_jsonb(cat) ->> 'codigo_contable'
                   ) AS codigo_contable,
                   cat.nombre AS categoria, sc.nombre AS subcategoria,
                   fc.nombre AS cultivo, fc.tipo_cultivo, fc.unidad_base,
                   et.nombre_etapa AS etapa, co.idetapa_cultivo AS "etapaId",
                   co.descripcion, co.valor, co.fecha, 'CULTIVO'::text AS origen,
                   NULL::numeric AS porcentaje_prorrateo
            FROM costo co
            JOIN filtered_crops fc ON fc.idcultivo = co.idcultivo
            LEFT JOIN etapa_cultivo ec ON ec.idetapacultivo = co.idetapa_cultivo
            LEFT JOIN etapas et ON et.idetapa = ec.idetapa
            LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
            LEFT JOIN categoria_costo cat ON cat.idcategoria = sc.idcategoria
            WHERE ${costConditions}
          ),
          ${allocatedGeneralCte},
          unallocated_general AS (
            SELECT gc.idcosto AS id_costo, NULL::integer AS id_cultivo,
                   NULL::integer AS id_etapa_cultivo,
                   COALESCE(gc.codigo_subcategoria, gc.codigo_categoria) AS codigo_contable,
                   gc.categoria, gc.subcategoria, NULL::text AS cultivo,
                   NULL::text AS tipo_cultivo, NULL::text AS unidad_base, NULL::text AS etapa,
                   NULL::integer AS "etapaId", gc.descripcion, gc.valor, gc.fecha,
                   'GENERAL_SIN_PRORRATEAR'::text AS origen,
                   NULL::numeric AS porcentaje_prorrateo
            FROM general_costs gc
            WHERE ${stageUnfiltered}
              ${unallocatedGeneralCondition}
          )
          SELECT * FROM direct_costs
          UNION ALL
          SELECT * FROM allocated_general
          UNION ALL
          SELECT * FROM unallocated_general
          ORDER BY fecha DESC`,
        params,
      };
    }

    const fincaCondition = filters.fincaId
      ? `co.idfinca = $${params.indexOf(filters.fincaId) + 1}`
      : 'TRUE';
    const stageUnfiltered = filters.etapaId ? 'FALSE' : 'TRUE';
    const allocatedCostsByCrop = hasGeneralCostProration
      ? `UNION ALL
        SELECT p.idcultivo, NULL::integer AS idetapa_cultivo,
               round(co.valor * p.porcentaje / 100, 2) AS valor,
               ${includeInUnitCostExpression} AS incluir_costo_unitario
        FROM costo co
        JOIN prorrateo_costos_generales p ON p.idfinca = co.idfinca
        JOIN filtered_crops fc ON fc.idcultivo = p.idcultivo
        LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
        LEFT JOIN categoria_costo cat ON cat.idcategoria = sc.idcategoria
        WHERE ${costConditions}
          AND co.idcultivo IS NULL
          AND ${fincaCondition}
          AND ${stageUnfiltered}`
      : '';
    ctes.push(`costs_by_crop AS (
      SELECT all_costs.idcultivo, all_costs.idetapa_cultivo,
             SUM(all_costs.valor) AS total_costos,
             SUM(CASE WHEN all_costs.incluir_costo_unitario
                      THEN all_costs.valor ELSE 0 END) AS costo_produccion
      FROM (
        SELECT co.idcultivo, co.idetapa_cultivo, co.valor,
               ${includeInUnitCostExpression} AS incluir_costo_unitario
        FROM costo co
        JOIN filtered_crops fc ON fc.idcultivo = co.idcultivo
        LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
        LEFT JOIN categoria_costo cat ON cat.idcategoria = sc.idcategoria
        WHERE ${costConditions}
        ${allocatedCostsByCrop}
      ) all_costs
      GROUP BY all_costs.idcultivo, all_costs.idetapa_cultivo
    )`);
  }

  if (['por-cultivo', 'produccion', 'rentabilidad'].includes(reportType)) {
    const harvestConditions = buildHarvestConditions(filters, params, hasHarvestStage);
    const harvestStageColumn = hasHarvestStage ? 'cc.idetapa_cultivo' : 'NULL::integer';
    if (reportType === 'produccion') {
      const conversionFields = hasUnitConversions
        ? `CASE
             WHEN conv.factor_a_unidad_base IS NOT NULL
             THEN cc.cantidad_cosechada * conv.factor_a_unidad_base
             ELSE NULL
           END AS cantidad_unidad_base,
           base_unit.nombre AS unidad_base,`
        : 'NULL::numeric AS cantidad_unidad_base, NULL::text AS unidad_base,';
      const conversionJoins = hasUnitConversions
        ? `LEFT JOIN conversion_unidades_cultivo conv
             ON conv.idtipocultivo = fc.idtipocultivo
            AND conv.idunidadmedida = cc.idunidadmedida
           LEFT JOIN conversion_unidades_cultivo base_conv
             ON base_conv.idtipocultivo = fc.idtipocultivo
            AND base_conv.es_unidad_base = TRUE
           LEFT JOIN unidades_medidas base_unit
             ON base_unit.idunidadmedida = base_conv.idunidadmedida`
        : '';
      return {
        query: `WITH ${filteredCrops}
          SELECT fc.nombre AS cultivo,
                 fc.tipo_cultivo,
                 fc.idcultivo AS id_cultivo,
                 cc.cantidad_cosechada AS cantidad,
                 ${conversionFields}
                 cc.fecha_cosecha AS fecha,
                 cc.precio_unitario AS precio_unitario,
                 cc.cantidad_cosechada * cc.precio_unitario AS ingreso,
                 um.nombre AS unidad,
                 et.nombre_etapa AS etapa,
                 ${harvestStageColumn} AS "etapaId",
                 ${harvestStageColumn} AS id_etapa_cultivo
          FROM cosecha cc
          JOIN filtered_crops fc ON fc.idcultivo = cc.idcultivo
          LEFT JOIN unidades_medidas um ON um.idunidadmedida = cc.idunidadmedida
          ${conversionJoins}
          LEFT JOIN etapa_cultivo ec ON ec.idetapacultivo = ${harvestStageColumn}
          LEFT JOIN etapas et ON et.idetapa = ec.idetapa
          WHERE ${harvestConditions}
          ORDER BY cc.fecha_cosecha DESC`,
        params,
      };
    }

    const harvestsByCropCte = hasUnitConversions
      ? `harvests_by_crop AS (
      SELECT cc.idcultivo, ${harvestStageColumn} AS idetapa_cultivo,
             SUM(cc.cantidad_cosechada * cc.precio_unitario) AS total_ingresos,
             CASE
               WHEN bool_and(conv.factor_a_unidad_base IS NOT NULL)
               THEN SUM(cc.cantidad_cosechada * conv.factor_a_unidad_base)
               ELSE NULL
             END AS total_produccion,
             base_unit.nombre AS unidad_base
      FROM cosecha cc
      JOIN filtered_crops fc ON fc.idcultivo = cc.idcultivo
      LEFT JOIN conversion_unidades_cultivo conv
        ON conv.idtipocultivo = fc.idtipocultivo
       AND conv.idunidadmedida = cc.idunidadmedida
      LEFT JOIN conversion_unidades_cultivo base_conv
        ON base_conv.idtipocultivo = fc.idtipocultivo
       AND base_conv.es_unidad_base = TRUE
      LEFT JOIN unidades_medidas base_unit
        ON base_unit.idunidadmedida = base_conv.idunidadmedida
      WHERE ${harvestConditions}
      GROUP BY cc.idcultivo, ${harvestStageColumn}, base_unit.nombre
    )`
      : `harvests_by_crop AS (
      SELECT cc.idcultivo, ${harvestStageColumn} AS idetapa_cultivo,
             SUM(cc.cantidad_cosechada * cc.precio_unitario) AS total_ingresos,
             CASE
               WHEN COUNT(DISTINCT cc.idunidadmedida) = 1
               THEN SUM(cc.cantidad_cosechada)
               ELSE NULL
             END AS total_produccion,
             CASE
               WHEN COUNT(DISTINCT cc.idunidadmedida) = 1 THEN MAX(um.nombre)
               ELSE NULL
             END AS unidad_base
      FROM cosecha cc
      JOIN filtered_crops fc ON fc.idcultivo = cc.idcultivo
      LEFT JOIN unidades_medidas um ON um.idunidadmedida = cc.idunidadmedida
      WHERE ${harvestConditions}
      GROUP BY cc.idcultivo, ${harvestStageColumn}
    )`;
    ctes.push(harvestsByCropCte);
  }

  if (reportType === 'por-cultivo' || reportType === 'rentabilidad') {
    const orderBy = reportType === 'rentabilidad' ? 'ganancia DESC' : 'fc.nombre';
    return {
      query: `WITH ${ctes.join(',\n')},
        crop_cost_totals AS (
          SELECT idcultivo, SUM(total_costos) AS total_costos,
                 SUM(costo_produccion) AS costo_produccion
          FROM costs_by_crop
          GROUP BY idcultivo
        ),
        crop_production_totals AS (
          SELECT idcultivo,
                 CASE WHEN bool_and(total_produccion IS NOT NULL)
                      THEN SUM(total_produccion) ELSE NULL END AS total_produccion
          FROM harvests_by_crop
          GROUP BY idcultivo
        ),
        crop_stage_keys AS (
          SELECT idcultivo, idetapa_cultivo FROM costs_by_crop
          UNION
          SELECT idcultivo, idetapa_cultivo FROM harvests_by_crop
          UNION
          SELECT fc.idcultivo, NULL::integer
          FROM filtered_crops fc
          WHERE NOT EXISTS (
            SELECT 1 FROM costs_by_crop c WHERE c.idcultivo = fc.idcultivo
          )
            AND NOT EXISTS (
            SELECT 1 FROM harvests_by_crop h WHERE h.idcultivo = fc.idcultivo
          )
        )
        SELECT fc.idcultivo AS id,
               fc.nombre AS cultivo,
               fc.estado,
               fc.tipo_cultivo,
               et.nombre_etapa AS etapa,
               keys.idetapa_cultivo AS "etapaId",
               COALESCE(costs.total_costos, 0) AS total_costos,
               COALESCE(harvests.total_ingresos, 0) AS total_ingresos,
               harvests.total_produccion,
               harvests.unidad_base,
               COALESCE(harvests.total_ingresos, 0) - COALESCE(costs.total_costos, 0) AS ganancia,
               CASE WHEN production_totals.total_produccion > 0
                    THEN COALESCE(cost_totals.costo_produccion, 0) / production_totals.total_produccion
                    ELSE NULL
               END AS costo_unitario
        FROM crop_stage_keys keys
        JOIN filtered_crops fc ON fc.idcultivo = keys.idcultivo
        LEFT JOIN etapa_cultivo ec ON ec.idetapacultivo = keys.idetapa_cultivo
        LEFT JOIN etapas et ON et.idetapa = ec.idetapa
        LEFT JOIN costs_by_crop costs
          ON costs.idcultivo = keys.idcultivo
         AND costs.idetapa_cultivo IS NOT DISTINCT FROM keys.idetapa_cultivo
        LEFT JOIN harvests_by_crop harvests
          ON harvests.idcultivo = keys.idcultivo
         AND harvests.idetapa_cultivo IS NOT DISTINCT FROM keys.idetapa_cultivo
        LEFT JOIN crop_cost_totals cost_totals ON cost_totals.idcultivo = fc.idcultivo
        LEFT JOIN crop_production_totals production_totals ON production_totals.idcultivo = fc.idcultivo
        ORDER BY ${orderBy}, fc.tipo_cultivo, fc.nombre, et.nombre_etapa`,
      params,
    };
  }

  if (reportType === 'trabajador') {
    const userFilter = filters.usuarioId ? (() => {
      params.push(filters.usuarioId);
      return `AND uc.id_usuario = $${params.length}`;
    })() : '';
    return {
      query: `WITH ${ctes.join(',\n')},
        user_crops AS (
          SELECT DISTINCT uc.id_usuario, fc.idcultivo, fc.idtipocultivo
          FROM filtered_crops fc
          JOIN usuario_cultivo uc ON uc.idcultivo = fc.idcultivo
          WHERE TRUE ${userFilter} ${filters.etapaId ? 'AND FALSE' : ''}
        ),
        labor_by_worker_type AS (
          SELECT pm.id_trabajador AS id_usuario, fc.idtipocultivo,
                 co.idetapa_cultivo,
                 SUM(co.valor) AS total_costos
          FROM pago_mano_obra pm
          JOIN costo co ON co.idcosto = pm.idcosto AND co.estado_registro = 1
          JOIN filtered_crops fc ON fc.idcultivo = co.idcultivo
          LEFT JOIN subcategoria_costo sc ON sc.idsubcategoria = co.idsubcategoria
          WHERE pm.estado_registro = 1
            AND ${costConditions}
            ${filters.usuarioId ? `AND pm.id_trabajador = $${params.length}` : ''}
          GROUP BY pm.id_trabajador, fc.idtipocultivo, co.idetapa_cultivo
        ),
        worker_type_keys AS (
          SELECT id_usuario, idtipocultivo, NULL::integer AS idetapa_cultivo FROM user_crops
          UNION
          SELECT id_usuario, idtipocultivo, idetapa_cultivo FROM labor_by_worker_type
        ),
        assigned_crops AS (
          SELECT id_usuario, idtipocultivo, COUNT(DISTINCT idcultivo) AS cultivos_asignados
          FROM user_crops
          GROUP BY id_usuario, idtipocultivo
        )
        SELECT u.id_usuario AS id,
               u.primer_nombre || ' ' || u.primer_apellido AS nombre,
               tc.nombre AS tipo_cultivo,
               et.nombre_etapa AS etapa,
               COALESCE(labor.total_costos, 0) AS total_costos,
               COALESCE(assigned.cultivos_asignados, 0) AS cultivos_asignados
        FROM worker_type_keys keys
        JOIN usuario u ON u.id_usuario = keys.id_usuario
        LEFT JOIN tipos_cultivo tc ON tc.idtipocultivo = keys.idtipocultivo
        LEFT JOIN etapa_cultivo ec ON ec.idetapacultivo = keys.idetapa_cultivo
        LEFT JOIN etapas et ON et.idetapa = ec.idetapa
        LEFT JOIN labor_by_worker_type labor
          ON labor.id_usuario = keys.id_usuario
         AND labor.idtipocultivo = keys.idtipocultivo
         AND labor.idetapa_cultivo IS NOT DISTINCT FROM keys.idetapa_cultivo
        LEFT JOIN assigned_crops assigned
          ON assigned.id_usuario = keys.id_usuario
         AND assigned.idtipocultivo = keys.idtipocultivo
        ORDER BY total_costos DESC, u.primer_nombre, tc.nombre, et.nombre_etapa`,
      params,
    };
  }

  throw new Error(`Tipo de reporte desconocido: ${reportType}`);
}

async function getSchemaCapabilities(client) {
  const result = await client.query(`
    SELECT to_regclass('public.conversion_unidades_cultivo') IS NOT NULL
             AS "hasUnitConversions",
           to_regclass('public.prorrateo_costos_generales') IS NOT NULL
             AS "hasGeneralCostProration",
           EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'cosecha'
               AND column_name = 'idetapa_cultivo'
           ) AS "hasHarvestStage"
  `);
  return result.rows[0];
}

async function runReport(reportType, filters) {
  const client = await pool.connect();
  let query;
  let params;
  try {
    const schemaCapabilities = await getSchemaCapabilities(client);
    ({ query, params } = buildReportQuery(reportType, filters, schemaCapabilities));
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error(`Report query failed (${reportType}):`, {
      filters,
      query,
      params,
      error: error.stack || error,
    });
    throw error;
  } finally {
    client.release();
  }
}

export const reportByCultivo = (filters = {}) => runReport('por-cultivo', filters);
export const reportCostos = (filters = {}) => runReport('costos', filters);
export const reportProduccion = (filters = {}) => runReport('produccion', filters);
export const reportRentabilidad = (filters = {}) => runReport('rentabilidad', filters);
export const reportByTrabajador = (filters = {}) => runReport('trabajador', filters);

export async function fetchReportData(reportType, filters = {}) {
  const reportTypes = {
    'por-cultivo': reportByCultivo,
    costos: reportCostos,
    produccion: reportProduccion,
    rentabilidad: reportRentabilidad,
    trabajador: reportByTrabajador,
  };
  const run = reportTypes[reportType];
  if (!run) {
    throw Object.assign(new Error('Tipo de reporte desconocido.'), { statusCode: 400 });
  }
  return run(filters);
}

const costsReportColumns = [
  { key: 'fecha', header: 'Fecha', type: 'date', width: 14, total: 'none' },
  { key: 'cultivo', header: 'Cultivo', type: 'text', width: 24, total: 'none' },
  { key: 'categoria', header: 'Categoría', type: 'text', width: 22, total: 'none' },
  { key: 'concepto', header: 'Concepto', type: 'text', width: 36, total: 'none' },
  { key: 'cantidad', header: 'Cantidad', type: 'number', width: 14, total: 'none' },
  { key: 'unidad', header: 'Unidad', type: 'text', width: 14, total: 'none' },
  { key: 'valor_unitario', header: 'Valor unitario', type: 'money', width: 18, total: 'none' },
  { key: 'costo', header: 'Costo', type: 'money', width: 18, total: 'sum' },
  { key: 'ingreso', header: 'Ingreso', type: 'money', width: 18, total: 'sum' },
  { key: 'ganancia', header: 'Ganancia', type: 'money', width: 18, total: 'sum' },
  { key: 'margen', header: 'Margen %', type: 'percent', width: 14, total: 'none' },
  { key: 'rowId', header: 'ID fila', type: 'text', width: 16, total: 'none' },
];

const costsTechnicalColumns = [
  { key: 'rowId', header: 'ID fila', type: 'text', width: 16, total: 'none' },
  { key: 'codigo_contable', header: 'Código contable', type: 'text', width: 18, total: 'none' },
  { key: 'origen', header: 'Origen', type: 'text', width: 24, total: 'none' },
  { key: 'porcentaje_prorrateo', header: 'Prorrateo %', type: 'percent', width: 16, total: 'none' },
  { key: 'unidad_base', header: 'Unidad base', type: 'text', width: 18, total: 'none' },
  { key: 'etapa', header: 'Etapa', type: 'text', width: 22, total: 'none' },
  { key: 'subcategoria', header: 'Subcategoría', type: 'text', width: 26, total: 'none' },
];

function decimalToCents(value) {
  const text = String(value ?? '0').trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new TypeError(`Invalid monetary value returned by PostgreSQL: ${text}`);
  const [, sign, whole, fraction = ''] = match;
  const firstTwoDecimals = (fraction + '00').slice(0, 2);
  const shouldRound = Number(fraction[2] || 0) >= 5;
  const cents = BigInt(whole) * 100n + BigInt(firstTwoDecimals) + (shouldRound ? 1n : 0n);
  return sign === '-' ? -cents : cents;
}

function centsToDecimal(cents) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const value = `${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
  return negative ? `-${value}` : value;
}

function reportDateValue(value) {
  if (!value) return null;
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function groupLabel(row) {
  return row.cultivo || 'Sin cultivo asignado';
}

function groupKey(row) {
  if (!row.id_cultivo) return 'unallocated';
  return `${row.id_cultivo}:${row.id_etapa_cultivo ?? 'none'}`;
}

function appliedFilterLabels(filters) {
  const labels = {
    fincaId: 'Finca (ID)',
    cultivoId: 'Cultivo (ID)',
    categoriaId: 'Categoría (ID)',
    subcategoriaId: 'Subcategoría (ID)',
    usuarioId: 'Usuario (ID)',
    estadoId: 'Estado (ID)',
    tipoCultivoId: 'Tipo de cultivo (ID)',
    etapaId: 'Etapa (ID)',
    fechaInicio: 'Desde',
    fechaFin: 'Hasta',
  };
  return Object.entries(filters)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${labels[key] || key}: ${value}`);
}

export function assembleCostsReportModel({
  costRows,
  harvestRows,
  filters = {},
  context = {},
  generatedAt = new Date(),
}) {
  const rows = [];
  const groupMap = new Map();
  const categoryMap = new Map();
  let totalCostsCents = 0n;
  let totalIncomeCents = 0n;
  let costIndex = 0;
  let incomeIndex = 0;

  const ensureGroup = (key, row) => {
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        groupId: key,
        cultivo: groupLabel(row),
        etapa: row.etapa || 'Sin etapa',
        ingresosCents: 0n,
        costosCents: 0n,
      });
    }
    return groupMap.get(key);
  };

  for (const row of costRows) {
    const cents = decimalToCents(row.valor);
    const key = groupKey(row);
    const group = ensureGroup(key, row);
    group.costosCents += cents;
    totalCostsCents += cents;
    const category = row.categoria || 'Sin categoría';
    categoryMap.set(category, (categoryMap.get(category) || 0n) + cents);
    costIndex += 1;
    rows.push({
      rowId: `C${String(costIndex).padStart(6, '0')}`,
      kind: 'cost',
      fecha: reportDateValue(row.fecha),
      cultivo: groupLabel(row),
      etapa: row.etapa || 'Sin etapa',
      categoria: category,
      concepto: row.descripcion || '',
      cantidad: null,
      unidad: null,
      valor_unitario: null,
      costo: centsToDecimal(cents),
      ingreso: '0.00',
      ganancia: centsToDecimal(-cents),
      margen: 0,
      codigo_contable: row.codigo_contable,
      origen: row.origen,
      porcentaje_prorrateo: row.porcentaje_prorrateo,
      unidad_base: row.unidad_base,
      subcategoria: row.subcategoria,
      id_cultivo: row.id_cultivo,
      id_etapa_cultivo: row.id_etapa_cultivo,
    });
  }

  for (const row of harvestRows) {
    const cents = decimalToCents(row.ingreso);
    const key = `${row.id_cultivo}:${row.id_etapa_cultivo ?? 'none'}`;
    const group = ensureGroup(key, row);
    group.ingresosCents += cents;
    totalIncomeCents += cents;
    incomeIndex += 1;
    rows.push({
      rowId: `I${String(incomeIndex).padStart(6, '0')}`,
      kind: 'income',
      fecha: reportDateValue(row.fecha),
      cultivo: groupLabel(row),
      etapa: row.etapa || 'Sin etapa',
      categoria: 'Ingresos',
      concepto: 'Ingreso por cosecha',
      cantidad: row.cantidad == null ? null : String(row.cantidad),
      unidad: row.unidad,
      valor_unitario: row.precio_unitario == null ? null : String(row.precio_unitario),
      costo: '0.00',
      ingreso: centsToDecimal(cents),
      ganancia: centsToDecimal(cents),
      margen: cents > 0n ? 1 : 0,
      codigo_contable: null,
      origen: null,
      porcentaje_prorrateo: null,
      unidad_base: row.unidad_base,
      subcategoria: null,
      id_cultivo: row.id_cultivo,
      id_etapa_cultivo: row.id_etapa_cultivo,
    });
  }

  rows.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || a.rowId.localeCompare(b.rowId));
  const totalProfitCents = totalIncomeCents - totalCostsCents;
  const groups = {
    byCategory: [...categoryMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoria, cents]) => ({ categoria, costos: centsToDecimal(cents) })),
    byCropStage: [...groupMap.values()]
      .map((group) => {
        const gananciaCents = group.ingresosCents - group.costosCents;
        return {
          groupId: group.groupId,
          cultivo: group.cultivo,
          etapa: group.etapa,
          ingresos: centsToDecimal(group.ingresosCents),
          costos: centsToDecimal(group.costosCents),
          ganancia: centsToDecimal(gananciaCents),
          margen: group.ingresosCents === 0n ? 0 : Number(gananciaCents) / Number(group.ingresosCents),
        };
      })
      .sort((a, b) => a.cultivo.localeCompare(b.cultivo) || a.etapa.localeCompare(b.etapa)),
    byCrop: [...groupMap.values().reduce((byCrop, group) => {
      const current = byCrop.get(group.cultivo) || {
        groupId: group.cultivo,
        cultivo: group.cultivo,
        ingresosCents: 0n,
        costosCents: 0n,
      };
      current.ingresosCents += group.ingresosCents;
      current.costosCents += group.costosCents;
      byCrop.set(group.cultivo, current);
      return byCrop;
    }, new Map()).values()]
      .map((group) => {
        const gananciaCents = group.ingresosCents - group.costosCents;
        return {
          groupId: group.groupId,
          cultivo: group.cultivo,
          ingresos: centsToDecimal(group.ingresosCents),
          costos: centsToDecimal(group.costosCents),
          ganancia: centsToDecimal(gananciaCents),
          margen: group.ingresosCents === 0n ? 0 : Number(gananciaCents) / Number(group.ingresosCents),
        };
      })
      .sort((a, b) => a.cultivo.localeCompare(b.cultivo)),
    unallocatedCosts: centsToDecimal(groupMap.get('unallocated')?.costosCents || 0n),
  };

  return {
    meta: {
      finca: context.finca || null,
      razonSocial: null,
      nit: null,
      reportName: 'Reporte de costos',
      period: {
        from: filters.fechaInicio || null,
        to: filters.fechaFin || null,
      },
      filters: appliedFilterLabels(filters),
      generatedAt: generatedAt.toISOString(),
      usuario: context.usuario || null,
      traceId: context.traceId || null,
    },
    columns: costsReportColumns,
    technicalColumns: costsTechnicalColumns,
    rows,
    groups,
    totals: {
      ingresosCentavos: totalIncomeCents.toString(),
      costosCentavos: totalCostsCents.toString(),
      gananciaCentavos: totalProfitCents.toString(),
      ingresos: centsToDecimal(totalIncomeCents),
      costos: centsToDecimal(totalCostsCents),
      ganancia: centsToDecimal(totalProfitCents),
      margen: totalIncomeCents === 0n ? 0 : Number(totalProfitCents) / Number(totalIncomeCents),
      registroCount: rows.length,
    },
  };
}

export async function buildReportModel(reportType, filters = {}, context = {}) {
  if (reportType !== 'costos') {
    throw Object.assign(new Error('El modelo único solo está implementado para el reporte de costos.'), {
      statusCode: 400,
    });
  }
  const [costRows, harvestRows] = await Promise.all([
    reportCostos(filters),
    reportProduccion(filters),
  ]);
  return assembleCostsReportModel({
    costRows,
    harvestRows,
    filters,
    context,
  });
}
