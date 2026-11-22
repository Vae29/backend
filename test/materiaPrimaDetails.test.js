import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMateriaPrimaDetails } from '../utils/materiaPrimaDetails.js';

test('normalizes valid Kardex lines without accepting client prices', () => {
  assert.deepEqual(
    normalizeMateriaPrimaDetails([
      { idKardex: '12', cantidad: '10.25', subtotal: 999999 },
      { idKardex: 18, cantidad: 5 },
    ]),
    [
      { idKardex: 12, cantidad: 10.25 },
      { idKardex: 18, cantidad: 5 },
    ]
  );
});

test('rejects repeated outputs in the same cost request', () => {
  assert.throws(
    () => normalizeMateriaPrimaDetails([
      { idKardex: 12, cantidad: 1 },
      { idKardex: 12, cantidad: 2 },
    ]),
    { statusCode: 400, message: 'No repitas la misma salida de Kardex en un costo.' }
  );
});

test('rejects nonpositive or over-precision quantities', () => {
  for (const cantidad of [0, -1, '1.0000001', 'Infinity']) {
    assert.throws(
      () => normalizeMateriaPrimaDetails([{ idKardex: 1, cantidad }]),
      { statusCode: 400 }
    );
  }
});

test('requires a bounded nonempty set of detail lines', () => {
  assert.throws(() => normalizeMateriaPrimaDetails([]), { statusCode: 400 });
  assert.throws(
    () => normalizeMateriaPrimaDetails(Array.from({ length: 101 }, (_, index) => ({
      idKardex: index + 1,
      cantidad: 1,
    }))),
    { statusCode: 400 }
  );
});
