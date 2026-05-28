import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'costosbd',
  password: process.env.PG_PASSWORD || 'TU_PASSWORD',
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5432,
});

pool.on('connect', () => {
  console.log('🔌 PostgreSQL pool connected');
});

pool.on('error', (error) => {
  console.error('❌ PostgreSQL pool error', error);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL conectado');
    client.release();
  } catch (error) {
    console.log('❌ Error conectando PostgreSQL');
    console.error(error);
  }
};

export default pool;
export { testConnection };