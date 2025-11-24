import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabaseClient";

type Row = { tipo: string; total_monto: number };

export default function usePagosVentasAnuladas(
  fechaDesde?: string | null,
  usuarioId?: number | string | null,
  usuarioNombre?: string | null
) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!fechaDesde) {
        setData([]);
        return;
      }

      // Normalize fechaDesde to include timezone if missing (assume Honduras -06:00)
      let since = fechaDesde;
      if (since && !since.includes("Z") && !since.includes("+") && !since.match(/-\d\d:\d\d$/)) {
        since = `${since}-06:00`;
      }
      const sinceIso = since ? new Date(since).toISOString() : null;

      // 1) obtener ids de ventas anuladas desde fecha
      let ventasQuery = supabase.from("ventas").select("id").ilike("estado", "%anulad%");
      if (sinceIso) ventasQuery = ventasQuery.gte("fecha_venta", sinceIso);
      if (usuarioNombre) ventasQuery = ventasQuery.eq("usuario", usuarioNombre);

      const { data: ventasRows, error: ventasErr } = await ventasQuery;
      if (ventasErr) throw ventasErr;

      const ventaIdsRaw = Array.isArray(ventasRows) ? ventasRows.map((v: any) => v.id).filter(Boolean) : [];
      if (ventaIdsRaw.length === 0) {
        setData([]);
        return;
      }

      // Normalizar ids para la consulta IN
      const ventaIds = ventaIdsRaw.every((id: any) => !Number.isNaN(Number(id)))
        ? ventaIdsRaw.map((id: any) => Number(id))
        : ventaIdsRaw.map((id: any) => String(id));

      // 2) obtener pagos relacionados con esas ventas y agregarlos por tipo
      let pagosQuery = supabase
        .from("pagos")
        .select("tipo, monto, valor_moneda, created_at")
        .in("venta_id", ventaIds);

      // Aplicar filtro por fecha de creación (similar a useDataPagos)
      if (sinceIso) pagosQuery = pagosQuery.gte("created_at", sinceIso as any);

      // Aplicar filtro por usuario si se proporciona
      if (usuarioNombre && (usuarioId || usuarioId === 0)) {
        const asNumber = Number(usuarioId);
        if (!Number.isNaN(asNumber)) {
          pagosQuery = pagosQuery.or(`usuario_nombre.eq.${usuarioNombre},usuario_id.eq.${asNumber}`);
        } else {
          pagosQuery = pagosQuery.eq("usuario_nombre", usuarioNombre);
        }
      } else if (usuarioNombre) {
        pagosQuery = pagosQuery.eq("usuario_nombre", usuarioNombre);
      } else if (usuarioId != null && usuarioId !== "") {
        pagosQuery = pagosQuery.eq("usuario_id", usuarioId as any);
      }

      const { data: pagosRows, error: pagosErr } = await pagosQuery;
      if (pagosErr) throw pagosErr;

      const map: Record<string, number> = {};
      if (Array.isArray(pagosRows)) {
        pagosRows.forEach((p: any) => {
          const tipo = (p.tipo || "desconocido").toString();
          let monto = Number(p.monto || 0);
          try {
            const t = tipo.toLowerCase();
            if (t.includes("dolar") || t.includes("usd")) {
              const vm = (p.valor_moneda || "").toString();
              const m = vm.match(/=\s*([0-9.,]+)/);
              if (m && m[1]) {
                const factor = Number(String(m[1]).replace(/,/g, ".")) || 0;
                if (factor > 0) monto = Number((monto / factor).toFixed(6));
              }
            }
          } catch (e) {
            // mantener monto original en caso de error
          }
          map[tipo] = (map[tipo] || 0) + monto;
        });
      }

      const rows: Row[] = Object.keys(map)
        .sort()
        .map((k) => ({ tipo: k, total_monto: map[k] }));

      setData(rows);
    } catch (e) {
      setError(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, usuarioId, usuarioNombre]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
