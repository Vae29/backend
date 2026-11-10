import assert from 'node:assert/strict';
import test from 'node:test';
import { toDatabaseRegistroState } from '../utils/registroEstado.js';

test('database registration states use the schema integer values', () => {
  assert.equal(toDatabaseRegistroState('ACTIVO'), 1);
  assert.equal(toDatabaseRegistroState('ARCHIVADO'), 0);
  assert.equal(toDatabaseRegistroState('ANULADO'), 0);
  assert.equal(toDatabaseRegistroState(1), 1);
  assert.equal(toDatabaseRegistroState(0), 0);
});

test('unknown registration states fail explicitly', () => {
  assert.throws(() => toDatabaseRegistroState('TODOS'), TypeError);
});
