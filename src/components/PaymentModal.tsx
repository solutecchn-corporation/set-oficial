import React, { useState, useEffect } from 'react'

type PaymentPayload = {
  efectivo: number
  tarjeta: number
  transferencia: number
  totalPaid: number
  tipoPagoString: string
}

export default function PaymentModal({ open, onClose, totalDue, onConfirm }:
  { open: boolean, onClose: () => void, totalDue: number, onConfirm: (p: PaymentPayload) => void }) {
  const [efectivo, setEfectivo] = useState<number>(0)
  const [tarjeta, setTarjeta] = useState<number>(0)
  const [transferencia, setTransferencia] = useState<number>(0)

  useEffect(() => {
    if (!open) {
      setEfectivo(0); setTarjeta(0); setTransferencia(0)
    }
  }, [open])

  const totalPaid = Number((Number(efectivo) + Number(tarjeta) + Number(transferencia)).toFixed(2))
  const remaining = Number((totalDue - totalPaid).toFixed(2))
  const canConfirm = totalPaid >= totalDue && totalPaid > 0

  const handleConfirm = () => {
    const parts: string[] = []
    if (efectivo > 0) parts.push(`efectivo:(${efectivo.toFixed(2)})`)
    if (tarjeta > 0) parts.push(`tarjeta:(${tarjeta.toFixed(2)})`)
    if (transferencia > 0) parts.push(`transferencia:(${transferencia.toFixed(2)})`)
    const tipoPagoString = parts.join(',')
    onConfirm({ efectivo, tarjeta, transferencia, totalPaid, tipoPagoString })
    onClose()
  }

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }}>
      <div style={{ width: 520, maxWidth: '95%', background: 'white', borderRadius: 10, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Registrar Pago</h3>
          <button onClick={onClose} className="btn-opaque">Cerrar</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>Total a pagar: <strong>L {totalDue.toFixed(2)}</strong></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label>Efectivo</label>
              <input type="number" value={efectivo} onChange={e => setEfectivo(Number(e.target.value || 0))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6edf3' }} />
            </div>
            <div>
              <label>Tarjeta</label>
              <input type="number" value={tarjeta} onChange={e => setTarjeta(Number(e.target.value || 0))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6edf3' }} />
            </div>
            <div>
              <label>Transferencia</label>
              <input type="number" value={transferencia} onChange={e => setTransferencia(Number(e.target.value || 0))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e6edf3' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                <label>Total ingresado</label>
                <div style={{ padding: 8, borderRadius: 6, border: '1px solid #e6edf3' }}>L {totalPaid.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {remaining > 0 ? (
              <div style={{ color: '#ef4444' }}>Falta: L {remaining.toFixed(2)}</div>
            ) : (
              <div style={{ color: '#16a34a' }}>Pago completo. Cambio/Exceso: L {Math.abs(remaining).toFixed(2)}</div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} className="btn-opaque" style={{ background: 'transparent' }}>Cancelar</button>
            <button onClick={handleConfirm} className="btn-opaque" disabled={!canConfirm} style={{ background: canConfirm ? '#16a34a' : 'gray', color: 'white' }}>Confirmar pago</button>
          </div>
        </div>
      </div>
    </div>
  )
}
