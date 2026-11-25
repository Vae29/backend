# Configuración de correo para recuperación de contraseña

La recuperación de contraseña envía un código de seis dígitos por Gmail SMTP. Un
administrador puede guardar el remitente y la contraseña de aplicación desde
**Panel de administración → Configuración → Configuración de correo**. La
configuración queda inactiva hasta que el correo de prueba sea exitoso.

## Preparar Gmail

1. Activa la verificación en dos pasos en la cuenta Gmail que enviará los
   códigos.
2. Genera una contraseña de aplicación de 16 caracteres desde
   <https://myaccount.google.com/apppasswords>.
3. En el panel, usa esa contraseña de aplicación; no uses la contraseña normal
   de Gmail. El usuario SMTP se establece igual al correo remitente.
4. Guarda la configuración y envía el correo de prueba. La prueba se envía al
   correo de la cuenta administradora que inició sesión.

El host y puerto predeterminados son `smtp.gmail.com` y `465`; se pueden cambiar
en **Configuración avanzada**.

## Migración requerida

El flujo de recuperación requiere `migrations/001-password-reset-token-security.sql` para limitar intentos y guardar los códigos de forma segura. Para auditar las solicitudes de restablecimiento hechas por un administrador, aplica también `migrations/006-auditoria-restablecimiento-password.up.sql` después del esquema base de auditoría.

La pantalla necesita la tabla `public.configuracion_correo`. La migración
propuesta es `migrations/004-configuracion-correo.up.sql`; su archivo de reversa
es `migrations/004-configuracion-correo.down.sql`. Ninguna de las dos se ejecuta
automáticamente. Aplica la migración `up` en la base antes de guardar una
configuración. Mientras la tabla no exista, la aplicación continúa usando las
variables SMTP de respaldo.

## Respaldo por variables de entorno

Si no hay una configuración activa en la base, el backend usa estas variables:

| Variable | Valor |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Dirección Gmail completa |
| `SMTP_PASS` | Contraseña de aplicación |
| `SMTP_FROM` | Dirección remitente (si se omite, usa `SMTP_USER`) |

No uses la contraseña normal de Gmail ni compartas `SMTP_PASS`.

## Clave local de cifrado

La contraseña guardada en la base se cifra con AES-256-GCM. Si no se define
`EMAIL_ENCRYPTION_KEY`, el backend genera una clave de 32 bytes y la guarda fuera
del repositorio en `~/.agrogestion/email-encryption.key`, con permisos `0600`.
`EMAIL_ENCRYPTION_KEY_FILE` permite elegir otra ruta. En un hosting con disco
efímero, configura una ruta persistente o define `EMAIL_ENCRYPTION_KEY` con una
clave estable de 32 bytes codificada en hexadecimal (64 caracteres) o base64.
La variable de entorno tiene prioridad sobre el archivo.

Conserva una copia segura de la clave. Si se pierde o se reemplaza, la contraseña
cifrada existente no se podrá recuperar; el sistema desactivará esa configuración
y pedirá guardarla de nuevo. El archivo de clave nunca debe subirse al
repositorio.
Hay que aplicar manualmente la migración 004 antes de guardar desde el panel.
La clave se guarda por defecto en ~/.agrogestion/email-encryption.key. En Render u otro hosting con disco efímero, configura almacenamiento persistente o una EMAIL_ENCRYPTION_KEY estable; si se pierde o cambia la clave, habrá que volver a guardar la contraseña de aplicación.
La interfaz usa el correo remitente como usuario SMTP, adecuado para Gmail. Si tu servidor requiere un usuario SMTP distinto, habría que añadir ese campo.