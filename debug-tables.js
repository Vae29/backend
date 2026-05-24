import pool from './config/db.js';

async function debugTables() {
  try {
    console.log('\n===== ESTRUCTURA TABLA usuario_finca =====');
    const usuarioFincaStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuario_finca'
    `);
    console.table(usuarioFincaStructure.rows);

    console.log('\n===== ESTRUCTURA TABLA usuario_cultivo =====');
    const usuarioCultivoStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'usuario_cultivo'
    `);
    console.table(usuarioCultivoStructure.rows);

    console.log('\n===== DATOS EN usuario_finca =====');
    const usuarioFincaData = await pool.query(`
      SELECT * FROM usuario_finca LIMIT 20
    `);
    console.table(usuarioFincaData.rows);
    console.log(`Total registros: ${usuarioFincaData.rows.length}`);

    console.log('\n===== DATOS EN usuario_cultivo =====');
    const usuarioCultivoData = await pool.query(`
      SELECT * FROM usuario_cultivo LIMIT 20
    `);
    console.table(usuarioCultivoData.rows);
    console.log(`Total registros: ${usuarioCultivoData.rows.length}`);

    console.log('\n===== USUARIOS CON SUS FINCAS =====');
    const usuariosConFincas = await pool.query(`
      SELECT u.id_usuario, u.primer_nombre, uf.idfinca
      FROM usuario u
      LEFT JOIN usuario_finca uf ON u.id_usuario = uf.id_usuario
      ORDER BY u.id_usuario
    `);
    console.table(usuariosConFincas.rows);

    console.log('\n===== USUARIOS CON SUS CULTIVOS =====');
    const usuariosConCultivos = await pool.query(`
      SELECT u.id_usuario, u.primer_nombre, uc.idcultivo
      FROM usuario u
      LEFT JOIN usuario_cultivo uc ON u.id_usuario = uc.id_usuario
      ORDER BY u.id_usuario
    `);
    console.table(usuariosConCultivos.rows);

    console.log('\n===== TEST ARRAY_AGG =====');
    const arrayAggTest = await pool.query(`
      SELECT
        u.id_usuario,
        u.primer_nombre,
        COALESCE((SELECT array_agg(idfinca) FROM usuario_finca WHERE id_usuario = u.id_usuario), ARRAY[]::integer[]) AS fincas,
        COALESCE((SELECT array_agg(idcultivo) FROM usuario_cultivo WHERE id_usuario = u.id_usuario), ARRAY[]::integer[]) AS cultivos
      FROM usuario u
      LIMIT 10
    `);
    console.table(arrayAggTest.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

debugTables();
