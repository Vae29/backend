BEGIN;

CREATE TABLE public.configuracion_correo (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  remitente VARCHAR(320) NOT NULL,
  host VARCHAR(253) NOT NULL DEFAULT 'smtp.gmail.com',
  puerto INTEGER NOT NULL DEFAULT 465 CHECK (puerto BETWEEN 1 AND 65535),
  secure BOOLEAN NOT NULL DEFAULT TRUE,
  usuario VARCHAR(320) NOT NULL,
  password_cifrada TEXT NOT NULL,
  password_iv VARCHAR(24) NOT NULL,
  password_auth_tag VARCHAR(32) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_error TEXT,
  ultimo_envio_ok TIMESTAMPTZ,
  actualizado_por INTEGER REFERENCES public.usuario(id_usuario) ON DELETE SET NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION public.fn_auditoria_columnas_sensibles()
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT ARRAY[
    'contraseña',
    'contrasena',
    'password',
    'refresh_token_hash',
    'code',
    'password_cifrada',
    'password_iv',
    'password_auth_tag'
  ]::text[]
$$;

COMMIT;
