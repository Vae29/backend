BEGIN;

DO $$
BEGIN
    IF pg_catalog.to_regclass('public.auditoria') IS NULL THEN
        RAISE EXCEPTION 'Falta public.auditoria; aplica primero el esquema de auditoría del dump.';
    END IF;
    IF pg_catalog.to_regprocedure('public.fn_auditoria_registrar()') IS NULL THEN
        RAISE EXCEPTION 'Falta public.fn_auditoria_registrar(); aplica primero el esquema de auditoría del dump.';
    END IF;
    IF pg_catalog.to_regprocedure('public.fn_auditoria_proteger()') IS NULL
       OR NOT EXISTS (
           SELECT 1
             FROM pg_catalog.pg_trigger
            WHERE tgrelid = 'public.auditoria'::regclass
              AND tgname = 'trg_auditoria_proteger_v2'
              AND tgfoid = 'public.fn_auditoria_proteger()'::regprocedure::oid
              AND NOT tgisinternal
       )
       OR NOT EXISTS (
           SELECT 1
             FROM pg_catalog.pg_trigger
            WHERE tgrelid = 'public.auditoria'::regclass
              AND tgname = 'trg_auditoria_proteger_truncate_v2'
              AND tgfoid = 'public.fn_auditoria_proteger()'::regprocedure::oid
              AND NOT tgisinternal
       ) THEN
        RAISE EXCEPTION 'La auditoría debe estar protegida contra UPDATE, DELETE y TRUNCATE antes de aplicar esta migración.';
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_auditoria_costos_modulo_fecha
    ON public.auditoria (modulo, fecha DESC, id_auditoria DESC)
    WHERE modulo IN ('CULTIVOS', 'COSTOS', 'COSECHAS', 'COSTEO', 'USUARIOS', 'REPORTES');

CREATE INDEX IF NOT EXISTS ix_auditoria_costos_entidad_fecha
    ON public.auditoria (tabla_afectada, fecha DESC, registro_id);

DO $$
DECLARE
    v_tabla text;
    v_pk text;
    v_modulo text;
    v_relid oid;
    v_funcion oid := 'public.fn_auditoria_registrar()'::regprocedure;
    v_existente oid;
BEGIN
    FOR v_tabla, v_pk, v_modulo IN
        SELECT t.tabla, t.pk, t.modulo
        FROM (VALUES
            ('usuario', 'id_usuario', 'USUARIOS'),
            ('usuario_finca', 'idusuario_finca', 'USUARIOS'),
            ('usuario_cultivo', 'idusuariocultivo', 'USUARIOS'),
            ('usuario_modulos', 'id_usuario_modulo', 'USUARIOS'),
            ('cultivo', 'idcultivo', 'CULTIVOS'),
            ('etapa_cultivo', 'idetapacultivo', 'CULTIVOS'),
            ('etapas', 'idetapa', 'CULTIVOS'),
            ('tipos_cultivo', 'idtipocultivo', 'CULTIVOS'),
            ('estado_cultivo', 'idestadocultivo', 'CULTIVOS'),
            ('costo', 'idcosto', 'COSTOS'),
            ('categoria_costo', 'idcategoria', 'COSTOS'),
            ('subcategoria_costo', 'idsubcategoria', 'COSTOS'),
            ('estado_pago', 'idestado_pago', 'COSTOS'),
            ('cosecha', 'idcosecha', 'COSECHAS'),
            ('tipo_precio', 'idtipoprecio', 'COSECHAS'),
            ('unidades_medidas', 'idunidadmedida', 'COSECHAS'),
            ('etapas_tipo_cultivo', 'idtipocultivo', 'COSTEO'),
            ('prorrateo_costos_generales', 'idcultivo', 'COSTEO'),
            ('conversion_unidades_cultivo', 'idtipocultivo', 'COSTEO'),
            ('pago_mano_obra', 'idcosto', 'COSTOS'),
            ('costo_insumo_detalle', 'idcosto_insumo_detalle', 'COSTOS')
        ) AS t(tabla, pk, modulo)
    LOOP
        v_relid := pg_catalog.to_regclass('public.' || v_tabla);
        IF v_relid IS NULL THEN
            CONTINUE;
        END IF;

        SELECT tgfoid
          INTO v_existente
          FROM pg_catalog.pg_trigger
         WHERE tgrelid = v_relid
           AND tgname = 'trg_auditoria_v2'
           AND NOT tgisinternal;

        IF EXISTS (
            SELECT 1
              FROM pg_catalog.pg_trigger tr
              JOIN pg_catalog.pg_proc pr ON pr.oid = tr.tgfoid
             WHERE tr.tgrelid = v_relid
               AND NOT tr.tgisinternal
               AND tr.tgname <> 'trg_auditoria_v2'
               AND (
                   tr.tgname ILIKE '%auditoria%'
                   OR tr.tgname ILIKE '%audit%'
                   OR pr.proname ILIKE '%auditoria%'
                   OR pr.proname ILIKE '%audit%'
               )
        ) THEN
            RAISE EXCEPTION
                'Hay otro trigger de auditoría en public.%; verifica duplicados antes de continuar.',
                v_tabla;
        END IF;

        IF v_existente IS NOT NULL THEN
            IF v_existente <> v_funcion THEN
                RAISE EXCEPTION
                    'El trigger public.trg_auditoria_v2 de % ya existe con otra función.',
                    v_tabla;
            END IF;
        ELSE
            IF EXISTS (
                SELECT 1
                  FROM pg_catalog.pg_trigger
                 WHERE tgrelid = v_relid
                   AND tgfoid = v_funcion
                   AND NOT tgisinternal
            ) THEN
                RAISE EXCEPTION
                    'Ya existe otro trigger de auditoría en public.%; verifica duplicados antes de continuar.',
                    v_tabla;
            END IF;

            EXECUTE pg_catalog.format(
                'CREATE TRIGGER trg_auditoria_v2 AFTER INSERT OR UPDATE OR DELETE ON public.%I '
                || 'FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_registrar(%L, %L)',
                v_tabla, v_pk, v_modulo
            );
        END IF;
    END LOOP;
END
$$;

COMMIT;
