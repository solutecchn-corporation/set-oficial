-- Migration: Añadir columnas de usuario a la tabla `pagos`
-- Fecha: 2025-11-23
-- Agrega `usuario_id` (integer) y `usuario_nombre` (text) e índice opcional.

-- IMPORTANTE: hacer backup antes de ejecutar en producción.

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS usuario_id integer;

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS usuario_nombre text;

CREATE INDEX IF NOT EXISTS idx_pagos_usuario_id ON pagos(usuario_id);

-- Opcional: si quieres un rollback simple (manual), puedes ejecutar:
-- ALTER TABLE pagos DROP COLUMN IF EXISTS usuario_nombre;
-- ALTER TABLE pagos DROP COLUMN IF EXISTS usuario_id;
-- DROP INDEX IF EXISTS idx_pagos_usuario_id;

-- Nota: este script agrega `usuario_id` como integer. Si en tu aplicación
-- los IDs de usuario son UUID, deberías cambiar el tipo a `uuid` o
-- adaptar el frontend para enviar IDs numéricos.
