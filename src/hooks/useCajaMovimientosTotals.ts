import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'

type Row = { tipo_movimiento: string; total_monto: number }

export default function useCajaMovimientosTotals(fechaDesde?: string | null, usuario?: string | null) {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!fechaDesde || !usuario) {
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

      const { data: rows, error: qErr } = await supabase
        .from('caja_movimientos')
        .select('tipo_movimiento, monto')
        .gte('fecha', sinceIso)
        .eq('usuario', usuario)

      if (qErr) {
        setError(qErr)
        setData([])
        return
      }

      const map: Record<string, number> = {}
      if (Array.isArray(rows)) {
        rows.forEach((r: any) => {
          const tipo = (r.tipo_movimiento || 'desconocido').toString()
          const monto = Number(r.monto || 0)
          map[tipo] = (map[tipo] || 0) + monto
        })
      }

      const out: Row[] = Object.keys(map).sort().map(k => ({ tipo_movimiento: k, total_monto: map[k] }))
      setData(out)
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
