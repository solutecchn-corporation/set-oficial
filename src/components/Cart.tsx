import React from 'react'

type Producto = {
  id: string;
  sku?: string;
  nombre?: string;
  precio?: number;
}

type ItemCarrito = {
  producto: Producto;
  cantidad: number;
}

type Props = {
  carrito: ItemCarrito[]
  actualizarCantidad: (id: any, cambio: number) => void
  eliminarDelCarrito: (id: any) => void
  vaciarCarrito: () => void
  subtotal: number
  perItemTaxes: any[]
  taxRate: number
  tax18Rate: number
  taxTouristRate: number
  total: number
  openSelector: (mode: 'factura'|'cotizacion') => void
  btnStyle: React.CSSProperties
}

export default function Cart({ carrito, actualizarCantidad, eliminarDelCarrito, vaciarCarrito, subtotal, perItemTaxes, taxRate, tax18Rate, taxTouristRate, total, openSelector, btnStyle }: Props) {
  return (
    <div style={{
      background: 'white', borderRadius: 10, padding: 16,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', height: 'fit-content',
      position: 'sticky', top: 16, alignSelf: 'start'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Carrito ({carrito.length})</h3>
        {carrito.length > 0 && (
          <button onClick={vaciarCarrito} className="btn-opaque" style={{ background: 'transparent', color: '#2563eb', fontSize: '0.85rem', padding: '6px 8px' }}>
            Vaciar
          </button>
        )}
      </div>

      {carrito.length > 0 && (
        <div style={{ border: '2px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
            <span>Subtotal:</span>
            <span>L{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 500 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>ISV ({(taxRate*100)}%): <strong>L{(Number(perItemTaxes.reduce((s, it) => s + (it.isv || 0), 0))).toFixed(2)}</strong></div>
              <div>Impuesto 18%: <strong>L{(Number(perItemTaxes.reduce((s, it) => s + (it.imp18 || 0), 0))).toFixed(2)}</strong></div>
              <div>Impuesto turístico ({(taxTouristRate*100)}%): <strong>L{(Number(perItemTaxes.reduce((s, it) => s + (it.tur || 0), 0))).toFixed(2)}</strong></div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, marginTop: 8, color: '#1e293b' }}>
            <span>TOTAL:</span>
            <span>L{total.toFixed(2)}</span>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
            <div>Tax rates: ISV {(taxRate*100).toFixed(2)}%, 18% {(tax18Rate*100).toFixed(2)}%, Tur {(taxTouristRate*100).toFixed(2)}%</div>
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer' }}>Ver desglose por ítem</summary>
              <div style={{ marginTop: 8 }}>
                {perItemTaxes.map(it => (
                  <div key={String(it.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #eef2ff' }}>
                    <div style={{ color: '#0f172a' }}>{it.nombre} — L{it.price.toFixed(2)}</div>
                    <div style={{ color: '#0f172a' }}>ISV: L{it.isv.toFixed(2)} • 18%: L{it.imp18.toFixed(2)} • Tur: L{it.tur.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
            <button onClick={() => openSelector('cotizacion')} className="btn-opaque">Cotización</button>
            <button onClick={() => openSelector('factura')} className="btn-opaque">Facturar</button>
          </div>
        </div>
      )}

      {carrito.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontStyle: 'italic' }}>
          Carrito vacío
        </div>
      ) : (
        <div style={{ maxHeight: '40vh', overflowY: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
          {carrito.map(item => (
            <div key={item.producto.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px dashed #e2e8f0'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                  [{item.producto.sku}] {item.producto.nombre}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  L{(Number(item.producto.precio || 0)).toFixed(2)} c/u
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => actualizarCantidad(item.producto.id, -1)} style={btnStyle}>−</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>{item.cantidad}</span>
                <button onClick={() => actualizarCantidad(item.producto.id, 1)} style={btnStyle}>+</button>
                <button onClick={() => eliminarDelCarrito(item.producto.id)} style={{ ...btnStyle, background: '#ef4444' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
