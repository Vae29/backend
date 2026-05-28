import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import pool, { testConnection } from './config/db.js';
import authRoutes from './routes/auth.js';
import asignacionesUsuarioRoutes from './routes/asignaciones-usuario.js';
import dashboardRoutes from './routes/dashboard.js';
import reportesRoutes from './routes/reportes.js';
import fincasRoutes from './routes/fincas.js';

// Verify routes loaded
console.log('AS routes object keys:', Object.keys(asignacionesUsuarioRoutes));

const app = express();

// Configurar CORS para permitir cookies
app.use(
  cors({
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:3000',
      'http://127.0.0.1:5173',
    ],
    credentials: true, // Permitir cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(cookieParser());

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log('Incoming:', req.method, req.path)
  next()
})

const PORT = process.env.PORT || 3000;

testConnection();

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED PROMISE REJECTION', { reason, promise });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// Rutas
app.use('/auth', authRoutes);
app.use('/api/fincas', fincasRoutes);
app.use('/api', asignacionesUsuarioRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);

// Debug: Log all registered routes
app.use((req, res, next) => {
  console.log(`Route not matched: ${req.method} ${req.path}`);
  next();
});

console.log('Mounted route: /api/reportes (reportes)')

// test route under /api/dashboard
app.get('/api/dashboard/test', (req, res) => res.json({ success: true, msg: 'dashboard base OK' }))

console.log('Mounted route: /api (asignaciones-usuario)')
console.log('Mounted route: /api/dashboard (dashboard)')

console.log('About to call app.listen on port', PORT);
const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log('Server is now listening and active');
});

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

console.log('app.listen() completed, server object created');