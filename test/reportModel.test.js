import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleCostsReportModel, buildReportQuery } from '../models/reportModel.js';

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
  assert.match(query, /cu\.idestadocultivo = \$4/);
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

test('report queries return every matching detail and summary row without an arbitrary row cap', () => {
  for (const reportType of ['por-cultivo', 'costos', 'produccion', 'rentabilidad', 'trabajador']) {
    const { query } = buildReportQuery(reportType);
    assert.doesNotMatch(query, /LIMIT\s+1000/i, `${reportType} should not truncate report rows`);
  }
});

test('type-of-crop and stage filters constrain reports without interpolating input', () => {
  const { query, params } = buildReportQuery('rentabilidad', {
    fincaId: 7,
    tipoCultivoId: 3,
    etapaId: 9,
  });

  assert.deepEqual(params, [7, 3, 9, 9]);
  assert.match(query, /cu\.idtipocultivo = \$2/);
  assert.match(query, /ec\.idetapa = \$3/);
  assert.match(query, /ec\.idetapa = \$4/);
});

test('cost reports include allocated and unallocated general costs', () => {
  const { query, params } = buildReportQuery('costos', { fincaId: 7 });

  assert.deepEqual(params, [7]);
  assert.match(query, /co\.idcosto AS id_costo/);
  assert.match(query, /fc\.idcultivo AS id_cultivo/);
  assert.match(query, /general_costs AS \(/);
  assert.match(query, /allocated_general AS \(/);
  assert.match(query, /unallocated_general AS \(/);
  assert.match(query, /round\(gc\.valor \* p\.porcentaje \/ 100, 2\)/);
  assert.match(query, /unidad_base/);
});

test('costs model can join harvest income rows by crop and stage', () => {
  const { query } = buildReportQuery('produccion');

  assert.match(query, /fc\.idcultivo AS id_cultivo/);
  assert.match(query, /cc\.cantidad_cosechada \* cc\.precio_unitario AS ingreso/);
  assert.match(query, /cc\.idetapa_cultivo AS id_etapa_cultivo/);
});

test('crop cost unit uses all crop costs and only comparable base-unit production', () => {
  const { query } = buildReportQuery('rentabilidad');

  assert.match(query, /crop_cost_totals AS \(/);
  assert.match(query, /crop_production_totals AS \(/);
  assert.match(query, /bool_and\(total_produccion IS NOT NULL\)/);
  assert.match(query, /COALESCE\(cost_totals\.costo_produccion, 0\) \/ production_totals\.total_produccion/);
  assert.match(query, /to_jsonb\(sc\) ->> 'incluir_costo_unitario'/);
  assert.match(query, /costos indirectos/);
  assert.doesNotMatch(query, /sc\.incluir_costo_unitario/);
});

test('crop report supports the legacy schema without conversion, proration, or harvest-stage columns', () => {
  const { query, params } = buildReportQuery('por-cultivo', { etapaId: 3 }, {
    hasUnitConversions: false,
    hasGeneralCostProration: false,
    hasHarvestStage: false,
  });

  assert.deepEqual(params, [3]);
  assert.doesNotMatch(query, /conversion_unidades_cultivo|prorrateo_costos_generales|cc\.idetapa_cultivo/);
  assert.match(query, /COUNT\(DISTINCT cc\.idunidadmedida\) = 1/);
  assert.match(query, /NULL::integer AS idetapa_cultivo/);
});

test('cost report supports the legacy schema without conversion or proration tables', () => {
  const { query } = buildReportQuery('costos', {}, {
    hasUnitConversions: false,
    hasGeneralCostProration: false,
    hasHarvestStage: false,
  });

  assert.doesNotMatch(query, /conversion_unidades_cultivo|prorrateo_costos_generales/);
  assert.match(query, /NULL::text AS unidad_base/);
});

test('cost report tolerates optional accounting columns missing from the database schema', () => {
  const { query } = buildReportQuery('costos');

  assert.match(query, /to_jsonb\(sc\) ->> 'codigo_contable'/);
  assert.match(query, /to_jsonb\(cat\) ->> 'codigo_contable'/);
  assert.doesNotMatch(query, /sc\.codigo_contable|cat\.codigo_contable|sc\.incluir_costo_unitario/);
});

test('costs report model totals use exact cents and keep unallocated costs separate', () => {
  const model = assembleCostsReportModel({
    filters: { fechaInicio: '2026-10-01', fechaFin: '2026-10-31' },
    context: { finca: 'Finca Norte', usuario: 'Ana' },
    generatedAt: new Date('2026-11-01T04:00:00.000Z'),
    costRows: [
      {
        id_cultivo: 7,
        id_etapa_cultivo: 3,
        cultivo: 'Café',
        etapa: 'Cosecha',
        categoria: 'Insumos',
        descripcion: 'Fertilizante',
        valor: '100.25',
        fecha: '2026-10-31',
        origen: 'CULTIVO',
      },
      {
        id_cultivo: null,
        id_etapa_cultivo: null,
        cultivo: null,
        etapa: null,
        categoria: 'Generales',
        descripcion: 'Costo no asignado',
        valor: '-5.00',
        fecha: '2026-10-31',
        origen: 'GENERAL_SIN_PRORRATEAR',
      },
    ],
    harvestRows: [{
      id_cultivo: 7,
      id_etapa_cultivo: 3,
      cultivo: 'Café',
      etapa: 'Cosecha',
      ingreso: '250.50',
      cantidad: '10',
      precio_unitario: '25.05',
      fecha: '2026-10-31',
      unidad: 'kg',
    }],
  });

  assert.equal(model.totals.ingresos, '250.50');
  assert.equal(model.totals.costos, '95.25');
  assert.equal(model.totals.ganancia, '155.25');
  assert.equal(model.groups.byCropStage[0].costos, '100.25');
  assert.equal(model.groups.byCropStage[0].ganancia, '150.25');
  assert.equal(model.groups.unallocatedCosts, '-5.00');
  assert.equal(model.rows.find((row) => row.kind === 'income').fecha, '2026-10-31');
  assert.equal(model.rows.length, 3);
});

test('empty costs report model has exact zero totals and no groups', () => {
  const model = assembleCostsReportModel({
    costRows: [],
    harvestRows: [],
    generatedAt: new Date('2026-11-01T04:00:00.000Z'),
  });

  assert.deepEqual(model.totals, {
    ingresosCentavos: '0',
    costosCentavos: '0',
    gananciaCentavos: '0',
    ingresos: '0.00',
    costos: '0.00',
    ganancia: '0.00',
    margen: 0,
    registroCount: 0,
  });
  assert.deepEqual(model.groups.byCategory, []);
  assert.deepEqual(model.groups.byCropStage, []);
});