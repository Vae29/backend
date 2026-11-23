BEGIN;

DO $$
DECLARE
  v_audit_context regprocedure :=
    pg_catalog.to_regprocedure(
      'public.fn_auditoria_contexto(integer,text,text,uuid,text,text)'
    );
  v_usuario_id integer;
BEGIN
  IF v_audit_context IS NOT NULL THEN
    SELECT id_usuario
      INTO v_usuario_id
      FROM public.usuario
     WHERE email = 'admin@prueba.com'
     ORDER BY id_usuario
     LIMIT 1;

    IF v_usuario_id IS NULL THEN
      RAISE EXCEPTION
        'La auditoría está activa, pero no se encontró el usuario administrador para registrar la migración.';
    END IF;

    EXECUTE
      'SELECT public.fn_auditoria_contexto($1, NULL, NULL, NULL, $2, $3)'
      USING v_usuario_id, 'COSTEO', 'Aplicación de la migración de modelo de costeo 002';
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_validar_total_costo_insumo_detalle ON public.costo;

ALTER TABLE public.costo
  ALTER COLUMN valor TYPE NUMERIC(14,2);

DO $$
BEGIN
  IF pg_catalog.to_regclass('public.costo_insumo_detalle') IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.fn_validar_total_costo_insumo_detalle()'
     ) IS NOT NULL THEN
    EXECUTE
      'CREATE TRIGGER trg_validar_total_costo_insumo_detalle '
      || 'BEFORE UPDATE OF valor ON public.costo '
      || 'FOR EACH ROW WHEN (OLD.valor IS DISTINCT FROM NEW.valor) '
      || 'EXECUTE FUNCTION public.fn_validar_total_costo_insumo_detalle()';
  END IF;
END
$$;

ALTER TABLE public.cosecha
  ALTER COLUMN cantidad_cosechada TYPE NUMERIC(14,3),
  ALTER COLUMN precio_unitario TYPE NUMERIC(14,2);

ALTER TABLE public.cosecha
  ADD COLUMN IF NOT EXISTS idetapa_cultivo INTEGER
    REFERENCES public.etapa_cultivo(idetapacultivo) ON DELETE RESTRICT;

ALTER TABLE public.tipos_cultivo
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1
    CHECK (estado_registro IN (0, 1));

ALTER TABLE public.etapas
  ADD COLUMN IF NOT EXISTS estado_registro SMALLINT NOT NULL DEFAULT 1
    CHECK (estado_registro IN (0, 1));

ALTER TABLE public.categoria_costo
  ADD COLUMN IF NOT EXISTS codigo_contable VARCHAR(20);

ALTER TABLE public.subcategoria_costo
  ADD COLUMN IF NOT EXISTS codigo_contable VARCHAR(20),
  ADD COLUMN IF NOT EXISTS incluir_costo_unitario BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.categoria_costo
     WHERE (lower(btrim(nombre)) = 'materia prima' AND codigo_contable IS NOT NULL AND codigo_contable <> '7105')
        OR (lower(btrim(nombre)) = 'mano de obra directa' AND codigo_contable IS NOT NULL AND codigo_contable <> '7205')
        OR (lower(btrim(nombre)) = 'costos indirectos' AND codigo_contable IS NOT NULL AND codigo_contable <> '7301')
        OR (lower(btrim(nombre)) = 'contratos de servicios' AND codigo_contable IS NOT NULL AND codigo_contable <> '7405')
  ) THEN
    RAISE EXCEPTION
      'Hay códigos contables existentes que no coinciden con la clasificación solicitada; revise antes de migrar.';
  END IF;
END
$$;

UPDATE public.categoria_costo
   SET codigo_contable = CASE lower(btrim(nombre))
     WHEN 'materia prima' THEN '7105'
     WHEN 'mano de obra directa' THEN '7205'
     WHEN 'costos indirectos' THEN '7301'
     WHEN 'contratos de servicios' THEN '7405'
     ELSE codigo_contable
   END
 WHERE lower(btrim(nombre)) IN (
   'materia prima',
   'mano de obra directa',
   'costos indirectos',
   'contratos de servicios'
 );

CREATE TABLE public.migration_costeo_002_seed (
  tabla VARCHAR(30) NOT NULL CHECK (tabla IN ('tipo_cultivo', 'subcategoria_costo')),
  registro_id INTEGER NOT NULL,
  PRIMARY KEY (tabla, registro_id)
);

CREATE TABLE public.migration_costeo_002_renamed_subcategory (
  idsubcategoria INTEGER PRIMARY KEY,
  nombre_anterior VARCHAR(100) NOT NULL,
  nombre_migrado VARCHAR(100) NOT NULL
);

WITH rename_candidates AS (
  SELECT s.idsubcategoria, s.nombre AS nombre_anterior, desired.nombre AS nombre_migrado
    FROM public.subcategoria_costo s
    JOIN public.categoria_costo c ON c.idcategoria = s.idcategoria
    JOIN (VALUES
      ('mano de obra directa', 'Jornales', 'Prestación de servicios-jornales'),
      ('mano de obra directa', 'Prestaciones Sociales', 'Prestaciones sociales'),
      ('costos indirectos', 'Energía', 'Servicio público-Energía'),
      ('costos indirectos', 'Acueducto y Alcantarrillado', 'Servicio público-Acueducto y Alcantarillado'),
      ('costos indirectos', 'Gas', 'Servicio público-Gas'),
      ('costos indirectos', 'Internet', 'Servicio de Internet'),
      ('costos indirectos', 'Impuesto Predial', 'Impuesto predial'),
      ('costos indirectos', 'Impuesto de Renta', 'Impuesto de renta'),
      ('contratos de servicios', 'General', 'Servicios contratados')
    ) AS desired(categoria, anterior, nombre)
      ON lower(btrim(c.nombre)) = desired.categoria
     AND lower(btrim(s.nombre)) = lower(btrim(desired.anterior))
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.subcategoria_costo existing
      WHERE existing.idcategoria = s.idcategoria
        AND lower(btrim(existing.nombre)) = lower(btrim(desired.nombre))
   )
)
INSERT INTO public.migration_costeo_002_renamed_subcategory
  (idsubcategoria, nombre_anterior, nombre_migrado)
SELECT idsubcategoria, nombre_anterior, nombre_migrado
  FROM rename_candidates;

UPDATE public.subcategoria_costo s
   SET nombre = renamed.nombre_migrado
  FROM public.migration_costeo_002_renamed_subcategory renamed
 WHERE renamed.idsubcategoria = s.idsubcategoria;

WITH inserted AS (
  INSERT INTO public.subcategoria_costo (nombre, idcategoria)
  SELECT seeds.nombre, c.idcategoria
    FROM (VALUES
      ('contratos de servicios', 'Servicios contratados')
    ) AS seeds(categoria, nombre)
    JOIN public.categoria_costo c
      ON lower(btrim(c.nombre)) = seeds.categoria
   WHERE NOT EXISTS (
     SELECT 1 FROM public.subcategoria_costo s
      WHERE s.idcategoria = c.idcategoria
        AND lower(btrim(s.nombre)) = lower(btrim(seeds.nombre))
   )
  RETURNING idsubcategoria
)
INSERT INTO public.migration_costeo_002_seed (tabla, registro_id)
SELECT 'subcategoria_costo', idsubcategoria FROM inserted;

UPDATE public.subcategoria_costo s
   SET incluir_costo_unitario = FALSE
  FROM public.categoria_costo c
 WHERE c.idcategoria = s.idcategoria
   AND lower(btrim(c.nombre)) = 'costos indirectos'
   AND lower(btrim(s.nombre)) = 'impuesto de renta';

CREATE TABLE public.etapas_tipo_cultivo (
  idtipocultivo INTEGER NOT NULL REFERENCES public.tipos_cultivo(idtipocultivo) ON DELETE RESTRICT,
  idetapa INTEGER NOT NULL REFERENCES public.etapas(idetapa) ON DELETE RESTRICT,
  orden INTEGER NOT NULL DEFAULT 0 CHECK (orden >= 0),
  estado_registro SMALLINT NOT NULL DEFAULT 1 CHECK (estado_registro IN (0, 1)),
  PRIMARY KEY (idtipocultivo, idetapa)
);

WITH inserted AS (
  INSERT INTO public.tipos_cultivo (nombre)
  SELECT tipo.nombre
    FROM (VALUES ('PLÁTANO'), ('BANANO'), ('CAFÉ'), ('CÍTRICOS')) AS tipo(nombre)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.tipos_cultivo existente
      WHERE lower(btrim(existente.nombre)) = lower(btrim(tipo.nombre))
   )
  RETURNING idtipocultivo
)
INSERT INTO public.migration_costeo_002_seed (tabla, registro_id)
SELECT 'tipo_cultivo', idtipocultivo FROM inserted;

CREATE TABLE public.prorrateo_costos_generales (
  idfinca INTEGER NOT NULL REFERENCES public.finca(idfinca) ON DELETE RESTRICT,
  idcultivo INTEGER NOT NULL REFERENCES public.cultivo(idcultivo) ON DELETE RESTRICT,
  porcentaje NUMERIC(7,4) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
  PRIMARY KEY (idfinca, idcultivo)
);

CREATE TABLE public.conversion_unidades_cultivo (
  idtipocultivo INTEGER NOT NULL REFERENCES public.tipos_cultivo(idtipocultivo) ON DELETE RESTRICT,
  idunidadmedida INTEGER NOT NULL REFERENCES public.unidades_medidas(idunidadmedida) ON DELETE RESTRICT,
  factor_a_unidad_base NUMERIC(18,8) NOT NULL CHECK (factor_a_unidad_base > 0),
  es_unidad_base BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (idtipocultivo, idunidadmedida)
);

CREATE UNIQUE INDEX conversion_unidades_cultivo_unidad_base_idx
  ON public.conversion_unidades_cultivo (idtipocultivo)
  WHERE es_unidad_base;

CREATE TABLE public.pago_mano_obra (
  idcosto INTEGER PRIMARY KEY REFERENCES public.costo(idcosto) ON DELETE RESTRICT,
  id_trabajador INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE RESTRICT,
  estado_registro SMALLINT NOT NULL DEFAULT 1 CHECK (estado_registro IN (0, 1))
);

CREATE INDEX prorrateo_costos_generales_cultivo_idx
  ON public.prorrateo_costos_generales (idcultivo);

CREATE INDEX pago_mano_obra_trabajador_idx
  ON public.pago_mano_obra (id_trabajador, estado_registro);

COMMIT;
