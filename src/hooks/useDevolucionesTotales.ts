import { useEffect, useState, useCallback } from 'react'
import supabase from '../lib/supabaseClient'

type Totals = {
  efectivo: number
  tarjeta: number
  transferencia: number
  dolares: number
  total: number
}

export default function useDevolucionesTotales(fechaDesde?: string | null, usuario?: string | null) {
  const [totals, setTotals] = useState<Totals>({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!fechaDesde) {
      setTotals({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
      return
    }
    setLoading(true)
    try {
      let query = supabase.from('devoluciones_ventas').select('total, tipo_devolucion').gte('fecha_devolucion', fechaDesde)
      if (usuario) query = query.eq('usuario', usuario)
      const { data, error } = await query
      if (error) {
        console.debug('useDevolucionesTotales: error fetching devoluciones_ventas', error)
        setTotals({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
        return
      }
      const newTotals: Totals = { efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 }
      if (Array.isArray(data)) {
        data.forEach((d: any) => {
          const monto = Number(d.total || 0)
          const tipo = (d.tipo_devolucion || '').toLowerCase()
          let category: keyof Totals | null = null
          if (tipo.includes('efectivo') || tipo === 'devolucion') category = 'efectivo'
          else if (tipo.includes('tarjeta')) category = 'tarjeta'
          else if (tipo.includes('transferencia')) category = 'transferencia'
          else if (tipo.includes('dolar')) category = 'dolares'
          if (!category) {
            // fallback: treat unknown as efectivo
            category = 'efectivo'
          }
          newTotals[category] += monto
          newTotals.total += monto
        })
      }
      setTotals(newTotals)
    } catch (e) {
      console.debug('useDevolucionesTotales: exception', e)
      setTotals({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, usuario])

  useEffect(() => {
    load()
  }, [load])

  return { totals, loading, reload: load }
}
