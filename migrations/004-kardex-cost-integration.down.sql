BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.costo_insumo_detalle)
     OR EXISTS (SELECT 1 FROM inventario.kardex_destino_cultivo) THEN
    RAISE EXCEPTION
      'No se puede revertir la integración: existen destinos o detalles de Materia Prima que deben conservarse.';
  END IF;
END
$$;

DROP TRIGGER trg_bloquear_edicion_costo_insumo_detalle
  ON public.costo_insumo_detalle;
DROP TRIGGER trg_validar_total_costo_insumo_detalle
  ON public.costo;
DROP TRIGGER trg_exigir_detalle_materia_prima
  ON public.costo;
DROP TRIGGER trg_validar_costo_insumo_detalle
  ON public.costo_insumo_detalle;
DROP TRIGGER trg_auditoria_v2
  ON public.costo_insumo_detalle;
DROP TRIGGER trg_auditoria_v2
  ON inventario.kardex_destino_cultivo;
DROP TRIGGER trg_validar_kardex_destino_cultivo
  ON inventario.kardex_destino_cultivo;
DROP TRIGGER trg_proteger_destino_cultivo_con_consumo
  ON inventario.kardex_destino_cultivo;

DROP FUNCTION public.fn_bloquear_edicion_costo_insumo_detalle();
DROP FUNCTION public.fn_validar_total_costo_insumo_detalle();
DROP FUNCTION public.fn_exigir_detalle_materia_prima();
DROP FUNCTION public.fn_validar_costo_insumo_detalle();
DROP FUNCTION public.fn_registrar_costo_materia_prima_detallado(
  INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, DATE, JSONB
);
DROP FUNCTION inventario.fn_registrar_salida_con_destinos(
  INTEGER, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, INTEGER, INTEGER[]
);
DROP FUNCTION inventario.fn_validar_kardex_destino_cultivo();
DROP FUNCTION inventario.fn_proteger_destino_cultivo_con_consumo();

DROP TABLE public.costo_insumo_detalle;
DROP TABLE inventario.kardex_destino_cultivo;

COMMIT;
