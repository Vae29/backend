BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.costo c
      JOIN public.subcategoria_costo s ON s.idsubcategoria = c.idsubcategoria
     WHERE s.nombre IN ('Prestación de servicios-jornales', 'Servicios contratados')
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: ya existen costos que usan subcategorías agregadas por ella.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.cultivo c
      JOIN public.migration_costeo_002_seed s
        ON s.tabla = 'tipo_cultivo' AND s.registro_id = c.idtipocultivo
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: ya existen cultivos asociados a tipos agregados por ella.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.cosecha WHERE idetapa_cultivo IS NOT NULL) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay cosechas asociadas a etapas.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cosecha
     WHERE cantidad_cosechada <> trunc(cantidad_cosechada)
        OR cantidad_cosechada > 2147483647
        OR cantidad_cosechada < -2147483648
        OR precio_unitario <> trunc(precio_unitario)
        OR precio_unitario > 2147483647
        OR precio_unitario < -2147483648
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay cantidades o precios de cosecha con precisión/rango no representable por el esquema anterior.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.costo
     WHERE valor > 9999999999.99 OR valor < -9999999999.99
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay valores de costo fuera del rango NUMERIC(12,2).';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.subcategoria_costo s
      JOIN public.migration_costeo_002_seed seed
        ON seed.tabla = 'subcategoria_costo' AND seed.registro_id = s.idsubcategoria
      JOIN public.costo c ON c.idsubcategoria = s.idsubcategoria
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: ya existen costos que usan subcategorías agregadas por ella.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.etapas_tipo_cultivo)
     OR EXISTS (SELECT 1 FROM public.prorrateo_costos_generales)
     OR EXISTS (SELECT 1 FROM public.conversion_unidades_cultivo)
     OR EXISTS (SELECT 1 FROM public.pago_mano_obra) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay etapas, prorrateos, conversiones o pagos que deben conservarse.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.migration_costeo_002_seed seed
      JOIN public.tipos_cultivo t ON t.idtipocultivo = seed.registro_id
     WHERE seed.tabla = 'tipo_cultivo'
       AND (t.estado_registro <> 1 OR upper(btrim(t.nombre)) NOT IN ('PLÁTANO', 'BANANO', 'CAFÉ', 'CÍTRICOS'))
  ) OR EXISTS (
    SELECT 1
      FROM public.migration_costeo_002_seed seed
      JOIN public.subcategoria_costo s ON s.idsubcategoria = seed.registro_id
     WHERE seed.tabla = 'subcategoria_costo'
       AND s.nombre NOT IN ('Prestación de servicios-jornales', 'Servicios contratados')
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: existen cambios manuales sobre los catálogos agregados.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.migration_costeo_002_renamed_subcategory renamed
      JOIN public.subcategoria_costo s ON s.idsubcategoria = renamed.idsubcategoria
     WHERE s.nombre <> renamed.nombre_migrado
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay subcategorías renombradas manualmente después de migrar.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.etapas WHERE estado_registro <> 1)
     OR EXISTS (SELECT 1 FROM public.tipos_cultivo WHERE estado_registro <> 1) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay tipos o etapas de catálogo desactivados.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subcategoria_costo
     WHERE codigo_contable IS NOT NULL
        OR incluir_costo_unitario IS DISTINCT FROM
           (lower(btrim(nombre)) <> 'impuesto de renta')
  ) OR EXISTS (
    SELECT 1
      FROM public.categoria_costo
     WHERE codigo_contable IS NOT NULL
       AND codigo_contable IS DISTINCT FROM CASE lower(btrim(nombre))
         WHEN 'materia prima' THEN '7105'
         WHEN 'mano de obra directa' THEN '7205'
         WHEN 'costos indirectos' THEN '7301'
         WHEN 'contratos de servicios' THEN '7405'
         ELSE NULL
       END
  ) THEN
    RAISE EXCEPTION
      'No se puede revertir la migración: hay configuración contable que debe conservarse.';
  END IF;
END
$$;

DROP TABLE public.pago_mano_obra;
DROP TABLE public.conversion_unidades_cultivo;
DROP TABLE public.prorrateo_costos_generales;
DROP TABLE public.etapas_tipo_cultivo;

DELETE FROM public.subcategoria_costo
 WHERE idsubcategoria IN (
   SELECT registro_id FROM public.migration_costeo_002_seed
    WHERE tabla = 'subcategoria_costo'
 );

DELETE FROM public.tipos_cultivo
 WHERE idtipocultivo IN (
   SELECT registro_id FROM public.migration_costeo_002_seed
    WHERE tabla = 'tipo_cultivo'
 );

UPDATE public.subcategoria_costo s
   SET nombre = renamed.nombre_anterior
  FROM public.migration_costeo_002_renamed_subcategory renamed
 WHERE renamed.idsubcategoria = s.idsubcategoria;

DROP TABLE public.migration_costeo_002_renamed_subcategory;
DROP TABLE public.migration_costeo_002_seed;

ALTER TABLE public.subcategoria_costo
  DROP COLUMN incluir_costo_unitario,
  DROP COLUMN codigo_contable;

ALTER TABLE public.categoria_costo
  DROP COLUMN codigo_contable;

ALTER TABLE public.costo
  ALTER COLUMN valor TYPE NUMERIC(12,2);

ALTER TABLE public.cosecha
  ALTER COLUMN cantidad_cosechada TYPE INTEGER USING cantidad_cosechada::integer,
  ALTER COLUMN precio_unitario TYPE INTEGER USING precio_unitario::integer;

ALTER TABLE public.cosecha
  DROP COLUMN idetapa_cultivo;

ALTER TABLE public.tipos_cultivo
  DROP COLUMN estado_registro;

ALTER TABLE public.etapas
  DROP COLUMN estado_registro;

COMMIT;
