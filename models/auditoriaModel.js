import pool from '../config/db.js';

export const AUDIT_MODULES = [
  'CULTIVOS',
  'COSTOS',
  'COSECHAS',
  'COSTEO',
  'USUARIOS',
  'REPORTES',
];

export const AUDIT_ACTIONS = [
  'CREACION',
  'ACTUALIZACION',
  'ELIMINACION_FISICA',
  'DESACTIVACION',
  'REACTIVACION',
  'CAMBIO_ESTADO_REGISTRO',
  'CAMBIO_CREDENCIAL',
  'RESTABLECIMIENTO_SOLICITADO',
  'CONSULTA_REPORTE',
  'EXPORTACION',
];

export const AUDIT_ENTITIES = [
  'usuario',
  'usuario_cultivo',
  'usuario_finca',
  'usuario_modulos',
  'cultivo',
  'etapa_cultivo',
  'etapas',
  'tipos_cultivo',
  'estado_cultivo',
  'costo',
  'categoria_costo',
  'subcategoria_costo',
  'estado_pago',
  'cosecha',
  'tipo_precio',
  'unidades_medidas',
  'etapas_tipo_cultivo',
  'prorrateo_costos_generales',
  'conversion_unidades_cultivo',
  'pago_mano_obra',
  'costo_insumo_detalle',
  'reportes',
];

const COST_MODULES = AUDIT_MODULES.filter((module) => module !== 'REPORTES');
const COST_ENTITIES = AUDIT_ENTITIES.filter((entity) => entity !== 'reportes');
const AUDIT_SCOPE = `(
  (a.modulo = ANY($1::text[]) AND a.tabla_afectada = ANY($2::text[]))
  OR (a.modulo = 'REPORTES' AND a.tabla_afectada = 'reportes')
)`;

function buildWhere(filters) {
  const values = [COST_MODULES, COST_ENTITIES];
  const clauses = [AUDIT_SCOPE];
  const add = (sql, value) => {
    values.push(value);
    clauses.push(sql.replace('?', `$${values.length}`));
  };

  if (filters.fechaDesde) add('a.fecha >= ?::date', filters.fechaDesde);
  if (filters.fechaHasta) add('a.fecha < (?::date + INTERVAL \'1 day\')', filters.fechaHasta);
  if (filters.usuarioId) add('a.usuario_id = ?', filters.usuarioId);
  if (filters.modulo) add('a.modulo = ?', filters.modulo);
  if (filters.accion) add('a.accion = ?', filters.accion);
  if (filters.entidad) add('a.tabla_afectada = ?', filters.entidad);
  if (filters.registroId) add('a.registro_id = ?', filters.registroId);
  if (filters.busqueda) {
    values.push(`%${filters.busqueda}%`);
    const parameter = `$${values.length}`;
    clauses.push(`(
      a.descripcion ILIKE ${parameter}
      OR a.modulo ILIKE ${parameter}
      OR a.accion ILIKE ${parameter}
      OR a.tabla_afectada ILIKE ${parameter}
      OR a.registro_id::text ILIKE ${parameter}
      OR concat_ws(' ', u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido, u.nombre) ILIKE ${parameter}
      OR a.valores_anteriores::text ILIKE ${parameter}
      OR a.valores_nuevos::text ILIKE ${parameter}
      OR a.columnas_modificadas::text ILIKE ${parameter}
    )`);
  }

  return { values, where: clauses.join(' AND ') };
}

export async function listAuditEvents(filters) {
  const { values, where } = buildWhere(filters);
  const offset = (filters.page - 1) * filters.pageSize;
  const pageValues = [...values, filters.pageSize, offset];

  const [countResult, eventsResult, usersResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::integer AS total
       FROM public.auditoria a
       LEFT JOIN public.usuario u ON u.id_usuario = a.usuario_id
       WHERE ${where}`,
      values
    ),
    pool.query(
      `SELECT a.id_auditoria AS id,
              to_char(a.fecha, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS fecha,
              a.usuario_id AS "usuarioId",
              COALESCE(
                NULLIF(btrim(concat_ws(' ', u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido)), ''),
                NULLIF(btrim(u.nombre), ''),
                CASE WHEN a.usuario_id IS NULL THEN 'Usuario no disponible'
                     ELSE 'Usuario #' || a.usuario_id::text END
              ) AS usuario,
              a.modulo, a.accion, a.tabla_afectada AS entidad,
              a.registro_id AS "registroId", a.descripcion
       FROM public.auditoria a
       LEFT JOIN public.usuario u ON u.id_usuario = a.usuario_id
       WHERE ${where}
       ORDER BY a.fecha DESC, a.id_auditoria DESC
       LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues
    ),
    pool.query(
      `SELECT a.usuario_id AS id,
              COALESCE(
                NULLIF(btrim(concat_ws(' ', u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido)), ''),
                NULLIF(btrim(u.nombre), ''),
                'Usuario #' || a.usuario_id::text
              ) AS nombre
       FROM public.auditoria a
       LEFT JOIN public.usuario u ON u.id_usuario = a.usuario_id
       WHERE ${AUDIT_SCOPE} AND a.usuario_id IS NOT NULL
       GROUP BY a.usuario_id, u.primer_nombre, u.segundo_nombre,
                u.primer_apellido, u.segundo_apellido, u.nombre
       ORDER BY nombre`,
      [COST_MODULES, COST_ENTITIES]
    ),
  ]);

  const total = countResult.rows[0]?.total || 0;
  return {
    eventos: eventsResult.rows,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.ceil(total / filters.pageSize),
    filtros: {
      usuarios: usersResult.rows,
      modulos: AUDIT_MODULES,
      acciones: AUDIT_ACTIONS,
      entidades: AUDIT_ENTITIES,
    },
  };
}

function collectIds(snapshots, keys) {
  const ids = new Set();
  for (const snapshot of snapshots) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue;
    for (const source of [snapshot, snapshot.filtros]) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
      for (const key of keys) {
        const value = Number(source[key]);
        if (Number.isInteger(value) && value > 0) ids.add(value);
      }
    }
  }
  return [...ids];
}

async function getRelatedLabels(snapshots) {
  const ids = {
    usuarios: collectIds(snapshots, ['id_usuario', 'usuario_id', 'idusuario', 'id_trabajador', 'usuarioId']),
    cultivos: collectIds(snapshots, ['idcultivo', 'cultivoId']),
    fincas: collectIds(snapshots, ['idfinca', 'fincaId']),
    tiposCultivo: collectIds(snapshots, ['idtipocultivo', 'tipoCultivoId']),
    etapas: collectIds(snapshots, ['idetapa', 'etapaId']),
    etapasCultivo: collectIds(snapshots, ['idetapacultivo', 'idetapa_cultivo']),
    categorias: collectIds(snapshots, ['idcategoria', 'categoriaId']),
    subcategorias: collectIds(snapshots, ['idsubcategoria', 'subcategoriaId']),
    estadosCultivo: collectIds(snapshots, ['idestadocultivo']),
    estadosPago: collectIds(snapshots, ['idestado_pago']),
    unidades: collectIds(snapshots, ['idunidadmedida']),
    tiposPrecio: collectIds(snapshots, ['idtipoprecio']),
    roles: collectIds(snapshots, ['id_roles']),
    modulos: collectIds(snapshots, ['id_modulo']),
  };

  const result = await pool.query(
    `SELECT
       COALESCE((SELECT jsonb_object_agg(id_usuario::text, COALESCE(
         NULLIF(btrim(concat_ws(' ', primer_nombre, segundo_nombre, primer_apellido, segundo_apellido)), ''),
         NULLIF(btrim(nombre), ''), 'Usuario'
       )) FROM public.usuario WHERE id_usuario = ANY($1::integer[])), '{}'::jsonb) AS usuarios,
       COALESCE((SELECT jsonb_object_agg(idcultivo::text, nombre)
         FROM public.cultivo WHERE idcultivo = ANY($2::integer[])), '{}'::jsonb) AS cultivos,
       COALESCE((SELECT jsonb_object_agg(idfinca::text, nombre)
         FROM public.finca WHERE idfinca = ANY($3::integer[])), '{}'::jsonb) AS fincas,
       COALESCE((SELECT jsonb_object_agg(idtipocultivo::text, nombre)
         FROM public.tipos_cultivo WHERE idtipocultivo = ANY($4::integer[])), '{}'::jsonb) AS "tiposCultivo",
       COALESCE((SELECT jsonb_object_agg(idetapa::text, nombre_etapa)
         FROM public.etapas WHERE idetapa = ANY($5::integer[])), '{}'::jsonb) AS etapas,
       COALESCE((SELECT jsonb_object_agg(ec.idetapacultivo::text,
         concat_ws(' / ', c.nombre, e.nombre_etapa))
         FROM public.etapa_cultivo ec
         LEFT JOIN public.cultivo c ON c.idcultivo = ec.idcultivo
         LEFT JOIN public.etapas e ON e.idetapa = ec.idetapa
         WHERE ec.idetapacultivo = ANY($6::integer[])), '{}'::jsonb) AS "etapasCultivo",
       COALESCE((SELECT jsonb_object_agg(idcategoria::text, nombre)
         FROM public.categoria_costo WHERE idcategoria = ANY($7::integer[])), '{}'::jsonb) AS categorias,
       COALESCE((SELECT jsonb_object_agg(s.idsubcategoria::text,
         concat_ws(' / ', c.nombre, s.nombre))
         FROM public.subcategoria_costo s
         LEFT JOIN public.categoria_costo c ON c.idcategoria = s.idcategoria
         WHERE s.idsubcategoria = ANY($8::integer[])), '{}'::jsonb) AS subcategorias,
       COALESCE((SELECT jsonb_object_agg(idestadocultivo::text, nombre)
         FROM public.estado_cultivo WHERE idestadocultivo = ANY($9::integer[])), '{}'::jsonb) AS "estadosCultivo",
       COALESCE((SELECT jsonb_object_agg(idestado_pago::text, nombre)
         FROM public.estado_pago WHERE idestado_pago = ANY($10::integer[])), '{}'::jsonb) AS "estadosPago",
       COALESCE((SELECT jsonb_object_agg(idunidadmedida::text, nombre)
         FROM public.unidades_medidas WHERE idunidadmedida = ANY($11::integer[])), '{}'::jsonb) AS unidades,
       COALESCE((SELECT jsonb_object_agg(idtipoprecio::text, nombre)
         FROM public.tipo_precio WHERE idtipoprecio = ANY($12::integer[])), '{}'::jsonb) AS "tiposPrecio",
       COALESCE((SELECT jsonb_object_agg(id_roles::text, nombre)
         FROM public.roles WHERE id_roles = ANY($13::integer[])), '{}'::jsonb) AS roles,
       COALESCE((SELECT jsonb_object_agg(id_modulo::text, nombre)
         FROM public.modulos WHERE id_modulo = ANY($14::integer[])), '{}'::jsonb) AS modulos`,
    [
      ids.usuarios,
      ids.cultivos,
      ids.fincas,
      ids.tiposCultivo,
      ids.etapas,
      ids.etapasCultivo,
      ids.categorias,
      ids.subcategorias,
      ids.estadosCultivo,
      ids.estadosPago,
      ids.unidades,
      ids.tiposPrecio,
      ids.roles,
      ids.modulos,
    ]
  );
  return result.rows[0];
}

export async function getAuditEvent(id) {
  const result = await pool.query(
    `SELECT a.id_auditoria AS id,
            to_char(a.fecha, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS fecha,
            a.usuario_id AS "usuarioId",
            COALESCE(
              NULLIF(btrim(concat_ws(' ', u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido)), ''),
              NULLIF(btrim(u.nombre), ''),
              CASE WHEN a.usuario_id IS NULL THEN 'Usuario no disponible'
                   ELSE 'Usuario #' || a.usuario_id::text END
            ) AS usuario,
            a.modulo, a.accion, a.tabla_afectada AS entidad,
            a.registro_id AS "registroId", a.descripcion,
            a.valores_anteriores AS "valoresAnteriores",
            a.valores_nuevos AS "valoresNuevos",
            a.columnas_modificadas AS "columnasModificadas",
            a.ip_usuario AS "ipUsuario"
     FROM public.auditoria a
     LEFT JOIN public.usuario u ON u.id_usuario = a.usuario_id
     WHERE a.id_auditoria = $3 AND ${AUDIT_SCOPE}`,
    [COST_MODULES, COST_ENTITIES, id]
  );
  const event = result.rows[0];
  if (!event) return null;

  event.relacionados = await getRelatedLabels([
    event.valoresAnteriores,
    event.valoresNuevos,
  ]);
  return event;
}
