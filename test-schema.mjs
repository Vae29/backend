import pool from './config/db.js';
const tables = ['unidades_medidas', 'tipo_precio', 'cosecha'];
async function run() {
  for (const table of tables) {
    console.log('TABLE', table);
    const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
    console.log(res.rows);
  }
  process.exit(0);
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
