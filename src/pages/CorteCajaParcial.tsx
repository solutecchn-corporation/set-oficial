import React, { useEffect, useState } from "react";
import useCajaSession from "../hooks/useCajaSession";
import supabase from "../lib/supabaseClient";
import useHondurasTime from "../lib/useHondurasTime";
import Confirmado from "../components/Confirmado";
import useDevolucionesTotales from "../hooks/useDevolucionesTotales";
import usePagosTotals from "../hooks/usePagosTotals";
import usePagosVentasAnuladas from "../hooks/usePagosVentasAnuladas";
import useDataPagos from "../hooks/useDataPagos";
import useCajaMovimientosTotals from "../hooks/useCajaMovimientosTotals";
import useDataDevoluciones from "../hooks/useDataDevoluciones";
import getCompanyData from "../lib/getCompanyData";

export default function CorteCajaParcial({ onBack }: { onBack: () => void }) {
  const {
    session,
    loading: sessionLoading,
    startSession,
    closeSession,
  } = useCajaSession();
  const [calculating, setCalculating] = useState(false);
  const [startAmount, setStartAmount] = useState<number | "">("");

  // Closing Modal State
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [closeValues, setCloseValues] = useState({
    efectivo: "",
    dolares: "",
    tarjeta: "",
    transferencia: "",
  });

  // Detailed Breakdowns
  const [ingresos, setIngresos] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    dolares: 0,
    total: 0,
  });
  const [anulaciones, setAnulaciones] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    dolares: 0,
    total: 0,
  });
  const [devoluciones, setDevoluciones] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    dolares: 0,
    total: 0,
  });
  const [otrosIngresos, setOtrosIngresos] = useState(0); // From caja_movimientos
  const [otrosEgresos, setOtrosEgresos] = useState(0); // From caja_movimientos

  const { hondurasNowISO } = useHondurasTime();
  const { totals: devolucionesTotals, reload: reloadDevoluciones } =
    useDevolucionesTotales(
      session?.fecha_apertura ?? null,
      session?.usuario ?? null
    );
  const {
    totals: pagosTotals,
    loading: pagosLoading,
    reload: reloadPagos,
  } = usePagosTotals(session?.fecha_apertura ?? null, session?.usuario ?? null);
  // Mostrar agrupación por tipo (suma de monto) — usar la fecha de apertura de la sesión
  const fechaDesdePagos = session?.fecha_apertura ?? null;
  const {
    data: dataPagos,
    loading: dataPagosLoading,
    error: dataPagosError,
    reload: reloadDataPagos,
  } = useDataPagos(fechaDesdePagos);
  const {
    data: cajaMovs,
    loading: cajaMovsLoading,
    error: cajaMovsError,
    reload: reloadCajaMovs,
  } = useCajaMovimientosTotals(fechaDesdePagos, session?.usuario ?? null);

  // extract potential usuario id from localStorage user object (if present)
  let usuarioIdForQuery: string | number | null = null;
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      usuarioIdForQuery =
        parsed && (parsed.id || parsed.user?.id || parsed.sub || parsed.user_id)
          ? parsed.id || parsed.user?.id || parsed.sub || parsed.user_id
          : null;
    }
  } catch (e) {
    usuarioIdForQuery = null;
  }

  const {
    data: pagosVentasAnuladas,
    loading: pagosVentasAnuladasLoading,
    error: pagosVentasAnuladasError,
    reload: reloadPagosVentasAnuladas,
  } = usePagosVentasAnuladas(
    fechaDesdePagos,
    usuarioIdForQuery,
    session?.usuario ?? null
  );

  const {
    data: dataDevoluciones,
    loading: dataDevolucionesLoading,
    error: dataDevolucionesError,
  } = useDataDevoluciones(
    session?.usuario ?? null,
    usuarioIdForQuery,
    session?.fecha_apertura ?? null
  );

  // Debug: mostrar pagosTotals en consola para verificar valores
  React.useEffect(() => {
    try {
      console.debug("usePagosTotals values", { pagosTotals, pagosLoading });
    } catch (e) {}
  }, [pagosTotals, pagosLoading]);

  useEffect(() => {
    if (session) {
      calculateTotals();
    }
  }, [session]);

  const calculateTotals = async () => {
    if (!session) return;
    setCalculating(true);
    try {
      // ensure all data hooks are fresh when recalculating
      const reloadPromises = [];
      if (typeof reloadPagos === "function") reloadPromises.push(reloadPagos());
      if (typeof reloadDataPagos === "function")
        reloadPromises.push(reloadDataPagos());
      if (typeof reloadCajaMovs === "function")
        reloadPromises.push(reloadCajaMovs());

      if (typeof reloadDevoluciones === "function")
        reloadPromises.push(reloadDevoluciones());
      if (typeof reloadPagosVentasAnuladas === "function")
        reloadPromises.push(reloadPagosVentasAnuladas());

      await Promise.allSettled(reloadPromises);

      const user = session.usuario;
      let since = session.fecha_apertura;
      // Ensure since has timezone offset if missing (assume Honduras -06:00)
      if (
        since &&
        !since.includes("Z") &&
        !since.includes("+") &&
        !since.match(/-\d\d:\d\d$/)
      ) {
        since = `${since}-06:00`;
      }
      // Convert to ISO string to ensure consistent UTC comparison in Supabase
      const sinceIso = since ? new Date(since).toISOString() : null;

      // 1. Fetch Pagos (Income & Cancellations)
      // First fetch relevant sales IDs to avoid relying on 'ventas!inner' join which needs explicit FK
      const { data: ventas, error: vErr } = await supabase
        .from("ventas")
        .select("id")
        .eq("usuario", user)
        .gte("fecha_venta", sinceIso);

      if (vErr) console.error("Error fetching ventas for ids:", vErr);

      const newIngresos = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        dolares: 0,
        total: 0,
      };
      const newAnulaciones = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        dolares: 0,
        total: 0,
      };

      if (ventas && ventas.length > 0) {
        // Cast IDs to string to match pagos.venta_id type (text)
        const ventaIds = ventas.map((v: any) => String(v.id));

        const { data: pagos, error: pErr } = await supabase
          .from("pagos")
          .select("monto, tipo")
          .in("venta_id", ventaIds);

        if (pErr) console.error("Error fetching pagos:", pErr);

        if (pagos) {
          pagos.forEach((p: any) => {
            const monto = Number(p.monto || 0);
            const tipo = (p.tipo || "").toLowerCase();

            // Categorize type
            let category:
              | "efectivo"
              | "tarjeta"
              | "transferencia"
              | "dolares"
              | null = null;
            if (tipo.includes("efectivo") || tipo === "cash")
              category = "efectivo";
            else if (tipo.includes("tarjeta") || tipo === "card")
              category = "tarjeta";
            else if (tipo.includes("transferencia") || tipo === "transfer")
              category = "transferencia";
            else if (tipo.includes("dolar") || tipo === "usd")
              category = "dolares";

            if (category) {
              if (monto >= 0) {
                newIngresos[category] += monto;
                newIngresos.total += monto;
              } else {
                // Anulaciones (negative values)
                newAnulaciones[category] += Math.abs(monto);
                newAnulaciones.total += Math.abs(monto);
              }
            }
          });
        }
      }
      setIngresos(newIngresos);
      setAnulaciones(newAnulaciones);

      // 2. Fetch Movimientos (Otros Ingresos/Egresos manuales)
      let movs: any[] = [];
      const tableCandidates = ["caja_movimientos"];
      for (const tbl of tableCandidates) {
        const { data: mData, error: mErr } = await supabase
          .from(tbl)
          .select("monto, tipo_movimiento")
          .eq("usuario", user)
          .gte("fecha", since);

        if (!mErr && mData) {
          movs = mData;
          break;
        }
      }

      let totalIng = 0;
      let totalEgr = 0;
      movs.forEach((m: any) => {
        const tipo = (m.tipo_movimiento || "").toLowerCase();
        const monto = Number(m.monto || 0);
        if (tipo === "ingreso") totalIng += monto;
        if (tipo === "egreso") totalEgr += monto;
      });
      setOtrosIngresos(totalIng);
      setOtrosEgresos(totalEgr);

      // Devoluciones ahora manejadas por el hook `useDevolucionesTotales`.
      // Sincronizar valores devueltos por el hook (si existen) a nuestro estado local.
      try {
        if (devolucionesTotals) {
          setDevoluciones(devolucionesTotals);
        }
      } catch (e) {
        console.debug("Error syncing devoluciones from hook", e);
      }
    } catch (e) {
      console.error("Error calculating totals:", e);
    } finally {
      setCalculating(false);
    }
  };

  const handleStartSession = async () => {
    if (startAmount === "" || Number(startAmount) < 0)
      return alert("Ingrese un monto inicial válido");
    try {
      await startSession(Number(startAmount));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const currencyFmt = (v: number) =>
    new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" })
      .format(v)
      .replace("HNL", "L");

  if (sessionLoading)
    return <div style={{ padding: 20 }}>Cargando sesión...</div>;

  if (!session) {
    return (
      <div
        style={{
          padding: 20,
          maxWidth: 500,
          margin: "40px auto",
          textAlign: "center",
        }}
      >
        <h2>No hay sesión de caja activa</h2>
        <p>
          Para comenzar a vender y registrar movimientos, debes abrir una sesión
          de caja.
        </p>
        <div
          style={{
            marginTop: 20,
            background: "white",
            padding: 20,
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: 10,
              textAlign: "left",
              fontWeight: 600,
            }}
          >
            Monto Inicial (L)
          </label>
          <input
            type="number"
            className="input"
            value={startAmount}
            onChange={(e) => setStartAmount(Number(e.target.value))}
            placeholder="0.00"
            style={{ width: "100%", marginBottom: 16 }}
          />
          <button
            className="btn-primary"
            style={{ width: "100%" }}
            onClick={handleStartSession}
          >
            Abrir Caja
          </button>
        </div>
        <button
          onClick={onBack}
          className="btn-opaque"
          style={{ marginTop: 20 }}
        >
          Volver
        </button>
      </div>
    );
  }

  const netCashSales = ingresos.efectivo - anulaciones.efectivo;
  const saldoTeorico =
    (session.monto_inicial || 0) +
    netCashSales +
    otrosIngresos -
    otrosEgresos -
    devoluciones.efectivo;

  // --- Calculation Logic for Tables ---
  const categories = [
    "efectivo",
    "dolares",
    "tarjeta",
    "transferencia",
  ] as const;

  const normalizeTipo = (s: string = "") => {
    const t = s.toLowerCase();
    if (t.includes("efect")) return "efectivo";
    if (t.includes("dolar") || t.includes("usd")) return "dolares";
    if (t.includes("tarj")) return "tarjeta";
    if (t.includes("transfer")) return "transferencia";
    return "efectivo";
  };

  // pagos totals (from usePagosTotals)
  const pagosByCat: Record<string, number> = {
    efectivo: Number((pagosTotals && pagosTotals.efectivo) || 0),
    dolares: Number((pagosTotals && pagosTotals.dolares) || 0),
    tarjeta: Number((pagosTotals && pagosTotals.tarjeta) || 0),
    transferencia: Number((pagosTotals && pagosTotals.transferencia) || 0),
  };

  // caja movimientos -> split into ingresos/egresos by detecting keywords in tipo_movimiento
  const cajaIngresos: Record<string, number> = {
    efectivo: 0,
    dolares: 0,
    tarjeta: 0,
    transferencia: 0,
  };
  const cajaEgresos: Record<string, number> = {
    efectivo: 0,
    dolares: 0,
    tarjeta: 0,
    transferencia: 0,
  };
  if (Array.isArray(cajaMovs)) {
    cajaMovs.forEach((r: any) => {
      const tipo = String(r.tipo_movimiento || "").toLowerCase();
      const cat = normalizeTipo(tipo);
      const monto = Number(r.total_monto || r.monto || 0);
      const isEgreso =
        tipo.includes("egreso") ||
        tipo.includes("salida") ||
        tipo.includes("salir") ||
        tipo.includes("retirada");
      const isIngreso =
        tipo.includes("ingreso") || tipo.includes("entrada") || !isEgreso;
      if (isEgreso) cajaEgresos[cat] = (cajaEgresos[cat] || 0) + monto;
      else if (isIngreso) cajaIngresos[cat] = (cajaIngresos[cat] || 0) + monto;
    });
  }

  // anulaciones: calcular usando los pagos asociados a ventas anuladas
  // usePagosVentasAnuladas ya devuelve agregación por `tipo` sumando los `monto` de la tabla `pagos`
  const anulacionesByCat: Record<string, number> = {
    efectivo: 0,
    dolares: 0,
    tarjeta: 0,
    transferencia: 0,
  };
  if (Array.isArray(pagosVentasAnuladas)) {
    pagosVentasAnuladas.forEach((r: any) => {
      const key = String(r.tipo || "").toLowerCase();
      const cat = normalizeTipo(key);
      const monto = Number(r.total_monto || 0);
      anulacionesByCat[cat] = (anulacionesByCat[cat] || 0) + monto;
    });
  }

  // devoluciones totals from useDevolucionesTotales
  const devolucionesByCat: Record<string, number> = {
    efectivo: 0,
    dolares: 0,
    tarjeta: 0,
    transferencia: 0,
  };
  if (devolucionesTotals) {
    devolucionesByCat.efectivo = Number(devolucionesTotals.efectivo || 0);
    devolucionesByCat.dolares = Number(devolucionesTotals.dolares || 0);
    devolucionesByCat.tarjeta = Number(devolucionesTotals.tarjeta || 0);
    devolucionesByCat.transferencia = Number(
      devolucionesTotals.transferencia || 0
    );
  }

  // Calculate Nets for Closing
  const getNet = (cat: string) =>
    (pagosByCat[cat] || 0) +
    (cajaIngresos[cat] || 0) -
    ((cajaEgresos[cat] || 0) +
      (anulacionesByCat[cat] || 0) +
      (devolucionesByCat[cat] || 0));

  const handleCloseBox = async () => {
    // open the modal instead of browser confirm — handled by UI: close modal already shows inputs
    setClosing(true);

    // 1.2s delay for loading effect
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const obtained: Record<string, number> = {
      efectivo: getNet("efectivo"),
      dolares: getNet("dolares"),
      tarjeta: getNet("tarjeta"),
      transferencia: getNet("transferencia"),
    };

    const registered: Record<string, number> = {
      efectivo: Number(closeValues.efectivo) || 0,
      dolares: Number(closeValues.dolares) || 0,
      tarjeta: Number(closeValues.tarjeta) || 0,
      transferencia: Number(closeValues.transferencia) || 0,
    };

    const totalObtained = Object.values(obtained).reduce((a, b) => a + b, 0);
    const totalRegistered = Object.values(registered).reduce(
      (a, b) => a + b,
      0
    );
    const difference = totalRegistered - totalObtained;

    try {
      // Fetch company data for report
      const company = await getCompanyData();

      await closeSession({
        total_ingresos: ingresos.total + otrosIngresos,
        total_egresos: otrosEgresos + devoluciones.total,
        saldo_final: totalRegistered, // Using registered amount as final balance
        efectivo_obtenido: obtained.efectivo,
        dolares_obtenido: obtained.dolares,
        tarjeta_obtenido: obtained.tarjeta,
        transferencia_obtenido: obtained.transferencia,
        efectivo_registrado: registered.efectivo,
        dolares_registrado: registered.dolares,
        tarjeta_registrado: registered.tarjeta,
        transferencia_registrado: registered.transferencia,
        diferencia: difference,
      });

      // Generate Report HTML
      const logoHtml = company?.logoUrl
        ? `<img src="${company.logoUrl}" class="logo" alt="Logo" />`
        : "";
      const now = new Date();

      const reportHtml = `
        <html>
        <head>
          <title>Reporte de Cierre de Caja</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .logo { max-height: 80px; margin-bottom: 10px; }
            .company-name { font-size: 24px; font-weight: bold; margin: 5px 0; color: #2c3e50; }
            .info { font-size: 13px; color: #7f8c8d; margin-bottom: 2px; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin: 30px 0; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #333; padding: 10px; }
            .session-info { margin-bottom: 30px; font-size: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            th, td { border: 1px solid #e0e0e0; padding: 10px; text-align: right; }
            th { background-color: #f8f9fa; font-weight: bold; text-align: center; color: #2c3e50; }
            .text-left { text-align: left; }
            .totals { margin-top: 30px; border-top: 2px solid #333; padding-top: 20px; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; font-size: 14px; }
            .final-balance { font-size: 18px; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 15px; }
            .signatures { margin-top: 80px; display: flex; justify-content: space-between; }
            .sig-line { border-top: 1px solid #333; width: 40%; text-align: center; padding-top: 10px; font-size: 13px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <div class="company-name">${
              company?.nombre_empresa || "Nombre Empresa"
            }</div>
            <div class="info">${company?.direccion || ""}</div>
            <div class="info">RTN: ${company?.rtn || "N/A"} | Tel: ${
        company?.telefono || ""
      }</div>
            <div class="info">${company?.email || ""}</div>
          </div>

          <div class="title">Reporte de Cierre de Caja</div>

          <div class="session-info">
            <div><strong>Cajero:</strong> ${session.usuario}</div>
            <div><strong>ID Sesión:</strong> #${session.id}</div>
            <div><strong>Apertura:</strong> ${new Date(
              session.fecha_apertura
            ).toLocaleString()}</div>
            <div><strong>Cierre:</strong> ${now.toLocaleString()}</div>
            <div><strong>Monto Inicial:</strong> ${currencyFmt(
              session.monto_inicial
            )}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="text-left">Medio de Pago</th>
                <th>Sistema (Calc)</th>
                <th>Registrado (Real)</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              ${categories
                .map(
                  (cat) => `
                <tr>
                  <td class="text-left" style="text-transform: capitalize">${cat}</td>
                  <td>${currencyFmt(obtained[cat])}</td>
                  <td>${currencyFmt(registered[cat])}</td>
                  <td style="color: ${
                    registered[cat] - obtained[cat] < 0 ? "red" : "black"
                  }">${currencyFmt(registered[cat] - obtained[cat])}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Total Ingresos (Sistema):</span>
              <span>${currencyFmt(ingresos.total + otrosIngresos)}</span>
            </div>
            <div class="total-row">
              <span>Total Egresos (Sistema):</span>
              <span>${currencyFmt(otrosEgresos + devoluciones.total)}</span>
            </div>
            <div class="total-row final-balance">
              <span>Saldo Final Registrado:</span>
              <span>${currencyFmt(totalRegistered)}</span>
            </div>
             <div class="total-row" style="color: ${
               difference < 0 ? "red" : "black"
             }">
              <span>Diferencia Total:</span>
              <span>${currencyFmt(difference)}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-line">Firma Cajero</div>
            <div class="sig-line">Firma Supervisor</div>
          </div>

          <script>
            // Wait for images to load before printing
            window.onload = function() { 
              setTimeout(function() {
                window.print(); 
                // Optional: window.close(); 
              }, 500);
            }
          </script>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(reportHtml);
        printWindow.document.close();
      }

      setClosing(false);
      setCloseModalOpen(false);
      setSuccessOpen(true);
    } catch (e: any) {
      setClosing(false);
      setErrorMessage(e?.message || String(e));
      setErrorOpen(true);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "24px auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Datos de caja </h2>
          <div style={{ color: "#64748b", fontSize: 14 }}>
            Sesión iniciada el:{" "}
            {new Date(session.fecha_apertura).toLocaleString()} por{" "}
            <strong>{session.usuario}</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={calculateTotals}
            className="btn-opaque"
            disabled={calculating}
          >
            {calculating ? "Calculando..." : "Actualizar datos"}
          </button>
          <button onClick={onBack} className="btn-opaque">
            Volver
          </button>
        </div>
      </header>

      {/* Tabla: Corte de Caja Parcial (resumen por tipo de pago) */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "8px 0" }}>Resumen Parcial - Corte de Caja</h3>

        <div
          style={{
            background: "white",
            borderRadius: 8,
            padding: 12,
            boxShadow: "0 4px 18px rgba(2,6,23,0.08)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "Inter, system-ui, -apple-system",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "12px 16px",
                    color: "#0f172a",
                  }}
                >
                  Medio / Columna
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "12px 16px",
                    color: "#0f172a",
                  }}
                >
                  Pagos
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "12px 16px",
                    color: "#0f172a",
                  }}
                >
                  Ingresos
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "12px 16px",
                    color: "#0f172a",
                  }}
                >
                  Egresos
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "12px 16px",
                    color: "#0f172a",
                  }}
                >
                  Anulaciones
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "12px 16px",
                    color: "#0f172a",
                  }}
                >
                  Devoluciones
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: "#0b1220",
                      textTransform: "capitalize",
                    }}
                  >
                    {cat}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      color: "#0ea5e9",
                    }}
                  >
                    {currencyFmt(pagosByCat[cat] || 0)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      color: "#10b981",
                    }}
                  >
                    {currencyFmt(cajaIngresos[cat] || 0)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      color: "#ef4444",
                    }}
                  >
                    {currencyFmt(cajaEgresos[cat] || 0)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      color: "#f50b0bff",
                    }}
                  >
                    {currencyFmt(anulacionesByCat[cat] || 0)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      color: "#f10606ff",
                    }}
                  >
                    {currencyFmt(devolucionesByCat[cat] || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #e6eef7" }}>
                <td style={{ padding: "12px 16px", fontWeight: 800 }}>
                  Totales
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {currencyFmt(
                    Object.values(pagosByCat).reduce((s, n) => s + n, 0)
                  )}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {currencyFmt(
                    Object.values(cajaIngresos).reduce((s, n) => s + n, 0)
                  )}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {currencyFmt(
                    Object.values(cajaEgresos).reduce((s, n) => s + n, 0)
                  )}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {currencyFmt(
                    Object.values(anulacionesByCat).reduce((s, n) => s + n, 0)
                  )}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {currencyFmt(
                    Object.values(devolucionesByCat).reduce((s, n) => s + n, 0)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Nueva Tabla: Resumen Neto por Medio de Pago */}
      <section style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "8px 0", fontSize: 14 }}></h3>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div
            style={{
              background: "white",
              borderRadius: 6,
              padding: 8,
              boxShadow: "0 2px 8px rgba(2,6,23,0.06)",
              maxWidth: 400,
              flex: "0 0 400px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "Inter, system-ui, -apple-system",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px",
                      color: "#0f172a",
                    }}
                  >
                    Resumen actual--Medio de Pago
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "6px 8px",
                      color: "#0f172a",
                    }}
                  >
                    Total Neto
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const net =
                    (pagosByCat[cat] || 0) +
                    (cajaIngresos[cat] || 0) -
                    ((cajaEgresos[cat] || 0) +
                      (anulacionesByCat[cat] || 0) +
                      (devolucionesByCat[cat] || 0));
                  return (
                    <tr key={cat} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontWeight: 600,
                          color: "#0b1220",
                          textTransform: "capitalize",
                        }}
                      >
                        {cat}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: net >= 0 ? "#10b981" : "#ef4444",
                        }}
                      >
                        {currencyFmt(net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            className="btn-primary"
            style={{
              fontSize: 14,
              padding: "12px 24px",
              height: "fit-content",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
            }}
            onClick={() => setCloseModalOpen(true)}
          >
            Registrar Corte Total
          </button>
        </div>
      </section>

      {/* Modal de Cierre de Caja */}
      {closeModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              padding: 24,
              borderRadius: 12,
              width: 400,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>
              Ingreso de valores
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Efectivo en Caja
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  value={closeValues.efectivo}
                  onChange={(e) =>
                    setCloseValues({ ...closeValues, efectivo: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Dólares en Caja
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  value={closeValues.dolares}
                  onChange={(e) =>
                    setCloseValues({ ...closeValues, dolares: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Total Tarjeta (Voucher)
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  value={closeValues.tarjeta}
                  onChange={(e) =>
                    setCloseValues({ ...closeValues, tarjeta: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Total Transferencias
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: "100%" }}
                  value={closeValues.transferencia}
                  onChange={(e) =>
                    setCloseValues({
                      ...closeValues,
                      transferencia: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 24,
              }}
            >
              <button
                className="btn-opaque"
                onClick={() => setCloseModalOpen(false)}
                disabled={closing}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCloseBox}
                disabled={closing}
              >
                {closing ? "Cerrando..." : "Registrar Cierre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {closing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,255,255,0.8)",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: "4px solid #e2e8f0",
              borderTopColor: "#0f172a",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <div style={{ marginTop: 16, fontWeight: 600, color: "#0f172a" }}>
            Procesando Cierre...
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {/* Success / Error modals */}
      <Confirmado
        open={successOpen}
        title="Cierre exitoso"
        message="La caja se cerró correctamente. Se actualizarán los datos del sistema."
        onClose={async () => {
          setSuccessOpen(false);
          // attempt to refresh all hooks and UI
          try {
            const toReload: Promise<any>[] = [];
            if (typeof reloadPagos === "function") toReload.push(reloadPagos());
            if (typeof reloadDataPagos === "function")
              toReload.push(reloadDataPagos());
            if (typeof reloadCajaMovs === "function")
              toReload.push(reloadCajaMovs());

            if (typeof reloadDevoluciones === "function")
              toReload.push(reloadDevoluciones());
            if (typeof reloadPagosVentasAnuladas === "function")
              toReload.push(reloadPagosVentasAnuladas());
            await Promise.allSettled(toReload);
          } catch (e) {
            /* ignore */
          }
          try {
            onBack();
          } catch (e) {
            /* ignore */
          }
          // final safety: reload page to ensure global state (optional fallback)
          setTimeout(() => {
            try {
              window.location.reload();
            } catch (e) {}
          }, 400);
        }}
      />

      <Confirmado
        open={errorOpen}
        title="Error al cerrar caja"
        message={errorMessage}
        onClose={() => setErrorOpen(false)}
      />
    </div>
  );
}

function BreakdownRow({
  label,
  ventas = 0,
  ing,
  anl,
  dev,
}: {
  label: string;
  ventas?: number;
  ing: number;
  anl: number;
  dev: number;
}) {
  const currency = (v: number) =>
    new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" })
      .format(v)
      .replace("HNL", "L");
  const net = ing - anl - dev;
  return (
    <tr
      style={{
        borderBottom: "1px solid #f1f5f9",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafbfc")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td
        style={{
          padding: "14px 16px",
          fontWeight: 600,
          color: "#1e293b",
          fontSize: 14,
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "14px 16px",
          textAlign: "right",
          color: "#0ea5e9",
          fontWeight: 600,
        }}
      >
        {currency(ventas)}
      </td>
      <td
        style={{
          padding: "14px 16px",
          textAlign: "right",
          color: "#10b981",
          fontWeight: 500,
        }}
      >
        {currency(ing)}
      </td>
      <td
        style={{
          padding: "14px 16px",
          textAlign: "right",
          color: "#f59e0b",
          fontWeight: 500,
        }}
      >
        {currency(anl)}
      </td>
      <td
        style={{
          padding: "14px 16px",
          textAlign: "right",
          color: "#ef4444",
          fontWeight: 500,
        }}
      >
        {currency(dev)}
      </td>
      <td
        style={{
          padding: "14px 16px",
          textAlign: "right",
          fontWeight: 700,
          fontSize: 15,
          color: net >= 0 ? "#059669" : "#dc2626",
          background: net >= 0 ? "#f0fdf4" : "#fef2f2",
          borderLeft: `3px solid ${net >= 0 ? "#10b981" : "#ef4444"}`,
        }}
      >
        {net >= 0 ? "+" : ""}
        {currency(net)}
      </td>
    </tr>
  );
}

function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const currency = (v: number) =>
    new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL" })
      .format(v)
      .replace("HNL", "L");
  return (
    <div
      style={{
        background: "white",
        padding: 16,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        borderTop: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
        {currency(value)}
      </div>
    </div>
  );
}
