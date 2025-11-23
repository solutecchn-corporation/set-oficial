import React from 'react'
import ModalWrapper from './ModalWrapper'
import supabase from '../lib/supabaseClient'

type NcInfo = {
  cai?: string | null
  identificador?: string | null
  rango_de?: string | null
  rango_hasta?: string | null
  fecha_vencimiento?: string | null
  fecha_limite_emision?: string | null
  secuencia_actual?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  ncInfo?: NcInfo | null
  onRefresh?: () => Promise<void>
}

export default function NotasCreditoModal({ open, onClose, ncInfo, onRefresh }: Props) {
  const [loading, setLoading] = React.useState(false)
  return (
    <ModalWrapper open={open} onClose={onClose} width={520}>
      <div>
        <h3 style={{ marginTop: 0 }}>Notas de crédito</h3>
        <div style={{ color: '#475569', marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}><strong>CAI:</strong> {ncInfo?.cai ?? '-'}</div>
          <div style={{ marginBottom: 8 }}><strong>Identificador:</strong> {ncInfo?.identificador ?? '-'}</div>
          <div style={{ marginBottom: 8 }}><strong>Rango desde:</strong> {ncInfo?.rango_de ?? '-'}</div>
          <div style={{ marginBottom: 8 }}><strong>Rango hasta:</strong> {ncInfo?.rango_hasta ?? '-'}</div>
          <div style={{ marginBottom: 8 }}><strong>Fecha límite emisión:</strong> {ncInfo?.fecha_vencimiento ?? ncInfo?.fecha_limite_emision ?? '-'}</div>
          <div style={{ marginBottom: 8 }}><strong>Secuencia actual:</strong> {ncInfo?.secuencia_actual ?? '-'}</div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-opaque" onClick={onClose} style={{ padding: '8px 12px' }}>Cerrar</button>
          <button
            className="btn-opaque"
            style={{ padding: '8px 12px' }}
            disabled={loading}
            onClick={async () => {
              if (!onRefresh) return
              try {
                setLoading(true)
                await onRefresh()
              } catch (e) {
                console.debug('Error calling onRefresh from NotasCreditoModal:', e)
              } finally {
                setLoading(false)
              }
            }}
          >{loading ? 'Actualizando...' : 'Actualizar'}</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
