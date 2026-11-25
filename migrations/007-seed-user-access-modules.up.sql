BEGIN;

INSERT INTO public.modulos (nombre)
VALUES ('costos'), ('inventario')
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
