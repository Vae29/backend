BEGIN;

CREATE OR REPLACE FUNCTION public.fn_finalizar_etapas_al_finalizar_cultivo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_estado text;
    v_id_estado_en_proceso integer;
    v_cantidad_estados integer;
BEGIN
    SELECT lower(btrim(ec.nombre))
      INTO v_estado
      FROM public.estado_cultivo ec
     WHERE ec.idestadocultivo = NEW.idestadocultivo;

    IF v_estado IS DISTINCT FROM 'finalizado' THEN
        RETURN NEW;
    END IF;

    SELECT count(*)::integer, min(ec.idestadocultivo)
      INTO v_cantidad_estados, v_id_estado_en_proceso
      FROM public.estado_cultivo ec
     WHERE lower(btrim(ec.nombre)) = 'en proceso';

    IF v_cantidad_estados <> 1 THEN
        RAISE EXCEPTION
            'Se requiere exactamente un estado En Proceso para finalizar el cultivo.'
            USING ERRCODE = '23514';
    END IF;

    UPDATE public.etapa_cultivo
       SET idestadocultivo = NEW.idestadocultivo,
           fecha_final = COALESCE(fecha_final, CURRENT_DATE)
     WHERE idcultivo = NEW.idcultivo
       AND idestadocultivo = v_id_estado_en_proceso;

    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_finalizar_etapas_al_finalizar_cultivo
    ON public.cultivo;
CREATE TRIGGER trg_finalizar_etapas_al_finalizar_cultivo
    BEFORE UPDATE OF idestadocultivo ON public.cultivo
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_finalizar_etapas_al_finalizar_cultivo();

CREATE OR REPLACE FUNCTION public.fn_validar_cultivo_abierto_para_nuevos_registros()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_idcultivo integer;
    v_estado text;
    v_estado_registro smallint;
BEGIN
    IF TG_TABLE_NAME = 'etapa_cultivo' AND TG_OP = 'UPDATE' THEN
        SELECT lower(btrim(ec.nombre))
          INTO v_estado
          FROM public.estado_cultivo ec
         WHERE ec.idestadocultivo = NEW.idestadocultivo;

        IF v_estado IS DISTINCT FROM 'en proceso' THEN
            RETURN NEW;
        END IF;
    END IF;

    IF TG_TABLE_NAME IN ('costo_insumo_detalle', 'pago_mano_obra') THEN
        SELECT co.idcultivo
          INTO v_idcultivo
          FROM public.costo co
         WHERE co.idcosto = NEW.idcosto
         FOR UPDATE OF co;
    ELSE
        v_idcultivo := NEW.idcultivo;
    END IF;

    IF v_idcultivo IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT lower(btrim(ec.nombre)), c.estado_registro
      INTO v_estado, v_estado_registro
      FROM public.cultivo c
      JOIN public.estado_cultivo ec
        ON ec.idestadocultivo = c.idestadocultivo
     WHERE c.idcultivo = v_idcultivo
     FOR UPDATE OF c;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el cultivo asociado al nuevo registro.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado = 'finalizado' OR v_estado_registro <> 1 THEN
        IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'etapa_cultivo' THEN
            RAISE EXCEPTION
                'No se puede reactivar una etapa de un cultivo finalizado o inactivo.'
                USING ERRCODE = '23514';
        END IF;

        RAISE EXCEPTION
            'No se permiten nuevos registros porque el cultivo está finalizado o inactivo.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_validar_cultivo_abierto_para_nuevos_registros
    ON public.etapa_cultivo;
CREATE TRIGGER trg_validar_cultivo_abierto_para_nuevos_registros
    BEFORE INSERT OR UPDATE ON public.etapa_cultivo
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validar_cultivo_abierto_para_nuevos_registros();

DO $$
DECLARE
    v_table text;
    v_relation regclass;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'public.cosecha',
        'public.costo',
        'public.costo_insumo_detalle',
        'public.prorrateo_costos_generales',
        'public.pago_mano_obra',
        'inventario.kardex_destino_cultivo'
    ]
    LOOP
        v_relation := pg_catalog.to_regclass(v_table);
        IF v_relation IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE pg_catalog.format(
            'DROP TRIGGER IF EXISTS trg_validar_cultivo_abierto_para_nuevos_registros ON %s',
            v_relation
        );
        EXECUTE pg_catalog.format(
            'CREATE TRIGGER trg_validar_cultivo_abierto_para_nuevos_registros '
            || 'BEFORE INSERT ON %s FOR EACH ROW '
            || 'EXECUTE FUNCTION public.fn_validar_cultivo_abierto_para_nuevos_registros()',
            v_relation
        );
    END LOOP;
END
$$;

COMMIT;
