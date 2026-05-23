import { findUserByCredentials } from '../models/authModel.js';

// Login del usuario
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos',
      });
    }

    const usuario = await findUserByCredentials(email, password);

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales no válidas',
      });
    }

    const role = Number(usuario.rol) === 1 ? 'admin' : 'worker';

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        role,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    });
  }
}
