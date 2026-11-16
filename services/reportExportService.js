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

function centsValue(decimalValue) {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(decimalValue || '0'));
  if (!match) throw new TypeError(`Invalid monetary value in costs report: ${decimalValue}`);
  const [, sign, whole, fraction = ''] = match;
  const cents = BigInt(whole) * 100n +
    BigInt((fraction + '00').slice(0, 2)) +
    (Number(fraction[2] || 0) >= 5 ? 1n : 0n);
  return Number(sign === '-' ? -cents : cents) / 100;
}

function excelDateFromISO(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function dateForPDF(value) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

function reportNumberFormat(value) {
  const number = Number(value) || 0;
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(number));
  return number < 0 ? `(${formatted})` : formatted;
}

function reportFiltersText(meta) {
  return meta.filters.length ? meta.filters.join(' · ') : 'Sin filtros adicionales';
}

function modelTotals(model) {
  return {
    ingresos: centsValue(model.totals.ingresos),
    costos: centsValue(model.totals.costos),
    ganancia: centsValue(model.totals.ganancia),
    margen: model.totals.margen,
  };
}

function addModelSummary(workbook, model, totalRow, detailColumnLetters) {
  const sheet = workbook.addWorksheet('Resumen');
  sheet.columns = [
    { width: 28 }, { width: 44 }, { width: 4 },
    { width: 26 }, { width: 20 }, { width: 4 },
    { width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 },
  ];
  const generated = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(model.meta.generatedAt));
  const metadataRows = [
    ['Razón social', model.meta.razonSocial || 'Pendiente de configurar'],
    ['NIT', model.meta.nit || 'Pendiente de configurar'],
    ['Finca', model.meta.finca || 'No especificada'],
    ['Reporte', model.meta.reportName],
    ['Periodo', `${model.meta.period.from || 'Sin inicio'} a ${model.meta.period.to || 'Sin fin'}`],
    ['Filtros aplicados', reportFiltersText(model.meta)],
    ['Generado', `${generated} (America/Bogota)`],
    ['Usuario', model.meta.usuario || 'No especificado'],
    ['Cantidad de registros', model.totals.registroCount],
    ['Total ingresos', null],
    ['Total costos', null],
    ['Ganancia total', null],
    ['Margen', null],
    ['ID de trazabilidad', model.meta.traceId || 'No disponible'],
  ];
  metadataRows.forEach(([label, value], index) => {
    sheet.getCell(index + 1, 1).value = label;
    sheet.getCell(index + 1, 2).value = value;
  });
  const totals = modelTotals(model);
  const totalRowCells = {
    ingresos: detailColumnLetters.ingreso,
    costos: detailColumnLetters.costo,
    ganancia: detailColumnLetters.ganancia,
  };
  for (const [offset, key] of [[10, 'ingresos'], [11, 'costos'], [12, 'ganancia']]) {
    const column = totalRowCells[key];
    sheet.getCell(offset, 2).value = {
      formula: `Detalle!${column}${totalRow}`,
      result: totals[key],
    };
    sheet.getCell(offset, 2).numFmt = '#,##0;(#,##0)';
  }
  sheet.getCell(13, 2).value = {
    formula: 'IF(B10=0,0,B12/B10)',
    result: totals.margen,
  };
  sheet.getCell(13, 2).numFmt = '0.00%;(0.00%)';

  sheet.getCell('D1').value = 'Costos por categoría';
  sheet.getCell('D2').value = 'Categoría';
  sheet.getCell('E2').value = 'Costo';
  model.groups.byCategory.forEach((group, index) => {
    const row = index + 3;
    const result = centsValue(group.costos);
    sheet.getCell(row, 4).value = group.categoria;
    sheet.getCell(row, 5).value = {
      formula: `SUMIFS(Detalle!${detailColumnLetters.costo}:${detailColumnLetters.costo},Detalle!${detailColumnLetters.categoria}:${detailColumnLetters.categoria},D${row})`,
      result,
    };
    sheet.getCell(row, 5).numFmt = '#,##0;(#,##0)';
  });

  ['Cultivo', 'Ingresos', 'Costos', 'Ganancia', 'Margen'].forEach((header, index) => {
    sheet.getCell(1, 7 + index).value = header;
  });
  model.groups.byCrop.forEach((group, index) => {
    const row = index + 2;
    const income = centsValue(group.ingresos);
    const costs = centsValue(group.costos);
    const profit = centsValue(group.ganancia);
    sheet.getCell(row, 7).value = group.cultivo;
    sheet.getCell(row, 8).value = {
      formula: `SUMIFS(Detalle!${detailColumnLetters.ingreso}:${detailColumnLetters.ingreso},Detalle!${detailColumnLetters.cultivo}:${detailColumnLetters.cultivo},G${row})`,
      result: income,
    };
    sheet.getCell(row, 9).value = {
      formula: `SUMIFS(Detalle!${detailColumnLetters.costo}:${detailColumnLetters.costo},Detalle!${detailColumnLetters.cultivo}:${detailColumnLetters.cultivo},G${row})`,
      result: costs,
    };
    sheet.getCell(row, 10).value = { formula: `H${row}-I${row}`, result: profit };
    sheet.getCell(row, 11).value = {
      formula: `IF(H${row}=0,0,J${row}/H${row})`,
      result: group.margen,
    };
    for (const column of [8, 9, 10]) sheet.getCell(row, column).numFmt = '#,##0;(#,##0)';
    sheet.getCell(row, 11).numFmt = '0.00%;(0.00%)';
  });

  for (const rowNumber of [1, 2]) {
    sheet.getRow(rowNumber).font = { bold: true };
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('D1').font = { bold: true };
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF395D4A' } };
}

async function buildCostsExcel(model) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AgroGestión';
  workbook.created = new Date(model.meta.generatedAt);
  workbook.calcProperties = { fullCalcOnLoad: true, forceFullCalc: true };
  const detail = workbook.addWorksheet('Detalle');
  const columns = model.columns;
  detail.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  detail.views = [{ state: 'frozen', ySplit: 1 }];
  const columnIndex = Object.fromEntries(columns.map((column, index) => [column.key, index + 1]));
  const letters = Object.fromEntries(columns.map((column) => [
    column.key,
    detail.getColumn(indexOfKey(columns, column.key) + 1).letter,
  ]));

  const tableRows = model.rows.map((row) => columns.map((column) => {
      if (column.key === 'fecha') return excelDateFromISO(row.fecha);
      if (column.key === 'costo' || column.key === 'ingreso' || column.key === 'valor_unitario') {
        return row[column.key] == null ? null : centsValue(row[column.key]);
      }
      if (column.key === 'cantidad') return row.cantidad == null ? null : Number(row.cantidad);
      if (column.key === 'ganancia' || column.key === 'margen') return null;
      return row[column.key] ?? null;
    }));
  detail.addTable({
    name: 'CostosDetalle',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium4', showRowStripes: true },
    columns: columns.map((column) => ({ name: column.header, filterButton: true })),
    rows: tableRows,
  });

  for (const [rowIndex, row] of model.rows.entries()) {
    const rowNumber = rowIndex + 2;
    for (const column of columns) {
      const cell = detail.getCell(rowNumber, columnIndex[column.key]);
      if (column.type === 'date') cell.numFmt = 'dd/mm/yyyy';
      if (column.type === 'money') cell.numFmt = '#,##0;(#,##0)';
      if (column.type === 'percent') cell.numFmt = '0.00%;(0.00%)';
      if (column.type === 'number') cell.numFmt = '#,##0.###';
      if (column.key === 'ganancia') {
        const incomeCell = `${letters.ingreso}${rowNumber}`;
        const costCell = `${letters.costo}${rowNumber}`;
        cell.value = { formula: `${incomeCell}-${costCell}`, result: centsValue(row.ganancia) };
      }
      if (column.key === 'margen') {
        const incomeCell = `${letters.ingreso}${rowNumber}`;
        const profitCell = `${letters.ganancia}${rowNumber}`;
        cell.value = {
          formula: `IF(${incomeCell}=0,0,${profitCell}/${incomeCell})`,
          result: row.margen,
        };
      }
    }
  }

  const firstDataRow = 2;
  const lastDataRow = model.rows.length + 1;
  const totalValues = columns.map((column, index) => {
    if (column.key === 'rowId') return 'TOTAL';
    if (column.total !== 'sum') return null;
    const letter = detail.getColumn(index + 1).letter;
    const resultKey = column.key === 'costo' ? 'costos' : column.key === 'ingreso' ? 'ingresos' : 'ganancia';
    return model.rows.length
      ? {
          formula: `SUBTOTAL(109,${letter}${firstDataRow}:${letter}${lastDataRow})`,
          result: centsValue(model.totals[resultKey]),
        }
      : { formula: 'SUM(0)', result: 0 };
  });
  const totalsRow = detail.addRow(totalValues);
  totalsRow.font = { bold: true };
  for (const column of columns) {
    if (column.type === 'money') totalsRow.getCell(columnIndex[column.key]).numFmt = '#,##0;(#,##0)';
    if (column.type === 'percent') totalsRow.getCell(columnIndex[column.key]).numFmt = '0.00%;(0.00%)';
  }
  addModelSummary(workbook, model, totalsRow.number, {
    ingreso: letters.ingreso,
    costo: letters.costo,
    ganancia: letters.ganancia,
    categoria: letters.categoria,
    cultivo: letters.cultivo,
    etapa: letters.etapa,
  });

  const technical = workbook.addWorksheet('Detalle técnico');
  technical.columns = model.technicalColumns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  technical.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of model.rows.filter((item) => item.kind === 'cost')) {
    technical.addRow(Object.fromEntries(model.technicalColumns.map((column) => [
      column.key,
      column.key === 'porcentaje_prorrateo' && row[column.key] != null
        ? Number(row[column.key]) / 100
        : row[column.key] ?? null,
    ])));
  }
  technical.getRow(1).font = { bold: true };
  technical.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, technical.rowCount), column: model.technicalColumns.length },
  };
  for (const [index, column] of model.technicalColumns.entries()) {
    if (column.type === 'percent') {
      technical.getColumn(index + 1).numFmt = '0.00%;(0.00%)';
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function indexOfKey(columns, key) {
  return columns.findIndex((column) => column.key === key);
}

function pdfRowForModel(row) {
  return [
    dateForPDF(row.fecha),
    row.cultivo,
    row.categoria,
    row.concepto,
    row.cantidad == null ? '' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(Number(row.cantidad)),
    row.unidad || '',
    row.valor_unitario == null ? '' : reportNumberFormat(row.valor_unitario),
    reportNumberFormat(row.costo),
    reportNumberFormat(row.ingreso),
    reportNumberFormat(row.ganancia),
    `${(row.margen * 100).toFixed(2)}%`,
  ];
}

function buildCostsPdf(model) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const margin = 30;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totals = modelTotals(model);
  const header = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(model.meta.finca || 'Finca no especificada', margin, 22);
    doc.text(model.meta.reportName, pageWidth / 2, 22, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const period = `${model.meta.period.from || 'Sin inicio'} a ${model.meta.period.to || 'Sin fin'}`;
    doc.text('Razón social/NIT: pendientes de configurar', margin, 36);
    doc.text(`Periodo: ${period} · Moneda: COP`, margin, 49);
  };
  const drawPageHeader = () => header();
  const filterText = reportFiltersText(model.meta);

  header();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resumen ejecutivo', margin, 76);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Ingresos: COP ${reportNumberFormat(model.totals.ingresos)}`, margin, 96);
  doc.text(`Costos: COP ${reportNumberFormat(model.totals.costos)}`, margin + 210, 96);
  doc.text(`Ganancia: COP ${reportNumberFormat(model.totals.ganancia)}`, margin + 420, 96);
  doc.text(`Margen: ${(model.totals.margen * 100).toFixed(2)}%`, margin + 640, 96);
  doc.text(`Registros: ${model.totals.registroCount}`, margin, 114);

  autoTable(doc, {
    head: [['Costos por categoría', 'Total COP']],
    body: model.groups.byCategory.map((group) => [group.categoria, reportNumberFormat(group.costos)]),
    startY: 132,
    margin: { top: 65, right: margin, bottom: 38, left: margin },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, lineColor: [190, 190, 190], lineWidth: 0.3 },
    headStyles: { fillColor: [90, 90, 90], textColor: 255 },
    columnStyles: { 1: { halign: 'right' } },
    didDrawPage: drawPageHeader,
  });
  const cropSummary = model.groups.byCrop.map((group) => [
    group.cultivo,
    reportNumberFormat(group.ingresos),
    reportNumberFormat(group.costos),
    reportNumberFormat(group.ganancia),
  ]);
  autoTable(doc, {
    head: [['Cultivo/Lote', 'Ingresos COP', 'Costos COP', 'Ganancia COP']],
    body: cropSummary,
    startY: (doc.lastAutoTable?.finalY || 132) + 18,
    margin: { top: 65, right: margin, bottom: 38, left: margin },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, lineColor: [190, 190, 190], lineWidth: 0.3 },
    headStyles: { fillColor: [90, 90, 90], textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didDrawPage: drawPageHeader,
  });
  doc.addPage('letter', 'landscape');

  const body = [];
  const subtotalRows = new Set();
  const rowsByGroup = new Map();
  for (const row of model.rows) {
    const key = row.cultivo;
    if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
    rowsByGroup.get(key).push(row);
  }
  for (const group of model.groups.byCrop) {
    const key = group.groupId;
    const groupRows = rowsByGroup.get(key) || [];
    body.push([group.cultivo, '', '', '', '', '', '', '', '', '', '']);
    for (const row of groupRows) body.push(pdfRowForModel(row));
    const subtotal = [
      `Subtotal ${group.cultivo}`,
      '', '', '', '', '', '',
      reportNumberFormat(group.costos),
      reportNumberFormat(group.ingresos),
      reportNumberFormat(group.ganancia),
      `${(group.margen * 100).toFixed(2)}%`,
    ];
    subtotalRows.add(body.length);
    body.push(subtotal);
  }
  const totalRow = [
    'TOTAL GENERAL', '', '', '', '', '', '',
    reportNumberFormat(model.totals.costos),
    reportNumberFormat(model.totals.ingresos),
    reportNumberFormat(model.totals.ganancia),
    `${(model.totals.margen * 100).toFixed(2)}%`,
  ];
  subtotalRows.add(body.length);
  body.push(totalRow);
  autoTable(doc, {
    head: [model.columns.filter((column) => column.key !== 'rowId').map((column) => column.header)],
    body,
    startY: 68,
    margin: { top: 62, right: margin, bottom: 40, left: margin },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 3,
      overflow: 'linebreak',
      lineColor: [195, 195, 195],
      lineWidth: 0.25,
    },
    headStyles: { fillColor: [90, 90, 90], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center' },
      4: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'center' },
    },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    didDrawPage: drawPageHeader,
    didParseCell: (hook) => {
      if (hook.section === 'body' && subtotalRows.has(hook.row.index)) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = hook.row.index === body.length - 1 ? [215, 215, 215] : [240, 240, 240];
      }
    },
    didDrawCell: (hook) => {
      if (hook.section === 'body' && hook.row.index === body.length - 1 && hook.column.index === 0) {
        const y = hook.cell.y;
        doc.setDrawColor(45, 45, 45);
        doc.setLineWidth(0.7);
        doc.line(margin, y - 3, pageWidth - margin, y - 3);
        doc.line(margin, y - 5, pageWidth - margin, y - 5);
      }
    },
  });

  doc.addPage('letter', 'landscape');
  header();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Notas y filtros aplicados', margin, 78);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const notes = doc.splitTextToSize(
    `Filtros: ${filterText}\nPeriodo de costos: ${model.meta.period.from || 'Sin inicio'} a ${model.meta.period.to || 'Sin fin'}\nLos ingresos corresponden a cosechas del mismo cultivo, etapa y periodo. Los costos generales sin prorratear se conservan como grupo separado y se incluyen en el total general.\nRazón social y NIT no están configurados en el sistema.`,
    pageWidth - margin * 2
  );
  doc.text(notes, margin, 98);

  const generatedLabel = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(model.meta.generatedAt));
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `Generado: ${generatedLabel} · Usuario: ${model.meta.usuario || 'No especificado'} · ID: ${model.meta.traceId || 'No disponible'} · Página ${page} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 18,
      { align: 'center' }
    );
  }
  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateReportExport({ reportType, format, rows, filters, context, model }) {
  if (reportType === 'costos' && model && format === 'xlsx') {
    const buffer = await buildCostsExcel(model);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      rowCount: model.rows.length,
    };
  }
  if (reportType === 'costos' && model && format === 'pdf') {
    return {
      buffer: buildCostsPdf(model),
      contentType: 'application/pdf',
      extension: 'pdf',
      rowCount: model.rows.length,
    };
  }
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
