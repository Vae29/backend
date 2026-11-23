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

test('audit detail includes the name of the affected crop', async (t) => {
  const calls = [];
  t.mock.method(pool, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) {
      return {
        rows: [{
          id: 17,
          entidad: 'cultivo',
          registroId: 7,
          valoresNuevos: { idcultivo: 7, nombre: 'Tomate' },
          valoresAnteriores: null,
        }],
      };
    }
    return { rows: [{ cultivos: { 7: 'Tomate' } }] };
  });

  const event = await getAuditEvent(17);

  assert.equal(event.cultivo, 'Tomate');
  assert.deepEqual(calls[1].values[1], [7]);
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

test('audit list shows the crop name for crop and crop-stage records', async (t) => {
  const calls = [];
  t.mock.method(pool, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (calls.length === 1) return { rows: [{ total: 2 }] };
    if (calls.length === 2) {
      return {
        rows: [
          {
            id: 1,
            entidad: 'cultivo',
            registroId: 7,
            valoresNuevos: { idcultivo: 7, nombre: 'Tomate' },
            valoresAnteriores: null,
          },
          {
            id: 2,
            entidad: 'etapa_cultivo',
            registroId: 22,
            valoresNuevos: { idetapacultivo: 22, idcultivo: 8 },
            valoresAnteriores: null,
          },
        ],
      };
    }
    if (calls.length === 3) return { rows: [] };
    return {
      rows: [{ id: 8, nombre: 'Pimentón' }],
    };
  });

  const result = await listAuditEvents({ page: 1, pageSize: 25 });

  assert.deepEqual(result.eventos.map((event) => event.cultivo), ['Tomate', 'Pimentón']);
  assert.equal(Object.hasOwn(result.eventos[0], 'valoresNuevos'), false);
  assert.deepEqual(calls[3].values, [[7, 8]]);
});
