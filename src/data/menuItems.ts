export const menuItems: any[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'datos', label: 'Datos de mi empresa' },
  {
    id: 'usuarios',
    label: 'Usuarios / Cajeros',
    children: [
      { id: 'usuarios_internal', label: 'Usuarios Cajeros' },
      { id: 'usuarios_web', label: 'Usuarios web (usuarios_web)' }
    ]
  },
  {
    id: 'factura',
    label: 'Factura y CAI',
    children: [
      { id: 'cai', label: 'Gestio de CAI por cajas' },
      { id: 'facturas', label: 'Facturas (ventas)' },
      { id: 'anulacion_factura', label: 'Anulación de factura' },
      { id: 'notas_credito', label: 'Notas de crédito' },
      { id: 'historial_facturas', label: 'Historial de facturas' },
      { id: 'impuestos', label: 'Impuestos' }
    ]
  },
  {
    id: 'inventario',
    label: 'Inventario',
    children: [
      { id: 'inventario_productos', label: 'Productos (Inventario)' },
      { id: 'registro_producto', label: 'Registro de producto' },
      { id: 'precios_productos', label: 'Precios de productos' },
      { id: 'precios_historico', label: 'Histórico de precios' },
      { id: 'stock', label: 'Stock' },
      { id: 'inventario_salidas', label: 'Movimiento de Inventario' },
      { id: 'inventario_categorias', label: 'Categorías / Marcas (opcional)' }
    ]
  },
  {
    id: 'compras',
    label: 'Compras y Proveedores',
    children: [
      { id: 'compras_main', label: 'Compras (compras)' },
      { id: 'compras_detalle', label: 'Detalle de Compras (Líneas)' },
      { id: 'proveedores', label: 'Proveedores (proveedores)' },
      { id: 'devoluciones_proveedores', label: 'Devolución a Proveedores' }
    ]
  },
  {
    id: 'cierres',
    label: 'Cierres de caja',
    children: [
      { id: 'caja_sesiones', label: 'Sesiones de caja (caja_sesiones)' },
      { id: 'caja_movimientos', label: 'Movimientos de caja (caja_movimientos)' }
    ]
  },
  {
    id: 'pedidos',
    label: 'Pedidos web / Ecommerce',
    children: [
      { id: 'pedidos_web', label: 'Pedidos web (pedidos_web)' },
      { id: 'pedidos_detalle', label: 'Detalle de pedidos (pedidos_web_detalle)' },
      { id: 'pagos_web', label: 'Pagos web (pagos_web)' }
    ]
  },
  {
    id: 'cotizaciones',
    label: 'Cotizaciones',
    children: [
      { id: 'cotizaciones', label: 'Cotizaciones (cotizaciones)' },
      { id: 'cotizaciones_detalle', label: 'Detalle de cotizaciones (cotizaciones_detalle)' }
    ]
  },
  {
    id: 'reportes',
    label: 'Reportes',
    children: [
      { id: 'rep_ventas', label: 'Ventas (ventas + ventas_detalle)' },
      { id: 'rep_devoluciones', label: 'Devoluciones (devoluciones_ventas)' },
      { id: 'rep_ingresos_egresos', label: 'Ingresos / Egresos (caja_movimientos)' },
      { id: 'rep_compras', label: 'Compras' },
      { id: 'rep_inventario', label: 'Inventario' },
      { id: 'rep_export', label: 'Exportar reportes generales (PDF / Excel)' }
    ]
  },
  {
    id: 'contaduria',
    label: 'Contaduría / Libro Diario',
    children: [
      { id: 'cuentas_contables', label: 'Cuentas contables (cuentas_contables)' },
      { id: 'libro_diario', label: 'Libro diario (libro_diario)' },
      { id: 'auditoria', label: 'Auditoría (auditoria)' }
    ]
  },
  { id: 'salir', label: 'Salir' }
]

export default menuItems
