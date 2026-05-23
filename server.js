import express from 'express';
import cors from 'cors';

import pool, { testConnection } from './config/db.js';
import fincasRoutes from './routes/fincas.js';
import dashboardRoutes from './routes/dashboard.js';
import authRoutes from './routes/auth.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/fincas', fincasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API de backend lista' });
});

testConnection();

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});