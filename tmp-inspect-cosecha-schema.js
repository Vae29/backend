import pool from './config/db.js';

async function run() {
  const res = await pool.query(
    "SELECT column_name, data_type, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = 'cosecha' AND column_name = 'cantidad_cosechada'"
  );
  console.log(res.rows);
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
