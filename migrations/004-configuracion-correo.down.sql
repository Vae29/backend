BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.configuracion_correo) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: borre o migre manualmente la configuración de correo antes.';
  END IF;
END
$$;

DROP TABLE public.configuracion_correo;

CREATE OR REPLACE FUNCTION public.fn_auditoria_columnas_sensibles()
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT ARRAY[
    'contraseña',
    'contrasena',
    'password',
    'refresh_token_hash',
    'code'
  ]::text[]
$$;

COMMIT;
