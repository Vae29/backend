import * as dashboardModel from '../models/dashboardModel.js';

export async function getDashboardByFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    if (!Number.isInteger(fincaId) || fincaId <= 0) {
      return res.status(400).json({ error: 'ID de finca inválido' });
    }

    const month = req.query.month !== undefined ? Number(req.query.month) : null;
    const year = req.query.year !== undefined ? Number(req.query.year) : null;

    if (req.query.month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      return res.status(400).json({ error: 'Mes inválido para el filtro del dashboard' });
    }

    if (req.query.year !== undefined && (!Number.isInteger(year) || year < 1900)) {
      return res.status(400).json({ error: 'Año inválido para el filtro del dashboard' });
    }

    const dashboardData = await dashboardModel.findDashboardByFinca(fincaId, {
      month: month || null,
      year: year || null,
    });
    return res.json(dashboardData);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error obteniendo datos del dashboard' });
  }
}
