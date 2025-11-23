import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'

type Row = { tipo: string; num_ventas_anuladas: number; total_monto: number }

export default function usePagosVentasAnuladas(fechaDesde?: string | null, usuarioId?: number | string | null, usuarioNombre?: string | null) {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!usuarioNombre && (usuarioId == null || usuarioId === '')) {
        setData([])
        return
      }

      // 1) fetch ventas anuladas (apply fecha filter if provided)
      let ventasQuery = supabase.from('ventas').select('id')
      ventasQuery = ventasQuery.eq('estado', 'Anulada')
      if (fechaDesde) ventasQuery = ventasQuery.gte('fecha_venta', fechaDesde)
      const { data: ventasRows, error: ventasErr } = await ventasQuery
      if (ventasErr) {
        setError(ventasErr)
        setData([])
        return
      }
      const ventaIds = Array.isArray(ventasRows) ? ventasRows.map((v: any) => String(v.id)) : []
      if (ventaIds.length === 0) {
        setData([])
        return
      }

      // 2) fetch pagos that reference those ventas, match usuario filters and monto > 0
      let pagosQuery = supabase.from('pagos').select('tipo, monto, venta_id')
        .in('venta_id', ventaIds)
        .gt('monto', 0)

      if (usuarioNombre) pagosQuery = pagosQuery.eq('usuario_nombre', usuarioNombre)
      // usuarioId may be numeric or string; only apply if provided
      if (usuarioId != null && usuarioId !== '') {
        // try numeric compare first
        const asNumber = Number(usuarioId)
        if (!Number.isNaN(asNumber)) pagosQuery = pagosQuery.eq('usuario_id', asNumber)
        else pagosQuery = pagosQuery.eq('usuario_id', usuarioId)
      }

      const { data: pagosRows, error: pagosErr } = await pagosQuery
      if (pagosErr) {
        setError(pagosErr)
        setData([])
        return
      }

      // 3) aggregate by tipo: count distinct venta_id and sum monto
      const map: Record<string, { ventas: Set<string>; total: number }> = {}
      if (Array.isArray(pagosRows)) {
        pagosRows.forEach((p: any) => {
          const tipo = String(p.tipo || 'desconocido')
          const monto = Number(p.monto || 0)
          const vid = String(p.venta_id || '')
          if (!map[tipo]) map[tipo] = { ventas: new Set<string>(), total: 0 }
          if (vid) map[tipo].ventas.add(vid)
          map[tipo].total += monto
        })
      }

      const out: Row[] = Object.keys(map).sort().map(k => ({
        tipo: k,
        num_ventas_anuladas: map[k].ventas.size,
        total_monto: Number(map[k].total.toFixed(2))
      }))

      setData(out)
    } catch (e) {
      setError(e)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, usuarioId, usuarioNombre])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}
