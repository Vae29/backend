BEGIN;

CREATE OR REPLACE FUNCTION public.fn_auditoria_registrar_evento(
    p_modulo text,
    p_accion text,
    p_tabla text DEFAULT NULL,
    p_registro_id bigint DEFAULT NULL,
    p_descripcion text DEFAULT NULL,
    p_parametros jsonb DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_id bigint;
    v_usuario integer := public.fn_auditoria_usuario_actual();
BEGIN
    IF v_usuario IS NULL THEN
        RAISE EXCEPTION
            'Debe establecer public.fn_auditoria_contexto en la transacción antes de registrar eventos.'
            USING ERRCODE = '28000';
    END IF;

    IF p_accion IS NULL
       OR p_accion NOT IN (
           'CONSULTA_REPORTE',
           'EXPORTACION',
           'RESTABLECIMIENTO_SOLICITADO'
       ) THEN
        RAISE EXCEPTION 'Acción de aplicación no permitida: "%"', p_accion
            USING ERRCODE = '22023';
    END IF;
    IF p_modulo IS NULL OR btrim(p_modulo) = '' THEN
        RAISE EXCEPTION 'p_modulo es obligatorio' USING ERRCODE = '22004';
    END IF;

    INSERT INTO public.auditoria (
        usuario_id, modulo, accion, tabla_afectada,
        registro_id, valores_nuevos, descripcion, ip_usuario
    )
    VALUES (
        v_usuario, p_modulo, p_accion,
        p_tabla, p_registro_id,
        public.fn_auditoria_sanear(p_parametros), p_descripcion,
        public.fn_auditoria_ctx_ip()
    )
    RETURNING id_auditoria INTO v_id;
    RETURN v_id;
END
$$;

COMMIT;
