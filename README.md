# Configurar Gmail SMTP en Render

La recuperación de contraseña envía el código de seis dígitos por Gmail SMTP.

## Preparar la cuenta de Gmail

1. Inicia sesión en la cuenta Gmail que enviará los códigos.
2. Activa la verificación en dos pasos en la configuración de seguridad de la
   cuenta de Google.
3. Abre <https://myaccount.google.com/apppasswords> y crea una contraseña de
   aplicación para el backend. Google muestra una clave de 16 caracteres;
   guárdala en un lugar seguro y no la subas al repositorio.
4. Usa el correo Gmail completo como usuario SMTP y como remitente.

## Variables de entorno en Render

En el servicio del backend, abre **Environment** y añade:

| Variable | Valor |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | La dirección Gmail completa que creó la contraseña de aplicación |
| `SMTP_PASS` | La contraseña de aplicación de 16 caracteres, sin espacios |
| `SMTP_FROM` | La misma dirección Gmail de `SMTP_USER` |

Guarda los cambios y vuelve a desplegar el servicio. No uses la contraseña
normal de Gmail ni compartas `SMTP_PASS`.

Si Gmail responde con `Invalid login`, revisa la contraseña de aplicación y la
verificación en dos pasos. Si Render registra `ETIMEDOUT` al conectarse a
`smtp.gmail.com`, la conexión SMTP saliente no está llegando al servidor; las
credenciales no pueden corregir un bloqueo de red de SMTP. En ese caso será
necesario usar una API HTTPS de correo o un servicio/plan que permita SMTP
saliente.
