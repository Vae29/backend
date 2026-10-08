import express from 'express';
import cors from 'cors';

import pool, { testConnection } from './config/db.js';

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.frontend_url,
  process.env.CLIENT_ORIGIN,
  'https://agrogestion-modulo-costos.netlify.app',
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;

testConnection();

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});