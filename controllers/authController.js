import { sendResetCodeEmail } from '../utils/emailSender.js';
import {
  findUserByCredentials,
  findUserByEmail,
  fetchAllUsers,
  createUser,
  updateUser,
  deleteUser,
  createPasswordResetToken,
  findValidPasswordResetToken,
  markPasswordResetTokenUsed,
} from '../models/authModel.js';

const generate4DigitCode = () => String(Math.floor(1000 + Math.random() * 9000));

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

export async function getAllUsers(req, res) {
  try {
    const usuarios = await fetchAllUsers();
    const usersWithRoleLabel = usuarios.map((usuario) => ({
      id: usuario.id,
      nombre: usuario.primer_nombre,
      apellidos: usuario.primer_apellido,
      email: usuario.email,
      password: usuario.password,
      rol: Number(usuario.rol) === 1 ? 'Administrador' : 'Trabajador',
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
