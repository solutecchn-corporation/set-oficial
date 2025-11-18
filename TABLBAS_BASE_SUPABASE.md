CREATE TABLE pagos_web (
    id SERIAL PRIMARY KEY,
    pedido_id UUID NOT NULL,
    metodo_pago TEXT NOT NULL,               -- tarjeta, transferencia, efectivo
    monto NUMERIC(14,2) NOT NULL,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagado','rechazado')),
    fecha_pago TIMESTAMP DEFAULT NOW(),
    referencia TEXT,
    FOREIGN KEY (pedido_id) REFERENCES pedidos_web(id)
);
CREATE TABLE pedidos_web_detalle (
    id SERIAL PRIMARY KEY,
    pedido_id UUID NOT NULL,                 -- referencia a pedidos_web.id
    producto_id UUID NOT NULL,               -- referencia a inventario.id
    cantidad NUMERIC(10,2) NOT NULL,
    precio_unitario NUMERIC(14,2) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    descuento NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos_web(id),
    FOREIGN KEY (producto_id) REFERENCES inventario(id)
);
CREATE TABLE pedidos_web (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL,                -- referencia a usuarios_web.id
    fecha_pedido TIMESTAMP DEFAULT NOW(),
    subtotal NUMERIC(14,2) DEFAULT 0,
    impuesto NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) DEFAULT 0,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagado','cancelado','enviado')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios_web(id)
);
CREATE TABLE carrito_compras (
    id SERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL,                -- referencia a usuarios_web.id
    producto_id UUID NOT NULL,               -- referencia a inventario.id
    cantidad NUMERIC(10,2) NOT NULL,
    precio_unitario NUMERIC(14,2) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    fecha_agregado TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (usuario_id) REFERENCES usuarios_web(id),
    FOREIGN KEY (producto_id) REFERENCES inventario(id)
);
CREATE TABLE usuarios_web (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,                 -- almacenar hasheado
    telefono TEXT,
    direccion TEXT,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    estado TEXT DEFAULT 'activo'           -- activo, inactivo
);
CREATE TABLE cotizaciones_detalle (
    id SERIAL PRIMARY KEY,
    cotizacion_id UUID NOT NULL,         -- referencia a cotizaciones.id
    producto_id UUID,                     -- referencia a inventario.id (opcional)
    descripcion TEXT NOT NULL,            -- detalle del producto o servicio
    cantidad NUMERIC(10,2) NOT NULL,
    precio_unitario NUMERIC(14,2) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    descuento NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) NOT NULL,
    FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id),
    FOREIGN KEY (producto_id) REFERENCES inventario(id)
);
CREATE TABLE cotizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id INTEGER,                  -- referencia a clientes.id
    usuario TEXT NOT NULL,               -- quien genera la cotización
    fecha_cotizacion TIMESTAMP DEFAULT NOW(),
    numero_cotizacion TEXT UNIQUE,
    validez_dias INTEGER DEFAULT 30,    -- días de validez de la cotización
    subtotal NUMERIC(14,2) DEFAULT 0,
    impuesto NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) DEFAULT 0,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','rechazada')),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);
CREATE TABLE caja_sesiones (
    id SERIAL PRIMARY KEY,
    usuario TEXT NOT NULL,                -- cajero o encargado de la caja
    fecha_apertura TIMESTAMP DEFAULT NOW(),
    monto_inicial NUMERIC(14,2) NOT NULL,
    total_ingresos NUMERIC(14,2) DEFAULT 0,
    total_egresos NUMERIC(14,2) DEFAULT 0,
    saldo_final NUMERIC(14,2),           -- se calcula al cierre
    fecha_cierre TIMESTAMP,
    estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada'))
);
CREATE TABLE caja_movimientos (
    id SERIAL PRIMARY KEY,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('ingreso','egreso')), 
    monto NUMERIC(14,2) NOT NULL,
    concepto TEXT NOT NULL,                -- descripción del movimiento
    referencia TEXT,                        -- factura, nota, pago, etc.
    usuario TEXT NOT NULL,                  -- quien registró el movimiento
    fecha TIMESTAMP DEFAULT NOW()
);
CREATE TABLE devoluciones_ventas (
    id SERIAL PRIMARY KEY,
    venta_id UUID NOT NULL,               -- referencia a la venta original
    producto_id UUID NOT NULL,            -- producto devuelto
    cantidad NUMERIC(10,2) NOT NULL,
    motivo TEXT,                          -- motivo de la devolución
    fecha_devolucion TIMESTAMP DEFAULT NOW(),
    usuario TEXT NOT NULL,                -- quien registró la devolución
    tipo_devolucion TEXT CHECK (tipo_devolucion IN ('credito','efectivo')) DEFAULT 'credito',
    FOREIGN KEY (venta_id) REFERENCES ventas(id),
    FOREIGN KEY (producto_id) REFERENCES inventario(id)
);
CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    tabla TEXT NOT NULL,                  -- nombre de la tabla afectada
    registro_id UUID,                      -- id del registro afectado
    accion TEXT NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')), 
    usuario TEXT NOT NULL,                -- quien realizó la acción
    fecha TIMESTAMP DEFAULT NOW(),
    datos_anteriores JSONB,               -- valores antes del cambio (para UPDATE/DELETE)
    datos_nuevos JSONB                    -- valores después del cambio (para INSERT/UPDATE)
);
CREATE TABLE cuentas_contables (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,        -- código de la cuenta (ej. 1101, 2102)
    nombre TEXT NOT NULL,               -- nombre de la cuenta (ej. Caja, Bancos)
    tipo TEXT NOT NULL CHECK (tipo IN ('activo','pasivo','patrimonio','ingreso','gasto')),
    descripcion TEXT,                   -- descripción opcional
    cuenta_padre_id INTEGER,            -- para jerarquía de cuentas
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (cuenta_padre_id) REFERENCES cuentas_contables(id)
);
CREATE TABLE libro_diario (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    cuenta TEXT NOT NULL,          -- nombre o código de la cuenta contable
    descripcion TEXT,              -- detalle del movimiento
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('debe', 'haber')),
    monto NUMERIC(14,2) NOT NULL,
    referencia TEXT,               -- factura, compra, nota, etc.
    usuario TEXT                   -- quien registró el asiento
);
CREATE TABLE ventas_detalle (
    id SERIAL PRIMARY KEY,
    venta_id UUID NOT NULL,                 -- referencia a ventas.id
    producto_id UUID NOT NULL,              -- referencia a inventario.id
    cantidad NUMERIC(10,2) NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,       -- ahora es simple, el front calcula
    descuento NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,          -- ahora es simple, el front calcula
    FOREIGN KEY (venta_id) REFERENCES ventas(id),
    FOREIGN KEY (producto_id) REFERENCES inventario(id)
);
CREATE TABLE ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id INTEGER,                     -- referencia a clientes.id
    usuario TEXT NOT NULL,                  -- quien realizó la venta
    fecha_venta TIMESTAMP DEFAULT NOW(),
    numero_factura TEXT UNIQUE,
    tipo_pago TEXT,                         -- efectivo, tarjeta, transferencia
    subtotal NUMERIC(10,2) DEFAULT 0,
    impuesto NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) DEFAULT 0,
    estado TEXT DEFAULT 'pagada',           -- pagada, anulada, pendiente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);
CREATE TABLE salidas_inventario (
    id SERIAL PRIMARY KEY,
    producto_id UUID NOT NULL,           -- debe coincidir con inventario.id
    cantidad NUMERIC(10,2) NOT NULL,
    tipo_salida TEXT NOT NULL,           -- ejemplo: 'venta', 'ajuste', 'donacion'
    referencia TEXT,                     -- factura, nota, o motivo
    usuario TEXT,                        -- quien realizó la salida
    fecha_salida TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (producto_id) REFERENCES inventario(id)
);
CREATE TABLE compras (
    id SERIAL PRIMARY KEY,
    proveedor_id INTEGER NOT NULL,
    fecha_compra TIMESTAMP DEFAULT NOW(),
    numero_documento TEXT,          
    tipo_documento TEXT,            
    subtotal NUMERIC(10,2) DEFAULT 0,
    impuesto NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) DEFAULT 0,
    usuario TEXT,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores (id)
);

CREATE TABLE compras_detalle (
    id SERIAL PRIMARY KEY,
    compra_id INTEGER NOT NULL,
    producto_id UUID NOT NULL,               -- cambiado a UUID
    cantidad NUMERIC(10,2) NOT NULL,
    costo_unitario NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
    FOREIGN KEY (compra_id) REFERENCES compras (id),
    FOREIGN KEY (producto_id) REFERENCES inventario (id)
);
CREATE TABLE proveedores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    rtn TEXT,
    telefono TEXT,
    correo TEXT,
    direccion TEXT,
    tipo_proveedor TEXT CHECK (tipo_proveedor IN ('juridico', 'natural')),
    activo BOOLEAN DEFAULT TRUE
);
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    rtn TEXT,
    telefono TEXT,
    tipo_cliente TEXT CHECK (tipo_cliente IN ('juridico', 'natural')),
    correo_electronico TEXT,
    exonerado BOOLEAN DEFAULT FALSE
);
CREATE TABLE cai (
    id SERIAL PRIMARY KEY,
    cajero TEXT NOT NULL,
    cai TEXT NOT NULL,
    rango_de TEXT NOT NULL,
    rango_hasta TEXT NOT NULL,
    fecha_vencimiento DATE NOT NULL
);
CREATE TABLE empresa (
    id SERIAL PRIMARY KEY,
    rtn TEXT NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    logo TEXT
);
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);
CREATE TABLE Inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    codigo_barras TEXT,
    categoria_id INTEGER,
    marca_id INTEGER,
    descripcion TEXT,
    modelo TEXT,
    publicacion_web BOOLEAN DEFAULT FALSE,
    exento BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT NOW()
);
