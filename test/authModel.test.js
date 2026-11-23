import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { createUser, fetchAllUsers, findUserByCredentials } from '../models/authModel.js';

test('login lookup only returns users assigned to the costos module', async () => {
  const originalQuery = pool.query;
  const queries = [];
  const passwordHash = await bcrypt.hash('password', 4);
  pool.query = async (query, params) => {
    queries.push({ query, params });
    return {
      rows: [{
        id: 4,
        email: 'admin@prueba.com',
        nombre: 'Admin',
        apellidos: 'Maestro',
        rol: 1,
        password: passwordHash,
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

test('a valid legacy plaintext password is migrated to bcrypt with an audit context', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const statements = [];
  pool.query = async () => ({
    rows: [{
      id: 4,
      email: 'admin@prueba.com',
      nombre: 'Admin',
      apellidos: 'Maestro',
      rol: 1,
      password: 'legacy-password',
    }],
  });
  pool.connect = async () => ({
    query: async (query, values) => {
      statements.push({ query, values });
      return { rows: [], rowCount: 1 };
    },
    release() {},
  });

  try {
    const user = await findUserByCredentials('admin@prueba.com', 'legacy-password', '127.0.0.1');
    assert.equal(user.password, undefined);
    assert.match(statements[1].query, /fn_auditoria_contexto/);
    assert.match(statements[2].query, /UPDATE public\.usuario/);
    assert.equal(await bcrypt.compare('legacy-password', statements[2].values[0]), true);
    assert.equal(statements[2].values[1], 4);
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test('user listing includes users assigned to either supported module', async () => {
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
    assert.match(queries[0].query, /m\.nombre IN \('costos', 'inventario'\)/);
    assert.match(queries[0].query, /array_agg\(m\.nombre ORDER BY m\.nombre\)/);
    assert.doesNotMatch(queries[0].query, /contraseña|password/i);
  } finally {
    pool.query = originalQuery;
  }
});

test('createUser persists the selected module memberships', async (t) => {
  const queries = [];
  t.mock.method(pool, 'query', async (query, params) => {
    queries.push({ query, params });
    if (/INSERT INTO usuario \(/.test(query)) {
      return { rows: [{ id: 8, email: 'nueva@example.com' }] };
    }
    if (/INSERT INTO usuario_modulos/.test(query)) {
      return { rows: [{ id_modulo: 1 }, { id_modulo: 2 }] };
    }
    return { rows: [] };
  });

  const user = await createUser({
    nombre: 'Nueva',
    apellidos: 'Cuenta',
    correo: 'nueva@example.com',
    contraseña: 'hashed',
    rol: 'trabajador',
    modulos: ['costos', 'inventario'],
  });

  const moduleInsert = queries.find(({ query }) => /INSERT INTO usuario_modulos/.test(query));
  assert.deepEqual(moduleInsert.params, [8, ['costos', 'inventario']]);
  assert.deepEqual(user.modulos, ['costos', 'inventario']);
});
