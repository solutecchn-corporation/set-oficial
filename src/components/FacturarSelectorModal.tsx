import React from 'react'

type Props = {
  open: boolean
  onClose: () => void
  doFacturaClienteFinal: () => void
  doFacturaClienteNormal: () => void
  doFacturaClienteJuridico: () => void
  carritoLength: number
  subtotal: number
  taxRate: number
  taxableSubtotal: number
}

export default function FacturarSelectorModal({ open, onClose, doFacturaClienteFinal, doFacturaClienteNormal, doFacturaClienteJuridico, carritoLength, subtotal, taxRate, taxableSubtotal }: Props) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: 640, maxWidth: '95%', background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 18px 50px rgba(2,6,23,0.35)', display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Seleccionar tipo de cliente</h3>
            <button onClick={onClose} className="btn-opaque" style={{ padding: '6px 10px' }}>Cerrar</button>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div onClick={doFacturaClienteFinal} role="button" tabIndex={0} style={{ flex: 1, borderRadius: 10, padding: 14, cursor: 'pointer', boxShadow: '0 6px 18px rgba(2,6,23,0.08)', border: '1px solid #e6edf3', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>👤</div>
              <div style={{ fontWeight: 700 }}>Cliente Final</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>Consumidor final</div>
            </div>
            <div onClick={doFacturaClienteNormal} role="button" tabIndex={0} style={{ flex: 1, borderRadius: 10, padding: 14, cursor: 'pointer', boxShadow: '0 6px 18px rgba(2,6,23,0.08)', border: '1px solid #e6edf3', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>🏷️</div>
              <div style={{ fontWeight: 700 }}>Cliente Normal</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>Ingresar datos del cliente</div>
            </div>

            <div onClick={doFacturaClienteJuridico} role="button" tabIndex={0} style={{ flex: 1, borderRadius: 10, padding: 14, cursor: 'pointer', boxShadow: '0 6px 18px rgba(2,6,23,0.08)', border: '1px solid #e6edf3', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 28 }}>🏢</div>
              <div style={{ fontWeight: 700 }}>Cliente Jurídico</div>
              <div style={{ color: '#64748b', fontSize: 13 }}>Razón social / RTN</div>
            </div>
          </div>
        </div>

     
      </div>
    </div>
  )
}
