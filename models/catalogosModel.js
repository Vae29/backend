import pool from '../config/db.js';

const definitions = {
  etapas: {
    responseKey: 'etapas',
    table: 'public.etapas',
    idColumn: 'idetapa',
    nameColumn: 'nombre_etapa',
    descriptionColumn: 'descripcion',
  },
  'tipos-cultivo': {
    responseKey: 'tiposCultivo',
    table: 'public.tipos_cultivo',
    idColumn: 'idtipocultivo',
    nameColumn: 'nombre',
  },
  'categorias-costo': {
    responseKey: 'categoriasCosto',
    table: 'public.categoria_costo',
    idColumn: 'idcategoria',
    nameColumn: 'nombre',
  },
  'subcategorias-costo': {
    responseKey: 'subcategoriasCosto',
    table: 'public.subcategoria_costo',
    idColumn: 'idsubcategoria',
    nameColumn: 'nombre',
    parentColumn: 'idcategoria',
  },
  'estados-cultivo': {
    responseKey: 'estadosCultivo',
    table: 'public.estado_cultivo',
    idColumn: 'idestadocultivo',
    nameColumn: 'nombre',
  },
  'estados-pago': {
    responseKey: 'estadosPago',
    table: 'public.estado_pago',
    idColumn: 'idestado_pago',
    nameColumn: 'nombre',
  },
  'unidades-medida': {
    responseKey: 'unidadesMedida',
    table: 'public.unidades_medidas',
    idColumn: 'idunidadmedida',
    nameColumn: 'nombre',
  },
  'tipos-precio': {
    responseKey: 'tiposPrecio',
    table: 'public.tipo_precio',
    idColumn: 'idtipoprecio',
    nameColumn: 'nombre',
  },
};

function modelError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function getDefinition(key) {
  const definition = definitions[key];
  if (!definition) throw modelError('Catálogo no válido.', 404);
  return definition;
}

async function assertUnique(definition, nombre, parentId, excludeId = null) {
  const values = [nombre];
  let where = `lower(btrim(t.${definition.nameColumn})) = lower(btrim($1))`;
  if (definition.parentColumn) {
    values.push(parentId);
    where += ` AND t.${definition.parentColumn} = $${values.length}`;
  }
  if (excludeId !== null) {
    values.push(excludeId);
    where += ` AND t.${definition.idColumn} <> $${values.length}`;
  }
  const result = await pool.query(
    `SELECT 1 FROM ${definition.table} t WHERE ${where} LIMIT 1`,
    values
  );
  if (result.rowCount) throw modelError('Ya existe una opción con ese nombre.', 409);
}

async function assertParentExists(parentId) {
  const result = await pool.query(
    'SELECT 1 FROM public.categoria_costo WHERE idcategoria = $1',
    [parentId]
  );
  if (!result.rowCount) throw modelError('La categoría seleccionada no existe.', 400);
}

async function assertCultivationStatusEditable(key, id) {
  if (key !== 'estados-cultivo') return;
  const result = await pool.query(
    'SELECT idestadocultivo, nombre FROM public.estado_cultivo WHERE idestadocultivo = $1',
    [id]
  );
  const name = result.rows[0]?.nombre?.trim().toLowerCase() || '';
  if (result.rows[0] && (name === 'en proceso' || name === 'finalizado')) {
    throw modelError('Los estados En Proceso y Finalizado son necesarios para el flujo de cultivos y no se pueden renombrar ni eliminar.', 409);
  }
}

export async function getCatalogs() {
  const entries = await Promise.all(
    Object.entries(definitions)
      .filter(([, definition]) => !definition.parentColumn)
      .map(async ([, definition]) => {
        const description = definition.descriptionColumn
          ? `, t.${definition.descriptionColumn} AS descripcion`
          : '';
        const result = await pool.query(
          `SELECT t.${definition.idColumn} AS id,
                  t.${definition.nameColumn} AS nombre${description}
           FROM ${definition.table} t
           ORDER BY t.${definition.nameColumn}`
        );
        return [definition.responseKey, result.rows];
      })
  );

  const subcategories = await pool.query(
    `SELECT s.idsubcategoria AS id, s.nombre,
            s.idcategoria AS "categoriaId", c.nombre AS "categoriaNombre"
     FROM public.subcategoria_costo s
     JOIN public.categoria_costo c ON c.idcategoria = s.idcategoria
     ORDER BY c.nombre, s.nombre`
  );
  return {
    ...Object.fromEntries(entries),
    subcategoriasCosto: subcategories.rows,
  };
}

export async function createCatalogItem(key, { nombre, descripcion = '', parentId = null }) {
  const definition = getDefinition(key);
  if (definition.parentColumn) await assertParentExists(parentId);
  await assertUnique(definition, nombre, parentId);

  const columns = [definition.nameColumn];
  const values = [nombre];
  if (definition.descriptionColumn) {
    columns.push(definition.descriptionColumn);
    values.push(descripcion || null);
  }
  if (definition.parentColumn) {
    columns.push(definition.parentColumn);
    values.push(parentId);
  }

  try {
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const result = await pool.query(
      `INSERT INTO ${definition.table} (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING ${definition.idColumn} AS id, ${definition.nameColumn} AS nombre`,
      values
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') throw modelError('Ya existe una opción con ese nombre.', 409);
    throw error;
  }
}

export async function updateCatalogItem(key, id, { nombre, descripcion = '', parentId = null }) {
  const definition = getDefinition(key);
  await assertCultivationStatusEditable(key, id);
  if (definition.parentColumn) {
    await assertParentExists(parentId);
    if (key === 'subcategorias-costo') {
      const current = await pool.query(
        'SELECT idcategoria FROM public.subcategoria_costo WHERE idsubcategoria = $1',
        [id]
      );
      if (!current.rowCount) return null;
      if (current.rows[0].idcategoria !== parentId) {
        const used = await pool.query(
          'SELECT 1 FROM public.costo WHERE idsubcategoria = $1 LIMIT 1',
          [id]
        );
        if (used.rowCount) {
          throw modelError('No se puede cambiar de categoría una subcategoría que ya tiene costos asociados.', 409);
        }
      }
    }
  }
  await assertUnique(definition, nombre, parentId, id);

  const assignments = [`${definition.nameColumn} = $2`];
  const values = [id, nombre];
  if (definition.descriptionColumn) {
    assignments.push(`${definition.descriptionColumn} = $3`);
    values.push(descripcion || null);
  }
  if (definition.parentColumn) {
    assignments.push(`${definition.parentColumn} = $${values.length + 1}`);
    values.push(parentId);
  }

  try {
    const result = await pool.query(
      `UPDATE ${definition.table}
       SET ${assignments.join(', ')}
       WHERE ${definition.idColumn} = $1
       RETURNING ${definition.idColumn} AS id, ${definition.nameColumn} AS nombre`,
      values
    );
    return result.rows[0] || null;
  } catch (error) {
    if (error.code === '23505') throw modelError('Ya existe una opción con ese nombre.', 409);
    throw error;
  }
}

export async function deleteCatalogItem(key, id) {
  const definition = getDefinition(key);
  await assertCultivationStatusEditable(key, id);
  if (key === 'categorias-costo') {
    const children = await pool.query(
      'SELECT 1 FROM public.subcategoria_costo WHERE idcategoria = $1 LIMIT 1',
      [id]
    );
    if (children.rowCount) {
      throw modelError('Elimina primero las subcategorías de esta categoría.', 409);
    }
  }

  try {
    const result = await pool.query(
      `DELETE FROM ${definition.table}
       WHERE ${definition.idColumn} = $1
       RETURNING ${definition.idColumn}`,
      [id]
    );
    return result.rowCount > 0;
  } catch (error) {
    if (error.code === '23503') {
      throw modelError('No se puede eliminar esta opción porque tiene registros asociados. Puedes cambiarle el nombre.', 409);
    }
    throw error;
  }
}
