import React, { useEffect, useState } from 'react'
import supabase from '../../lib/supabaseClient'
import { hondurasNowISO } from '../../lib/useHondurasTime'

type Producto = { id: string; nombre?: string; sku?: string }
type Proveedor = { id: number | string; nombre?: string }
type LineItem = { producto_id: string; nombre?: string; cantidad: number; costo_unitario?: number }

type Devolucion = { id: number | string; proveedor_id?: string | number; numero_documento?: string; usuario?: string; fecha?: string }

export default function DevolucionesProveedores() {
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [openCreate, setOpenCreate] = useState(false)
  const [openDetail, setOpenDetail] = useState<number | string | null>(null)

  async function loadDevoluciones() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.from('devoluciones_proveedores').select('id, proveedor_id, numero_documento, usuario, created_at').order('created_at', { ascending: false })
      if (error) throw error
      setDevoluciones(Array.isArray(data) ? data.map((d: any) => ({ id: d.id, proveedor_id: d.proveedor_id, numero_documento: d.numero_documento, usuario: d.usuario, fecha: d.created_at })) : [])
    } catch (err: any) {
      setError(err?.message || String(err))
      setDevoluciones([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDevoluciones() }, [])

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>Devolución a Proveedores</h2>
      <p style={{ color: '#475569' }}>Registra devoluciones de productos hacia proveedores. Este proceso creará un registro de devolución y registrará la salida en `registro_de_inventario`.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn-primary" onClick={() => setOpenCreate(true)}>Nueva devolución</button>
        <div style={{ marginLeft: 'auto', color: '#64748b' }}>{loading ? 'Cargando...' : `${devoluciones.length} devoluciones`}</div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}

      <div style={{ background: '#fff', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Proveedor</th><th>Documento</th><th>Usuario</th><th>Fecha</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {devoluciones.map(d => (
              <tr key={String(d.id)}>
                <td style={{ width: 80 }}>{String(d.id)}</td>
                <td>{String(d.proveedor_id || '')}</td>
                <td>{d.numero_documento || ''}</td>
                <td>{d.usuario || ''}</td>
                <td>{d.fecha || ''}</td>
                <td>
                  <button className="btn-opaque" onClick={() => setOpenDetail(d.id)}>Detalle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openCreate && <DevolucionCreateModal onClose={() => { setOpenCreate(false); loadDevoluciones() }} />}
      {openDetail && <DevolucionDetailModal id={openDetail} onClose={() => { setOpenDetail(null); loadDevoluciones() }} />}
    </div>
  )
}

function DevolucionCreateModal({ onClose }: { onClose: () => void }) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [compraId, setCompraId] = useState<number | null>(null)
  const [compraProductos, setCompraProductos] = useState<any[]>([])
  const [proveedorId, setProveedorId] = useState<number | string | null>(null)
  const [proveedorNombre, setProveedorNombre] = useState<string | null>(null)
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [selectedProducto, setSelectedProducto] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState<number>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const p = await supabase.from('proveedores').select('id, nombre').order('nombre', { ascending: true })
        setProveedores(Array.isArray(p.data) ? p.data : [])
      } catch (e) {
        // ignore
      }
      try {
        const r = await supabase.from('inventario').select('id, nombre, sku').order('nombre', { ascending: true })
        setProductos(Array.isArray(r.data) ? r.data : [])
      } catch (e) {
        // ignore
      }
    })()
  }, [])

  // Load compra by numero_documento and its detalles, compute available qty considering previous devoluciones
  async function loadCompraByNumero() {
    if (!numeroDocumento) return
    setError(null)
    try {
      const { data: compraData, error: compraErr } = await supabase.from('compras').select('id, proveedor_id, numero_documento').eq('numero_documento', numeroDocumento).limit(1).single()
      if (compraErr) throw compraErr
      if (!compraData) { setError('No se encontró compra con ese número de documento'); return }
      setCompraId(compraData.id)
      setProveedorId(compraData.proveedor_id)
      try {
        const { data: provRow } = await supabase.from('proveedores').select('id, nombre').eq('id', compraData.proveedor_id).limit(1).single()
        if (provRow && provRow.nombre) setProveedorNombre(provRow.nombre)
      } catch (e) {
        // ignore
      }

      // load detalles de compra
      const { data: detalles } = await supabase.from('compras_detalle').select('producto_id, cantidad, costo_unitario').eq('compra_id', compraData.id)
      const detallesArr = Array.isArray(detalles) ? detalles : []

      // get devoluciones existentes with same numero_documento
      const { data: devs } = await supabase.from('devoluciones_proveedores').select('id').eq('numero_documento', numeroDocumento)
      const devIds = Array.isArray(devs) ? devs.map((d: any) => d.id) : []
      let returnedMap: Record<string, number> = {}
      if (devIds.length > 0) {
        const { data: detDev } = await supabase.from('devoluciones_proveedores_detalle').select('producto_id, cantidad').in('devolucion_id', devIds)
        if (Array.isArray(detDev)) {
          detDev.forEach((r: any) => {
            const pid = String(r.producto_id)
            returnedMap[pid] = (returnedMap[pid] || 0) + Number(r.cantidad)
          })
        }
      }

      // resolve product names
      const prodIds = detallesArr.map((d: any) => d.producto_id)
      const { data: prods } = await supabase.from('inventario').select('id, nombre, sku').in('id', prodIds)
      const prodMap: Record<string, any> = {}
      if (Array.isArray(prods)) prods.forEach((p: any) => { prodMap[String(p.id)] = p })

      const compraProds = detallesArr.map((d: any) => {
        const pid = String(d.producto_id)
        const purchased = Number(d.cantidad)
        const returned = returnedMap[pid] || 0
        const available = Math.max(0, purchased - returned)
        return { producto_id: pid, nombre: prodMap[pid]?.nombre || pid, sku: prodMap[pid]?.sku, purchased, returned, available, costo_unitario: Number(d.costo_unitario || 0) }
      })
      setCompraProductos(compraProds)
      // prefer product select list from compra
      setProductos(compraProds.map((p: any) => ({ id: p.producto_id, nombre: p.nombre, sku: p.sku })))
    } catch (err: any) {
      setError(err?.message || String(err))
    }
  }

  function addItem() {
    if (!selectedProducto) { setError('Selecciona un producto'); return }
    if (!cantidad || cantidad <= 0) { setError('Cantidad inválida'); return }
    const prod = productos.find(p => p.id === selectedProducto)
    // If compraProductos available, validate against available quantity
    const compraProd = compraProductos.find((cp: any) => cp.producto_id === selectedProducto)
    if (compraProd) {
      if (cantidad > compraProd.available) { setError(`Cantidad excede disponible para devolución (${compraProd.available})`); return }
    }
    setItems(prev => [...prev, { producto_id: selectedProducto!, nombre: prod?.nombre, cantidad }])
    setSelectedProducto(null)
    setCantidad(1)
    setError(null)
    // reduce available in compraProductos if present
    if (compraProd) {
      setCompraProductos(prev => prev.map(p => p.producto_id === compraProd.producto_id ? { ...p, available: Math.max(0, p.available - cantidad) } : p))
      setProductos(prev => prev.map(p => p.id === compraProd.producto_id ? p : p))
    }
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  async function confirmDevolucion() {
    setError(null)
    if (!proveedorId) { setError('Selecciona un proveedor'); return }
    if (items.length === 0) { setError('Agrega al menos un producto'); return }
    setSaving(true)
    try {
      // Insert master devolucion
      const devPayload: any = {
        proveedor_id: proveedorId,
        numero_documento: numeroDocumento || null,
        usuario: null
      }
      const insertRes = await supabase.from('devoluciones_proveedores').insert(devPayload).select('id').single()
      if (insertRes.error) throw insertRes.error
      const devolucionId = insertRes.data.id

      // insert detalles if table exists
      try {
        const detalles = items.map(it => ({ devolucion_id: devolucionId, producto_id: it.producto_id, cantidad: it.cantidad }))
        const detRes = await supabase.from('devoluciones_proveedores_detalle').insert(detalles)
        if (detRes.error) {
          console.warn('No se pudo insertar detalles de devolución', detRes.error)
        }
      } catch (e) {
        console.warn('Detalles tabla puede no existir', e)
      }

      // Registrar cada item en registro_de_inventario como SALIDA
      try {
        const referenciaText = numeroDocumento ? `Devolución - ${numeroDocumento}` : `Devolución ${devolucionId}`
        let usuarioText = 'sistema'
        try {
          const raw = localStorage.getItem('user')
          if (raw) {
            const u = JSON.parse(raw)
            usuarioText = u.username ? `${u.username}${u.role ? ` (${u.role})` : ''}` : String(u)
          }
        } catch (e) { }
        const now = hondurasNowISO()
        const registroRows = items.map(it => ({ producto_id: it.producto_id, cantidad: it.cantidad, tipo_de_movimiento: 'SALIDA', referencia: referenciaText, usuario: usuarioText, fecha_salida: now }))
        const regRes = await supabase.from('registro_de_inventario').insert(registroRows)
        if (regRes.error) {
          console.warn('Error registrando en registro_de_inventario', regRes.error)
          setError('Devolución guardada, pero falló el registro en inventario: ' + regRes.error.message)
        }
      } catch (e) {
        console.warn('Registro inventario fallo', e)
      }

      onClose()
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: 900, maxWidth: '98%', background: '#fff', borderRadius: 8, padding: 16, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Nueva devolución a proveedor</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13 }}>Proveedor</label>
            {compraId ? (
              <div style={{ padding: 8, background: '#f1f5f9', borderRadius: 6 }}>{proveedorNombre || String(proveedorId || '')}</div>
            ) : (
              <select className="input" value={proveedorId ?? ''} onChange={e => setProveedorId(e.target.value || null)}>
                <option value="">-- seleccionar proveedor --</option>
                {proveedores.map(p => <option key={String(p.id)} value={p.id}>{p.nombre}</option>)}
              </select>
            )}

            <label style={{ fontSize: 13, marginTop: 8 }}>Número documento / referencia</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} />
              <button className="btn-opaque" onClick={() => loadCompraByNumero()}>Buscar compra</button>
            </div>
            {compraId && <div style={{ marginTop: 8, color: '#374151' }}>Compra encontrada: #{compraId} — proveedor seleccionado automáticamente.</div>}
            {compraProductos && compraProductos.length > 0 && (
              <div style={{ marginTop: 8, background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Productos en la compra</strong> (disponible para devolución)</div>
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead><tr><th>Producto</th><th>Comprado</th><th>Devuelto</th><th>Disponible</th><th></th></tr></thead>
                  <tbody>
                    {compraProductos.map((cp: any) => (
                      <tr key={cp.producto_id}>
                        <td>{cp.nombre}</td>
                        <td style={{ textAlign: 'right' }}>{Number(cp.purchased).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(cp.returned).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{Number(cp.available).toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}><button className="btn-opaque" onClick={() => { setSelectedProducto(cp.producto_id); setCantidad(cp.available || 1) }}>Usar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 13 }}>Agregar producto a devolver</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="input" value={selectedProducto ?? ''} onChange={e => setSelectedProducto(e.target.value || null)} disabled={!!compraId}>
                <option value="">-- seleccionar producto --</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input
                className="input"
                type="number"
                style={{ width: 90 }}
                value={cantidad}
                onChange={e => {
                  const val = Number(e.target.value)
                  // If compraProductos available, enforce bounds
                  const compraProd = compraProductos.find((cp: any) => cp.producto_id === selectedProducto)
                  if (compraProd) {
                    const max = Number(compraProd.available || 0)
                    if (isNaN(val) || val < 1) return setCantidad(1)
                    if (val > max) return setCantidad(max)
                    return setCantidad(val)
                  }
                  setCantidad(val)
                }}
                min={1}
                max={selectedProducto ? (compraProductos.find((cp: any) => cp.producto_id === selectedProducto)?.available ?? undefined) : undefined}
                disabled={(() => {
                  const compraProd = compraProductos.find((cp: any) => cp.producto_id === selectedProducto)
                  return !!compraProd && Number(compraProd.available || 0) <= 1
                })()}
              />
              <button className="btn-primary" onClick={addItem}>Agregar</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <table className="admin-table">
                <thead>
                  <tr><th>Producto</th><th>Cantidad</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={`${it.producto_id}-${idx}`}>
                      <td>{it.nombre}</td>
                      <td style={{ textAlign: 'right' }}>{it.cantidad}</td>
                      <td><button className="btn-opaque" onClick={() => removeItem(idx)}>Quitar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn-opaque" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={confirmDevolucion} disabled={saving}>{saving ? 'Guardando...' : 'Registrar devolución'}</button>
        </div>
      </div>
    </div>
  )
}

function DevolucionDetailModal({ id, onClose }: { id: number | string; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadDetalle() {
    setLoading(true)
    setError(null)
    try {
      // try to load from detalle table
      const { data, error } = await supabase.from('devoluciones_proveedores_detalle').select('producto_id, cantidad').eq('devolucion_id', id)
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      if (rows.length > 0) {
        // resolve product names
        const ids = rows.map((r: any) => r.producto_id)
        const { data: prods } = await supabase.from('inventario').select('id, nombre, sku').in('id', ids)
        const map: Record<string, any> = {}
        if (Array.isArray(prods)) prods.forEach((p: any) => { map[String(p.id)] = p })
        setItems(rows.map((r: any) => ({ producto: map[String(r.producto_id)]?.nombre || String(r.producto_id), cantidad: r.cantidad })))
      } else {
        // fallback: check registro_de_inventario with referencia containing devolucion id
        const { data: regData } = await supabase.from('registro_de_inventario').select('producto_id, cantidad').like('referencia', `%${id}%`)
        const regRows = Array.isArray(regData) ? regData : []
        const ids = regRows.map((r: any) => r.producto_id)
        const { data: prods2 } = await supabase.from('inventario').select('id, nombre, sku').in('id', ids)
        const map2: Record<string, any> = {}
        if (Array.isArray(prods2)) prods2.forEach((p: any) => { map2[String(p.id)] = p })
        setItems(regRows.map((r: any) => ({ producto: map2[String(r.producto_id)]?.nombre || String(r.producto_id), cantidad: r.cantidad })))
      }
    } catch (err: any) {
      setError(err?.message || String(err))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDetalle() }, [id])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: 720, maxWidth: '98%', background: '#fff', borderRadius: 8, padding: 16, maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Detalle devolución #{String(id)}</h3>
        {loading && <div>Cargando...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <table className="admin-table" style={{ marginTop: 8 }}>
          <thead><tr><th>Producto</th><th>Cantidad</th></tr></thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}><td>{it.producto}</td><td style={{ textAlign: 'right' }}>{Number(it.cantidad).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn-opaque" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
