-- Idempotent compatibility migration for the unified PostgreSQL schema.
-- estado_registro is SMALLINT (1 = active, 0 = inactive); change reasons are
-- recorded in auditoria, not in business-table columns.

BEGIN;

ALTER TABLE public.finca
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.cultivo
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.etapa_cultivo
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.cosecha
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.costo
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1;

DO $$
DECLARE
  invalid_table text;
BEGIN
  SELECT table_name
    INTO invalid_table
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND column_name = 'estado_registro'
     AND table_name IN ('finca', 'usuario', 'cultivo', 'etapa_cultivo', 'cosecha', 'costo')
     AND data_type <> 'smallint'
   LIMIT 1;

  IF invalid_table IS NOT NULL THEN
    RAISE EXCEPTION
      'public.%.estado_registro debe ser SMALLINT para el esquema unificado.',
      invalid_table;
  END IF;
END
$$;

COMMIT;
