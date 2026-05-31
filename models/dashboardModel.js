import pool from '../config/db.js';

const toNumber = (value) => {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function findDashboardByFinca(fincaId) {
  const summaryQuery = `
    WITH cultivos AS (
      SELECT c.idcultivo,
             c.nombre,
             c.fecha_inicio,
             c.fecha_final,
             COALESCE(LOWER(e.nombre), '') AS estado
      FROM cultivo c
      LEFT JOIN estado e ON c.idestado = e.idestado
      WHERE c.idfinca = $1
    ),
    costos AS (
      SELECT idcultivo, SUM(valor) AS total_costos
      FROM costo
      GROUP BY idcultivo
    ),
    ingresos AS (
      SELECT idcultivo,
             SUM(cantidad_cosechada * precio_unitario) AS total_ingresos,
             SUM(cantidad_cosechada) AS total_produccion
      FROM cosecha
      GROUP BY idcultivo
    )
    SELECT
      COALESCE(COUNT(*), 0) AS total_cultivos,
      COALESCE(SUM(costos.total_costos), 0) AS total_costos,
      COALESCE(SUM(ingresos.total_ingresos), 0) AS total_ingresos,
      COALESCE(SUM(ingresos.total_produccion), 0) AS total_produccion,
      COUNT(*) FILTER (WHERE cultivos.estado <> 'finalizado' OR cultivos.estado = '') AS cultivos_activos,
      COUNT(*) FILTER (WHERE cultivos.estado = 'finalizado') AS cultivos_finalizados
    FROM cultivos
    LEFT JOIN costos ON cultivos.idcultivo = costos.idcultivo
    LEFT JOIN ingresos ON cultivos.idcultivo = ingresos.idcultivo;
  `;

  const rentabilidadQuery = `
    -- Datos de rentabilidad por cultivo para el dashboard.
    -- Se calculan ingresos, costos y ganancia a partir de las tablas cultivo, costo y cosecha.
    WITH cultivos AS (
      SELECT c.idcultivo,
             c.nombre,
             c.fecha_inicio,
             c.fecha_final,
             COALESCE(LOWER(e.nombre), '') AS estado
      FROM cultivo c
      LEFT JOIN estado e ON c.idestado = e.idestado
      WHERE c.idfinca = $1
    ),
    costos AS (
      SELECT idcultivo, SUM(valor) AS total_costos
      FROM costo
      GROUP BY idcultivo
    ),
    ingresos AS (
      SELECT idcultivo,
             SUM(cantidad_cosechada * precio_unitario) AS total_ingresos
      FROM cosecha
      GROUP BY idcultivo
    )
    SELECT
      cultivos.idcultivo AS id,
      cultivos.nombre,
      cultivos.estado,
      TO_CHAR(cultivos.fecha_inicio, 'DD/MM/YYYY') AS fecha_inicio,
      COALESCE(TO_CHAR(cultivos.fecha_final, 'DD/MM/YYYY'), '--') AS fecha_final,
      COALESCE(costos.total_costos, 0) AS costo,
      COALESCE(ingresos.total_ingresos, 0) AS ingresos,
      COALESCE(ingresos.total_ingresos, 0) - COALESCE(costos.total_costos, 0) AS ganancia,
      CASE
        WHEN COALESCE(ingresos.total_ingresos, 0) > 0
        THEN ((COALESCE(ingresos.total_ingresos, 0) - COALESCE(costos.total_costos, 0)) / COALESCE(ingresos.total_ingresos, 1)) * 100
        ELSE 0
      END AS margen
    FROM cultivos
    LEFT JOIN costos ON cultivos.idcultivo = costos.idcultivo
    LEFT JOIN ingresos ON cultivos.idcultivo = ingresos.idcultivo
    ORDER BY cultivos.nombre;
  `;

  const costCategoryQuery = `
      SELECT cc.nombre AS categoria,
        COALESCE(SUM(co.valor), 0) AS total
      FROM categoria_costo cc
      LEFT JOIN subcategoria_costo sc ON sc.idcategoria = cc.idcategoria
      LEFT JOIN costo co ON co.idsubcategoria = sc.idsubcategoria
      LEFT JOIN cultivo cu ON co.idcultivo = cu.idcultivo AND cu.idfinca = $1
      GROUP BY cc.nombre
      ORDER BY total DESC, cc.nombre;
  `;

  const productionTrendQuery = `
    SELECT TO_CHAR(month, 'Mon YYYY') AS label,
           COALESCE(SUM(cc.cantidad_cosechada), 0) AS total_produccion
    FROM GENERATE_SERIES(
      date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
      date_trunc('month', CURRENT_DATE),
      INTERVAL '1 month'
    ) AS month
    LEFT JOIN cosecha cc ON date_trunc('month', cc.fecha_cosecha) = month
    LEFT JOIN cultivo cu ON cc.idcultivo = cu.idcultivo AND cu.idfinca = $1
    GROUP BY month
    ORDER BY month;
  `;

  const costTrendQuery = `
    SELECT TO_CHAR(month, 'Mon YYYY') AS label,
           COALESCE(SUM(co.valor), 0) AS total_costos
    FROM GENERATE_SERIES(
      date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
      date_trunc('month', CURRENT_DATE),
      INTERVAL '1 month'
    ) AS month
    LEFT JOIN costo co ON date_trunc('month', co.fecha) = month
    LEFT JOIN cultivo cu ON co.idcultivo = cu.idcultivo AND cu.idfinca = $1
    GROUP BY month
    ORDER BY month;
  `;

  const recentActivitiesQuery = `
    WITH finca_cultivos AS (
      SELECT c.idcultivo, c.nombre AS cultivo_nombre
      FROM cultivo c
      WHERE c.idfinca = $1
    )
    SELECT 'cosecha' AS type,
           cc.fecha_cosecha AS occurred_at,
           'Cosecha registrada' AS title,
           CONCAT(
             'Cultivo: ', COALESCE(fc.cultivo_nombre, '--'),
             ' | Cantidad: ', COALESCE(cc.cantidad_cosechada::text, '0'),
             ' ', COALESCE(um.nombre, ''),
             ' | Ingreso: ', TO_CHAR(COALESCE(cc.cantidad_cosechada * cc.precio_unitario, 0), 'FM$999G999G999')
           ) AS description
    FROM cosecha cc
    JOIN finca_cultivos fc ON cc.idcultivo = fc.idcultivo
    LEFT JOIN unidades_medidas um ON cc.idunidadmedida = um.idunidadmedida

    UNION ALL

    SELECT 'costo' AS type,
           co.fecha AS occurred_at,
           CONCAT('Costo registrado: ', COALESCE(cc.nombre, 'Costo')) AS title,
           CONCAT(
             'Cultivo: ', COALESCE(fc.cultivo_nombre, '--'),
             ' | Monto: ', TO_CHAR(co.valor, 'FM$999G999G999')
           ) AS description
    FROM costo co
    JOIN finca_cultivos fc ON co.idcultivo = fc.idcultivo
    LEFT JOIN subcategoria_costo sc ON co.idsubcategoria = sc.idsubcategoria
    LEFT JOIN categoria_costo cc ON sc.idcategoria = cc.idcategoria

    UNION ALL

    SELECT 'etapa' AS type,
           ec.fecha_inicio AS occurred_at,
           CONCAT('Etapa iniciada: ', COALESCE(e.nombre_etapa, 'Etapa nueva')) AS title,
           CONCAT(
             'Cultivo: ', COALESCE(fc.cultivo_nombre, '--'),
             ' | ', COALESCE(ec.descripcion, 'Descripción no disponible')
           ) AS description
    FROM etapa_cultivo ec
    JOIN finca_cultivos fc ON ec.idcultivo = fc.idcultivo
    LEFT JOIN etapas e ON ec.idetapa = e.idetapa

    UNION ALL

    SELECT 'cultivo' AS type,
           c.fecha_inicio AS occurred_at,
           CONCAT('Cultivo iniciado: ', c.nombre) AS title,
           CONCAT('Inicio: ', TO_CHAR(c.fecha_inicio, 'DD/MM/YYYY')) AS description
    FROM cultivo c
    WHERE c.idfinca = $1

    ORDER BY occurred_at DESC
    LIMIT 5;
  `;

  const upcomingCropQuery = `
    SELECT c.nombre,
           TO_CHAR(c.fecha_final, 'DD/MM/YYYY') AS fecha_final,
           COALESCE(LOWER(e.nombre), '') AS estado
    FROM cultivo c
    LEFT JOIN estado e ON c.idestado = e.idestado
    WHERE c.idfinca = $1
      AND c.fecha_final BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      AND COALESCE(LOWER(e.nombre), '') <> 'finalizado'
    ORDER BY c.fecha_final
    LIMIT 1;
  `;

  const costRiskQuery = `
    WITH costos AS (
      SELECT idcultivo, SUM(valor) AS total_costos
      FROM costo
      GROUP BY idcultivo
    ),
    ingresos AS (
      SELECT idcultivo, SUM(cantidad_cosechada * precio_unitario) AS total_ingresos
      FROM cosecha
      GROUP BY idcultivo
    )
    SELECT c.nombre,
           COALESCE(costos.total_costos, 0) AS total_costos,
           COALESCE(ingresos.total_ingresos, 0) AS total_ingresos
    FROM cultivo c
    LEFT JOIN costos ON c.idcultivo = costos.idcultivo
    LEFT JOIN ingresos ON c.idcultivo = ingresos.idcultivo
    WHERE c.idfinca = $1
    ORDER BY COALESCE(costos.total_costos, 0) DESC
    LIMIT 1;
  `;

  const lowProductionQuery = `
    SELECT c.nombre,
           COALESCE(SUM(cc.cantidad_cosechada), 0) AS produccion_30dias,
           COALESCE(um.nombre, 'kg') AS unidad
    FROM cultivo c
    LEFT JOIN cosecha cc ON cc.idcultivo = c.idcultivo AND cc.fecha_cosecha >= CURRENT_DATE - INTERVAL '30 days'
    LEFT JOIN unidades_medidas um ON cc.idunidadmedida = um.idunidadmedida
    WHERE c.idfinca = $1
    GROUP BY c.idcultivo, c.nombre, um.nombre
    ORDER BY produccion_30dias ASC
    LIMIT 1;
  `;

  const highProfitQuery = `
    WITH costos AS (
      SELECT idcultivo, SUM(valor) AS total_costos
      FROM costo
      GROUP BY idcultivo
    ),
    ingresos AS (
      SELECT idcultivo, SUM(cantidad_cosechada * precio_unitario) AS total_ingresos
      FROM cosecha
      GROUP BY idcultivo
    )
    SELECT c.nombre,
           COALESCE(costos.total_costos, 0) AS total_costos,
           COALESCE(ingresos.total_ingresos, 0) AS total_ingresos,
           CASE WHEN COALESCE(ingresos.total_ingresos, 0) > 0
                THEN (COALESCE(ingresos.total_ingresos, 0) - COALESCE(costos.total_costos, 0)) / COALESCE(ingresos.total_ingresos, 1)
                ELSE 0 END AS margin
    FROM cultivo c
    LEFT JOIN costos ON c.idcultivo = costos.idcultivo
    LEFT JOIN ingresos ON c.idcultivo = ingresos.idcultivo
    WHERE c.idfinca = $1
    ORDER BY margin DESC
    LIMIT 1;
  `;

  const [summaryResult, rentabilidadResult, categoryResult, productionResult, costTrendResult, recentActivitiesResult, upcomingCropResult, costRiskResult, lowProductionResult, highProfitResult] = await Promise.all([
    pool.query(summaryQuery, [fincaId]),
    pool.query(rentabilidadQuery, [fincaId]),
    pool.query(costCategoryQuery, [fincaId]),
    pool.query(productionTrendQuery, [fincaId]),
    pool.query(costTrendQuery, [fincaId]),
    pool.query(recentActivitiesQuery, [fincaId]),
    pool.query(upcomingCropQuery, [fincaId]),
    pool.query(costRiskQuery, [fincaId]),
    pool.query(lowProductionQuery, [fincaId]),
    pool.query(highProfitQuery, [fincaId]),
  ]);

  const summaryRow = summaryResult.rows[0] || {};
  const summary = {
    totalCultivos: toNumber(summaryRow.total_cultivos),
    costos: toNumber(summaryRow.total_costos),
    ingresos: toNumber(summaryRow.total_ingresos),
    ganancia: toNumber(summaryRow.total_ingresos) - toNumber(summaryRow.total_costos),
    produccionKg: toNumber(summaryRow.total_produccion),
    cultivosActivos: toNumber(summaryRow.cultivos_activos),
    cultivosFinalizados: toNumber(summaryRow.cultivos_finalizados),
  };

  const rentability = rentabilidadResult.rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    estado: row.estado || 'Sin estado',
    fechaInicio: row.fecha_inicio || '--',
    fechaFinal: row.fecha_final || '--',
    ingresos: toNumber(row.ingresos),
    costo: toNumber(row.costo),
    ganancia: toNumber(row.ganancia),
    margen: Number.isFinite(Number(row.margen)) ? Number(row.margen) : 0,
  }));

  const cultivosEstado = rentability.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    estado: row.estado,
    fechaInicio: row.fechaInicio,
    fechaFinal: row.fechaFinal,
    costo: row.costo,
    ganancia: row.ganancia,
  }));

  const costByCategory = categoryResult.rows.map((row) => ({
    categoria: row.categoria,
    total: toNumber(row.total),
  }));

  const productionTrend = productionResult.rows.map((row) => ({
    label: row.label,
    value: toNumber(row.total_produccion),
  }));

  const costTrend = costTrendResult.rows.map((row) => ({
    label: row.label,
    value: toNumber(row.total_costos),
  }));

  const recentActivities = recentActivitiesResult.rows.map((row) => ({
    type: row.type,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at ? row.occurred_at.toISOString?.() || row.occurred_at : null,
  }));

  const alerts = [];
  const upcomingCrop = upcomingCropResult.rows[0];
  const costRisk = costRiskResult.rows[0];
  const lowProduction = lowProductionResult.rows[0];
  const highProfit = highProfitResult.rows[0];

  if (upcomingCrop) {
    alerts.push({
      type: 'warning',
      title: 'Cultivo próximo a finalizar',
      message: `El cultivo ${upcomingCrop.nombre} tiene fecha de finalización ${upcomingCrop.fecha_final}. Revisa recursos y cosecha.`, 
    });
  }

  if (costRisk && costRisk.total_costos > 0) {
    const ratio = costRisk.total_ingresos > 0 ? costRisk.total_costos / costRisk.total_ingresos : 1;
    if (ratio >= 1) {
      alerts.push({
        type: 'danger',
        title: 'Costos elevados detectados',
        message: `El cultivo ${costRisk.nombre} registra costos mayores o iguales a sus ingresos (${toNumber(costRisk.total_costos)} / ${toNumber(costRisk.total_ingresos)}).`, 
      });
    } else {
      alerts.push({
        type: 'warning',
        title: 'Costos altos en cultivo',
        message: `El cultivo ${costRisk.nombre} tiene costos significativos de ${toNumber(costRisk.total_costos)}.`, 
      });
    }
  }

  if (lowProduction) {
    alerts.push({
      type: lowProduction.produccion_30dias === 0 ? 'danger' : 'info',
      title: 'Baja producción reciente',
      message: `El cultivo ${lowProduction.nombre} produjo ${toNumber(lowProduction.produccion_30dias)} ${lowProduction.unidad} en los últimos 30 días.`, 
    });
  }

  if (highProfit && highProfit.margin > 0.4) {
    alerts.push({
      type: 'success',
      title: 'Rentabilidad óptima',
      message: `El cultivo ${highProfit.nombre} tiene un margen de rentabilidad del ${Math.round(highProfit.margin * 100)}%.`, 
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: 'info',
      title: 'Sin alertas críticas',
      message: 'No se encontraron situaciones relevantes para la finca en este momento.',
    });
  }

  return {
    summary,
    productionTrend,
    costTrend,
    costByCategory,
    rentability,
    cultivosEstado,
    recentActivities,
    alerts,
  };
}
