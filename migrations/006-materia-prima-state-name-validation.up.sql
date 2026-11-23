BEGIN;

CREATE OR REPLACE FUNCTION public.fn_registrar_costo_materia_prima_detallado(
  p_id_usuario INTEGER,
  p_idfinca INTEGER,
  p_idcultivo INTEGER,
  p_idestado_pago INTEGER,
  p_idsubcategoria INTEGER,
  p_descripcion TEXT,
  p_fecha DATE,
  p_detalles JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_idcosto INTEGER;
  v_idetapa_cultivo INTEGER;
  v_idtipocultivo INTEGER;
  v_id_kardex INTEGER;
  v_cantidad NUMERIC(18,6);
  v_cantidad_original NUMERIC(18,6);
  v_cantidad_asociada NUMERIC(18,6);
  v_costo_unitario NUMERIC(18,6);
  v_subtotal NUMERIC(14,2);
  v_total NUMERIC(20,2) := 0;
  v_unidad TEXT;
  v_tipo TEXT;
  v_finca INTEGER;
  v_cantidad_envases NUMERIC(12,2);
  v_costo_envase NUMERIC(12,2);
  v_contenido NUMERIC(12,3);
  v_item JSONB;
  v_count INTEGER;
  v_unique_count INTEGER;
  v_lock_id INTEGER;
  v_contexto TEXT := NULLIF(btrim(current_setting('app.usuario_id', true)), '');
  v_marcador_anterior TEXT := COALESCE(
    current_setting('app.materia_prima_detallada', true), '');
BEGIN
  IF p_id_usuario IS NULL OR p_idfinca IS NULL OR p_idcultivo IS NULL
     OR p_idestado_pago IS NULL OR p_idsubcategoria IS NULL
     OR p_detalles IS NULL
     OR jsonb_typeof(p_detalles) <> 'array'
     OR jsonb_array_length(p_detalles) = 0 THEN
    RAISE EXCEPTION
      'Faltan datos o detalles de Materia Prima para registrar el costo.'
      USING ERRCODE = '22023';
  END IF;
  IF v_contexto IS NOT NULL AND v_contexto <> p_id_usuario::text THEN
    RAISE EXCEPTION
      'El usuario del contexto de auditoría no coincide con p_id_usuario.'
      USING ERRCODE = '28000';
  END IF;
  PERFORM set_config('app.usuario_id', p_id_usuario::text, true);

  IF NOT EXISTS (
    SELECT 1 FROM public.usuario
     WHERE id_usuario = p_id_usuario AND estado_registro = 1
  ) THEN
    RAISE EXCEPTION 'No existe un usuario activo con ID %.', p_id_usuario
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.subcategoria_costo sc
      JOIN public.categoria_costo cc ON cc.idcategoria = sc.idcategoria
     WHERE sc.idsubcategoria = p_idsubcategoria
       AND lower(btrim(cc.nombre)) = 'materia prima'
  ) THEN
    RAISE EXCEPTION
      'La subcategoría seleccionada no pertenece a Materia Prima.'
      USING ERRCODE = '23514';
  END IF;

  SELECT ec.idetapacultivo, c.idtipocultivo
    INTO v_idetapa_cultivo, v_idtipocultivo
    FROM public.cultivo c
    JOIN public.etapa_cultivo ec ON ec.idcultivo = c.idcultivo
    JOIN public.estado_cultivo estado_cultivo
      ON estado_cultivo.idestadocultivo = c.idestadocultivo
    JOIN public.estado_cultivo estado_etapa
      ON estado_etapa.idestadocultivo = ec.idestadocultivo
   WHERE c.idcultivo = p_idcultivo
     AND c.idfinca = p_idfinca
     AND lower(btrim(estado_cultivo.nombre)) = 'en proceso'
     AND c.estado_registro = 1
     AND lower(btrim(estado_etapa.nombre)) = 'en proceso'
     AND ec.estado_registro = 1
   ORDER BY ec.fecha_inicio DESC, ec.idetapacultivo DESC
   LIMIT 1
   FOR SHARE OF c, ec;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'El cultivo no pertenece a la finca o no tiene una etapa activa En proceso.'
      USING ERRCODE = '23514';
  END IF;

  IF pg_catalog.to_regclass('public.etapas_tipo_cultivo') IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.etapas_tipo_cultivo e
        WHERE e.idtipocultivo = v_idtipocultivo
          AND e.estado_registro = 1
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.etapas_tipo_cultivo e
        WHERE e.idtipocultivo = v_idtipocultivo
          AND e.idetapa = (
            SELECT ec.idetapa
              FROM public.etapa_cultivo ec
             WHERE ec.idetapacultivo = v_idetapa_cultivo
          )
          AND e.estado_registro = 1
     ) THEN
    RAISE EXCEPTION 'La etapa activa no está permitida para el tipo de cultivo.'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*),
         count(DISTINCT (item.value ->> 'idKardex')::integer)
    INTO v_count, v_unique_count
    FROM jsonb_array_elements(p_detalles) AS item(value);
  IF v_count <> v_unique_count THEN
    RAISE EXCEPTION
      'Una salida no puede aparecer más de una vez en el mismo costo.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_lock_id IN
    SELECT DISTINCT (item.value ->> 'idKardex')::integer
      FROM jsonb_array_elements(p_detalles) AS item(value)
     ORDER BY 1
  LOOP
    PERFORM 1
      FROM inventario.kardex k
     WHERE k.id_kardex = v_lock_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe la salida de Kardex %.', v_lock_id
        USING ERRCODE = '23503';
    END IF;
  END LOOP;

  FOR v_item IN SELECT item.value FROM jsonb_array_elements(p_detalles) AS item(value)
  LOOP
    v_id_kardex := (v_item ->> 'idKardex')::integer;
    v_cantidad := (v_item ->> 'cantidad')::numeric;
    IF v_id_kardex IS NULL OR v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION
        'Cada detalle requiere idKardex y una cantidad mayor que cero.'
        USING ERRCODE = '22023';
    END IF;

    SELECT k.id_finca, k.tipo, k.cantidad, k.costo_unitario,
           pp.contenido_por_envase, pp.unidad_contenido
      INTO v_finca, v_tipo, v_cantidad_envases, v_costo_envase,
           v_contenido, v_unidad
      FROM inventario.kardex k
      JOIN inventario.presentacion_producto pp ON pp.id_producto = k.id_producto
     WHERE k.id_kardex = v_id_kardex;

    IF NOT FOUND OR v_tipo <> 'SALIDA' OR v_finca <> p_idfinca THEN
      RAISE EXCEPTION
        'La salida % no pertenece a la finca seleccionada.', v_id_kardex
        USING ERRCODE = '23514';
    END IF;
    IF v_costo_envase < 0 THEN
      RAISE EXCEPTION
        'La salida % no tiene un costo unitario válido.', v_id_kardex
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM inventario.kardex_destino_cultivo kd
       WHERE kd.id_kardex = v_id_kardex
         AND kd.idcultivo = p_idcultivo
    ) THEN
      RAISE EXCEPTION
        'La salida % no está destinada al cultivo seleccionado.', v_id_kardex
        USING ERRCODE = '23514';
    END IF;

    v_cantidad_original := v_cantidad_envases * v_contenido;
    SELECT COALESCE(sum(d.cantidad_utilizada), 0)
      INTO v_cantidad_asociada
      FROM public.costo_insumo_detalle d
     WHERE d.id_kardex = v_id_kardex;

    IF v_cantidad > v_cantidad_original - v_cantidad_asociada THEN
      RAISE EXCEPTION
        'La salida % tiene disponible % %, pero se solicitaron % %.',
        v_id_kardex,
        GREATEST(v_cantidad_original - v_cantidad_asociada, 0),
        v_unidad, v_cantidad, v_unidad
        USING ERRCODE = '23514';
    END IF;

    v_costo_unitario := v_costo_envase / v_contenido;
    v_subtotal := round(v_cantidad * v_costo_unitario, 2);
    v_total := v_total + v_subtotal;
  END LOOP;

  IF v_total > 999999999999.99 THEN
    RAISE EXCEPTION 'El valor total del costo excede el rango permitido.'
      USING ERRCODE = '22003';
  END IF;

  PERFORM set_config('app.materia_prima_detallada', '1', true);
  INSERT INTO public.costo (
    descripcion, valor, fecha, idcultivo, idetapa_cultivo, id_usuario,
    idsubcategoria, idfinca, idestado_pago
  )
  VALUES (
    NULLIF(btrim(p_descripcion), ''), 0, COALESCE(p_fecha, CURRENT_DATE),
    p_idcultivo, v_idetapa_cultivo, p_id_usuario, p_idsubcategoria,
    p_idfinca, p_idestado_pago
  )
  RETURNING idcosto INTO v_idcosto;

  FOR v_item IN SELECT item.value FROM jsonb_array_elements(p_detalles) AS item(value)
  LOOP
    INSERT INTO public.costo_insumo_detalle (
      idcosto, id_kardex, cantidad_utilizada, unidad_medida,
      costo_unitario_aplicado, subtotal
    )
    VALUES (
      v_idcosto,
      (v_item ->> 'idKardex')::integer,
      (v_item ->> 'cantidad')::numeric,
      '-',
      0,
      0
    );
  END LOOP;

  UPDATE public.costo
     SET valor = v_total
   WHERE idcosto = v_idcosto;

  PERFORM set_config('app.materia_prima_detallada', v_marcador_anterior, true);
  RETURN v_idcosto;
END
$$;

REVOKE ALL ON FUNCTION public.fn_registrar_costo_materia_prima_detallado(
  INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, DATE, JSONB
) FROM PUBLIC;

COMMIT;
