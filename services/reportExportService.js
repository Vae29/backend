import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const reportLabels = {
  'por-cultivo': 'Por cultivo',
  costos: 'Costos',
  produccion: 'Producción',
  rentabilidad: 'Rentabilidad',
  trabajador: 'Trabajador',
};

const commonColumns = [
  { key: 'codigo_contable', header: 'Código contable', type: 'text' },
  { key: 'categoria', header: 'Categoría', type: 'text' },
  { key: 'subcategoria', header: 'Subcategoría', type: 'text' },
  { key: 'cultivo', header: 'Cultivo', type: 'text' },
  { key: 'tipo_cultivo', header: 'Tipo de cultivo', type: 'text' },
  { key: 'etapa', header: 'Etapa', type: 'text' },
  { key: 'fecha', header: 'Fecha', type: 'date' },
  { key: 'valor', header: 'Valor COP', type: 'currency' },
];

const extraColumns = {
  'por-cultivo': [
    { key: 'estado', header: 'Estado', type: 'text' },
    { key: 'cantidad_producida', header: 'Producción', type: 'number' },
    { key: 'unidad_base', header: 'Unidad base', type: 'text' },
    { key: 'ingresos', header: 'Ingresos COP', type: 'currency' },
    { key: 'costos', header: 'Costos COP', type: 'currency' },
    { key: 'ganancia', header: 'Ganancia COP', type: 'currency' },
    { key: 'costo_unitario', header: 'Costo unitario COP', type: 'currency' },
  ],
  costos: [
    { key: 'descripcion', header: 'Descripción', type: 'text' },
    { key: 'origen', header: 'Origen', type: 'text' },
    { key: 'porcentaje_prorrateo', header: 'Prorrateo %', type: 'percentagePoints' },
  ],
  produccion: [
    { key: 'cantidad', header: 'Cantidad', type: 'number' },
    { key: 'unidad', header: 'Unidad', type: 'text' },
    { key: 'cantidad_unidad_base', header: 'Cantidad unidad base', type: 'number' },
    { key: 'unidad_base', header: 'Unidad base', type: 'text' },
    { key: 'precio_unitario', header: 'Precio unitario COP', type: 'currency' },
    { key: 'ingresos', header: 'Ingresos COP', type: 'currency' },
  ],
  rentabilidad: [
    { key: 'ingresos', header: 'Ingresos COP', type: 'currency' },
    { key: 'costos', header: 'Costos COP', type: 'currency' },
    { key: 'ganancia', header: 'Ganancia COP', type: 'currency' },
    { key: 'margen', header: 'Margen', type: 'percentage' },
    { key: 'costo_unitario', header: 'Costo unitario COP', type: 'currency' },
    { key: 'unidad_base', header: 'Unidad base', type: 'text' },
  ],
  trabajador: [
    { key: 'trabajador', header: 'Trabajador', type: 'text' },
    { key: 'cultivos_asignados', header: 'Cultivos asignados', type: 'number' },
  ],
};

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
});

function columnsFor(reportType) {
  const columns = [...commonColumns, ...(extraColumns[reportType] || [])];
  if (reportType === 'rentabilidad') {
    return columns.map((column) =>
      column.key === 'ganancia'
        ? { ...column, formula: true }
        : column.key === 'margen'
          ? { ...column, formula: true }
          : column
    );
  }
  return columns;
}

function reportDate(row) {
  return row.fecha || row.fecha_cosecha || null;
}

function reportValue(reportType, row) {
  if (reportType === 'costos') return Number(row.valor) || 0;
  if (reportType === 'produccion') {
    return (Number(row.cantidad) || 0) * (Number(row.precio_unitario) || 0);
  }
  return Number(row.total_costos) || 0;
}

function valueFor(reportType, row, key) {
  switch (key) {
    case 'codigo_contable':
      return row.codigo_contable ?? null;
    case 'categoria':
      return row.categoria ?? null;
    case 'subcategoria':
      return row.subcategoria ?? null;
    case 'cultivo':
      return row.cultivo ?? null;
    case 'tipo_cultivo':
      return row.tipo_cultivo ?? null;
    case 'etapa':
      return row.etapa ?? null;
    case 'fecha':
      return reportDate(row);
    case 'valor':
      return reportValue(reportType, row);
    case 'estado':
      return row.estado ?? null;
    case 'cantidad_producida':
      return row.total_produccion == null ? null : Number(row.total_produccion);
    case 'unidad_base':
      return row.unidad_base ?? null;
    case 'ingresos':
      return row.total_ingresos == null
        ? reportType === 'produccion' ? reportValue(reportType, row) : 0
        : Number(row.total_ingresos);
    case 'costos':
      return Number(row.total_costos) || 0;
    case 'ganancia':
      return Number(row.ganancia) || 0;
    case 'costo_unitario':
      return row.costo_unitario == null ? null : Number(row.costo_unitario);
    case 'descripcion':
    case 'origen':
      return row[key] ?? null;
    case 'porcentaje_prorrateo':
      return row.porcentaje_prorrateo == null ? null : Number(row.porcentaje_prorrateo);
    case 'cantidad':
    case 'cantidad_unidad_base':
    case 'cultivos_asignados':
      return row[key] == null ? null : Number(row[key]);
    case 'unidad':
      return row.unidad ?? null;
    case 'precio_unitario':
      return row.precio_unitario == null ? null : Number(row.precio_unitario);
    case 'margen': {
      const ingresos = Number(row.total_ingresos) || 0;
      return ingresos > 0 ? (Number(row.ganancia) || 0) / ingresos : 0;
    }
    case 'trabajador':
      return row.nombre ?? null;
    default:
      return row[key] ?? null;
  }
}

function exportRows(reportType, rows) {
  const columns = columnsFor(reportType);
  return rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.key, valueFor(reportType, row, column.key)]))
  );
}

function isoDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function excelDate(value) {
  const normalized = isoDate(value);
  return normalized ? new Date(`${normalized}T00:00:00.000Z`) : null;
}

function csvCell(value) {
  if (value == null) return '';
  const text = value instanceof Date ? isoDate(value) : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(reportType, rows) {
  const columns = columnsFor(reportType);
  const output = [
    columns.map((column) => csvCell(column.header)).join(';'),
    ...rows.map((row) =>
      columns.map((column) => {
        const value = valueFor(reportType, row, column.key);
        const outputValue = column.type === 'date'
          ? isoDate(value)
          : column.type === 'currency' && value != null
            ? Number(value).toFixed(2)
            : value;
        return csvCell(outputValue);
      }).join(';')
    ),
  ].join('\r\n');
  return Buffer.from(`\uFEFF${output}`, 'utf8');
}

function reportTotals(reportType, rows) {
  const exported = exportRows(reportType, rows);
  const totals = { value: 0, income: 0, costs: 0, profit: 0 };
  for (const row of exported) {
    totals.value += Number(row.valor) || 0;
    totals.income += Number(row.ingresos) || 0;
    totals.costs += Number(row.costos) || 0;
    totals.profit += Number(row.ganancia) || 0;
  }
  totals.margin = totals.income > 0 ? totals.profit / totals.income : 0;
  return totals;
}

function filterSummary(filters) {
  const entries = Object.entries(filters).filter(([, value]) => value != null && value !== '');
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : 'Sin filtros adicionales';
}

function addSummarySheet(workbook, reportType, filters, context, rowCount, totals, generatedAt) {
  const sheet = workbook.addWorksheet('Resumen');
  sheet.columns = [
    { header: 'Dato', key: 'label', width: 28 },
    { header: 'Valor', key: 'value', width: 80 },
  ];
  const values = [
    ['Finca', context.finca],
    ['Tipo de reporte', reportLabels[reportType]],
    ['Filtros aplicados', filterSummary(filters)],
    ['Fecha de generación', generatedAt],
    ['Usuario', context.usuario],
    ['Número de filas', rowCount],
    ['Total valor COP', totals.value],
    ['Total ingresos COP', totals.income],
    ['Total costos COP', totals.costs],
    ['Ganancia COP', totals.profit],
    ['Margen', totals.margin],
  ];
  for (const [label, value] of values) {
    sheet.addRow({ label, value });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber >= 7 && rowNumber <= 10) cell.numFmt = '"$" #,##0';
    if (rowNumber === 11) cell.numFmt = '0.00%';
    if (rowNumber === 4) cell.numFmt = 'yyyy-mm-dd hh:mm';
  });
  sheet.getCell('B4').value = generatedAt;
}

function buildExcel(reportType, rows, filters, context, generatedAt) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AgroGestión';
  workbook.created = generatedAt;
  workbook.calcProperties = { fullCalcOnLoad: true, forceFullCalc: true };
  const columns = columnsFor(reportType);
  const exported = exportRows(reportType, rows);
  const totals = reportTotals(reportType, rows);
  addSummarySheet(workbook, reportType, filters, context, rows.length, totals, generatedAt);

  const sheet = workbook.addWorksheet('Detalle');
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.type === 'text' ? 22 : 18,
  }));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const [rowIndex, row] of exported.entries()) {
    const values = columns.map((column) => {
      if (column.formula) return null;
      const value = row[column.key];
      return column.type === 'date' ? excelDate(value) : value;
    });
    const added = sheet.addRow(values);
    const excelRow = rowIndex + 2;
    for (const [columnIndex, column] of columns.entries()) {
      const cell = added.getCell(columnIndex + 1);
      if (column.type === 'date') cell.numFmt = 'yyyy-mm-dd';
      if (column.type === 'currency') cell.numFmt = '"$" #,##0';
      if (column.type === 'percentagePoints') cell.numFmt = '0.0000"%"';
      if (column.type === 'percentage') cell.numFmt = '0.00%';
      if (!column.formula) continue;

      const incomeColumn = columns.findIndex((item) => item.key === 'ingresos') + 1;
      const costColumn = columns.findIndex((item) => item.key === 'costos') + 1;
      const profitColumn = columns.findIndex((item) => item.key === 'ganancia') + 1;
      const incomeLetter = sheet.getColumn(incomeColumn).letter;
      const costLetter = sheet.getColumn(costColumn).letter;
      const profitLetter = sheet.getColumn(profitColumn).letter;
      cell.value = column.key === 'ganancia'
        ? { formula: `IF(${incomeLetter}${excelRow}=0,0,${incomeLetter}${excelRow}-${costLetter}${excelRow})` }
        : { formula: `IF(${incomeLetter}${excelRow}=0,0,${profitLetter}${excelRow}/${incomeLetter}${excelRow})` };
    }
  }

  const firstDataRow = 2;
  const lastDataRow = rows.length + 1;
  const totalsRow = sheet.addRow(columns.map((column, index) => {
    if (index === 0) return 'TOTAL';
    if (['valor', 'ingresos', 'costos', 'ganancia'].includes(column.key) && rows.length) {
      const letter = sheet.getColumn(index + 1).letter;
      return { formula: `SUBTOTAL(109,${letter}${firstDataRow}:${letter}${lastDataRow})` };
    }
    if (column.key === 'margen' && rows.length) {
      const incomeLetter = sheet.getColumn(columns.findIndex((item) => item.key === 'ingresos') + 1).letter;
      const profitLetter = sheet.getColumn(columns.findIndex((item) => item.key === 'ganancia') + 1).letter;
      return { formula: `IF(${incomeLetter}${lastDataRow + 1}=0,0,${profitLetter}${lastDataRow + 1}/${incomeLetter}${lastDataRow + 1})` };
    }
    return null;
  }));
  totalsRow.font = { bold: true };
  for (const [index, column] of columns.entries()) {
    const cell = totalsRow.getCell(index + 1);
    if (column.type === 'currency') cell.numFmt = '"$" #,##0';
    if (column.type === 'percentage') cell.numFmt = '0.00%';
  }
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastDataRow, column: columns.length },
    };
  }
  return workbook.xlsx.writeBuffer();
}

function formattedValue(reportType, row, column) {
  const value = valueFor(reportType, row, column.key);
  if (value == null) return '';
  if (column.type === 'currency') return copFormatter.format(Number(value) || 0);
  if (column.type === 'percentage') return `${(Number(value) * 100).toFixed(2)}%`;
  if (column.type === 'percentagePoints') return `${Number(value).toFixed(4)}%`;
  if (column.type === 'date') return isoDate(value);
  if (typeof value === 'number') return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(value);
  return String(value);
}

function buildPdf(reportType, rows, filters, context, generatedAt) {
  const landscape = ['costos', 'produccion', 'rentabilidad'].includes(reportType);
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const columns = columnsFor(reportType);
  const totals = reportTotals(reportType, rows);
  const margin = 30;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const period = `${filters.fechaInicio || 'Inicio'} a ${filters.fechaFin || 'Hoy'}`;
  const filterLines = doc.splitTextToSize(
    `Periodo: ${period} · Filtros: ${filterSummary(filters)}`,
    pageWidth - margin * 2
  );
  const tableTop = 55 + filterLines.length * 10;
  const body = rows.map((row) => columns.map((column) => formattedValue(reportType, row, column)));
  const subtotalRowIndexes = new Set();
  if (reportType === 'costos') {
    const subtotals = new Map();
    for (const row of rows) {
      const code = row.codigo_contable || 'Sin código';
      subtotals.set(code, (subtotals.get(code) || 0) + (Number(row.valor) || 0));
    }
    for (const [code, value] of [...subtotals.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const subtotalRow = Array(columns.length).fill('');
      subtotalRow[0] = `Subtotal ${code}`;
      const valueIndex = columns.findIndex((column) => column.key === 'valor');
      if (valueIndex >= 0) subtotalRow[valueIndex] = copFormatter.format(value);
      subtotalRowIndexes.add(body.length);
      body.push(subtotalRow);
    }
  }

  const totalRow = Array(columns.length).fill('');
  totalRow[0] = 'TOTAL';
  for (const [index, column] of columns.entries()) {
    if (column.key === 'valor') totalRow[index] = copFormatter.format(totals.value);
    if (column.key === 'ingresos') totalRow[index] = copFormatter.format(totals.income);
    if (column.key === 'costos') totalRow[index] = copFormatter.format(totals.costs);
    if (column.key === 'ganancia') totalRow[index] = copFormatter.format(totals.profit);
    if (column.key === 'margen') totalRow[index] = `${(totals.margin * 100).toFixed(2)}%`;
  }
  subtotalRowIndexes.add(body.length);
  body.push(totalRow);

  const columnStyles = Object.fromEntries(columns.flatMap((column, index) =>
    column.type === 'currency' ? [[index, { halign: 'right' }]] : []
  ));
  autoTable(doc, {
    head: [columns.map((column) => column.header)],
    body,
    startY: tableTop,
    margin: { top: tableTop, right: margin, bottom: 42, left: margin },
    styles: { font: 'helvetica', fontSize: landscape ? 7 : 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [39, 93, 66], textColor: 255, fontStyle: 'bold' },
    columnStyles,
    didParseCell: (hook) => {
      if (hook.section === 'body' && subtotalRowIndexes.has(hook.row.index)) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [235, 239, 236];
      }
    },
  });

  const generatedLabel = generatedAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const title = `${reportLabels[reportType]} · ${context.finca}`;
  const summary = `Filas: ${rows.length} · Total COP: ${copFormatter.format(totals.value)} · Ganancia COP: ${copFormatter.format(totals.profit)}`;
  for (let page = 1; page <= doc.internal.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, margin, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(filterLines, margin, 34);
    doc.text(summary, margin, 44 + filterLines.length * 10);
    doc.text(
      `Generado: ${generatedLabel} · Usuario: ${context.usuario} · Página ${page} de ${doc.internal.getNumberOfPages()}`,
      pageWidth / 2,
      pageHeight - 18,
      { align: 'center' }
    );
  }
  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateReportExport({ reportType, format, rows, filters, context }) {
  const generatedAt = new Date();
  if (format === 'csv') {
    return {
      buffer: buildCsv(reportType, rows),
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
      rowCount: rows.length,
    };
  }
  if (format === 'xlsx') {
    const buffer = await buildExcel(reportType, rows, filters, context, generatedAt);
    return {
      buffer: Buffer.from(buffer),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      rowCount: rows.length,
    };
  }
  if (format === 'pdf') {
    return {
      buffer: buildPdf(reportType, rows, filters, context, generatedAt),
      contentType: 'application/pdf',
      extension: 'pdf',
      rowCount: rows.length,
    };
  }
  throw Object.assign(new Error('Formato de exportación desconocido.'), { statusCode: 400 });
}
