import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from './config/jwt.js';

const token = jwt.sign({ id: 1, email: 'dev@test', role: 'admin' }, JWT_CONFIG.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
console.log(token);
