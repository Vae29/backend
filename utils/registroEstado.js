const ACTIVE_STATES = new Set(['1', 'TRUE', 'T', 'ACTIVO']);
const INACTIVE_STATES = new Set([
  '0',
  'FALSE',
  'F',
  'ANULADO',
  'ARCHIVADO',
  'DESACTIVADO',
  'INACTIVO',
]);

export function toDatabaseRegistroState(state) {
  const normalized = String(state ?? '').trim().toUpperCase();
  if (ACTIVE_STATES.has(normalized)) return 1;
  if (INACTIVE_STATES.has(normalized)) return 0;
  throw new TypeError(`Estado de registro no válido: ${state}`);
}
