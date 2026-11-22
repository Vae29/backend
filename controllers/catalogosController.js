import * as catalogosModel from '../models/catalogosModel.js';

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sendError(res, error, fallback) {
  console.error(fallback, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallback,
  });
}

function validateItem(req) {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const descripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion.trim() : '';
  const parentId = positiveInteger(req.body?.categoriaId);
  if (!nombre || nombre.length > 100 || descripcion.length > 2000) return null;
  if (req.params.catalogo === 'subcategorias-costo' && !parentId) return null;
  return { nombre, descripcion, parentId };
}

export async function getCatalogos(req, res) {
  try {
    const data = await catalogosModel.getCatalogs();
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudieron cargar los catálogos.');
  }
}

export async function postCatalogo(req, res) {
  const item = validateItem(req);
  if (!item) {
    return res.status(400).json({
      success: false,
      message: 'Nombre, descripción o categoría inválidos.',
    });
  }
  try {
    const data = await catalogosModel.createCatalogItem(req.params.catalogo, item);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo crear la opción.');
  }
}

export async function putCatalogo(req, res) {
  const id = positiveInteger(req.params.id);
  const item = validateItem(req);
  if (!id || !item) {
    return res.status(400).json({
      success: false,
      message: 'ID, nombre, descripción o categoría inválidos.',
    });
  }
  try {
    const data = await catalogosModel.updateCatalogItem(req.params.catalogo, id, item);
    if (!data) return res.status(404).json({ success: false, message: 'Opción no encontrada.' });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'No se pudo actualizar la opción.');
  }
}

export async function deleteCatalogo(req, res) {
  const id = positiveInteger(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'ID inválido.' });
  try {
    const deleted = await catalogosModel.deleteCatalogItem(req.params.catalogo, id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Opción no encontrada.' });
    return res.json({ success: true, message: 'Opción eliminada.' });
  } catch (error) {
    return sendError(res, error, 'No se pudo eliminar la opción.');
  }
}

