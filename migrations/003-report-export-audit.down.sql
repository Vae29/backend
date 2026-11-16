BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.auditoria_exportaciones) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay auditorías de exportación que deben conservarse.';
  END IF;
END
$$;

DROP TABLE public.auditoria_exportaciones;

COMMIT;
