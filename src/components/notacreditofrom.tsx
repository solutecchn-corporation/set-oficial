import React, { useState } from 'react'
import supabase from '../lib/supabaseClient'

type Props = {
  open: boolean
  onClose: () => void
  cajeros: Array<{ id: number; username: string; nombre_usuario?: string }>
  availableCajeros?: Array<{ id: number; username: string; nombre_usuario?: string }>
  availableCajas?: number[]
  onCreated?: () => void
}

export default function Notacreditofrom({ open, onClose, cajeros, availableCajeros, availableCajas, onCreated }: Props) {
  const [cajeroId, setCajeroId] = useState<number | null>(null)
  const [cajeroUsername, setCajeroUsername] = useState<string | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [caja, setCaja] = useState<number | null>(null)
  const [caiValue, setCaiValue] = useState<string>('')
  const [rangoDe, setRangoDe] = useState<string>('')
  const [rangoHasta, setRangoHasta] = useState<string>('')
  const [fechaVenc, setFechaVenc] = useState<string>('')
  const [secuenciaActual, setSecuenciaActual] = useState<string | null>(null)
  const [identificador, setIdentificador] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleCreate() {
    const missing: string[] = []
    if (!caiValue) missing.push('CAI')
    if (!rangoDe) missing.push('Rango Desde')
    if (!rangoHasta) missing.push('Rango Hasta')
    if (!fechaVenc) missing.push('Fecha de Vencimiento')
    if (caja == null) missing.push('Caja')
    if (cajeroId == null && !cajeroUsername) missing.push('Cajero')
    if (missing.length > 0) {
      setError(`Campos obligatorios faltantes: ${missing.join(', ')}`)
      return
    }
    if (caja != null && (caja < 1 || caja > 5)) {
      setError('La caja debe estar entre 1 y 5')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: any = {
        cai: caiValue ?? null,
        identificador: identificador ?? null,
        rango_de: rangoDe ?? null,
        rango_hasta: rangoHasta ?? null,
        fecha_vencimiento: fechaVenc ?? null,
        secuencia_actual: secuenciaActual ?? null,
        caja: caja ?? null,
      }
      if (cajeroId != null) {
        const sel = cajeros.find(c => c.id === cajeroId)
        payload.cajero = sel ? sel.username : null
        payload.usuario_id = sel ? sel.id : null
      } else {
        payload.cajero = cajeroUsername ?? null
        payload.usuario_id = null
      }

      const res = await supabase.from('ncredito').insert(payload).select('id').maybeSingle()
      if ((res as any).error) throw (res as any).error
      if (onCreated) onCreated()
      onClose()
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: 720, maxWidth: '95%', background: '#fff', borderRadius: 8, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Crear CAI - Nota de crédito</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>CAI</label>
            <input className="input" value={caiValue} onChange={e => setCaiValue(e.target.value)} />
            <label style={{ display: 'block', marginTop: 8, marginBottom: 6 }}>Identificador</label>
            <input className="input" value={identificador} onChange={e => setIdentificador(e.target.value)} placeholder="Identificador (opcional)" />
            <label style={{ display: 'block', marginTop: 8, marginBottom: 6 }}>Rango Desde</label>
            <input className="input" value={rangoDe} onChange={e => setRangoDe(e.target.value)} />
            <label style={{ display: 'block', marginTop: 8, marginBottom: 6 }}>Rango Hasta</label>
            <input className="input" value={rangoHasta} onChange={e => setRangoHasta(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>Fecha de Vencimiento</label>
            <input className="input" type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} />

            <label style={{ display: 'block', marginTop: 8, marginBottom: 6 }}>Secuencia actual</label>
            <input className="input" value={secuenciaActual ?? ''} onChange={e => setSecuenciaActual(e.target.value === '' ? null : e.target.value)} placeholder="0" />

            <label style={{ display: 'block', marginTop: 12, marginBottom: 6 }}>Cajero</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="input"
                style={{ minHeight: 36, minWidth: 200 }}
                value={cajeroId != null ? String(cajeroId) : (isCustom ? '__custom__' : '')}
                onChange={e => {
                  const val = e.target.value
                  if (val === '') {
                    setCajeroId(null)
                    setCajeroUsername(null)
                    setIsCustom(false)
                  } else if (val === '__custom__') {
                    setCajeroId(null)
                    setIsCustom(true)
                  } else if (/^\d+$/.test(val)) {
                    setCajeroId(Number(val))
                    setCajeroUsername(null)
                    setIsCustom(false)
                  }
                }}
              >
                <option value="">-- sin asignar --</option>
                {(availableCajeros ?? cajeros).map(c => (
                  <option key={c.id} value={String(c.id)}>{c.username}{c.nombre_usuario ? ` — ${c.nombre_usuario}` : ''}</option>
                ))}
                <option value="__custom__">-- personalizado --</option>
              </select>
              {isCustom && (
                <input className="input" placeholder="Nombre de cajero" value={cajeroUsername ?? ''} onChange={e => { setCajeroUsername(e.target.value); setCajeroId(null) }} style={{ minHeight: 36 }} />
              )}

              <div style={{ marginLeft: 12 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>Caja</label>
                <select className="input" style={{ minHeight: 36, minWidth: 120 }} value={caja ?? '' as any} onChange={e => setCaja(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">-- sin asignar --</option>
                  {(availableCajas ?? [1,2,3,4,5]).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn-opaque" onClick={onClose} disabled={saving} style={{ width: 'auto' }}>Cancelar</button>
          <button className="btn-primary" onClick={handleCreate} disabled={saving} style={{ width: 'auto', padding: '8px 14px' }}>{saving ? 'Creando...' : 'Crear'}</button>
        </div>
      </div>
    </div>
  )
}
