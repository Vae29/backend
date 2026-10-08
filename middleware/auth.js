import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';

// Middleware para verificar Access Token
export function verificarAccessToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado',
      });
    }

    const token = authHeader.substring(7); // Quitar "Bearer "
    
    const decoded = jwt.verify(token, JWT_CONFIG.ACCESS_TOKEN_SECRET);
    
    // Guardar datos del usuario en el request para usarlos después
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
    });
  }
}

// Middleware para verificar que sea Admin
export function verificarAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'administrador' && req.user.role !== '1') {
    return res.status(403).json({
      success: false,
      message: 'No tienes permiso para acceder a este recurso',
    });
  }
  next();
}

// Middleware para verificar que sea Worker
export function verificarWorker(req, res, next) {
  if (req.user.role !== 'worker' && req.user.role !== 'trabajador' && req.user.role !== '2') {
    return res.status(403).json({
      success: false,
      message: 'No tienes permiso para acceder a este recurso',
    });
  }
  next();
}
