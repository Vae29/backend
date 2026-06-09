import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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