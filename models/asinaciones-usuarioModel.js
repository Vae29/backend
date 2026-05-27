import pool from '../config/db.js';

export async function fetchAllFincas() {
  try {
    const result = await pool.query(
      'SELECT idfinca AS id, nombre, ubicacion FROM finca ORDER BY nombre'
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
      `SELECT c.idcultivo AS id, c.nombre, c.idestado, c.idfinca, f.nombre AS finca_nombre
       FROM cultivo c
       LEFT JOIN finca f ON c.idfinca = f.idfinca
       WHERE c.idestado = 1
       ORDER BY f.nombre, c.nombre`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching cultivos en proceso:', error);
    throw error;
  }
}

export async function fetchCultivosPorFinca(fincaId) {
  try {
    const result = await pool.query(
      `SELECT 
        c.idcultivo AS id, 
        c.nombre, 
        tc.nombre AS tipo,
        c.fecha_inicio AS fechaInicio,
        c.fecha_final AS fechaCosecha,
        e.nombre AS estado,
        c.idestado
       FROM cultivo c
       LEFT JOIN tipos_cultivo tc ON c.idtipocultivo = tc.idtipocultivo
       LEFT JOIN estado e ON c.idestado = e.idestado
       WHERE c.idfinca = $1
       ORDER BY c.nombre`,
      [fincaId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching cultivos por finca:', error);
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
