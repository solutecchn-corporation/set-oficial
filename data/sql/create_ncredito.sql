-- Create table for Notas de crédito
CREATE TABLE ncredito (
  id bigserial PRIMARY KEY,
  cai text,
  identificador text,
  rango_de text,
  rango_hasta text,
  fecha_vencimiento timestamptz,
  secuencia_actual text,
  caja integer,
  cajero text,
  usuario_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Índices útiles
CREATE INDEX idx_ncredito_usuario ON ncredito (usuario_id);
CREATE INDEX idx_ncredito_caja ON ncredito (caja);
