import React, { useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'

type Cotizacion = {
  id: number;
  cliente?: string;
  rtn?: string | null;
  subtotal?: number;
  isv?: number;
  impuesto_18?: number;
  impuesto_turistico?: number;
  total?: number;
  creada_en?: string;
  nota?: string | null;
  cliente_nombre?: string | null;
}

type CotizacionDetalle = {
  id?: number;
  cotizacion_id?: number;
  producto_id?: string | number;
  sku?: string | null;
  nombre?: string | null;
  cantidad?: number;
  precio_unitario?: number;
  subtotal?: number;
  isv?: number;
  impuesto_18?: number;
  impuesto_turistico?: number;
}

export default function CotizacionesGuardadas({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detalles, setDetalles] = useState<CotizacionDetalle[]>([])
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<Cotizacion | null>(null)

  const fetchRows = async () => {
    setLoading(true)
    try {
      // seleccionar columnas relevantes
      const { data, error } = await supabase.from('cotizaciones').select('id, cliente_id, usuario, fecha_cotizacion, numero_cotizacion, validez_dias, subtotal, impuesto, total, estado').order('fecha_cotizacion', { ascending: false })
      if (error) throw error
      const baseRows = Array.isArray(data) ? data as Cotizacion[] : []

      // resolver nombres de cliente para mostrar en la tabla
      const clienteIds = Array.from(new Set(baseRows.map(r => (r as any).cliente_id).filter(Boolean)))
      let clienteMap: Record<string, string> = {}
      if (clienteIds.length > 0) {
        try {
          const { data: clientsData } = await supabase.from('clientes').select('id,nombre').in('id', clienteIds)
          if (Array.isArray(clientsData)) {
            for (const c of clientsData) clienteMap[String((c as any).id)] = (c as any).nombre || ''
          }
        } catch (e) {
          console.warn('Error cargando nombres de clientes:', e)
        }
      }

      const enriched = baseRows.map(r => ({ ...r, cliente_nombre: clienteMap[String((r as any).cliente_id)] || null }))
      setRows(enriched)
    } catch (e) {
      console.warn('Error cargando cotizaciones:', e)
      setRows([])
    }
    setLoading(false)
  }

  useEffect(() => { fetchRows() }, [])

  const [viewHeader, setViewHeader] = useState<Cotizacion | null>(null)
  const [viewClientName, setViewClientName] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')

  const openView = async (id: number) => {
    setSelectedId(id)
    try {
      // fetch header and detalles
      const { data: hd, error: hErr } = await supabase.from('cotizaciones').select('id, cliente_id, usuario, fecha_cotizacion, numero_cotizacion, subtotal, impuesto, total, estado').eq('id', id).maybeSingle()
      if (hErr) console.warn('Error cargando cabecera de cotizacion', hErr)
      setViewHeader((hd as any) || null)

      if (hd && (hd as any).cliente_id) {
        try {
          const { data: cdata } = await supabase.from('clientes').select('id,nombre').eq('id', (hd as any).cliente_id).maybeSingle()
          setViewClientName((cdata as any)?.nombre || null)
        } catch (e) {
          setViewClientName(null)
        }
      } else {
        setViewClientName(null)
      }

      const { data, error } = await supabase.from('cotizaciones_detalle').select('*').eq('cotizacion_id', id)
      if (error) throw error
      setDetalles(Array.isArray(data) ? data as CotizacionDetalle[] : [])
      setViewOpen(true)
    } catch (e) {
      console.warn('Error cargando detalles de cotizacion', e)
      setDetalles([])
    }
  }

  const openEdit = async (row: Cotizacion) => {
    try {
      const { data, error } = await supabase.from('cotizaciones_detalle').select('*').eq('cotizacion_id', row.id)
      const detallesData = Array.isArray(data) ? data as CotizacionDetalle[] : []
      // store header + detalles in localStorage so PuntoDeVentas can load them
      const payload = { header: row, detalles: detallesData }
      try { localStorage.setItem('cotizacion_to_load', JSON.stringify(payload)) } catch (e) { console.warn('No se pudo escribir localStorage', e) }
      try {
        // also dispatch a window event so PuntoDeVentas can react immediately
        window.dispatchEvent(new CustomEvent('cotizacion:load', { detail: payload }))
      } catch (e) {
        // ignore
      }
      // return to PuntoDeVentas (onBack) to allow editing/adding products
      onBack()
    } catch (e) { console.warn('Error cargando detalles para editar', e) }
  }

  const deleteRow = async (id: number) => {
    if (!confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.')) return
    try {
      const { error: d1 } = await supabase.from('cotizaciones_detalle').delete().eq('cotizacion_id', id)
      if (d1) console.warn('Error eliminando detalles:', d1)
      const { error: d2 } = await supabase.from('cotizaciones').delete().eq('id', id)
      if (d2) throw d2
      fetchRows()
    } catch (e) {
      console.warn('Error eliminando cotizacion:', e)
    }
  }

  const saveEdit = async () => {
    if (!editRow) return
    try {
      // update cotizaciones
      const payload: any = {
        cliente: editRow.cliente || null,
        rtn: editRow.rtn || null,
        nota: editRow.nota || null,
        subtotal: Number(editRow.subtotal || 0),
        isv: Number(editRow.isv || 0),
        impuesto_18: Number(editRow.impuesto_18 || 0),
        impuesto_turistico: Number(editRow.impuesto_turistico || 0),
        total: Number(editRow.total || 0)
      }
      const { error: upErr } = await supabase.from('cotizaciones').update(payload).eq('id', editRow.id)
      if (upErr) console.warn('Error actualizando cotizacion:', upErr)

      // replace detalles: delete existing, insert current detalles state
      if (editRow.id) {
        const { error: delErr } = await supabase.from('cotizaciones_detalle').delete().eq('cotizacion_id', editRow.id)
        if (delErr) console.warn('Error borrando detalles antiguos:', delErr)
        const detallesToInsert = detalles.map(d => ({ ...d, cotizacion_id: editRow.id }))
        const { error: insErr } = await supabase.from('cotizaciones_detalle').insert(detallesToInsert)
        if (insErr) console.warn('Error insertando detalles actualizados:', insErr)
      }
      setEditOpen(false)
      fetchRows()
    } catch (e) {
      console.warn('Error guardando cotizacion editada:', e)
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '24px auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Cotizaciones Guardadas</h2>
        <div>
          <button onClick={fetchRows} className="btn-opaque" style={{ marginRight: 8 }}>Refrescar</button>
          <button onClick={onBack} className="btn-opaque">Volver</button>
        </div>
      </header>

      <section style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 6px rgba(2,6,23,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ color: '#475569', fontSize: 14 }}>Buscar:</label>
            <input placeholder="Número o cliente" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #e6edf3', minWidth: 240 }} />
            <button onClick={() => setSearchTerm('')} className="btn-opaque" style={{ marginLeft: 6 }}>Limpiar</button>
          </div>
        </div>

        {loading ? (
          <div>Cargando...</div>
        ) : rows.length === 0 ? (
          <div style={{ color: '#64748b' }}>No hay cotizaciones guardadas.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e6edf3' }}>
                <th style={{ padding: 8 }}>Número</th>
                <th style={{ padding: 8 }}>Fecha</th>
                <th style={{ padding: 8 }}>Usuario</th>
                <th style={{ padding: 8 }}>Cliente ID</th>
                <th style={{ padding: 8 }}>Total</th>
                <th style={{ padding: 8 }}>Estado</th>
                <th style={{ padding: 8 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(r => {
                  if (!searchTerm) return true
                  const s = searchTerm.toLowerCase()
                  const num = (r.numero_cotizacion || '').toLowerCase()
                  const client = ((r as any).cliente_nombre || '')?.toLowerCase()
                  const usuario = (r.usuario || '').toLowerCase()
                  return num.includes(s) || client.includes(s) || usuario.includes(s)
                })
                .map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{r.numero_cotizacion || ''}</td>
                  <td style={{ padding: 8 }}>{r.fecha_cotizacion ? new Date(r.fecha_cotizacion).toLocaleString() : ''}</td>
                  <td style={{ padding: 8 }}>{r.usuario || ''}</td>
                  <td style={{ padding: 8 }}>{(r as any).cliente_nombre || ((r as any).cliente_id ? String((r as any).cliente_id) : '')}</td>
                  <td style={{ padding: 8 }}>L {Number(r.total || 0).toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{r.estado || ''}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => openView(r.id)} className="btn-opaque" style={{ marginRight: 6 }}>Ver</button>
                    {String(r.estado || '').toLowerCase() === 'aceptada' ? (
                      <button className="btn-opaque" style={{ marginRight: 6, opacity: 0.6, cursor: 'not-allowed' }} disabled title="No se puede editar una cotización aceptada">Editar</button>
                    ) : (
                      <button onClick={() => openEdit(r)} className="btn-opaque" style={{ marginRight: 6 }}>Editar</button>
                    )}
                    <button onClick={() => deleteRow(r.id)} className="btn-opaque" style={{ background: '#ef4444', color: 'white' }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Modal Ver */}
      {viewOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 880, maxWidth: '95%', background: 'white', borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Detalle de Cotización #{selectedId}</h3>
              <button onClick={() => { setViewOpen(false); setDetalles([]); setSelectedId(null) }} className="btn-opaque">Cerrar</button>
            </div>
            <div style={{ marginTop: 12 }}>
              {viewHeader && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div><strong>Número:</strong> {viewHeader.numero_cotizacion}</div>
                    <div><strong>Fecha:</strong> {viewHeader.fecha_cotizacion ? new Date(viewHeader.fecha_cotizacion).toLocaleString() : ''}</div>
                    <div><strong>Usuario:</strong> {viewHeader.usuario}</div>
                    <div><strong>Cliente:</strong> {viewClientName ?? (viewHeader.cliente_id ? String((viewHeader as any).cliente_id) : 'C/F')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div><strong>Subtotal:</strong> L {Number(viewHeader.subtotal || 0).toFixed(2)}</div>
                    <div><strong>Impuesto:</strong> L {Number(viewHeader.impuesto || 0).toFixed(2)}</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800 }}><strong>Total:</strong> L {Number(viewHeader.total || 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e6edf3' }}>
                    <th style={{ padding: 8 }}>Descripción</th>
                    <th style={{ padding: 8 }}>Cantidad</th>
                    <th style={{ padding: 8 }}>Precio U.</th>
                    <th style={{ padding: 8 }}>Subtotal</th>
                    <th style={{ padding: 8 }}>Descuento</th>
                    <th style={{ padding: 8 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((d, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: 8 }}>{d.descripcion}</td>
                      <td style={{ padding: 8 }}>{d.cantidad}</td>
                      <td style={{ padding: 8 }}>L {Number(d.precio_unitario || 0).toFixed(2)}</td>
                      <td style={{ padding: 8 }}>L {Number(d.subtotal || ((d.precio_unitario || 0) * (d.cantidad || 0))).toFixed(2)}</td>
                      <td style={{ padding: 8 }}>L {Number(d.descuento || 0).toFixed(2)}</td>
                      <td style={{ padding: 8 }}>L {Number(d.total || ((d.subtotal || 0) - (d.descuento || 0))).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editOpen && editRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 880, maxWidth: '95%', background: 'white', borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Editar Cotización #{editRow.id}</h3>
              <button onClick={() => { setEditOpen(false); setDetalles([]); setEditRow(null) }} className="btn-opaque">Cerrar</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label>Cliente</label>
                  <input value={editRow.cliente || ''} onChange={e => setEditRow({ ...editRow, cliente: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6edf3' }} />
                </div>
                <div>
                  <label>RTN</label>
                  <input value={editRow.rtn || ''} onChange={e => setEditRow({ ...editRow, rtn: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6edf3' }} />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e6edf3' }}>
                      <th style={{ padding: 8 }}>SKU</th>
                      <th style={{ padding: 8 }}>Nombre</th>
                      <th style={{ padding: 8 }}>Cantidad</th>
                      <th style={{ padding: 8 }}>Precio</th>
                      <th style={{ padding: 8 }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((d, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: 8 }}>{d.sku}</td>
                        <td style={{ padding: 8 }}>{d.nombre}</td>
                        <td style={{ padding: 8 }}><input type="number" value={d.cantidad || 0} onChange={e => { const v = Number(e.target.value || 0); const copy = [...detalles]; copy[idx] = { ...copy[idx], cantidad: v }; setDetalles(copy) }} style={{ width: 80, padding: 6 }} /></td>
                        <td style={{ padding: 8 }}><input type="number" value={d.precio_unitario || 0} onChange={e => { const v = Number(e.target.value || 0); const copy = [...detalles]; copy[idx] = { ...copy[idx], precio_unitario: v }; setDetalles(copy) }} style={{ width: 120, padding: 6 }} /></td>
                        <td style={{ padding: 8 }}>L {Number((d.precio_unitario || 0) * (d.cantidad || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button onClick={() => { setEditOpen(false); setDetalles([]); setEditRow(null) }} className="btn-opaque" style={{ background: 'transparent' }}>Cancelar</button>
                <button onClick={saveEdit} className="btn-opaque" style={{ background: '#2563eb', color: 'white' }}>Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
