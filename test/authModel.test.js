import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../config/db.js';
import { fetchAllUsers, findUserByCredentials } from '../models/authModel.js';

test('login lookup only returns users assigned to the costos module', async () => {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (query, params) => {
    queries.push({ query, params });
    return {
      rows: [{
        id: 4,
        email: 'admin@prueba.com',
        nombre: 'Admin',
        apellidos: 'Maestro',
        rol: 1,
        password: 'password',
      }],
    };
  };

  try {
    const user = await findUserByCredentials(' ADMIN@PRUEBA.COM ', 'password');

    assert.equal(user.id, 4);
    assert.equal(user.password, undefined);
    assert.deepEqual(queries[0].params, ['admin@prueba.com']);
    assert.match(queries[0].query, /usuario_modulos um/);
    assert.match(queries[0].query, /JOIN modulos m ON m\.id_modulo = um\.id_modulo/);
    assert.match(queries[0].query, /um\.id_usuario = u\.id_usuario/);
    assert.match(queries[0].query, /m\.nombre = 'costos'/);
  } finally {
    pool.query = originalQuery;
  }
});

test('user listing only returns users assigned to the costos module', async () => {
  const originalQuery = pool.query;
  const queries = [];
  pool.query = async (query, params) => {
    queries.push({ query, params });
    return { rows: [] };
  };

  try {
    assert.deepEqual(await fetchAllUsers('ACTIVO'), []);
    assert.deepEqual(queries[0].params, [1]);
    assert.match(queries[0].query, /usuario_modulos um/);
    assert.match(queries[0].query, /JOIN modulos m ON m\.id_modulo = um\.id_modulo/);
    assert.match(queries[0].query, /um\.id_usuario = u\.id_usuario/);
    assert.match(queries[0].query, /m\.nombre = 'costos'/);
  } finally {
    pool.query = originalQuery;
  }
});
