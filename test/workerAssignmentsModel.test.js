import assert from 'node:assert/strict'
import test from 'node:test'
import pool from '../config/db.js'
import {
  fetchAllEtapasCatalog,
  FINCAS_POR_USUARIO_QUERY,
  validateEtapaAllowedForCultivo,
} from '../models/asinaciones-usuarioModel.js'

test('worker farm query includes directly assigned farms', () => {
  assert.match(FINCAS_POR_USUARIO_QUERY, /FROM usuario_finca uf[\s\S]*uf\.idfinca = f\.idfinca[\s\S]*uf\.id_usuario = \$1/)
})

test('worker farm query includes the farm of an actively assigned crop', () => {
  assert.match(FINCAS_POR_USUARIO_QUERY, /FROM cultivo c[\s\S]*INNER JOIN usuario_cultivo uc ON uc\.idcultivo = c\.idcultivo[\s\S]*c\.idfinca = f\.idfinca[\s\S]*uc\.id_usuario = \$1[\s\S]*c\.estado_registro = 1/)
  assert.match(FINCAS_POR_USUARIO_QUERY, /f\.estado_registro = 1/)
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
