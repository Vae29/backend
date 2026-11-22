import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../config/db.js';
import { getAuditEvent, listAuditEvents } from '../models/auditoriaModel.js';

test('audit detail is restricted to public Costos entities and binds its ID separately', async (t) => {
  let captured;
  t.mock.method(pool, 'query', async (sql, values) => {
    captured = { sql, values };
    return { rows: [] };
  });

  assert.equal(await getAuditEvent(17), null);
  assert.match(captured.sql, /a\.id_auditoria = \$3/);
  assert.doesNotMatch(captured.sql, /inventario\.|turismo\./);
  assert.deepEqual(captured.values[0], ['CULTIVOS', 'COSTOS', 'COSECHAS', 'COSTEO', 'USUARIOS']);
  assert.equal(captured.values[2], 17);
});

test('audit list binds combinable filters and newest-first pagination', async (t) => {
  const calls = [];
  t.mock.method(pool, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return { rows: [{ total: 1 }] };
    return { rows: [] };
  });

  const result = await listAuditEvents({
    fechaDesde: '2025-01-01',
    fechaHasta: '2025-01-31',
    usuarioId: 3,
    modulo: 'COSTOS',
    accion: 'ACTUALIZACION',
    entidad: 'costo',
    registroId: 9,
    busqueda: 'abono',
    page: 2,
    pageSize: 25,
  });

  assert.equal(result.total, 1);
  assert.equal(calls.length, 3);
  assert.match(calls[1].sql, /ORDER BY a\.fecha DESC, a\.id_auditoria DESC/);
  assert.match(calls[1].sql, /LIMIT \$11 OFFSET \$12/);
  assert.deepEqual(calls[1].values.slice(-3), ['%abono%', 25, 25]);
  assert.doesNotMatch(calls[1].sql, /inventario\.|turismo\./);
});
