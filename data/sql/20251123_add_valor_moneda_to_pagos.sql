-- Migration: Añadir columna `valor_moneda` a la tabla `pagos`
-- Fecha: 2025-11-23
-- Agrega `valor_moneda` (text) para registrar la equivalencia de la moneda usada.

-- IMPORTANTE: hacer backup antes de ejecutar en producción.

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS valor_moneda text;

-- Opcional: rollback manual
-- ALTER TABLE pagos DROP COLUMN IF EXISTS valor_moneda;
