function invalidDetails(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function normalizeMateriaPrimaDetails(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw invalidDetails('Agrega entre 1 y 100 salidas de Kardex al costo.');
  }

  const seen = new Set();
  return value.map((detail) => {
    const idKardex = Number(detail?.idKardex);
    const cantidad = Number(detail?.cantidad);

    if (!Number.isInteger(idKardex) || idKardex <= 0 || idKardex > 2147483647) {
      throw invalidDetails('Cada detalle debe identificar una salida válida de Kardex.');
    }
    if (
      !Number.isFinite(cantidad) ||
      cantidad <= 0 ||
      cantidad > 999999999999 ||
      Math.abs(cantidad - Math.round(cantidad * 1000000) / 1000000) > 1e-10
    ) {
      throw invalidDetails('Cada cantidad debe ser positiva y admitir hasta 6 decimales.');
    }
    if (seen.has(idKardex)) {
      throw invalidDetails('No repitas la misma salida de Kardex en un costo.');
    }

    seen.add(idKardex);
    return { idKardex, cantidad };
  });
}
