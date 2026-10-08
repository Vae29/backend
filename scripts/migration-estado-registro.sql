-- Migration: Add estado_registro support to tables (replaces activo column)
-- This migration adds estado_registro, motivo_estado, fecha_cambio_estado, and usuario_cambio_estado columns

-- 1. FINCA TABLE: ACTIVO | ARCHIVADO
ALTER TABLE finca 
  ADD COLUMN estado_registro VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL CHECK (estado_registro IN ('ACTIVO', 'ARCHIVADO')),
  ADD COLUMN motivo_estado TEXT,
  ADD COLUMN fecha_cambio_estado TIMESTAMP,
  ADD COLUMN usuario_cambio_estado INTEGER;

-- Update existing data: convert activo to estado_registro
UPDATE finca SET estado_registro = CASE WHEN activo = TRUE THEN 'ACTIVO' ELSE 'ARCHIVADO' END;

-- 2. USUARIO TABLE: ACTIVO | DESACTIVADO  
ALTER TABLE usuario
  ADD COLUMN estado_registro VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL CHECK (estado_registro IN ('ACTIVO', 'DESACTIVADO')),
  ADD COLUMN motivo_estado TEXT,
  ADD COLUMN fecha_cambio_estado TIMESTAMP,
  ADD COLUMN usuario_cambio_estado INTEGER;

-- Update existing data: convert activo to estado_registro
UPDATE usuario SET estado_registro = CASE WHEN activo = TRUE THEN 'ACTIVO' ELSE 'DESACTIVADO' END;

-- 3. CULTIVO TABLE: ACTIVO | ARCHIVADO
ALTER TABLE cultivo
  ADD COLUMN estado_registro VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL CHECK (estado_registro IN ('ACTIVO', 'ARCHIVADO')),
  ADD COLUMN motivo_estado TEXT,
  ADD COLUMN fecha_cambio_estado TIMESTAMP,
  ADD COLUMN usuario_cambio_estado INTEGER;

-- Update existing data: convert activo to estado_registro
UPDATE cultivo SET estado_registro = CASE WHEN activo = TRUE THEN 'ACTIVO' ELSE 'ARCHIVADO' END;

-- 4. ETAPA_CULTIVO TABLE: ACTIVO | ANULADO
ALTER TABLE etapa_cultivo
  ADD COLUMN estado_registro VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL CHECK (estado_registro IN ('ACTIVO', 'ANULADO')),
  ADD COLUMN motivo_estado TEXT,
  ADD COLUMN fecha_cambio_estado TIMESTAMP,
  ADD COLUMN usuario_cambio_estado INTEGER;

-- Update existing data: convert activo to estado_registro
UPDATE etapa_cultivo SET estado_registro = CASE WHEN activo = TRUE THEN 'ACTIVO' ELSE 'ANULADO' END;

-- 5. COSECHA TABLE: ACTIVO | ANULADO (add soft delete support)
ALTER TABLE cosecha
  ADD COLUMN estado_registro VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL CHECK (estado_registro IN ('ACTIVO', 'ANULADO')),
  ADD COLUMN motivo_estado TEXT,
  ADD COLUMN fecha_cambio_estado TIMESTAMP,
  ADD COLUMN usuario_cambio_estado INTEGER;

-- 6. COSTO TABLE: ACTIVO | ANULADO (add soft delete support)
ALTER TABLE costo
  ADD COLUMN estado_registro VARCHAR(20) DEFAULT 'ACTIVO' NOT NULL CHECK (estado_registro IN ('ACTIVO', 'ANULADO')),
  ADD COLUMN motivo_estado TEXT,
  ADD COLUMN fecha_cambio_estado TIMESTAMP,
  ADD COLUMN usuario_cambio_estado INTEGER;

-- 7. Add foreign key constraints for usuario_cambio_estado
ALTER TABLE finca ADD CONSTRAINT fk_finca_usuario_cambio FOREIGN KEY (usuario_cambio_estado) REFERENCES usuario(id_usuario);
ALTER TABLE usuario ADD CONSTRAINT fk_usuario_cambio_usuario FOREIGN KEY (usuario_cambio_estado) REFERENCES usuario(id_usuario);
ALTER TABLE cultivo ADD CONSTRAINT fk_cultivo_usuario_cambio FOREIGN KEY (usuario_cambio_estado) REFERENCES usuario(id_usuario);
ALTER TABLE etapa_cultivo ADD CONSTRAINT fk_etapa_usuario_cambio FOREIGN KEY (usuario_cambio_estado) REFERENCES usuario(id_usuario);
ALTER TABLE cosecha ADD CONSTRAINT fk_cosecha_usuario_cambio FOREIGN KEY (usuario_cambio_estado) REFERENCES usuario(id_usuario);
ALTER TABLE costo ADD CONSTRAINT fk_costo_usuario_cambio FOREIGN KEY (usuario_cambio_estado) REFERENCES usuario(id_usuario);
