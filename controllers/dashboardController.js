import * as dashboardModel from '../models/dashboardModel.js';

export async function getDashboardByFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    if (!Number.isInteger(fincaId) || fincaId <= 0) {
      return res.status(400).json({ error: 'ID de finca inválido' });
    }

    const dashboardData = await dashboardModel.findDashboardByFinca(fincaId);
    return res.json(dashboardData);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error obteniendo datos del dashboard' });
  }
}
