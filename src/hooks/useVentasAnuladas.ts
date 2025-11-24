import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'

type Row = { tipo: string; num_ventas_anuladas: number; total_monto: number }

export default function useVentasAnuladas(fechaDesde?: string | null, usuario?: string | null) {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  const normalizeTipo = (t: string) => {
    const s = String(t || '').toLowerCase()
    if (s.includes('efect')) return 'efectivo'
    if (s.includes('dolar') || s.includes('usd')) return 'dolares'
    if (s.includes('tarj')) return 'tarjeta'
    if (s.includes('transfer')) return 'transferencia'
    return s || 'otros'
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!fechaDesde || !usuario) {
        setData([])
        return
      }

      // 1. fetch pagos for this user with positive monto
      const { data: pagos, error: pErr } = await supabase
        .from('pagos')
        .select('tipo,monto,venta_id')
        .eq('usuario_nombre', usuario)
        .gt('monto', 0)

      if (pErr) {
        setError(pErr)
        setData([])
        return
      }

      const pagosArr = Array.isArray(pagos) ? pagos : []
      const ventaIds = Array.from(new Set(pagosArr.map((p: any) => String(p.venta_id)).filter(Boolean)))
      if (ventaIds.length === 0) {
        setData([])
        return
      }

      // Ensure fechaDesde has timezone offset if missing (assume Honduras -06:00)
      let since = fechaDesde
      if (since && !since.includes('Z') && !since.includes('+') && !since.match(/-\d\d:\d\d$/)) {
        since = `${since}-06:00`
      }
      // Convert to ISO string to ensure consistent UTC comparison in Supabase
      const sinceIso = since ? new Date(since).toISOString() : null

      // 2. fetch ventas annuladas among those ventaIds and after fechaDesde
      const { data: ventas, error: vErr } = await supabase
        .from('ventas')
        .select('id')
        .in('id', ventaIds)
        .eq('estado', 'Anulada')
        .gte('fecha_venta', sinceIso)

      if (vErr) {
        setError(vErr)
        setData([])
        return
      }

      const annulledIds = new Set(Array.isArray(ventas) ? ventas.map((v: any) => String(v.id)) : [])

      // 3. aggregate by pago.tipo but only for pagos whose venta_id is in annulledIds
      const map: Record<string, { count: number; total: number }> = {}
      for (const p of pagosArr) {
        const vid = String(p.venta_id)
        if (!annulledIds.has(vid)) continue
        const rawTipo = String(p.tipo || 'otros')
        const tipoKey = normalizeTipo(rawTipo)
        const monto = Number(p.monto || 0)
        if (!map[tipoKey]) map[tipoKey] = { count: 0, total: 0 }
        map[tipoKey].count += 1
        map[tipoKey].total += monto
      }

      const rows: Row[] = Object.keys(map).sort().map(k => ({ tipo: k, num_ventas_anuladas: map[k].count, total_monto: Number(map[k].total.toFixed(2)) }))
      setData(rows)
    } catch (e) {
      setError(e)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, usuario])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}
