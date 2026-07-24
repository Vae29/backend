import jwt from 'jsonwebtoken';

const users = [
  { id: 1, nombre: 'Admin', apellidos: 'Sistema', correo: 'admin@test.com', rol: 'administrador' },
  { id: 2, nombre: 'Trabajador', apellidos: 'Demo', correo: 'trabajador@test.com', rol: 'trabajador' },
];

function buildSuccess(data, message = 'OK') {
  return { success: true, data, message };
}

const secret = process.env.JWT_SECRET || 'dev-secret';

export async function login(req, res) {
  const { correo, contraseña } = req.body || {};
  const user = users.find((item) => item.correo === correo && (contraseña === '12345678' || contraseña === '1234'));
  if (!user) return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  const accessToken = jwt.sign({ id: user.id, role: user.rol, correo: user.correo }, secret, { expiresIn: '8h' });
  return res.json(buildSuccess({ accessToken, user: { ...user, password: undefined } }, 'Login exitoso'));
}

export async function getAllUsers(req, res) {
  return res.json(buildSuccess(users));
}

export async function createUserController(req, res) {
  const user = { id: Date.now(), ...req.body };
  users.push(user);
  return res.status(201).json(buildSuccess(user, 'Usuario creado'));
}

export async function updateUserController(req, res) {
  const index = users.findIndex((item) => Number(item.id) === Number(req.params.id));
  if (index < 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  users[index] = { ...users[index], ...req.body };
  return res.json(buildSuccess(users[index], 'Usuario actualizado'));
}

export async function deleteUserController(req, res) {
  const index = users.findIndex((item) => Number(item.id) === Number(req.params.id));
  if (index < 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  users.splice(index, 1);
  return res.json(buildSuccess({ id: req.params.id }, 'Usuario eliminado'));
}

export async function changeUserStateController(req, res) {
  return res.json(buildSuccess({ id: req.params.id }, 'Estado cambiado'));
}

export async function requestPasswordReset(req, res) {
  return res.json(buildSuccess({ sent: true }, 'Código enviado'));
}

export async function verifyResetCode(req, res) {
  return res.json(buildSuccess({ verified: true }, 'Código válido'));
}

export async function recoverPassword(req, res) {
  return res.json(buildSuccess({ recovered: true }, 'Contraseña recuperada'));
}

export async function refreshToken(req, res) {
  return res.json(buildSuccess({ accessToken: jwt.sign({ role: 'administrador' }, secret, { expiresIn: '8h' }) }, 'Token renovado'));
}

export async function logout(req, res) {
  return res.json(buildSuccess({}, 'Sesión cerrada'));
}

export async function obtenerMisSesiones(req, res) {
  return res.json(buildSuccess([], 'Sesiones obtenidas'));
}
