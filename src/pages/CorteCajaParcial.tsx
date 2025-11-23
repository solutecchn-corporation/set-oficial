import React, { useEffect, useState } from 'react'
import useCajaSession from '../hooks/useCajaSession'
import supabase from '../lib/supabaseClient'
import useHondurasTime from '../lib/useHondurasTime'
import useDevolucionesTotales from '../hooks/useDevolucionesTotales'
import usePagosTotals from '../hooks/usePagosTotals'
import usePagosVentasAnuladas from '../hooks/usePagosVentasAnuladas'
import useDataPagos from '../hooks/useDataPagos'
import useCajaMovimientosTotals from '../hooks/useCajaMovimientosTotals'
import useVentasAnuladas from '../hooks/useVentasAnuladas'
import useDataDevoluciones from '../hooks/useDataDevoluciones'

export default function CorteCajaParcial({ onBack }: { onBack: () => void }) {
  const { session, loading: sessionLoading, startSession, refreshSession } = useCajaSession()
  const [calculating, setCalculating] = useState(false)
  const [startAmount, setStartAmount] = useState<number | ''>('')

  // Detailed Breakdowns
  const [ingresos, setIngresos] = useState({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
  const [anulaciones, setAnulaciones] = useState({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
  const [devoluciones, setDevoluciones] = useState({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
  const [otrosIngresos, setOtrosIngresos] = useState(0) // From caja_movimientos
  const [otrosEgresos, setOtrosEgresos] = useState(0) // From caja_movimientos

  const { hondurasNowISO } = useHondurasTime()
  const { totals: devolucionesTotals } = useDevolucionesTotales(session?.fecha_apertura ?? null, session?.usuario ?? null)
  const { totals: pagosTotals, loading: pagosLoading, reload: reloadPagos } = usePagosTotals(session?.fecha_apertura ?? null, session?.usuario ?? null)
  // Mostrar agrupación por tipo (suma de monto) — usar la fecha de apertura de la sesión
  const fechaDesdePagos = session?.fecha_apertura ?? null
  const { data: dataPagos, loading: dataPagosLoading, error: dataPagosError, reload: reloadDataPagos } = useDataPagos(fechaDesdePagos)
  const { data: cajaMovs, loading: cajaMovsLoading, error: cajaMovsError, reload: reloadCajaMovs } = useCajaMovimientosTotals(fechaDesdePagos, session?.usuario ?? null)
  const { data: ventasAnuladas, loading: ventasAnuladasLoading, error: ventasAnuladasError, reload: reloadVentasAnuladas } = useVentasAnuladas(fechaDesdePagos, session?.usuario ?? null)

  // extract potential usuario id from localStorage user object (if present)
  let usuarioIdForQuery: string | number | null = null
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (raw) {
      const parsed = JSON.parse(raw)
      usuarioIdForQuery = parsed && (parsed.id || parsed.user?.id || parsed.sub || parsed.user_id) ? (parsed.id || parsed.user?.id || parsed.sub || parsed.user_id) : null
    }
  } catch (e) {
    usuarioIdForQuery = null
  }

  const { data: pagosVentasAnuladas, loading: pagosVentasAnuladasLoading, error: pagosVentasAnuladasError, reload: reloadPagosVentasAnuladas } = usePagosVentasAnuladas(fechaDesdePagos, usuarioIdForQuery, session?.usuario ?? null)

  const { data: dataDevoluciones, loading: dataDevolucionesLoading, error: dataDevolucionesError, reload: reloadDevoluciones } = useDataDevoluciones(session?.usuario ?? null, usuarioIdForQuery, session?.fecha_apertura ?? null)

  // Debug: mostrar pagosTotals en consola para verificar valores
  React.useEffect(() => {
    try {
      console.debug('usePagosTotals values', { pagosTotals, pagosLoading })
    } catch (e) { }
  }, [pagosTotals, pagosLoading])

  useEffect(() => {
    if (session) {
      calculateTotals()
    }
  }, [session])

  const calculateTotals = async () => {
    if (!session) return
    setCalculating(true)
    try {
      // ensure pagosTotals are fresh when recalculating
      try { if (typeof reloadPagos === 'function') await reloadPagos() } catch (e) { console.debug('Error reloading pagosTotals', e) }
      const user = session.usuario
      const since = session.fecha_apertura

      // 1. Fetch Pagos (Income & Cancellations)
      // First fetch relevant sales IDs to avoid relying on 'ventas!inner' join which needs explicit FK
      const { data: ventas, error: vErr } = await supabase
        .from('ventas')
        .select('id')
        .eq('usuario', user)
        .gte('fecha_venta', since)

      if (vErr) console.error('Error fetching ventas for ids:', vErr)

      const newIngresos = { efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 }
      const newAnulaciones = { efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 }

      if (ventas && ventas.length > 0) {
        // Cast IDs to string to match pagos.venta_id type (text)
        const ventaIds = ventas.map((v: any) => String(v.id))

        const { data: pagos, error: pErr } = await supabase
          .from('pagos')
          .select('monto, tipo')
          .in('venta_id', ventaIds)

        if (pErr) console.error('Error fetching pagos:', pErr)

        if (pagos) {
          pagos.forEach((p: any) => {
            const monto = Number(p.monto || 0)
            const tipo = (p.tipo || '').toLowerCase()

            // Categorize type
            let category: 'efectivo' | 'tarjeta' | 'transferencia' | 'dolares' | null = null
            if (tipo.includes('efectivo') || tipo === 'cash') category = 'efectivo'
            else if (tipo.includes('tarjeta') || tipo === 'card') category = 'tarjeta'
            else if (tipo.includes('transferencia') || tipo === 'transfer') category = 'transferencia'
            else if (tipo.includes('dolar') || tipo === 'usd') category = 'dolares'

            if (category) {
              if (monto >= 0) {
                newIngresos[category] += monto
                newIngresos.total += monto
              } else {
                // Anulaciones (negative values)
                newAnulaciones[category] += Math.abs(monto)
                newAnulaciones.total += Math.abs(monto)
              }
            }
          })
        }
      }
      setIngresos(newIngresos)
      setAnulaciones(newAnulaciones)

      // 2. Fetch Movimientos (Otros Ingresos/Egresos manuales)
      let movs: any[] = []
      const tableCandidates = ['caja_movimientos']
      for (const tbl of tableCandidates) {
        const { data: mData, error: mErr } = await supabase
          .from(tbl)
          .select('monto, tipo_movimiento')
          .eq('usuario', user)
          .gte('fecha', since)

        if (!mErr && mData) {
          movs = mData
          break
        }
      }

      let totalIng = 0
      let totalEgr = 0
      movs.forEach((m: any) => {
        const tipo = (m.tipo_movimiento || '').toLowerCase()
        const monto = Number(m.monto || 0)
        if (tipo === 'ingreso') totalIng += monto
        if (tipo === 'egreso') totalEgr += monto
      })
      setOtrosIngresos(totalIng)
      setOtrosEgresos(totalEgr)

      // Devoluciones ahora manejadas por el hook `useDevolucionesTotales`.
      // Sincronizar valores devueltos por el hook (si existen) a nuestro estado local.
      try {
        if (devolucionesTotals) {
          setDevoluciones(devolucionesTotals)
        }
      } catch (e) {
        console.debug('Error syncing devoluciones from hook', e)
      }

    } catch (e) {
      console.error('Error calculating totals:', e)
    } finally {
      setCalculating(false)
    }
  }

  const handleStartSession = async () => {
    if (startAmount === '' || Number(startAmount) < 0) return alert('Ingrese un monto inicial válido')
    try {
      await startSession(Number(startAmount))
    } catch (e: any) {
      alert(e.message)
    }
  }

  const currency = (v: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(v).replace('HNL', 'L')

  if (sessionLoading) return <div style={{ padding: 20 }}>Cargando sesión...</div>

  if (!session) {
    return (
      <div style={{ padding: 20, maxWidth: 500, margin: '40px auto', textAlign: 'center' }}>
        <h2>No hay sesión de caja activa</h2>
        <p>Para comenzar a vender y registrar movimientos, debes abrir una sesión de caja.</p>
        <div style={{ marginTop: 20, background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <label style={{ display: 'block', marginBottom: 10, textAlign: 'left', fontWeight: 600 }}>Monto Inicial (L)</label>
          <input
            type="number"
            className="input"
            value={startAmount}
            onChange={e => setStartAmount(Number(e.target.value))}
            placeholder="0.00"
            style={{ width: '100%', marginBottom: 16 }}
          />
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleStartSession}>Abrir Caja</button>
        </div>
        <button onClick={onBack} className="btn-opaque" style={{ marginTop: 20 }}>Volver</button>
      </div>
    )
  }

  // Saldo Teórico = Monto Inicial + Ingresos Efectivo + Otros Ingresos - Otros Egresos - Devoluciones Efectivo
  // Note: Anulaciones are negative payments, so they reduce the total collected.
  // However, usually "Cash in Drawer" is: Initial + Cash Sales - Cash Returns - Expenses.
  // Anulaciones might just be reversing a sale, so if the sale came in (+100) and was annulled (-100), net is 0.
  // So summing 'ingresos.efectivo' (which only has positives) and subtracting 'anulaciones.efectivo' (positives) ?
  // OR just sum all pagos.monto?
  // User asked for breakdown.
  // Let's calculate Net Cash Flow = (Ingresos Efectivo - Anulaciones Efectivo) + Otros Ingresos - Otros Egresos - Devoluciones Efectivo

  const netCashSales = ingresos.efectivo - anulaciones.efectivo
  const saldoTeorico = (session.monto_inicial || 0) + netCashSales + otrosIngresos - otrosEgresos - devoluciones.efectivo

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: '24px auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Corte de Caja Parcial</h2>
          <div style={{ color: '#64748b', fontSize: 14 }}>
            Sesión iniciada el: {new Date(session.fecha_apertura).toLocaleString()} por <strong>{session.usuario}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={calculateTotals} className="btn-opaque" disabled={calculating}>
            {calculating ? 'Calculando...' : 'Actualizar datos'}
          </button>
          <button onClick={onBack} className="btn-opaque">Volver</button>
        </div>
      </header>

          {/* Tabla: Corte de Caja Parcial (resumen por tipo de pago) */}
          <section style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '8px 0' }}>Resumen Parcial - Corte de Caja</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <button className="btn-opaque" onClick={() => { reloadDataPagos(); reloadCajaMovs(); if (typeof reloadVentasAnuladas === 'function') reloadVentasAnuladas(); if (typeof reloadDevoluciones === 'function') reloadDevoluciones(); }} disabled={calculating}>Refrescar todo</button>
            </div>

            {/* build aggregated values for table */}
            {
              (() => {
                const categories = ['efectivo', 'dolares', 'tarjeta', 'transferencia'] as const

                const normalizeTipo = (s: string = '') => {
                  const t = s.toLowerCase()
                  if (t.includes('efect')) return 'efectivo'
                  if (t.includes('dolar') || t.includes('usd')) return 'dolares'
                  if (t.includes('tarj')) return 'tarjeta'
                  if (t.includes('transfer')) return 'transferencia'
                  return 'efectivo'
                }

                // pagos totals (from usePagosTotals)
                const pagosByCat: Record<string, number> = {
                  efectivo: Number((pagosTotals && pagosTotals.efectivo) || 0),
                  dolares: Number((pagosTotals && pagosTotals.dolares) || 0),
                  tarjeta: Number((pagosTotals && pagosTotals.tarjeta) || 0),
                  transferencia: Number((pagosTotals && pagosTotals.transferencia) || 0)
                }

                // caja movimientos -> split into ingresos/egresos by detecting keywords in tipo_movimiento
                const cajaIngresos: Record<string, number> = { efectivo: 0, dolares: 0, tarjeta: 0, transferencia: 0 }
                const cajaEgresos: Record<string, number> = { efectivo: 0, dolares: 0, tarjeta: 0, transferencia: 0 }
                if (Array.isArray(cajaMovs)) {
                  cajaMovs.forEach((r: any) => {
                    const tipo = String(r.tipo_movimiento || '').toLowerCase()
                    const cat = normalizeTipo(tipo)
                    const monto = Number(r.total_monto || r.monto || 0)
                    const isEgreso = tipo.includes('egreso') || tipo.includes('salida') || tipo.includes('salir') || tipo.includes('retirada')
                    const isIngreso = tipo.includes('ingreso') || tipo.includes('entrada') || (!isEgreso)
                    if (isEgreso) cajaEgresos[cat] = (cajaEgresos[cat] || 0) + monto
                    else if (isIngreso) cajaIngresos[cat] = (cajaIngresos[cat] || 0) + monto
                  })
                }

                // anulaciones from ventasAnuladas
                const anulacionesByCat: Record<string, number> = { efectivo: 0, dolares: 0, tarjeta: 0, transferencia: 0 }
                if (Array.isArray(ventasAnuladas)) {
                  ventasAnuladas.forEach((r: any) => {
                    const key = String(r.tipo || '').toLowerCase()
                    const cat = normalizeTipo(key)
                    const monto = Number(r.total_monto || 0)
                    anulacionesByCat[cat] = (anulacionesByCat[cat] || 0) + monto
                  })
                }

                // devoluciones totals from useDevolucionesTotales
                const devolucionesByCat: Record<string, number> = { efectivo: 0, dolares: 0, tarjeta: 0, transferencia: 0 }
                if (devolucionesTotals) {
                  devolucionesByCat.efectivo = Number(devolucionesTotals.efectivo || 0)
                  devolucionesByCat.dolares = Number(devolucionesTotals.dolares || 0)
                  devolucionesByCat.tarjeta = Number(devolucionesTotals.tarjeta || 0)
                  devolucionesByCat.transferencia = Number(devolucionesTotals.transferencia || 0)
                }

                const currencyFmt = (v: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(v).replace('HNL', 'L')

                return (
                  <div style={{ background: 'white', borderRadius: 8, padding: 12, boxShadow: '0 4px 18px rgba(2,6,23,0.08)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, system-ui, -apple-system' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '12px 16px', color: '#0f172a' }}>Medio / Columna</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: '#0f172a' }}>Pagos</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: '#0f172a' }}>Ingresos</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: '#0f172a' }}>Egresos</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: '#0f172a' }}>Anulaciones</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', color: '#0f172a' }}>Devoluciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat) => (
                          <tr key={cat} style={{ borderTop: '1px solid #eef2f7' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0b1220', textTransform: 'capitalize' }}>{cat}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0ea5e9' }}>{currencyFmt(pagosByCat[cat] || 0)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981' }}>{currencyFmt(cajaIngresos[cat] || 0)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{currencyFmt(cajaEgresos[cat] || 0)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#f59e0b' }}>{currencyFmt(anulacionesByCat[cat] || 0)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#7c3aed' }}>{currencyFmt(devolucionesByCat[cat] || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #e6eef7' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 800 }}>Totales</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{currencyFmt(Object.values(pagosByCat).reduce((s, n) => s + n, 0))}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{currencyFmt(Object.values(cajaIngresos).reduce((s, n) => s + n, 0))}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{currencyFmt(Object.values(cajaEgresos).reduce((s, n) => s + n, 0))}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{currencyFmt(Object.values(anulacionesByCat).reduce((s, n) => s + n, 0))}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{currencyFmt(Object.values(devolucionesByCat).reduce((s, n) => s + n, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })()
            }
          </section>

      {/* Ventas anuladas JSON eliminado — ahora oculto en interfaz */}
    
    </div>
  )
}

function BreakdownRow({ label, ventas = 0, ing, anl, dev }: { label: string, ventas?: number, ing: number, anl: number, dev: number }) {
  const currency = (v: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(v).replace('HNL', 'L')
  const net = ing - anl - dev
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#fafbfc'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{label}</td>
      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#0ea5e9', fontWeight: 600 }}>{currency(ventas)}</td>
      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#10b981', fontWeight: 500 }}>{currency(ing)}</td>
      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#f59e0b', fontWeight: 500 }}>{currency(anl)}</td>
      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#ef4444', fontWeight: 500 }}>{currency(dev)}</td>
      <td style={{
        padding: '14px 16px',
        textAlign: 'right',
        fontWeight: 700,
        fontSize: 15,
        color: net >= 0 ? '#059669' : '#dc2626',
        background: net >= 0 ? '#f0fdf4' : '#fef2f2',
        borderLeft: `3px solid ${net >= 0 ? '#10b981' : '#ef4444'}`
      }}>
        {net >= 0 ? '+' : ''}{currency(net)}
      </td>
    </tr>
  )
}

function Card({ title, value, color }: { title: string, value: number, color: string }) {
  const currency = (v: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(v).replace('HNL', 'L')
  return (
    <div style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{currency(value)}</div>
    </div>
  )
}
