import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import pool, { testConnection } from './config/db.js';

// Rutas
import authRoutes from './routes/auth.js';
import asignacionesUsuarioRoutes from './routes/asignaciones-usuario.js';
import dashboardRoutes from './routes/dashboard.js';
import reportesRoutes from './routes/reportes.js';
import fincasRoutes from './routes/fincas.js';

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================
   CORS CONFIGURADO BIEN
========================= */

app.use(cors({
  origin: [
    'https://agrogestion-modulo-costos.netlify.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Fallback CORS headers por si el proxy/modo de despliegue elimina cabeceras preflight
app.use((req, res, next) => {
  const allowed = ['https://agrogestion-modulo-costos.netlify.app'];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    return res.sendStatus(204);
  }
  next();
});

/* =========================
   MIDDLEWARES
========================= */

app.use(express.json());
app.use(cookieParser());

/* =========================
   DEBUG / TEST
========================= */

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Backend funcionando 🚀' });
});

app.get('/test', (req, res) => {
  console.log('TEST HIT');
  res.json({ ok: true });
});

/* =========================
   RUTAS API
========================= */

app.use('/auth', authRoutes);
app.use('/api/fincas', fincasRoutes);
app.use('/api', asignacionesUsuarioRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);

/* =========================
   DB TEST
========================= */

testConnection();

/* =========================
   ERRORES GLOBALES
========================= */

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION', { reason, promise });
});

/* =========================
   SERVER
========================= */

const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

/* =========================
   SHUTDOWN SAFE
========================= */

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);

  server.close((err) => {
    if (err) {
      console.error('Error closing server:', err);
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.once('SIGUSR2', () => {
  server.close(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
});
