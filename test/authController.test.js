import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { createUserController, getAllUsers } from '../controllers/authController.js';

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

test('new user credentials are generated securely and never exposed to the admin client', async (t) => {
  let insertValues;
  t.mock.method(pool, 'query', async (sql, values) => {
    if (/INSERT INTO usuario/.test(sql)) {
      insertValues = values;
      return {
        rows: [{
          id: 8,
          email: 'nueva@example.com',
          primer_nombre: 'Nueva',
          primer_apellido: 'Cuenta',
          rol: 2,
          estado_registro: 'ACTIVO',
        }],
      };
    }
    return { rows: [] };
  });
  t.mock.method(console, 'error', () => {});

  const response = createResponse();
  await createUserController({
    body: {
      nombre: 'Nueva',
      apellidos: 'Cuenta',
      correo: 'NUEVA@example.com',
      contraseña: 'el-admin-no-debe-elegir-esta-clave',
      rol: 'trabajador',
      fincas: [],
      cultivos: [],
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.match(insertValues[3], /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare('el-admin-no-debe-elegir-esta-clave', insertValues[3]), false);
  assert.equal(Object.hasOwn(response.body.data, 'password'), false);
  assert.equal(Object.hasOwn(response.body.data, 'contraseña'), false);
});

test('admin user listing omits password hashes even if a model row contains one', async (t) => {
  t.mock.method(pool, 'query', async () => ({
    rows: [{
      id: 8,
      email: 'nueva@example.com',
      primer_nombre: 'Nueva',
      primer_apellido: 'Cuenta',
      rol: 2,
      password: '$2b$12$hash',
      fincas: [],
      cultivos: [],
      estado_registro: 'ACTIVO',
    }],
  }));
  t.mock.method(console, 'error', () => {});

  const response = createResponse();
  await getAllUsers({ query: { estado: 'ACTIVO' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(Object.hasOwn(response.body.data[0], 'password'), false);
  assert.equal(Object.hasOwn(response.body.data[0], 'contraseña'), false);
});
