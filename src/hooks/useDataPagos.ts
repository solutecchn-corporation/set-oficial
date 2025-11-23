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
      // fetch pagos since fechaDesde (incluye la columna `valor_moneda` usada para conversión)
      const { data: pagos, error: pErr } = await supabase
        .from('pagos')
        .select('tipo, monto, valor_moneda, created_at')
        .gte('created_at', fechaDesde)
         .eq('usuario_nombre', 'cajero2')  // Filtra por nombre de usuario
        .or('usuario_id.eq.2')  // O filtra por id de usuario

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
