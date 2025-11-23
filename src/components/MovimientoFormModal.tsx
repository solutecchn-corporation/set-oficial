import React, { useState, useEffect } from 'react'

type FormValues = { concepto: string; monto: number | ''; referencia?: string }

export default function MovimientoFormModal({ open, onClose, tipo, onSubmit }: { open: boolean, onClose: () => void, tipo: 'ingreso' | 'egreso', onSubmit: (v: FormValues) => void }) {
  const [form, setForm] = useState<FormValues>({ concepto: '', monto: '', referencia: '' })

  useEffect(() => {
    if (!open) setForm({ concepto: '', monto: '', referencia: '' })
  }, [open])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 13000 }}>
      <div style={{ width: 520, maxWidth: '96%', background: '#fff', borderRadius: 10, padding: 18, boxShadow: '0 12px 36px rgba(2,6,23,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{tipo === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo egreso'}</h3>
          <button onClick={onClose} className="btn-opaque" style={{ background: 'transparent' }}>Cerrar</button>
        </div>
        <p style={{ marginTop: 8, color: '#475569' }}>Complete los datos del movimiento. Fecha y usuario se guardan automáticamente.</p>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>Concepto</div>
            <input className="input" value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>Monto</div>
            <input className="input" type="number" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value === '' ? '' : Number(e.target.value) }))} />
          </label>
          <label style={{ gridColumn: '1 / -1', display: 'block' }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>Referencia (opcional)</div>
            <input className="input" value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} className="btn-opaque" style={{ background: 'transparent', color: '#0b1724', border: '1px solid rgba(16,24,40,0.06)' }}>Cancelar</button>
          <button onClick={() => {
            if (!form.concepto || form.monto === '' || Number(form.monto) <= 0) return alert('Complete concepto y monto válido')
            onSubmit(form)
          }} className="btn-opaque" style={{ background: tipo === 'ingreso' ? '#16a34a' : '#ef4444', color: 'white' }}>{tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}</button>
        </div>
      </div>
    </div>
  )
}
