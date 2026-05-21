import express from 'express';
import cors from 'cors';

import pool, { testConnection } from './config/db.js';
import authRoutes from './routes/auth.js';

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

testConnection();

// Rutas
app.use('/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});