import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../config/db.js';
import {
  getAvailableKardexOutputs,
  postInventoryConsumption,
} from '../controllers/costeoController.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('worker cannot read Kardex outputs for an unassigned crop', async (t) => {
  const queries = [];
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query);
    return { rows: [{ allowed: false }] };
  });
  const response = createResponse();

  await getAvailableKardexOutputs(
    { params: { fincaId: '2', cultivoId: '8' }, user: { id: 5, role: 'worker' } },
    response
  );

  assert.equal(response.statusCode, 403);
  assert.equal(queries.length, 1);
  assert.match(response.body.message, /permiso/);
});

test('admin can read Kardex outputs without a worker assignment', async (t) => {
  const queries = [];
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query);
    return { rows: [{ idKardex: 12, cantidadDisponible: '4.000000' }] };
  });
  const response = createResponse();

  await getAvailableKardexOutputs(
    { params: { fincaId: '2', cultivoId: '8' }, user: { id: 1, role: 'admin' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(queries.length, 1);
  assert.equal(response.body.data[0].idKardex, 12);
});

test('assigned worker can register inventory consumption for the crop', async (t) => {
  const queries = [];
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query);
    if (query.includes('usuario_cultivo')) return { rows: [{ allowed: true }] };
    return { rows: [{ costoId: 31 }] };
  });
  const response = createResponse();

  await postInventoryConsumption(
    {
      user: { id: 5, role: 'worker' },
      body: {
        fincaId: 2,
        cultivoId: 8,
        estadoPagoId: 1,
        subcategoriaId: 4,
        detalles: [{ idKardex: 12, cantidad: 2.5 }],
      },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.data, { costoId: 31 });
  assert.equal(queries.length, 2);
  assert.match(queries[1], /fn_registrar_costo_materia_prima_detallado/);
});

test('worker cannot register inventory consumption for an unassigned crop', async (t) => {
  const queries = [];
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query);
    return { rows: [{ allowed: false }] };
  });
  const response = createResponse();

  await postInventoryConsumption(
    {
      user: { id: 5, role: 'worker' },
      body: {
        fincaId: 2,
        cultivoId: 8,
        estadoPagoId: 1,
        subcategoriaId: 4,
        detalles: [{ idKardex: 12, cantidad: 2.5 }],
      },
    },
    response
  );

  assert.equal(response.statusCode, 403);
  assert.equal(queries.length, 1);
  assert.match(response.body.message, /permiso/);
});
