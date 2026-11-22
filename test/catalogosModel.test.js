import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../config/db.js';
import { createCatalogItem, deleteCatalogItem, updateCatalogItem } from '../models/catalogosModel.js';

test('subcategory names are unique within their cost category', async (t) => {
  const queries = [];
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query);
    return { rowCount: 1, rows: [{}] };
  });

  await assert.rejects(
    createCatalogItem('subcategorias-costo', { nombre: 'General', parentId: 2 }),
    (error) => error.statusCode === 409
  );
  assert.equal(queries.length, 2);
  assert.match(queries[1], /lower\(btrim\(t\.nombre\)\)/);
});

test('cost categories with subcategories cannot be deleted', async (t) => {
  const queries = [];
  t.mock.method(pool, 'query', async (query) => {
    queries.push(query);
    return { rowCount: 1, rows: [{}] };
  });

  await assert.rejects(
    deleteCatalogItem('categorias-costo', 1),
    (error) => error.statusCode === 409
  );
  assert.equal(queries.length, 1);
  assert.match(queries[0], /public\.subcategoria_costo/);
});

test('required cultivation statuses cannot be renamed', async (t) => {
  t.mock.method(pool, 'query', async () => ({
    rowCount: 1,
    rows: [{ idestadocultivo: 1, nombre: 'En Proceso' }],
  }));

  await assert.rejects(
    updateCatalogItem('estados-cultivo', 1, { nombre: 'En marcha' }),
    (error) => error.statusCode === 409
  );
});
