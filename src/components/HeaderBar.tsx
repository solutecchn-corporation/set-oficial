import React, { useState, useRef, useEffect } from 'react'

type Props = {
  userName?: string | null
  userRole?: string | null
  userId?: number | string | null
  caiInfo?: { cai?: string | null; rango_de?: string | null; rango_hasta?: string | null; fecha_vencimiento?: string | null; secuencia_actual?: string | null } | null
  onOpenDatosFactura?: () => void
  onLogout: () => void
  onNavigate: (view: string | null) => void
  onPrintFormatChange?: (fmt: 'carta' | 'cinta') => void
  printFormat?: 'carta' | 'cinta'
}

export default function HeaderBar({ userName, userRole, userId, caiInfo, onOpenDatosFactura, onLogout, onNavigate, onPrintFormatChange, printFormat }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header style={{
      background: '#1e293b', color: 'white', padding: '14px 20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', position: 'relative'
    }}>
      <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>Solutecc  -  Caja</h1>
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: '0.95rem', color: '#e2e8f0', fontWeight: 500 }}>{userName ? `${userName}` : ''}</div>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{userRole ? `${userRole}` : ''}</div>
        {userId != null && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 2 }}>ID: {String(userId)}</div>}
        {/* CAI moved to DatosFacturaModal; header no longer shows detailed CAI */}
      </div>

      <div style={{ position: 'relative' }} ref={ref}>
        <div style={{ position: 'absolute', right: 120, top: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ color: '#e2e8f0', fontSize: 12 }}>Impresión</label>
          <div style={{ display: 'flex', background: '#0b1724', padding: 4, borderRadius: 20 }}>
            <button onClick={() => { onPrintFormatChange && onPrintFormatChange('carta') }} className={`btn-opaque`} style={{ padding: '6px 8px', background: (printFormat === 'carta') ? '#0ea5e9' : 'transparent', color: '#e2e8f0', borderRadius: 12 }}>Carta</button>
            <button onClick={() => { onPrintFormatChange && onPrintFormatChange('cinta') }} className={`btn-opaque`} style={{ padding: '6px 8px', background: (printFormat === 'cinta') ? '#0ea5e9' : 'transparent', color: '#e2e8f0', borderRadius: 12 }}>Cinta</button>
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-expanded={menuOpen}
          className="btn-opaque"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          Menu ▾
        </button>

        {menuOpen && (
          <div style={{ position: 'absolute', right: 0, marginTop: 8, background: 'white', color: '#0b1724', borderRadius: 8, boxShadow: '0 8px 24px rgba(2,6,23,0.16)', minWidth: 220, zIndex: 60, overflow: 'hidden' }}>
            <button onClick={() => { setMenuOpen(false); onLogout() }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Cerrar Sesión</button>
            <button onClick={() => { setMenuOpen(false); onOpenDatosFactura && onOpenDatosFactura() }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Datos de factura</button>
            <button onClick={() => { setMenuOpen(false); onNavigate('DevolucionCaja') }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Devolución de caja</button>
            <button onClick={() => { setMenuOpen(false); onNavigate('IngresoEfectivo') }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Ingreso de efectivo</button>
            <button onClick={() => { setMenuOpen(false); onNavigate('CotizacionesGuardadas') }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Cotizaciones guardadas</button>
            <button onClick={() => { setMenuOpen(false); onNavigate('PedidosEnLinea') }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Pedidos en línea</button>
            <button onClick={() => { setMenuOpen(false); onNavigate('CorteCajaParcial') }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Corte de caja parcial</button>
            <button onClick={() => { setMenuOpen(false); onNavigate('CorteCajaTotal') }} className="btn-opaque" style={{ width: '100%', background: 'transparent', color: '#0b1724', padding: '10px 12px', textAlign: 'left' }}>Corte de caja total</button>
          </div>
        )}
      </div>
    </header>
  )
}
