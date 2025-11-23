import React, { useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'
import { hondurasNowISO } from '../lib/useHondurasTime'

type Producto = { id: string; nombre: string; exento?: any }
type Proveedor = { id: number | string; nombre: string }
type LineItem = { producto_id: string; nombre: string; cantidad: number; costo_unitario: number; exento?: boolean }

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export default function CompraCreateModal({ open, onClose, onCreated }: Props) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [impuestoValor, setImpuestoValor] = useState<number>(0)

  const [proveedorId, setProveedorId] = useState<number | string | null>(null)
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('factura')
  const [items, setItems] = useState<LineItem[]>([])
  const [selectedProducto, setSelectedProducto] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState<number>(1)
  const [costoUnitario, setCostoUnitario] = useState<number | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // load products and providers
    ;(async () => {
      try {
        const p = await supabase.from('inventario').select('id, nombre, exento').order('nombre', { ascending: true })
        setProductos(Array.isArray(p.data) ? p.data as Producto[] : [])
      } catch (e) {
        // ignore
      }
      try {
        const r = await supabase.from('proveedores').select('id, nombre').order('nombre', { ascending: true })
        setProveedores(Array.isArray(r.data) ? r.data as Proveedor[] : [])
      } catch (e) {
        // ignore
      }
      // load impuesto (única fila esperada)
      try {
        const imp = await supabase.from('impuesto').select('impuesto_venta').limit(1).order('id', { ascending: true })
        const row = Array.isArray(imp.data) && imp.data.length > 0 ? imp.data[0] : null
        const impuestoVal = row ? Number(row.impuesto_venta) : 0
        setImpuestoValor(impuestoVal)
      } catch (e) {
        // ignore
      }
    })()
  }, [open])

  if (!open) return null

  function resetForm() {
    setProveedorId(null)
    setNumeroDocumento('')
    setTipoDocumento('factura')
    setItems([])
    setSelectedProducto(null)
    setCantidad(1)
    setCostoUnitario(null)
    setError(null)
  }

  function addItem() {
    if (!selectedProducto) { setError('Selecciona un producto'); return }
    if (!costoUnitario || costoUnitario <= 0) { setError('Costo unitario inválido'); return }
    if (!cantidad || cantidad <= 0) { setError('Cantidad inválida'); return }
    const prod = productos.find(p => p.id === selectedProducto)!
    // normalizar exento a boolean
    const isExento = (v: any) => {
      if (v == null) return false
      if (typeof v === 'boolean') return v === true
      if (typeof v === 'number') return v === 1
      const s = String(v).toLowerCase().trim()
      return s === '1' || s === 'true' || s === 't' || s === 'si' || s === 's' || s === 'yes'
    }
    setItems(prev => [...prev, { producto_id: selectedProducto!, nombre: prod?.nombre || '', cantidad, costo_unitario: costoUnitario, exento: isExento(prod?.exento) }])
    setSelectedProducto(null)
    setCantidad(1)
    setCostoUnitario(null)
    setError(null)
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function computeTotals() {
    // Interpretamos `costo_unitario` como precio que puede incluir impuesto.
    // Para items exentos, impuesto = 0 y subtotal = total_price
    // Para no exentos: impuesto_line = total_price * tasa, subtotal_line = total_price - impuesto_line
    const impuestoVal = impuestoValor
    const tasa = impuestoVal > 1 ? impuestoVal / 100 : impuestoVal

    let subtotal = 0
    let impuesto = 0
    let total = 0

    for (const it of items) {
      const totalPrice = it.cantidad * it.costo_unitario
      let impuestoLine = 0
      let subtotalLine = totalPrice
      if (!it.exento) {
        impuestoLine = totalPrice * tasa
        subtotalLine = totalPrice - impuestoLine
      }
      subtotal += subtotalLine
      impuesto += impuestoLine
      total += totalPrice
    }

    return { subtotal, impuesto, total }
  }

  async function confirmPurchase() {
    setError(null)
    if (!proveedorId) { setError('Selecciona un proveedor'); return }
    if (items.length === 0) { setError('Agrega al menos un producto'); return }
    setSaving(true)
    try {
      const { subtotal, impuesto, total } = computeTotals()
      // Insert compra
      const compraPayload: any = {
        proveedor_id: proveedorId,
        numero_documento: numeroDocumento || null,
        tipo_documento: tipoDocumento || null,
        subtotal: subtotal,
        impuesto: impuesto,
        total: total,
        usuario: null
      }
      const insertRes = await supabase.from('compras').insert(compraPayload).select('id').single()
      if (insertRes.error) throw insertRes.error
      const compraId = insertRes.data.id

      // prepare detalles
      const detalles = items.map(it => ({ compra_id: compraId, producto_id: it.producto_id, cantidad: it.cantidad, costo_unitario: it.costo_unitario }))
      const detRes = await supabase.from('compras_detalle').insert(detalles)
      if (detRes.error) {
        // rollback compra
        await supabase.from('compras').delete().eq('id', compraId)
        throw detRes.error
      }

      // Registrar cada item en registro_de_inventario como ENTRADA
      try {
        // referencia y usuario
        const referenciaText = numeroDocumento ? `Compra - ${numeroDocumento}` : `Compra ${compraId}`
        let usuarioText = 'sistema'
        try {
          const raw = localStorage.getItem('user')
          if (raw) {
            const u = JSON.parse(raw)
            usuarioText = u.username ? `${u.username}${u.role ? ` (${u.role})` : ''}` : String(u)
          }
        } catch (e) {
          // ignore
        }

        const now = hondurasNowISO()
        const registroRows = items.map(it => ({ producto_id: it.producto_id, cantidad: it.cantidad, tipo_de_movimiento: 'ENTRADA', referencia: referenciaText, usuario: usuarioText, fecha_salida: now }))
        const regRes = await supabase.from('registro_de_inventario').insert(registroRows)
        if (regRes.error) {
          console.warn('Error registrando en registro_de_inventario', regRes.error)
          // not critical: we don't rollback compra, but inform user
          setError('Compra guardada, pero falló el registro en inventario: ' + regRes.error.message)
        }
      } catch (e) {
        console.warn('Registro inventario fallo', e)
      }

      // success
      resetForm()
      onClose()
      if (onCreated) onCreated()
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  const totals = computeTotals()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ width: 900, maxWidth: '98%', background: '#fff', borderRadius: 8, padding: 16, maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Nueva compra</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13 }}>Proveedor</label>
            <select className="input" value={proveedorId ?? ''} onChange={e => setProveedorId(e.target.value || null)}>
              <option value="">-- seleccionar proveedor --</option>
              {proveedores.map(p => <option key={String(p.id)} value={p.id}>{p.nombre}</option>)}
            </select>

            <label style={{ fontSize: 13, marginTop: 8 }}>Número documento</label>
            <input className="input" value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} />

            <label style={{ fontSize: 13, marginTop: 8 }}>Tipo documento</label>
            <input className="input" value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 13 }}>Agregar producto</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="input" value={selectedProducto ?? ''} onChange={e => setSelectedProducto(e.target.value || null)}>
                <option value="">-- seleccionar producto --</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input className="input" type="number" style={{ width: 90 }} value={cantidad} onChange={e => setCantidad(Number(e.target.value))} />
              <input className="input" type="number" style={{ width: 120 }} value={costoUnitario ?? ''} onChange={e => setCostoUnitario(Number(e.target.value))} placeholder="Costo unitario" />
              <button className="btn-primary" onClick={addItem}>Agregar</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Costo unit.</th>
                    <th>Impuesto</th>
                    <th>Subtotal</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const totalPrice = it.cantidad * it.costo_unitario
                    const tasa = impuestoValor > 1 ? impuestoValor / 100 : impuestoValor
                    const impuestoLine = it.exento ? 0 : totalPrice * tasa
                    const subtotalLine = it.exento ? totalPrice : totalPrice - impuestoLine
                    return (
                      <tr key={`${it.producto_id}-${idx}`}>
                        <td>{it.nombre}</td>
                        <td>{it.cantidad}</td>
                        <td>{it.costo_unitario.toFixed(2)}</td>
                        <td>{impuestoLine.toFixed(2)}</td>
                        <td>{subtotalLine.toFixed(2)}</td>
                        <td><button className="btn-opaque" onClick={() => removeItem(idx)}>Quitar</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div>Subtotal: <strong>{totals.subtotal.toFixed(2)}</strong></div>
            <div>Impuesto: <strong>{totals.impuesto.toFixed(2)}</strong></div>
            <div>Total: <strong>{totals.total.toFixed(2)}</strong></div>
          </div>
        </div>

        {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn-opaque" onClick={() => { resetForm(); onClose() }} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={confirmPurchase} disabled={saving}>{saving ? 'Guardando...' : 'Confirmar compra'}</button>
        </div>
      </div>
    </div>
  )
}
