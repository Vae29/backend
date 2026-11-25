import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { createUserController, getAllUsers, updateUserController } from '../controllers/authController.js';

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

test('new user password is hashed and never returned to the admin client', async (t) => {
  let insertValues;
  let moduleValues;
  t.mock.method(pool, 'query', async (sql, values) => {
    if (/INSERT INTO usuario_modulos/.test(sql)) {
      moduleValues = values;
      return { rows: [{ id_modulo: 3 }] };
    }
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
      contraseña: 'clave-inicial-segura',
      rol: 'trabajador',
      fincas: [],
      cultivos: [],
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.match(insertValues[3], /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare('clave-inicial-segura', insertValues[3]), true);
  assert.equal(Object.hasOwn(response.body.data, 'password'), false);
  assert.equal(Object.hasOwn(response.body.data, 'contraseña'), false);
  assert.deepEqual(moduleValues[1], ['costos']);
  assert.deepEqual(response.body.data.modulos, ['costos']);
});

test('user creation returns a clear conflict when the email is already registered', async (t) => {
  t.mock.method(pool, 'query', async () => {
    const error = new Error('duplicate key');
    error.code = '23505';
    error.constraint = 'uq_usuario_correo';
    throw error;
  });
  t.mock.method(console, 'error', () => {});

  const response = createResponse();
  await createUserController({
    body: {
      nombre: 'Nueva',
      apellidos: 'Cuenta',
      correo: 'repetido@example.com',
      contraseña: 'clave-inicial-segura',
      rol: 'trabajador',
      modulos: ['costos'],
    },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /correo diferente/);
});

test('user creation rejects an empty module selection', async (t) => {
  t.mock.method(pool, 'query', async () => {
    throw new Error('No debe intentar crear el usuario');
  });

  const response = createResponse();
  await createUserController({
    body: {
      nombre: 'Nueva',
      apellidos: 'Cuenta',
      correo: 'nueva@example.com',
      contraseña: 'clave-inicial-segura',
      rol: 'trabajador',
      modulos: [],
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /Selecciona al menos un módulo/);
});

test('user creation accepts an inventory-only module assignment', async (t) => {
  let assignedModules;
  t.mock.method(pool, 'query', async (sql, values) => {
    if (/INSERT INTO usuario_modulos/.test(sql)) {
      assignedModules = values[1];
      return { rows: [{ id_modulo: 2 }] };
    }
    if (/INSERT INTO usuario \(/.test(sql)) {
      return {
        rows: [{
          id: 9,
          email: 'bodega@example.com',
          primer_nombre: 'Bodega',
          primer_apellido: 'Usuario',
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
      nombre: 'Bodega',
      apellidos: 'Usuario',
      correo: 'bodega@example.com',
      contraseña: 'clave-inicial-segura',
      rol: 'trabajador',
      modulos: ['inventario'],
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(assignedModules, ['inventario']);
  assert.deepEqual(response.body.data.modulos, ['inventario']);
});

test('user creation explains when the selected module is missing from the catalog', async (t) => {
  t.mock.method(pool, 'query', async (sql) => {
    if (/INSERT INTO usuario_modulos/.test(sql)) return { rows: [] };
    if (/INSERT INTO usuario \(/.test(sql)) {
      return {
        rows: [{
          id: 9,
          email: 'bodega@example.com',
          primer_nombre: 'Bodega',
          primer_apellido: 'Usuario',
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
      nombre: 'Bodega',
      apellidos: 'Usuario',
      correo: 'bodega@example.com',
      contraseña: 'clave-inicial-segura',
      rol: 'trabajador',
      modulos: ['inventario'],
    },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.match(response.body.message, /007-seed-user-access-modules\.up\.sql/);
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
      modulos: ['inventario'],
      estado_registro: 'ACTIVO',
    }],
  }));
  t.mock.method(console, 'error', () => {});

  const response = createResponse();
  await getAllUsers({ query: { estado: 'ACTIVO' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(Object.hasOwn(response.body.data[0], 'password'), false);
  assert.equal(Object.hasOwn(response.body.data[0], 'contraseña'), false);
  assert.deepEqual(response.body.data[0].modulos, ['inventario']);
});

test('admin can update a user module assignment', async (t) => {
  const moduleInsert = [];
  t.mock.method(pool, 'query', async (sql, values) => {
    if (/INSERT INTO usuario_modulos/.test(sql)) {
      moduleInsert.push(values);
      return { rows: [{ id_modulo: 2 }] };
    }
    if (/UPDATE usuario/.test(sql)) {
      return {
        rows: [{
          id: 8,
          email: 'usuario@example.com',
          primer_nombre: 'Usuario',
          primer_apellido: 'Editado',
          rol: 2,
          estado_registro: 'ACTIVO',
        }],
      };
    }
    if (/SELECT COALESCE\(array_agg\(m\.nombre/.test(sql)) {
      return { rows: [{ modulos: ['inventario'] }] };
    }
    return { rows: [] };
  });
  t.mock.method(console, 'error', () => {});

  const response = createResponse();
  await updateUserController({
    params: { id: '8' },
    body: {
      nombre: 'Usuario',
      apellidos: 'Editado',
      correo: 'usuario@example.com',
      rol: 'trabajador',
      modulos: ['inventario'],
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(moduleInsert[0], ['8', ['inventario']]);
  assert.deepEqual(response.body.data.modulos, ['inventario']);
});

test('user update returns a clear conflict when the email belongs to another user', async (t) => {
  t.mock.method(pool, 'query', async () => {
    const error = new Error('duplicate key');
    error.code = '23505';
    error.constraint = 'uq_usuario_correo';
    throw error;
  });
  t.mock.method(console, 'error', () => {});

  const response = createResponse();
  await updateUserController({
    params: { id: '8' },
    body: {
      nombre: 'Usuario',
      apellidos: 'Editado',
      correo: 'repetido@example.com',
      rol: 'trabajador',
      modulos: ['costos', 'inventario'],
    },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /correo ya está asignado/);
});

test('user update explains when a selected module is missing from the catalog', async (t) => {
  t.mock.method(pool, 'query', async (sql) => {
    if (/INSERT INTO usuario_modulos/.test(sql)) return { rows: [] };
    if (/UPDATE usuario/.test(sql)) {
      return {
        rows: [{
          id: 8,
          email: 'usuario@example.com',
          primer_nombre: 'Usuario',
          primer_apellido: 'Editado',
          rol: 2,
          estado_registro: 'ACTIVO',
        }],
      };
    }
    return { rows: [] };
  });
  t.mock.method(console, 'error', () => {});

  const response = createResponse();
  await updateUserController({
    params: { id: '8' },
    body: {
      nombre: 'Usuario',
      apellidos: 'Editado',
      correo: 'usuario@example.com',
      rol: 'trabajador',
      modulos: ['inventario'],
    },
  }, response);

  assert.equal(response.statusCode, 503);
  assert.match(response.body.message, /007-seed-user-access-modules\.up\.sql/);
});
