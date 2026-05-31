-- Agrega la columna activo a la tabla finca para manejar soft delete.
ALTER TABLE finca
  ADD COLUMN activo BOOLEAN DEFAULT TRUE NOT NULL;

-- Asegura que todas las fincas existentes se consideren activas.
UPDATE finca SET activo = TRUE WHERE activo IS NULL;
