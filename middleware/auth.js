import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'dev-secret';

export function verificarAccessToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.accessToken || null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
}

export function verificarAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'administrador')) {
    return res.status(403).json({ success: false, message: 'No autorizado' });
  }
  return next();
}
