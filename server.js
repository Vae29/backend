
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
   MIDDLEWARES
========================= */

// CORS
app.use(
  cors({
    // Refleja el Origin que llegue desde el navegador.
    // Con credentials=true, esto evita mismatches por variantes exactas del Origin.
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Preflight explícito (por compatibilidad con proxys/routers)
const preflightCors = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed = ['https://agrogestion-modulo-costos.netlify.app'];
    if (allowed.includes(origin)) return callback(null, true);
    if (origin === 'agrogestion-modulo-costos.netlify.app') return callback(null, true);

    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return preflightCors(req, res, next);
  }
  next();
});

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