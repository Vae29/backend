import jwt from 'jsonwebtoken';
import { sendResetCodeEmail } from '../utils/emailSender.js';
import {
  findUserByCredentials,
  findUserByEmail,
  fetchAllUsers,
  createUser,
  updateUser,
  deleteUser,
  changeUserState,
  createPasswordResetToken,
  findValidPasswordResetToken,
  markPasswordResetTokenUsed,
} from '../models/authModel.js';
import { crearSesion, verificarSesion, cerrarSesion, obtenerSesionesActivas } from '../models/sesionesModel.js';
import { JWT_CONFIG } from '../config/jwt.js';
import { registrarAuditoria, contextoAuditoria } from '../models/auditoriaModel.js';

const generate4DigitCode = () => String(Math.floor(1000 + Math.random() * 9000));

// Generar Access Token (15 minutos)
function generarAccessToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      role: Number(usuario.rol) === 1 ? 'admin' : 'worker',
    },
    JWT_CONFIG.ACCESS_TOKEN_SECRET,
    { expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRES }
  );
}

// Generar Refresh Token (7 días)
function generarRefreshToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
    },
    JWT_CONFIG.REFRESH_TOKEN_SECRET,
    { expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRES }
  );
}

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
      const usuarioIdentificado = await findUserByEmail(email);
      if (usuarioIdentificado) {
        await registrarAuditoria(contextoAuditoria(req, {
          usuarioId: usuarioIdentificado.id,
          modulo: 'Autenticación',
          accion: 'INICIO_SESION_FALLIDO',
          descripcion: 'Intento de inicio de sesión con credenciales no válidas',
        }));
      }
      return res.status(401).json({
        success: false,
        message: 'Credenciales no válidas',
      });
    }

    const role = Number(usuario.rol) === 1 ? 'admin' : 'worker';

    // Generar tokens
    const accessToken = generarAccessToken(usuario);
    const refreshToken = generarRefreshToken(usuario);

    // Obtener información del dispositivo (User-Agent)
    const userAgent = req.get('user-agent') || 'Desconocido';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Desconocida';

    // Guardar sesión en la BD
    const sesion = await crearSesion(usuario.id, refreshToken, userAgent, ipAddress);

    await registrarAuditoria(contextoAuditoria(req, {
      usuarioId: usuario.id,
      modulo: 'Autenticación',
      accion: 'INICIO_SESION',
      descripcion: 'Inicio de sesión exitoso',
      tablaAfectada: 'sesiones',
      registroId: sesion?.id_sesion,
    }));

    // Enviar refresh token en HttpOnly Cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // False en desarrollo (localhost), true en producción
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      path: '/',
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos || '',
        role,
        accessToken, // Retornar access token en el body
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

export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'El correo es requerido',
      })
    }

    const usuario = await findUserByEmail(email)
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'El correo ingresado no existe. Contacta al administrador para que te agregue.',
      })
    }

    const code = generate4DigitCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await createPasswordResetToken(usuario.id, code, expiresAt)
    await sendResetCodeEmail(usuario.email, code)

    res.json({
      success: true,
      message: 'Se ha enviado un código de recuperación a tu correo electrónico. Verifica tu bandeja de entrada.',
    })
  } catch (error) {
    console.error('Error en requestPasswordReset:', error)
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al enviar el código. Revisa la configuración SMTP.',
    })
  }
}

export async function verifyResetCode(req, res) {
  try {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'El correo y el código son requeridos.',
      })
    }

    const token = await findValidPasswordResetToken(email, code)
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Código inválido o ha expirado. Solicita uno nuevo.',
      })
    }

    await markPasswordResetTokenUsed(token.id)
    const usuario = await findUserByEmail(email)

    res.json({
      success: true,
      message: 'Código válido.',
      data: {
        password: usuario.password,
      },
    })
  } catch (error) {
    console.error('Error en verifyResetCode:', error)
    res.status(500).json({
      success: false,
      message: 'Error en el servidor al verificar el código.',
    })
  }
}

export async function recoverPassword(req, res) {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'El correo es requerido',
      })
    }

    const usuario = await findUserByEmail(email)
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'El correo ingresado no existe.',
      })
    }

    res.json({
      success: true,
      message: 'Contraseña recuperada correctamente.',
      data: {
        password: usuario.password,
      },
    })
  } catch (error) {
    console.error('Error en recoverPassword:', error)
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
    })
  }
}

export async function createUserController(req, res) {
  try {
    const { nombre, apellidos, correo, contraseña, rol, fincas = [], cultivos = [] } = req.body

    if (!nombre || !apellidos || !correo || !contraseña || !rol) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos',
      })
    }

    const cleanNombre = nombre
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    const cleanApellidos = apellidos
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    const cleanCorreo = correo.trim().toLowerCase()

    const nuevoUsuario = await createUser({
      nombre: cleanNombre,
      apellidos: cleanApellidos,
      correo: cleanCorreo,
      contraseña,
      rol,
      fincas,
      cultivos,
    })

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Usuarios',
      accion: 'CREAR_USUARIO',
      descripcion: 'Usuario creado',
      tablaAfectada: 'usuario',
      registroId: nuevoUsuario.id,
      nuevo: { nombre: cleanNombre, apellidos: cleanApellidos, correo: cleanCorreo, rol, fincas, cultivos },
    }));

    const userResponse = {
      id: nuevoUsuario.id,
      nombre: nuevoUsuario.primer_nombre,
      apellidos: nuevoUsuario.primer_apellido,
      email: nuevoUsuario.email,
      password: nuevoUsuario.password,
      rol: Number(nuevoUsuario.rol) === 1 ? 'Administrador' : 'Trabajador',
      fincas,
      cultivos,
    }

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: userResponse,
    })
  } catch (error) {
    console.error('Error en createUserController:', error)
    res.status(500).json({
      success: false,
      message: 'Error al crear el usuario',
    })
  }
}

export async function updateUserController(req, res) {
  try {
    const { id } = req.params
    const { nombre, apellidos, correo, contraseña, rol, fincas = [], cultivos = [] } = req.body

    if (!nombre || !apellidos || !correo || !contraseña || !rol) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos',
      })
    }

    const cleanNombre = nombre
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    const cleanApellidos = apellidos
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')

    const cleanCorreo = correo.trim().toLowerCase()

    const updatedUser = await updateUser(id, {
      nombre: cleanNombre,
      apellidos: cleanApellidos,
      correo: cleanCorreo,
      contraseña,
      rol,
      fincas,
      cultivos,
    })

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Usuarios',
      accion: 'EDITAR_USUARIO',
      descripcion: 'Usuario actualizado',
      tablaAfectada: 'usuario',
      registroId: updatedUser.id,
      nuevo: { nombre: cleanNombre, apellidos: cleanApellidos, correo: cleanCorreo, rol, fincas, cultivos },
    }));
    if (Number(rol) === 1 || Number(rol) === 2) {
      await registrarAuditoria(contextoAuditoria(req, {
        modulo: 'Usuarios',
        accion: 'CAMBIAR_ROL',
        descripcion: 'Rol de usuario actualizado',
        tablaAfectada: 'usuario',
        registroId: updatedUser.id,
        nuevo: { rol },
      }));
    }

    const userResponse = {
      id: updatedUser.id,
      nombre: updatedUser.primer_nombre,
      apellidos: updatedUser.primer_apellido,
      email: updatedUser.email,
      password: updatedUser.password,
      rol: Number(updatedUser.rol) === 1 ? 'Administrador' : 'Trabajador',
      fincas,
      cultivos,
    }

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: userResponse,
    })
  } catch (error) {
    console.error('Error en updateUserController:', error)
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el usuario',
    })
  }
}

export async function deleteUserController(req, res) {
  try {
    const { id } = req.params
    const deletedUser = await deleteUser(id)

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      })
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Usuarios',
      accion: 'ELIMINAR_USUARIO',
      descripcion: 'Usuario eliminado',
      tablaAfectada: 'usuario',
      registroId: deletedUser.id,
    }));

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      data: { id: deletedUser.id },
    })
  } catch (error) {
    console.error('Error en deleteUserController:', error)
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el usuario',
    })
  }
}

export async function changeUserStateController(req, res) {
  try {
    const { id } = req.params;
    const { nuevoEstado, motivo } = req.body;
    const usuarioId = req.user?.id;

    if (!nuevoEstado || !['ACTIVO', 'DESACTIVADO'].includes(nuevoEstado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido',
      });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Motivo es obligatorio',
      });
    }
    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      });
    }

    const updatedUser = await changeUserState(id, nuevoEstado, motivo.trim(), usuarioId);
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    await registrarAuditoria(contextoAuditoria(req, {
      modulo: 'Usuarios',
      accion: nuevoEstado === 'ACTIVO' ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
      descripcion: motivo.trim(),
      tablaAfectada: 'usuario',
      registroId: updatedUser.id,
      nuevo: { estado: nuevoEstado },
    }));

    res.json({
      success: true,
      message: 'Estado del usuario actualizado exitosamente',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        estado_registro: updatedUser.estado_registro,
        motivo_estado: updatedUser.motivo_estado,
        fecha_cambio_estado: updatedUser.fecha_cambio_estado,
      },
    });
  } catch (error) {
    console.error('Error en changeUserStateController:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar el estado del usuario',
    });
  }
}

export async function getAllUsers(req, res) {
  try {
    const estado = req.query.estado || 'ACTIVO';
    const usuarios = await fetchAllUsers(estado);
    const usersWithRoleLabel = usuarios.map((usuario) => ({
      id: usuario.id,
      nombre: usuario.primer_nombre,
      apellidos: usuario.primer_apellido,
      email: usuario.email,
      password: usuario.password,
      rol: Number(usuario.rol) === 1 ? 'Administrador' : 'Trabajador',
      estado_registro: usuario.estado_registro,
      motivo_estado: usuario.motivo_estado,
      fecha_cambio_estado: usuario.fecha_cambio_estado,
      fincas: usuario.fincas || [],
      cultivos: usuario.cultivos || [],
    }));

    res.json({
      success: true,
      data: usersWithRoleLabel,
    });
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los usuarios',
    });
  }
}

// Refresh Token - Generar nuevo Access Token
export async function refreshToken(req, res) {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token no encontrado',
      });
    }

    // Verificar que el refresh token sea válido
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_CONFIG.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido o expirado',
      });
    }

    // Verificar que la sesión existe en la BD
    const sesion = await verificarSesion(decoded.id, token);

    if (!sesion) {
      return res.status(401).json({
        success: false,
        message: 'Sesión no válida',
      });
    }

    // Obtener datos del usuario
    const usuario = await findUserByEmail(decoded.email);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Generar nuevo Access Token
    const newAccessToken = generarAccessToken(usuario);

    res.json({
      success: true,
      message: 'Access token renovado',
      data: {
        accessToken: newAccessToken,
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos || '',
        role: Number(usuario.rol) === 1 ? 'admin' : 'worker',
      },
    });
  } catch (error) {
    console.error('[refreshToken] ❌ ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error al renovar el token',
    });
  }
}

// Logout - Cerrar sesión
export async function logout(req, res) {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_CONFIG.REFRESH_TOKEN_SECRET);
        const sesion = await verificarSesion(decoded.id, token);

        if (sesion) {
          await cerrarSesion(sesion.id_sesion);
          await registrarAuditoria(contextoAuditoria(req, {
            usuarioId: decoded.id,
            modulo: 'Autenticación',
            accion: 'CIERRE_SESION',
            descripcion: 'Cierre de sesión exitoso',
            tablaAfectada: 'sesiones',
            registroId: sesion.id_sesion,
          }));
        }
      } catch (error) {
        console.error('Error al cerrar sesión en BD:', error);
      }
    }

    // Limpiar la cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión',
    });
  }
}

// Obtener sesiones activas del usuario (para panel de dispositivos)
export async function obtenerMisSesiones(req, res) {
  try {
    const userId = req.user.id; // Del middleware de verificación

    const sesiones = await obtenerSesionesActivas(userId);

    res.json({
      success: true,
      data: sesiones,
    });
  } catch (error) {
    console.error('Error en obtenerMisSesiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones',
    });
  }
}
