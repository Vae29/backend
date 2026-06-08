import * as fincaModel from '../models/fincaModel.js';

export async function getFincas(req, res) {
  try {
    const search = req.query.search || '';
    const estado = req.query.estado || 'ACTIVO';
    const fincas = await fincaModel.findFincas(search, estado);
    return res.json(fincas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error obteniendo fincas' });
  }
}

export async function createFinca(req, res) {
  try {
    const { nombre, ubicacion } = req.body;
    if (!nombre || !ubicacion || !nombre.trim() || !ubicacion.trim()) {
      return res.status(400).json({ error: 'Nombre y ubicación son obligatorios' });
    }

    const newFinca = await fincaModel.createFinca(nombre.trim(), ubicacion.trim());
    return res.status(201).json(newFinca);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error creando la finca' });
  }
}

export async function updateFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const { nombre, ubicacion } = req.body;
    if (!Number.isInteger(fincaId) || fincaId <= 0) {
      return res.status(400).json({ error: 'ID de finca inválido' });
    }
    if (!nombre || !ubicacion || !nombre.trim() || !ubicacion.trim()) {
      return res.status(400).json({ error: 'Nombre y ubicación son obligatorios' });
    }

    const updatedFinca = await fincaModel.updateFinca(fincaId, nombre.trim(), ubicacion.trim());
    if (!updatedFinca) {
      return res.status(404).json({ error: 'Finca no encontrada' });
    }

    return res.json(updatedFinca);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error actualizando la finca' });
  }
}

export async function changeFincaState(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const { nuevoEstado, motivo } = req.body;
    const usuarioId = req.user?.id;
    
    if (!Number.isInteger(fincaId) || fincaId <= 0) {
      return res.status(400).json({ error: 'ID de finca inválido' });
    }
    if (!nuevoEstado || !['ACTIVO', 'ARCHIVADO'].includes(nuevoEstado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Motivo es obligatorio' });
    }
    if (!usuarioId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const updatedFinca = await fincaModel.changeFincaState(fincaId, nuevoEstado, motivo.trim(), usuarioId);
    if (!updatedFinca) {
      return res.status(404).json({ error: 'Finca no encontrada' });
    }

    return res.json(updatedFinca);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error cambiando el estado de la finca' });
  }
}

// Legacy function for backward compatibility
export async function deleteFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    if (!Number.isInteger(fincaId) || fincaId <= 0) {
      return res.status(400).json({ error: 'ID de finca inválido' });
    }

    const deletedFinca = await fincaModel.deleteFinca(fincaId);
    if (!deletedFinca) {
      return res.status(404).json({ error: 'Finca no encontrada' });
    }

    return res.json({ message: 'Finca eliminada correctamente' });
  } catch (error) {
    console.error(error);
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar la finca porque tiene relaciones asociadas' });
    }
    return res.status(500).json({ error: 'Error eliminando la finca' });
  }
}
