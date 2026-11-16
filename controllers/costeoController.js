import * as costeoModel from '../models/costeoModel.js';
import { parseCurrencyValue } from '../utils/currency.js';

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isValidISODate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sendError(res, error, fallback) {
  console.error(fallback, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallback,
  });
}

export async function getCostingConfiguration(req, res) {
  try {
    const data = await costeoModel.getCostingConfiguration();
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo cargar la configuración de costeo.');
  }
}

export async function postCropType(req, res) {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre || nombre.length > 100) {
    return res.status(400).json({ success: false, message: 'Nombre de tipo de cultivo inválido.' });
  }
  try {
    const data = await costeoModel.createCropType(nombre);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo crear el tipo de cultivo.');
  }
}

export async function postStage(req, res) {
  const nombre = String(req.body?.nombre || '').trim();
  const descripcion = String(req.body?.descripcion || '').trim();
  if (!nombre || nombre.length > 100 || descripcion.length > 2000) {
    return res.status(400).json({ success: false, message: 'Nombre o descripción de etapa inválidos.' });
  }
  try {
    const data = await costeoModel.createStage({ nombre, descripcion });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo crear la etapa.');
  }
}

export async function putStage(req, res) {
  const id = positiveInteger(req.params.id);
  const nombre = String(req.body?.nombre || '').trim();
  const descripcion = String(req.body?.descripcion || '').trim();
  if (!id || !nombre || nombre.length > 100 || descripcion.length > 2000) {
    return res.status(400).json({ success: false, message: 'ID, nombre o descripción de etapa inválidos.' });
  }
  try {
    const data = await costeoModel.updateStage(id, { nombre, descripcion });
    if (!data) return res.status(404).json({ success: false, message: 'Etapa no encontrada o inactiva.' });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo actualizar la etapa.');
  }
}

export async function patchStageState(req, res) {
  const id = positiveInteger(req.params.id);
  const active = req.body?.activo;
  if (!id || typeof active !== 'boolean') {
    return res.status(400).json({ success: false, message: 'ID y estado activo/inactivo son requeridos.' });
  }
  try {
    const data = await costeoModel.setStageState(id, active);
    if (!data) return res.status(404).json({ success: false, message: 'Etapa no encontrada.' });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo cambiar el estado de la etapa.');
  }
}

export async function putCropType(req, res) {
  const id = positiveInteger(req.params.id);
  const nombre = String(req.body?.nombre || '').trim();
  if (!id || !nombre || nombre.length > 100) {
    return res.status(400).json({ success: false, message: 'ID o nombre de tipo de cultivo inválido.' });
  }
  try {
    const data = await costeoModel.updateCropType(id, nombre);
    if (!data) return res.status(404).json({ success: false, message: 'Tipo de cultivo no encontrado o inactivo.' });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo actualizar el tipo de cultivo.');
  }
}

export async function patchCropTypeState(req, res) {
  const id = positiveInteger(req.params.id);
  const active = req.body?.activo;
  if (!id || typeof active !== 'boolean') {
    return res.status(400).json({ success: false, message: 'ID y estado activo/inactivo son requeridos.' });
  }
  try {
    const data = await costeoModel.setCropTypeState(id, active);
    if (!data) return res.status(404).json({ success: false, message: 'Tipo de cultivo no encontrado.' });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo cambiar el estado del tipo de cultivo.');
  }
}

export async function putCropTypeStages(req, res) {
  const typeId = positiveInteger(req.params.id);
  const stageIds = req.body?.etapaIds;
  if (!typeId || !Array.isArray(stageIds) || stageIds.some((id) => !positiveInteger(id))) {
    return res.status(400).json({ success: false, message: 'Tipo de cultivo o lista de etapas inválida.' });
  }
  const normalizedIds = stageIds.map(Number);
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    return res.status(400).json({ success: false, message: 'La lista contiene etapas repetidas.' });
  }
  try {
    await costeoModel.replaceCropTypeStages(typeId, normalizedIds);
    return res.json({ success: true, data: { tipoCultivoId: typeId, etapaIds: normalizedIds } });
  } catch (error) {
    return sendError(res, error, 'No se pudo actualizar la secuencia de etapas.');
  }
}

export async function getGeneralCostAllocations(req, res) {
  const fincaId = positiveInteger(req.params.fincaId);
  if (!fincaId) return res.status(400).json({ success: false, message: 'ID de finca inválido.' });
  try {
    const data = await costeoModel.getGeneralCostAllocations(fincaId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo consultar el prorrateo de costos generales.');
  }
}

export async function putGeneralCostAllocations(req, res) {
  const fincaId = positiveInteger(req.params.fincaId);
  const allocations = req.body?.asignaciones;
  if (!fincaId || !Array.isArray(allocations)) {
    return res.status(400).json({ success: false, message: 'Finca o asignaciones inválidas.' });
  }
  const normalized = allocations.map((item) => ({
    cultivoId: positiveInteger(item?.cultivoId),
    porcentaje: Number(item?.porcentaje),
  }));
  if (normalized.some((item) =>
    !item.cultivoId ||
    !Number.isFinite(item.porcentaje) ||
    item.porcentaje <= 0 ||
    item.porcentaje > 100
  )) {
    return res.status(400).json({ success: false, message: 'Cada cultivo requiere un porcentaje mayor que 0 y hasta 100.' });
  }
  if (new Set(normalized.map((item) => item.cultivoId)).size !== normalized.length) {
    return res.status(400).json({ success: false, message: 'No se puede asignar más de un porcentaje al mismo cultivo.' });
  }
  if (normalized.length && Math.abs(normalized.reduce((sum, item) => sum + item.porcentaje, 0) - 100) > 0.00005) {
    return res.status(400).json({ success: false, message: 'Los porcentajes deben sumar exactamente 100%.' });
  }
  try {
    await costeoModel.replaceGeneralCostAllocations(fincaId, normalized);
    return res.json({ success: true, data: normalized });
  } catch (error) {
    return sendError(res, error, 'No se pudo guardar el prorrateo de costos generales.');
  }
}

export async function getUnitConversions(req, res) {
  const typeId = req.query.tipoCultivoId == null ? null : positiveInteger(req.query.tipoCultivoId);
  if (req.query.tipoCultivoId != null && !typeId) {
    return res.status(400).json({ success: false, message: 'ID de tipo de cultivo inválido.' });
  }
  try {
    const data = await costeoModel.getUnitConversions(typeId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudieron consultar las conversiones de unidades.');
  }
}

export async function putUnitConversions(req, res) {
  const typeId = positiveInteger(req.params.id);
  const conversiones = req.body?.conversiones;
  if (!typeId || !Array.isArray(conversiones)) {
    return res.status(400).json({ success: false, message: 'Tipo de cultivo o conversiones inválidas.' });
  }
  const normalized = conversiones.map((item) => ({
    unidadId: positiveInteger(item?.unidadId),
    factor: Number(item?.factor),
    esUnidadBase: item?.esUnidadBase === true,
  }));
  if (normalized.some((item) =>
    !item.unidadId || !Number.isFinite(item.factor) || item.factor <= 0
  )) {
    return res.status(400).json({ success: false, message: 'Cada conversión debe tener unidad y factor mayor que cero.' });
  }
  if (new Set(normalized.map((item) => item.unidadId)).size !== normalized.length) {
    return res.status(400).json({ success: false, message: 'No se puede repetir una unidad de medida.' });
  }
  if (normalized.length && normalized.filter((item) => item.esUnidadBase).length !== 1) {
    return res.status(400).json({ success: false, message: 'Debe seleccionarse exactamente una unidad base.' });
  }
  if (normalized.some((item) => item.esUnidadBase && item.factor !== 1)) {
    return res.status(400).json({ success: false, message: 'El factor de la unidad base debe ser 1.' });
  }
  try {
    await costeoModel.replaceUnitConversions(typeId, normalized);
    return res.json({ success: true, data: normalized });
  } catch (error) {
    return sendError(res, error, 'No se pudieron guardar las conversiones.');
  }
}

export async function putCostSubcategoryConfig(req, res) {
  const id = positiveInteger(req.params.id);
  const code = req.body?.codigoContable;
  const includeInUnitCost = req.body?.incluirCostoUnitario;
  if (
    !id ||
    (code !== null && code !== undefined &&
      (typeof code !== 'string' || code.length > 20 || !/^[A-Za-z0-9.-]+$/.test(code))) ||
    typeof includeInUnitCost !== 'boolean'
  ) {
    return res.status(400).json({ success: false, message: 'Código contable o configuración de costo unitario inválidos.' });
  }
  try {
    const data = await costeoModel.updateCostSubcategoryConfig(
      id,
      code || null,
      includeInUnitCost
    );
    if (!data) return res.status(404).json({ success: false, message: 'Subcategoría no encontrada.' });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo guardar la configuración contable.');
  }
}

export async function getInventoryProducts(req, res) {
  const fincaId = positiveInteger(req.params.fincaId);
  if (!fincaId) return res.status(400).json({ success: false, message: 'ID de finca inválido.' });
  try {
    const data = await costeoModel.getInventoryProducts(fincaId);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudieron consultar los productos del inventario.');
  }
}

export async function postInventoryConsumption(req, res) {
  const userId = positiveInteger(req.user?.id);
  const fincaId = positiveInteger(req.body?.fincaId);
  const cropId = positiveInteger(req.body?.cultivoId);
  const etapaId = positiveInteger(req.body?.etapaId);
  const estadoPagoId = positiveInteger(req.body?.estadoPagoId);
  const subcategoryId = positiveInteger(req.body?.subcategoriaId);
  const productoId = positiveInteger(req.body?.productoId);
  const cantidad = Number(req.body?.cantidad);
  const unidad = String(req.body?.unidad || '').trim();
  const fecha = req.body?.fecha || null;
  if (
    !userId || !fincaId || !cropId || !etapaId || !estadoPagoId ||
    !subcategoryId || !productoId || !Number.isFinite(cantidad) || cantidad <= 0 ||
    Math.round(cantidad * 1000) !== cantidad * 1000 || !unidad ||
    (fecha && !isValidISODate(fecha))
  ) {
    return res.status(400).json({ success: false, message: 'Datos inválidos para registrar la salida de inventario.' });
  }
  try {
    const data = await costeoModel.registerInventoryConsumption({
      userId,
      fincaId,
      cultivoId: cropId,
      etapaId,
      estadoPagoId,
      subcategoriaId,
      productoId,
      cantidad,
      unidad,
      descripcion: String(req.body?.descripcion || '').trim() || null,
      fecha,
    });
    return res.status(201).json({ success: true, data: { costoId: data } });
  } catch (error) {
    const invalidInputCodes = new Set(['22023', '23503', '23514', '23513', '22000', '22003', '28000']);
    return sendError(
      res,
      invalidInputCodes.has(error.code) ? Object.assign(error, { statusCode: 400 }) : error,
      'No se pudo registrar la salida de inventario.'
    );
  }
}

export async function postLaborPayment(req, res) {
  const userId = positiveInteger(req.user?.id);
  const fincaId = positiveInteger(req.body?.fincaId);
  const cropId = positiveInteger(req.body?.cultivoId);
  const etapaId = positiveInteger(req.body?.etapaId);
  const trabajadorId = positiveInteger(req.body?.trabajadorId);
  const subcategoryId = positiveInteger(req.body?.subcategoriaId);
  const estadoPagoId = positiveInteger(req.body?.estadoPagoId);
  const valor = parseCurrencyValue(req.body?.valor);
  const fecha = req.body?.fecha;
  if (
    !userId || !fincaId || !cropId || !etapaId || !trabajadorId ||
    !subcategoryId || !estadoPagoId || !Number.isFinite(valor) || valor <= 0 ||
    valor > 999999999999.99 || !fecha || !isValidISODate(fecha)
  ) {
    return res.status(400).json({ success: false, message: 'Datos inválidos para registrar el pago de mano de obra.' });
  }
  try {
    const data = await costeoModel.registerLaborPayment({
      fincaId,
      cultivoId: cropId,
      etapaId,
      trabajadorId,
      subcategoriaId: subcategoryId,
      estadoPagoId,
      valor,
      fecha,
      descripcion: String(req.body?.descripcion || '').trim() || null,
      registradoPor: userId,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo registrar el pago de mano de obra.');
  }
}

export async function getLaborPayments(req, res) {
  const fincaId = req.query.fincaId == null ? null : positiveInteger(req.query.fincaId);
  const cultivoId = req.query.cultivoId == null ? null : positiveInteger(req.query.cultivoId);
  const trabajadorId = req.query.trabajadorId == null ? null : positiveInteger(req.query.trabajadorId);
  if (
    (req.query.fincaId != null && !fincaId) ||
    (req.query.cultivoId != null && !cultivoId) ||
    (req.query.trabajadorId != null && !trabajadorId)
  ) {
    return res.status(400).json({ success: false, message: 'Filtros de pagos inválidos.' });
  }
  try {
    const data = await costeoModel.listLaborPayments({ fincaId, cultivoId, trabajadorId });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudieron consultar los pagos de mano de obra.');
  }
}
