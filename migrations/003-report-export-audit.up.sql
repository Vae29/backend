BEGIN;

CREATE TABLE public.auditoria_exportaciones (
  id_exportacion BIGSERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE RESTRICT,
  idfinca INTEGER NOT NULL REFERENCES public.finca(idfinca) ON DELETE RESTRICT,
  tipo_reporte VARCHAR(30) NOT NULL
    CHECK (tipo_reporte IN ('por-cultivo', 'costos', 'produccion', 'rentabilidad', 'trabajador')),
  formato VARCHAR(4) NOT NULL CHECK (formato IN ('xlsx', 'csv', 'pdf')),
  filtros JSONB NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  numero_filas INTEGER NOT NULL CHECK (numero_filas >= 0)
);

CREATE INDEX auditoria_exportaciones_finca_fecha_idx
  ON public.auditoria_exportaciones (idfinca, fecha_hora DESC);

COMMIT;
