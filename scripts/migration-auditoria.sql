-- Ejecutar después de crear la tabla usuario.
-- Registro inmutable de acciones relevantes del sistema.
CREATE TABLE IF NOT EXISTS auditoria (
    id_auditoria SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL,
    descripcion TEXT,
    tabla_afectada VARCHAR(50),
    registro_id INTEGER,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_usuario VARCHAR(45),
    navegador TEXT,
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuario(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo_accion ON auditoria (modulo, accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON auditoria (tabla_afectada, registro_id);

COMMENT ON TABLE auditoria IS 'Bitácora de acciones relevantes realizadas por usuarios. No almacenar contraseñas, tokens ni códigos de recuperación.';
