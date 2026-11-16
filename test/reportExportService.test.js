import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { assembleCostsReportModel } from '../models/reportModel.js';
import { generateReportExport } from '../services/reportExportService.js';

const context = { finca: 'Finca Norte', usuario: 'Ana Administradora' };

test('CSV export uses UTF-8 BOM, semicolon delimiter and raw values', async () => {
  const report = await generateReportExport({
    reportType: 'costos',
    format: 'csv',
    rows: [{
      codigo_contable: '7105',
      categoria: 'Materia; prima',
      subcategoria: 'Insumos',
      cultivo: 'Café',
      tipo_cultivo: 'CAFÉ',
      etapa: 'Siembra',
      fecha: '2026-03-05',
      valor: '1250000.50',
      descripcion: 'Compra "A"',
      origen: 'CULTIVO',
    }],
    filters: { fincaId: 1 },
    context,
  });

  const csv = report.buffer.toString('utf8');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Código contable;Categoría/);
  assert.match(csv, /7105;"Materia; prima"/);
  assert.match(csv, /2026-03-05;1250000\.50/);
  assert.match(csv, /"Compra ""A"""/);
  assert.equal(report.rowCount, 1);
});

test('Excel export stores numeric values, formula totals and rentability formulas', async () => {
  const report = await generateReportExport({
    reportType: 'rentabilidad',
    format: 'xlsx',
    rows: [{
      id: 8,
      cultivo: 'Café',
      tipo_cultivo: 'CAFÉ',
      etapa: 'Producción',
      fecha: '2026-03-05',
      total_costos: '300000.25',
      total_ingresos: '500000.50',
      ganancia: '200000.25',
      costo_unitario: '1500.25',
      unidad_base: 'kg',
    }],
    filters: { fincaId: 1 },
    context,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(report.buffer);
  const detail = workbook.getWorksheet('Detalle');

  assert.equal(typeof detail.getCell('H2').value, 'number');
  assert.equal(detail.getCell('H2').value, 300000.25);
  assert.ok(detail.getCell('G2').value instanceof Date);
  assert.match(detail.getCell('K2').value.formula, /^IF\(/);
  assert.match(detail.getCell('L2').value.formula, /^IF\(/);
  assert.match(detail.getCell('H3').value.formula, /^SUBTOTAL\(109,/);
  assert.match(detail.getCell('K3').value.formula, /^SUBTOTAL\(109,/);
  assert.equal(detail.autoFilter, 'A1:N2');
  assert.ok(workbook.getWorksheet('Resumen'));
});

test('PDF export is generated from report data as a selectable-text PDF', async () => {
  const report = await generateReportExport({
    reportType: 'rentabilidad',
    format: 'pdf',
    rows: [{
      cultivo: 'Café',
      tipo_cultivo: 'CAFÉ',
      etapa: 'Producción',
      total_costos: 300000,
      total_ingresos: 500000,
      ganancia: 200000,
      costo_unitario: 1500,
      unidad_base: 'kg',
    }],
    filters: { fincaId: 1 },
    context,
  });

  assert.equal(report.buffer.subarray(0, 4).toString('ascii'), '%PDF');
  assert.equal(report.rowCount, 1);
});

function costsModel(costRows, harvestRows = []) {
  return assembleCostsReportModel({
    costRows,
    harvestRows,
    filters: { fincaId: 1, fechaInicio: '2026-10-01', fechaFin: '2026-10-31' },
    context,
    generatedAt: new Date('2026-11-01T04:00:00.000Z'),
  });
}

test('costs workbook uses the shared model, formulas with cached results and separate technical detail', async () => {
  const model = costsModel(
    [{
      id_cultivo: 7,
      id_etapa_cultivo: 3,
      cultivo: 'Café',
      etapa: 'Cosecha',
      categoria: 'Insumos',
      descripcion: 'Fertilizante ñandú',
      valor: '1250000.50',
      fecha: '2026-10-31',
      codigo_contable: '7105',
      origen: 'CULTIVO',
      porcentaje_prorrateo: null,
      unidad_base: 'kg',
      subcategoria: 'Fertilizantes',
    }],
    [{
      id_cultivo: 7,
      id_etapa_cultivo: 3,
      cultivo: 'Café',
      etapa: 'Cosecha',
      ingreso: '2000000.75',
      cantidad: '10',
      precio_unitario: '200000.075',
      fecha: '2026-10-31',
      unidad: 'kg',
      unidad_base: 'kg',
    }]
  );
  model.meta.traceId = 'export-17';
  const report = await generateReportExport({ reportType: 'costos', format: 'xlsx', model });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(report.buffer);
  const detail = workbook.getWorksheet('Detalle');
  const summary = workbook.getWorksheet('Resumen');
  const technical = workbook.getWorksheet('Detalle técnico');

  assert.ok(detail);
  assert.ok(summary);
  assert.ok(technical);
  assert.ok(detail.getTable('CostosDetalle'));
  assert.ok(!detail.getRow(1).values.includes('Etapa'));
  assert.ok(!detail.getRow(1).values.includes('Código contable'));
  assert.ok(technical.getRow(1).values.includes('Etapa'));
  assert.ok(detail.getCell('A2').value instanceof Date);
  assert.equal(detail.getCell('A2').value.getUTCDate(), 31);
  assert.equal(typeof detail.getCell('H2').value, 'number');
  assert.equal(detail.getCell('H2').value, 1250000.5);
  assert.equal(detail.getCell('D2').value, 'Fertilizante ñandú');
  assert.equal(detail.getCell('J2').value.result, -1250000.5);
  assert.equal(detail.getCell('J3').value.result, 2000000.75);
  assert.match(detail.getCell('J4').value.formula, /^SUBTOTAL\(109,/);
  assert.equal(detail.getCell('J4').value.result, 750000.25);
  assert.equal(summary.getCell('B10').value.result, 2000000.75);
  assert.equal(summary.getCell('B11').value.result, 1250000.5);
  assert.equal(summary.getCell('B12').value.result, 750000.25);
  assert.equal(summary.getCell('H2').value.result, 2000000.75);
  assert.equal(technical.getCell('A2').value, 'C000001');
  assert.equal(technical.getCell('B2').value, '7105');
});

test('empty costs export contains valid zero totals in Excel and a PDF', async () => {
  const model = costsModel([]);
  const [excelReport, pdfReport] = await Promise.all([
    generateReportExport({ reportType: 'costos', format: 'xlsx', model }),
    generateReportExport({ reportType: 'costos', format: 'pdf', model }),
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelReport.buffer);
  const detail = workbook.getWorksheet('Detalle');

  assert.equal(detail.getCell('H2').value.formula, 'SUM(0)');
  assert.equal(detail.getCell('I2').value.formula, 'SUM(0)');
  assert.equal(detail.getCell('J2').value.formula, 'SUM(0)');
  assert.equal(pdfReport.buffer.subarray(0, 4).toString('ascii'), '%PDF');
  assert.equal(excelReport.rowCount, 0);
  assert.equal(pdfReport.rowCount, 0);
});

test('costs PDF is native, paginates large detail, and includes the trace ID', async () => {
  const costRows = Array.from({ length: 9999 }, (_, index) => ({
    id_cultivo: 7,
    id_etapa_cultivo: 3,
    cultivo: 'Café',
    etapa: 'Cosecha',
    categoria: 'Insumos',
    descripcion: `Registro de prueba ${index}`,
    valor: '1.00',
    fecha: '2026-10-31',
    codigo_contable: '7105',
    origen: 'CULTIVO',
    unidad_base: 'kg',
  }));
  const model = costsModel(costRows, [{
    id_cultivo: 7,
    id_etapa_cultivo: 3,
    cultivo: 'Café',
    etapa: 'Cosecha',
    ingreso: '500.00',
    cantidad: '1',
    precio_unitario: '500.00',
    fecha: '2026-10-31',
    unidad: 'kg',
    unidad_base: 'kg',
  }]);
  model.meta.traceId = 'export-10000';

  const report = await generateReportExport({ reportType: 'costos', format: 'pdf', model });
  const pdfText = report.buffer.toString('latin1');
  const pageCount = Number(pdfText.match(/\/Count\s+(\d+)/)?.[1] || 0);

  assert.equal(report.rowCount, 10000);
  assert.equal(model.totals.costos, '9999.00');
  assert.equal(model.totals.ingresos, '500.00');
  assert.equal(model.totals.ganancia, '-9499.00');
  assert.equal(report.buffer.subarray(0, 4).toString('ascii'), '%PDF');
  assert.ok(pageCount > 1);
  assert.ok(pdfText.includes('export-10000'));
  assert.ok(pdfText.includes('9.999,00'));
  assert.ok(pdfText.includes('500,00'));
  assert.ok(pdfText.includes('9.499,00'));
});
