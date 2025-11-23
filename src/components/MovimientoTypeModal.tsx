import React from 'react'

export default function MovimientoTypeModal({ open, onClose, onSelect }: { open: boolean, onClose: () => void, onSelect: (t: 'ingreso' | 'egreso') => void }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12000 }}>
      <div style={{ width: 420, maxWidth: '96%', background: '#fff', borderRadius: 10, padding: 18, boxShadow: '0 12px 36px rgba(2,6,23,0.2)' }}>
        <h3 style={{ marginTop: 0 }}>¿Qué tipo de movimiento?</h3>
        <p style={{ marginTop: 6, color: '#475569' }}>Seleccione si este movimiento es un ingreso o un egreso.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-opaque" style={{ background: 'transparent', color: '#0b1724', border: '1px solid rgba(16,24,40,0.06)' }}>Cancelar</button>
          <button onClick={() => onSelect('egreso')} className="btn-opaque" style={{ background: '#ef4444', color: 'white' }}>Egreso</button>
          <button onClick={() => onSelect('ingreso')} className="btn-opaque" style={{ background: '#16a34a', color: 'white' }}>Ingreso</button>
        </div>
      </div>
    </div>
  )
}
