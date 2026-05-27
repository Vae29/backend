import express from 'express';
import cors from 'cors';

import pool, { testConnection } from './config/db.js';
import authRoutes from './routes/auth.js';
import asignacionesUsuarioRoutes from './routes/asignaciones-usuario.js';
import dashboardRoutes from './routes/dashboard.js';

// Verify routes loaded
console.log('AS routes object keys:', Object.keys(asignacionesUsuarioRoutes));

const app = express();

app.use(cors());
app.use(express.json());

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log('Incoming:', req.method, req.path)
  next()
})

const PORT = process.env.PORT || 3000;

testConnection();

// Rutas
app.use('/auth', authRoutes);
app.use('/api', asignacionesUsuarioRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Debug: Log all registered routes
app.use((req, res, next) => {
  console.log(`Route not matched: ${req.method} ${req.path}`);
  next();
});

// test route under /api/dashboard
app.get('/api/dashboard/test', (req, res) => res.json({ success: true, msg: 'dashboard base OK' }))

console.log('Mounted route: /api (asignaciones-usuario)')
console.log('Mounted route: /api/dashboard (dashboard)')

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});