import assert from 'node:assert/strict';
import test from 'node:test';
import { postReportExport } from '../controllers/reportExportController.js';

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('export rejects unknown report types and file formats', async () => {
  const res = responseRecorder();
  await postReportExport({
    body: { tipo: 'unknown', formato: 'csv', filtros: { fincaId: 1 } },
    user: { id: 2 },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /Tipo de reporte inválido/);
});

test('export validates dates and requires an active farm selection before querying data', async () => {
  const invalidDateResponse = responseRecorder();
  await postReportExport({
    body: {
      tipo: 'costos',
      formato: 'xlsx',
      filtros: { fincaId: 1, fechaInicio: '2026-02-30' },
    },
    user: { id: 2 },
  }, invalidDateResponse);

  assert.equal(invalidDateResponse.statusCode, 400);
  assert.match(invalidDateResponse.payload.message, /fechaInicio/);

  const missingFarmResponse = responseRecorder();
  await postReportExport({
    body: { tipo: 'costos', formato: 'pdf', filtros: {} },
    user: { id: 2 },
  }, missingFarmResponse);

  assert.equal(missingFarmResponse.statusCode, 400);
  assert.match(missingFarmResponse.payload.message, /finca/);
});
