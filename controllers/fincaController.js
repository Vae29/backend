const mockFincas = [
  { id: 1, nombre: 'Finca Las Palmas', ubicacion: 'Palmira, Valle', activo: true, estado_registro: 'ACTIVO' },
  { id: 2, nombre: 'Finca El Sol', ubicacion: 'Cali, Valle', activo: true, estado_registro: 'ACTIVO' },
];

function buildSuccess(data, message = 'Operación exitosa') {
  return { success: true, data, message };
}

export async function getFincas(req, res) {
  return res.json(buildSuccess(mockFincas));
}

export async function createFinca(req, res) {
  const finca = { id: Date.now(), ...req.body, activo: true, estado_registro: 'ACTIVO' };
  mockFincas.push(finca);
  return res.status(201).json(buildSuccess(finca, 'Finca creada'));
}

export async function updateFinca(req, res) {
  const index = mockFincas.findIndex((item) => Number(item.id) === Number(req.params.id));
  if (index < 0) return res.status(404).json({ success: false, message: 'Finca no encontrada' });
  mockFincas[index] = { ...mockFincas[index], ...req.body };
  return res.json(buildSuccess(mockFincas[index], 'Finca actualizada'));
}

export async function deleteFinca(req, res) {
  const index = mockFincas.findIndex((item) => Number(item.id) === Number(req.params.id));
  if (index < 0) return res.status(404).json({ success: false, message: 'Finca no encontrada' });
  mockFincas[index] = { ...mockFincas[index], activo: false, estado_registro: 'ARCHIVADO' };
  return res.json(buildSuccess(mockFincas[index], 'Finca archivada'));
}

export async function changeFincaState(req, res) {
  return deleteFinca(req, res);
}
