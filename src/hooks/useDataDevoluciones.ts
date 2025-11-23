import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'

type Row = {
  total: number | string | null
  fecha_devolucion?: string
  usuario?: string
  usuario_id?: string | number
}

export default function useDataDevoluciones(usuario?: string | null, usuario_id?: string | number | null, fechaInicio?: string | null) {
  const [data, setData] = useState<{ total_devoluciones: number; rows: Row[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Build query
      let q: any = supabase.from('devoluciones_ventas').select('total,fecha_devolucion,usuario,usuario_id')

      if (usuario) q = q.eq('usuario', usuario)
      if (usuario_id !== null && typeof usuario_id !== 'undefined') q = q.eq('usuario_id', String(usuario_id))
      if (fechaInicio) q = q.gte('fecha_devolucion', fechaInicio)

      const { data: rows, error: qErr } = await q
      if (qErr) {
        setError(qErr)
        setData(null)
        return
      }

      const items: Row[] = Array.isArray(rows) ? rows : []
      const total = items.reduce((s, r) => s + (Number(r.total || 0) || 0), 0)
      setData({ total_devoluciones: total, rows: items })
    } catch (e) {
      setError(e)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [usuario, usuario_id, fechaInicio])

  useEffect(() => {
    // only fetch if we have at least usuario and fechaInicio; otherwise skip
    if (!usuario || !fechaInicio) {
      setData(null)
      return
    }
    void fetchData()
  }, [fetchData, usuario, fechaInicio])

  return { data, loading, error, reload: fetchData }
}
