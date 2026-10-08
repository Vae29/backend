import dotenv from 'dotenv';
import pkg from 'pg';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const { Pool } = pkg;

const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;

const usingDatabaseUrl = Boolean(process.env.DATABASE_URL);
const usingPgVars = Boolean(
  process.env.PG_USER &&
    process.env.PG_PASSWORD &&
    process.env.PG_HOST &&
    process.env.PG_DATABASE
);

if (!usingDatabaseUrl && !usingPgVars) {
  console.error(
    'FATAL: No se encontró configuración válida de PostgreSQL. Define DATABASE_URL o PG_USER/PG_PASSWORD/PG_HOST/PG_DATABASE.'
  );
}

const poolConfig = usingDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl,
    }
  : {
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT || 5432),
      database: process.env.PG_DATABASE,
      ssl,
    };

const pool = new Pool(poolConfig);

console.log(
  `PostgreSQL connection mode: ${usingDatabaseUrl ? 'DATABASE_URL' : usingPgVars ? 'PG_* variables' : 'NONE'}`
);

pool.on('connect', () => {
  console.log('🔌 PostgreSQL conectado a Supabase');
});

pool.on('error', (error) => {
  console.error('❌ PostgreSQL error', error);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión exitosa a Supabase');
    client.release();
  } catch (error) {
    console.log('❌ Error conectando a Supabase');
    console.error(error);
  }
};

export default pool;
export { testConnection };