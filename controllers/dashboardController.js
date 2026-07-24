const mockDashboard = {
  totalFincas: 2,
  cultivosEnProceso: 2,
  cultivosFinalizados: 1,
};

function buildSuccess(data, message = 'OK') {
  return { success: true, data, message };
}

export async function getDashboardByFinca(req, res) {
  return res.json(buildSuccess({ ...mockDashboard, fincaId: req.params.id }));
}
