import assert from 'node:assert/strict'
import test from 'node:test'
import pool from '../config/db.js'
import {
  validateActiveEtapaForCultivo,
  validateCultivoCanAddCosecha,
  validateEtapaAllowedForCultivo,
} from '../models/asinaciones-usuarioModel.js'

test('adding an etapa checks the crop lifecycle status without relying on its ID', async (t) => {
  const queries = []
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query)
    if (query.includes("to_regclass('public.etapas_tipo_cultivo')")) {
      return { rows: [{ available: false }] }
    }
    return { rows: [{ allowed: false }] }
  })

  assert.equal(await validateEtapaAllowedForCultivo(8, 3), false)
  assert.match(queries[1], /lower\(btrim\(estadoCultivo\.nombre\)\) <> 'finalizado'/)
})

test('harvest and cost validations reject stages on finalized crops', async (t) => {
  const queries = []
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query)
    if (query.includes("to_regclass('public.etapas_tipo_cultivo')")) {
      return { rows: [{ available: false }] }
    }
    return { rows: [] }
  })

  assert.equal(await validateCultivoCanAddCosecha(8), null)
  assert.equal(await validateActiveEtapaForCultivo(12, 8), false)
  assert.match(queries[0], /lower\(btrim\(estadoCultivo\.nombre\)\) <> 'finalizado'/)
  assert.match(queries[2], /lower\(btrim\(estadoCultivo\.nombre\)\) <> 'finalizado'/)
})
