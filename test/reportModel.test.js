import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportQuery } from '../models/reportModel.js';

test('cost reports filter category through the cost subcategory relation', () => {
  const { query, params } = buildReportQuery('costos', { categoriaId: '4' });

  assert.deepEqual(params, [4]);
  assert.match(query, /sc\.idcategoria = \$1/);
  assert.match(query, /sc\.idsubcategoria = co\.idsubcategoria/);
  assert.doesNotMatch(query, /co\.idcategoria/);
});

test('subcategory and category filters combine with cost-only date bounds', () => {
  const { query, params } = buildReportQuery('costos', {
    categoriaId: 4,
    subcategoriaId: 12,
    fechaInicio: '2026-01-10',
    fechaFin: '2026-01-20',
  });

  assert.deepEqual(params, [4, 12, '2026-01-10', '2026-01-20']);
  assert.match(query, /sc\.idcategoria = \$1/);
  assert.match(query, /co\.idsubcategoria = \$2/);
  assert.match(query, /co\.fecha >= \$3::date/);
  assert.match(query, /co\.fecha < \(\$4::date \+ INTERVAL '1 day'\)/);
  assert.doesNotMatch(query, /fecha_cosecha/);
});

test('production applies the same range only to harvest dates', () => {
  const { query, params } = buildReportQuery('produccion', {
    fechaInicio: '2026-02-01',
    fechaFin: '2026-02-28',
  });

  assert.deepEqual(params, ['2026-02-01', '2026-02-28']);
  assert.match(query, /cc\.fecha_cosecha >= \$1::date/);
  assert.match(query, /cc\.fecha_cosecha < \(\$2::date \+ INTERVAL '1 day'\)/);
  assert.doesNotMatch(query, /co\.fecha/);
});

test('combined crop, user, status, cost, subcategory, and date filters are parameterized', () => {
  const { query, params } = buildReportQuery('rentabilidad', {
    fincaId: 2,
    cultivoId: 8,
    usuarioId: 5,
    estadoId: 3,
    categoriaId: 4,
    subcategoriaId: 12,
    fechaInicio: '2026-03-01',
    fechaFin: '2026-03-31',
  });

  assert.deepEqual(params, [
    2, 8, 5, 3, 4, 12,
    '2026-03-01', '2026-03-31',
    '2026-03-01', '2026-03-31',
  ]);
  assert.match(query, /cu\.idfinca = \$1/);
  assert.match(query, /cu\.idcultivo = \$2/);
  assert.match(query, /uc\.id_usuario = \$3/);
  assert.match(query, /cu\.idestado = \$4/);
  assert.match(query, /sc\.idcategoria = \$5/);
  assert.match(query, /co\.idsubcategoria = \$6/);
  assert.match(query, /co\.fecha >= \$7::date/);
  assert.match(query, /cc\.fecha_cosecha >= \$9::date/);
});

test('summary reports aggregate costs and harvests before joining them', () => {
  const { query } = buildReportQuery('por-cultivo');

  assert.match(query, /costs_by_crop AS \(/);
  assert.match(query, /harvests_by_crop AS \(/);
  assert.match(query, /LEFT JOIN costs_by_crop/);
  assert.match(query, /LEFT JOIN harvests_by_crop/);
  assert.doesNotMatch(query, /JOIN cosecha cc ON cc\.idcultivo = cu\.idcultivo[\s\S]*JOIN costo co/);
});