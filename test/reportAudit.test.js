import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../config/db.js';
import { recordReportQuery } from '../models/reportExportModel.js';

test('report query audit stores only approved, non-sensitive filters', async (t) => {
  let captured;
  t.mock.method(pool, 'query', async (sql, values) => {
    captured = { sql, values };
    return { rows: [{ id: 21 }] };
  });

  const id = await recordReportQuery({
    reportType: 'costos',
    filters: {
      fincaId: 4,
      categoriaId: 2,
      fechaInicio: '2025-01-01',
      password: 'must-not-be-recorded',
      token: 'must-not-be-recorded',
      campoDesconocido: 'ignored',
    },
    rowCount: 6,
  });

  assert.equal(id, 21);
  assert.match(captured.sql, /'CONSULTA_REPORTE'/);
  const parameters = JSON.parse(captured.values[1]);
  assert.deepEqual(parameters.filtros, {
    fincaId: 4,
    categoriaId: 2,
    fechaInicio: '2025-01-01',
  });
  assert.equal(JSON.stringify(parameters).includes('must-not-be-recorded'), false);
});
