const records = [
  { id: 29, estado_registro: 'ANULADO', valor: '8000.00' },
  { id: 28, estado_registro: 'ANULADO', valor: '80000.00' },
  { id: 30, estado_registro: 'ACTIVO', valor: '9000.00' },
];

function getRegistroEstado(item) {
  if (!item || typeof item !== 'object') return null
  const raw = item.estado_registro ?? item.estadoRegistro ?? item.estado ?? (item.activo !== undefined ? (item.activo ? 'ACTIVO' : 'ANULADO') : null)
  if (raw == null) return null
  const s = String(raw).trim().toUpperCase()
  if (s === '1' || s === 'TRUE' || s === 'T') return 'ACTIVO'
  if (s === '0' || s === 'FALSE' || s === 'F') return 'ANULADO'
  if (s === 'ACTIVO' || s === 'ANULADO') return s
  return s
}

console.log('All:', records.map(r=>({id:r.id, estado:getRegistroEstado(r)})));
console.log('ACTIVO:', records.filter(r=>getRegistroEstado(r)==='ACTIVO').map(r=>r.id));
console.log('ANULADO:', records.filter(r=>getRegistroEstado(r)==='ANULADO').map(r=>r.id));
