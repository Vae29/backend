import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
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
