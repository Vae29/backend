import pool, { runWithRequestDatabaseClient } from '../config/db.js';

export function auditContext(moduleName) {
  return async (req, res, next) => {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado para registrar la auditoría',
      });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query(
        `SELECT public.fn_auditoria_contexto(
          $1::integer, $2::text, NULL, NULL, $3::text, $4::text
        )`,
        [userId, req.ip || null, moduleName, req.body?.motivo || null]
      );
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK').catch((rollbackError) => {
          console.error('Error revirtiendo contexto de auditoría:', rollbackError);
        });
        client.release();
      }
      return next(error);
    }

    let finalized = false;
    const finalize = (commit) => {
      if (finalized) return;
      finalized = true;
      client
        .query(commit ? 'COMMIT' : 'ROLLBACK')
        .catch((error) => {
          console.error('Error finalizando transacción auditada:', error);
        })
        .finally(() => client.release());
    };

    res.once('finish', () => finalize(res.statusCode < 400));
    res.once('close', () => finalize(false));

    try {
      runWithRequestDatabaseClient(client, next);
    } catch (error) {
      finalize(false);
      next(error);
    }
  };
}
