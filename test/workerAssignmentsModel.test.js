import assert from 'node:assert/strict'
import test from 'node:test'
import { FINCAS_POR_USUARIO_QUERY } from '../models/asinaciones-usuarioModel.js'

test('worker farm query includes directly assigned farms', () => {
  assert.match(FINCAS_POR_USUARIO_QUERY, /FROM usuario_finca uf[\s\S]*uf\.idfinca = f\.idfinca[\s\S]*uf\.id_usuario = \$1/)
})

test('worker farm query includes the farm of an actively assigned crop', () => {
  assert.match(FINCAS_POR_USUARIO_QUERY, /FROM cultivo c[\s\S]*INNER JOIN usuario_cultivo uc ON uc\.idcultivo = c\.idcultivo[\s\S]*c\.idfinca = f\.idfinca[\s\S]*uc\.id_usuario = \$1[\s\S]*UPPER\(TRIM\(c\.estado_registro\)\) = 'ACTIVO'/)
  assert.match(FINCAS_POR_USUARIO_QUERY, /UPPER\(TRIM\(f\.estado_registro\)\) = 'ACTIVO'/)
})
