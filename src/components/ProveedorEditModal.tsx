import React, { useEffect, useState } from 'react'

type ProveedorRow = {
  id: number | string
  nombre: string
  rtn?: string
  telefono?: string
  correo?: string
  direccion?: string
  tipo_proveedor?: string
  activo?: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  row: ProveedorRow | null
  onSave: (id: number | string, payload: { nombre?: string; rtn?: string; telefono?: string; correo?: string; direccion?: string; tipo_proveedor?: string; activo?: boolean }) => Promise<void>
}

export default function ProveedorEditModal({ open, onClose, row, onSave }: Props) {
  const [nombre, setNombre] = useState('')
  const [rtn, setRtn] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [direccion, setDireccion] = useState('')
  const [tipo, setTipo] = useState('')
  const [activo, setActivo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setNombre(row.nombre || '')
    setRtn(row.rtn || '')
    setTelefono(row.telefono || '')
    setCorreo(row.correo || '')
    setDireccion(row.direccion || '')
    setTipo(row.tipo_proveedor || '')
    setActivo(row.activo ?? true)
    setError(null)
  }, [open, row])

  if (!open || !row) return null

  async function handleSave() {
    if (!row) {
      setError('No hay fila seleccionada')
      return
    }
    const missing: string[] = []
    if (!nombre.trim()) missing.push('Nombre')
    if (missing.length) { setError(`Faltan campos: ${missing.join(', ')}`); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(row.id, { nombre: nombre.trim(), rtn: rtn.trim() || undefined, telefono: telefono.trim() || undefined, correo: correo.trim() || undefined, direccion: direccion.trim() || undefined, tipo_proveedor: tipo || undefined, activo })
      onClose()
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: 680, maxWidth: '95%', background: '#fff', borderRadius: 8, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Editar proveedor — ID {String(row.id)}</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 13 }}>Nombre</label>
          <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />

          <label style={{ fontSize: 13 }}>RTN</label>
          <input className="input" value={rtn} onChange={e => setRtn(e.target.value)} />

          <label style={{ fontSize: 13 }}>Teléfono</label>
          <input className="input" value={telefono} onChange={e => setTelefono(e.target.value)} />

          <label style={{ fontSize: 13 }}>Correo</label>
          <input className="input" value={correo} onChange={e => setCorreo(e.target.value)} />

          <label style={{ fontSize: 13 }}>Dirección</label>
          <input className="input" value={direccion} onChange={e => setDireccion(e.target.value)} />

          <label style={{ fontSize: 13 }}>Tipo</label>
          <input className="input" value={tipo} onChange={e => setTipo(e.target.value)} placeholder="local / internacional" />

          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />{' '}
            Activo
          </label>
        </div>

        {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn-opaque" onClick={onClose} disabled={saving} style={{ width: 'auto' }}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: 'auto', padding: '8px 14px' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
