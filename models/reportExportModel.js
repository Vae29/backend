import pool from '../config/db.js';

export const REPORT_FILTER_KEYS = [
  'fincaId',
  'cultivoId',
  'categoriaId',
  'subcategoriaId',
  'usuarioId',
  'estadoId',
  'tipoCultivoId',
  'etapaId',
  'fechaInicio',
  'fechaFin',
];

export async function getReportModelContext(fincaId, userId = null) {
  const result = await pool.query(
    `SELECT f.nombre AS finca,
            COALESCE(u.primer_nombre || ' ' || u.primer_apellido, '') AS usuario
     FROM finca f
     LEFT JOIN usuario u ON u.id_usuario = $2 AND u.estado_registro = 1
     WHERE f.idfinca = $1 AND f.estado_registro = 1`,
    [fincaId, userId]
  );
  return result.rows[0] || { finca: null, usuario: null };
}

export async function getReportExportContext(userId, fincaId) {
  const result = await pool.query(
    `SELECT f.nombre AS finca,
            u.primer_nombre || ' ' || u.primer_apellido AS usuario
     FROM finca f
     JOIN usuario u ON u.id_usuario = $1 AND u.estado_registro = 1
     WHERE f.idfinca = $2 AND f.estado_registro = 1`,
    [userId, fincaId]
  );
  if (!result.rowCount) {
    throw Object.assign(new Error('La finca seleccionada no existe o está archivada.'), {
      statusCode: 400,
    });
  }
  return result.rows[0];
}

export async function recordReportExport({
  fincaId,
  reportType,
  format,
  filters,
  rowCount,
}) {
  const result = await pool.query(
    `SELECT public.fn_auditoria_registrar_evento(
       $1::text,
       'EXPORTACION'::text,
       'reportes'::text,
       NULL::bigint,
       $2::text,
       $3::jsonb
     ) AS id`,
    [
      'REPORTES',
      `Exportación ${reportType} (${format}) para finca ${fincaId}; filas: ${rowCount}.`,
      JSON.stringify({
        fincaId,
        tipoReporte: reportType,
        formato: format,
        filtros: filters,
        numeroFilas: rowCount,
      }),
    ]
  );
  return result.rows[0].id;
}

export async function recordReportQuery({ reportType, filters, rowCount }) {
  const safeFilters = Object.fromEntries(
    REPORT_FILTER_KEYS
      .filter((key) => filters && Object.prototype.hasOwnProperty.call(filters, key))
      .map((key) => [key, filters[key]])
      .filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value))
  );
  const result = await pool.query(
    `SELECT public.fn_auditoria_registrar_evento(
       'REPORTES'::text,
       'CONSULTA_REPORTE'::text,
       'reportes'::text,
       NULL::bigint,
       $1::text,
       $2::jsonb
     ) AS id`,
    [
      `Consulta del reporte ${reportType}; filas encontradas: ${rowCount}.`,
      JSON.stringify({
        tipoReporte: reportType,
        filtros: safeFilters,
        numeroFilas: rowCount,
      }),
    ]
  );
  return result.rows[0].id;
}
