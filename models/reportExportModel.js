import pool from '../config/db.js';

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
  userId,
  fincaId,
  reportType,
  format,
  filters,
  rowCount,
}) {
  const result = await pool.query(
    `INSERT INTO auditoria_exportaciones (
       id_usuario, idfinca, tipo_reporte, formato, filtros, numero_filas
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id_exportacion AS id`,
    [userId, fincaId, reportType, format, JSON.stringify(filters), rowCount]
  );
  return result.rows[0].id;
}
