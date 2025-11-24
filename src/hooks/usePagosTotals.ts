import { useEffect, useState, useCallback } from 'react'
import supabase from '../lib/supabaseClient'

type Totals = {
  efectivo: number
  tarjeta: number
  transferencia: number
  dolares: number
  total: number
}

export default function usePagosTotals(fechaDesde?: string | null, usuario?: string | null) {
  const [totals, setTotals] = useState<Totals>({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!fechaDesde || !usuario) {
      setTotals({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
      return
    }
    setLoading(true)
    // Ensure fechaDesde has timezone offset if missing (assume Honduras -06:00)
    let since = fechaDesde
    if (since && !since.includes('Z') && !since.includes('+') && !since.match(/-\d\d:\d\d$/)) {
      since = `${since}-06:00`
    }
    // Convert to ISO string to ensure consistent UTC comparison in Supabase
    const sinceIso = since ? new Date(since).toISOString() : null

    try {
      // 1) Buscar ventas del usuario a partir de la fecha
      const { data: ventas, error: vErr } = await supabase
        .from('ventas')
        .select('id')
        .eq('usuario', usuario)
        .gte('fecha_venta', sinceIso)

      if (vErr) {
        console.debug('usePagosTotals: error fetching ventas', vErr)
        setTotals({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
        return
      }

      const ventaIds = Array.isArray(ventas) && ventas.length > 0 ? ventas.map((v: any) => String(v.id)) : []
      if (ventaIds.length === 0) {
        setTotals({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
        return
      }

      // 2) Consultar pagos relacionados a esas ventas
      const { data: pagos, error: pErr } = await supabase
        .from('pagos')
        .select('monto, tipo')
        .in('venta_id', ventaIds)

      if (pErr) {
        console.debug('usePagosTotals: error fetching pagos', pErr)
        setTotals({ efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 })
        return
      }

      const newTotals: Totals = { efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0, total: 0 }
      if (Array.isArray(pagos)) {
        pagos.forEach((p: any) => {
          const monto = Number(p.monto || 0)
          const tipo = (p.tipo || '').toLowerCase()
          let category: keyof Totals | null = null
          if (tipo.includes('efectivo') || tipo === 'cash') category = 'efectivo'
          else if (tipo.includes('tarjeta') || tipo === 'card') category = 'tarjeta'
          else if (tipo.includes('transferencia') || tipo === 'transfer') category = 'transferencia'
          else if (tipo.includes('dolar') || tipo.includes('usd')) category = 'dolares'
          if (!category) category = 'efectivo'
          newTotals[category] += monto
          newTotals.total += monto
        })
      }

      setTotals(newTotals)
    } catch (e) {
      console.debug('usePagosTotals: exception', e)
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
