import assert from 'node:assert/strict'
import test from 'node:test'
import pool from '../config/db.js'
import {
  createCultivo,
  createEtapaParaCultivo,
  createCosecha,
  fetchCosechasPorCultivo,
  fetchCultivosEnProceso,
  fetchAllEtapasCatalog,
  FINCAS_POR_USUARIO_QUERY,
  validateActiveEtapaForCultivo,
  validateEtapaAllowedForCultivo,
} from '../models/asinaciones-usuarioModel.js'

test('active crop query returns the status name used by the farms count', async () => {
  const originalQuery = pool.query
  let capturedQuery = ''
  pool.query = async (query) => {
    capturedQuery = query
    return { rows: [{ id: 8, idfinca: 2, estado: 'En Proceso' }] }
  }

  try {
    const cultivos = await fetchCultivosEnProceso()
    assert.equal(cultivos[0].estado, 'En Proceso')
    assert.match(capturedQuery, /estado\.nombre AS estado/)
    assert.match(capturedQuery, /lower\(btrim\(estado\.nombre\)\) = 'en proceso'/)
  } finally {
    pool.query = originalQuery
  }
})

test('new crops use the database ID for the En Proceso status', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query, params) => {
    queries.push({ query, params })
    if (query.includes('FROM estado_cultivo')) {
      return { rows: [{ idestadocultivo: 23 }] }
    }
    return {
      rows: [{ id: 8, nombre: 'Nuevo cultivo', idfinca: 2, idtipocultivo: 4, idestado: 23 }],
    }
  }

  try {
    const cultivo = await createCultivo({
      nombre: 'Nuevo cultivo',
      idtipocultivo: 4,
      idfinca: 2,
    })

    assert.equal(cultivo.idestado, 23)
    assert.match(queries[0].query, /lower\(btrim\(nombre\)\) = lower\(btrim\(\$1\)\)/)
    assert.deepEqual(queries[1].params, ['Nuevo cultivo', 4, 2, 23])
  } finally {
    pool.query = originalQuery
  }
})

test('new crop stages use the database ID for the En Proceso status', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query, params) => {
    queries.push({ query, params })
    if (query.includes('FROM estado_cultivo')) {
      return { rows: [{ idestadocultivo: 23 }] }
    }
    return {
      rows: [{ id: 9, idetapa: 4, descripcion: null, idestado: 23 }],
    }
  }

  try {
    const etapa = await createEtapaParaCultivo({
      idcultivo: 8,
      idetapa: 4,
      descripcion: '',
    })

    assert.equal(etapa.idestado, 23)
    assert.match(queries[0].query, /lower\(btrim\(nombre\)\) = lower\(btrim\(\$1\)\)/)
    assert.deepEqual(queries[1].params, [4, 8, null, 23])
  } finally {
    pool.query = originalQuery
  }
})

test('worker farm query includes directly assigned farms', () => {
  assert.match(FINCAS_POR_USUARIO_QUERY, /FROM usuario_finca uf[\s\S]*uf\.idfinca = f\.idfinca[\s\S]*uf\.id_usuario = \$1/)
})

test('worker farm query includes the farm of an actively assigned crop', () => {
  assert.match(FINCAS_POR_USUARIO_QUERY, /FROM cultivo c[\s\S]*INNER JOIN usuario_cultivo uc ON uc\.idcultivo = c\.idcultivo[\s\S]*c\.idfinca = f\.idfinca[\s\S]*uc\.id_usuario = \$1[\s\S]*c\.estado_registro = 1/)
  assert.match(FINCAS_POR_USUARIO_QUERY, /f\.estado_registro = 1/)
})

test('active stage validation checks state on the crop stage, not the stage catalog', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query, params) => {
    queries.push({ query, params })
    if (query.includes("to_regclass('public.etapas_tipo_cultivo')")) {
      return { rows: [{ available: false }] }
    }
    return { rows: [{}] }
  }

  try {
    assert.equal(await validateActiveEtapaForCultivo(7, 3), true)
    assert.equal(queries.length, 2)
    assert.match(queries[1].query, /JOIN etapas et ON et\.idetapa = ec\.idetapa/)
    assert.match(queries[1].query, /ec\.estado_registro = 1/)
    assert.doesNotMatch(queries[1].query, /et\.estado_registro|etapas_tipo_cultivo/)
    assert.deepEqual(queries[1].params, [7, 3])
  } finally {
    pool.query = originalQuery
  }
})

test('active stage validation enforces configured stages when the mapping table exists', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query, params) => {
    queries.push({ query, params })
    if (query.includes("to_regclass('public.etapas_tipo_cultivo')")) {
      return { rows: [{ available: true }] }
    }
    return { rows: [{}] }
  }

  try {
    assert.equal(await validateActiveEtapaForCultivo(7, 3), true)
    assert.equal(queries.length, 2)
    assert.match(queries[1].query, /FROM etapas_tipo_cultivo configured/)
    assert.match(queries[1].query, /configured\.idetapa = ec\.idetapa/)
    assert.deepEqual(queries[1].params, [7, 3])
  } finally {
    pool.query = originalQuery
  }
})

test('stage catalog uses existing stages when type-stage mappings are unavailable', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query) => {
    queries.push(query)
    if (query.includes("to_regclass('public.etapas_tipo_cultivo')")) {
      return { rows: [{ available: false }] }
    }
    return { rows: [{ id: 1, nombre: 'Germinación' }] }
  }

  try {
    const stages = await fetchAllEtapasCatalog(2)
    assert.deepEqual(stages, [{ id: 1, nombre: 'Germinación' }])
    assert.equal(queries.length, 2)
    assert.match(queries[1], /FROM public\.etapas et/)
    assert.doesNotMatch(queries[1], /etapas_tipo_cultivo/)
  } finally {
    pool.query = originalQuery
  }
})

test('stage assignment allows existing stages when type-stage mappings are unavailable', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query, params) => {
    queries.push({ query, params })
    if (query.includes("to_regclass('public.etapas_tipo_cultivo')")) {
      return { rows: [{ available: false }] }
    }
    return { rows: [{ allowed: true }] }
  }

  try {
    assert.equal(await validateEtapaAllowedForCultivo(8, 3), true)
    assert.equal(queries.length, 2)
    assert.doesNotMatch(queries[1].query, /etapas_tipo_cultivo/)
    assert.deepEqual(queries[1].params, [8, 3])
  } finally {
    pool.query = originalQuery
  }
})

test('harvest listing supports schemas without a stage association column', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query) => {
    queries.push(query)
    if (query.includes('information_schema.columns')) {
      return { rows: [{ available: false }] }
    }
    return { rows: [{ id: 4, idcultivo: 2, etapaId: null }] }
  }

  try {
    const harvests = await fetchCosechasPorCultivo(2)
    assert.deepEqual(harvests, [{ id: 4, idcultivo: 2, etapaId: null }])
    assert.equal(queries.length, 2)
    assert.doesNotMatch(queries[1], /c\.idetapa_cultivo/)
  } finally {
    pool.query = originalQuery
  }
})

test('harvest creation omits the unavailable stage association column', async () => {
  const originalQuery = pool.query
  const queries = []
  pool.query = async (query, params) => {
    queries.push({ query, params })
    if (query.includes('information_schema.columns')) {
      return { rows: [{ available: false }] }
    }
    return { rows: [{ id: 5, idcultivo: 2, etapaId: null }] }
  }

  try {
    const harvest = await createCosecha({
      idcultivo: 2,
      idetapa_cultivo: 7,
      cantidad_cosechada: 14,
      idunidadmedida: 3,
      precio_unitario: 1200,
      idtipo_precio: 1,
    })
    assert.deepEqual(harvest, { id: 5, idcultivo: 2, etapaId: null })
    assert.equal(queries.length, 2)
    assert.doesNotMatch(queries[1].query, /idetapa_cultivo/)
    assert.deepEqual(queries[1].params, [2, 14, 3, 1200, 1])
  } finally {
    pool.query = originalQuery
  }
})
