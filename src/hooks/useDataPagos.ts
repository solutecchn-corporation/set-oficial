import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabaseClient'

type Row = { tipo: string; total_monto: number }

export default function useDataPagos(fechaDesde?: string | null) {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!fechaDesde) {
        setData([])
        return
      }

      // Extract user info from localStorage
      let loggedInUserName: string | null = null
      let loggedInUserId: string | number | null = null
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
        if (raw) {
          const parsed = JSON.parse(raw)
          loggedInUserName = parsed.username || parsed.user?.username || parsed.name || parsed.user?.name || null
          loggedInUserId = parsed.id || parsed.user?.id || parsed.sub || parsed.user_id || null
        }
      } catch (e) {
        console.error('Error parsing user from localStorage', e)
      }

      // Ensure fechaDesde has timezone offset if missing (assume Honduras -06:00)
      let since = fechaDesde
      if (since && !since.includes('Z') && !since.includes('+') && !since.match(/-\d\d:\d\d$/)) {
        since = `${since}-06:00`
      }
      // Convert to ISO string to ensure consistent UTC comparison in Supabase
      const sinceIso = since ? new Date(since).toISOString() : null

      // Build query
      let query = supabase
        .from('pagos')
        .select('tipo, monto, valor_moneda, created_at')
        .gte('created_at', sinceIso)

      // Apply user filter if we have user info
      if (loggedInUserName && loggedInUserId) {
        query = query.or(`usuario_nombre.eq.${loggedInUserName},usuario_id.eq.${loggedInUserId}`)
      } else if (loggedInUserName) {
        query = query.eq('usuario_nombre', loggedInUserName)
      } else if (loggedInUserId) {
        query = query.eq('usuario_id', loggedInUserId)
      }

      const { data: pagos, error: pErr } = await query

      if (pErr) {
        setError(pErr)
        setData([])
        return
      }

      const map: Record<string, number> = {}
      if (Array.isArray(pagos)) {
        pagos.forEach((p: any) => {
          const tipo = (p.tipo || 'desconocido').toString()
          let monto = Number(p.monto || 0)
          // If payment type is dollars, convert monto using valor_moneda (format: '1 = 26.27 lps')
          try {
            const t = tipo.toLowerCase()
            if (t.includes('dolar') || t.includes('usd')) {
              const vm = (p.valor_moneda || '').toString()
              // extract numeric factor after '=' (e.g. '1 = 26.27 lps')
              const m = vm.match(/=\s*([0-9.,]+)/)
              if (m && m[1]) {
                const factor = Number(String(m[1]).replace(/,/g, '.')) || 0
                if (factor > 0) monto = Number((monto / factor).toFixed(6))
              }
            }
          } catch (e) {
            // on error, keep original monto
          }
          map[tipo] = (map[tipo] || 0) + monto
        })
      }

      const rows: Row[] = Object.keys(map).sort().map(k => ({ tipo: k, total_monto: map[k] }))
      setData(rows)
    } catch (e) {
      setError(e)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [fechaDesde])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}
