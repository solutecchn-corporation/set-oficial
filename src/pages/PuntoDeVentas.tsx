import React, { useState, useEffect, useRef } from 'react';
import DevolucionCaja from './DevolucionCaja'
import IngresoEfectivo from './IngresoEfectivo'
import CotizacionesGuardadas from './CotizacionesGuardadas'
import PedidosEnLinea from './PedidosEnLinea'
import CorteCajaParcial from './CorteCajaParcial'
import CorteCajaTotal from './CorteCajaTotal'
import supabase from '../lib/supabaseClient'
import ClienteSearchModal from '../components/ClienteSearchModal'
import PaymentModal from '../components/PaymentModal'
import ProductTable from '../components/ProductTable'
import Cart from '../components/Cart'
import HeaderBar from '../components/HeaderBar'
import DatosFacturaModal from '../components/DatosFacturaModal'
import ModalWrapper from '../components/ModalWrapper'
import ImageFallback from '../components/ImageFallback'
import LocationModal from '../components/LocationModal'
import CotizacionConfirmModal from '../components/CotizacionConfirmModal'
import FacturarSelectorModal from '../components/FacturarSelectorModal'
import ClienteNormalModal from '../components/ClienteNormalModal'
import CreateClienteModal from '../components/CreateClienteModal'
import { generateFacturaHTML } from '../lib/generateFacturaHTML'
import generateFacturaHTMLCinta from '../lib/generedordefacturahtmlcinta'

type Producto = {
  id: string;
  sku?: string;
  nombre?: string;
  precio?: number;
  categoria?: string;
  exento?: boolean;
  aplica_impuesto_18?: boolean;
  aplica_impuesto_turistico?: boolean;
  stock?: number;
  imagen?: string;
};

type ItemCarrito = {
  producto: Producto;
  cantidad: number;
};


export default function PuntoDeVentas({ onLogout }: { onLogout: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || ''; };
  }, []);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [taxRate, setTaxRate] = useState<number>(0.15) // default ISV 15%
  const [tax18Rate, setTax18Rate] = useState<number>(0) // default 0.18 (18%)
  const [taxTouristRate, setTaxTouristRate] = useState<number>(0) // default 0.04 (4%)

  const categorias = ['Todas', ...Array.from(new Set(productos.map(p => p.categoria)))]

  const productosFiltrados = productos.filter(p =>
    ((String(p.nombre || '').toLowerCase().includes(busqueda.toLowerCase())) ||
     (String(p.sku || '').toLowerCase().includes(busqueda.toLowerCase()))) &&
    (categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro)
  );

  const grossTotal = carrito.reduce((sum, item) => sum + (Number(item.producto.precio || 0) * item.cantidad), 0);
  // Compute taxes as included in the item price (price includes taxes).
  // For each item, extract the tax portion: taxAmount = price - price / (1 + combinedRate)
  // Then split the taxAmount between main tax (ISV 15% or 18%) and tourist tax proportionally.
  let isvTotal = 0
  let imp18Total = 0
  let impTouristTotal = 0
  for (const item of carrito) {
    const price = Number(item.producto.precio || 0) * item.cantidad
    const exento = Boolean(item.producto.exento)
    const aplica18 = Boolean((item.producto as any).aplica_impuesto_18)
    const aplicaTur = Boolean((item.producto as any).aplica_impuesto_turistico)
    if (exento) continue
    const mainRate = aplica18 ? (tax18Rate || 0) : (taxRate || 0)
    const turRate = aplicaTur ? (taxTouristRate || 0) : 0
    const combined = (Number(mainRate) || 0) + (Number(turRate) || 0)
    if (combined <= 0) continue
    const taxAmount = price - (price / (1 + combined))
    // split taxAmount proportionally
    if (aplica18) {
      imp18Total += taxAmount * (mainRate / combined)
    } else {
      isvTotal += taxAmount * (mainRate / combined)
    }
    if (aplicaTur) {
      impTouristTotal += taxAmount * (turRate / combined)
    }
  }
  // total is the gross total (prices include taxes); subtotal (net) is gross minus extracted taxes
  const total = grossTotal
  const subtotal = Math.max(0, grossTotal - (isvTotal + imp18Total + impTouristTotal))
  // Per-item tax breakdown for UI/debugging
  const perItemTaxes = carrito.map(item => {
    const price = Number(item.producto.precio || 0) * item.cantidad
    const exento = Boolean(item.producto.exento)
    const aplica18 = Boolean((item.producto as any).aplica_impuesto_18)
    const aplicaTur = Boolean((item.producto as any).aplica_impuesto_turistico)
    if (exento) return { id: item.producto.id, nombre: item.producto.nombre, price, isv: 0, imp18: 0, tur: 0, totalTax: 0 }
    const mainRate = aplica18 ? (tax18Rate || 0) : (taxRate || 0)
    const turRate = aplicaTur ? (taxTouristRate || 0) : 0
    const combined = (Number(mainRate) || 0) + (Number(turRate) || 0)
    if (combined <= 0) return { id: item.producto.id, nombre: item.producto.nombre, price, isv: 0, imp18: 0, tur: 0, totalTax: 0 }
    const taxAmount = price - (price / (1 + combined))
    const isvPart = aplica18 ? 0 : taxAmount * (mainRate / combined)
    const imp18Part = aplica18 ? taxAmount * (mainRate / combined) : 0
    const turPart = aplicaTur ? taxAmount * (turRate / combined) : 0
    return { id: item.producto.id, nombre: item.producto.nombre, price, isv: isvPart, imp18: imp18Part, tur: turPart, totalTax: isvPart + imp18Part + turPart }
  })

  const agregarAlCarrito = (producto: Producto) => {
    const stockNum = Number(producto.stock ?? 0)
    const precioNum = Number(producto.precio ?? 0)
    if (stockNum < 1) return;
    if (precioNum <= 0) return;
    setCarrito(prev => {
      const existente = prev.find(i => i.producto.id === producto.id);
      if (existente) {
        return prev.map(i =>
          i.producto.id === producto.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const actualizarCantidad = (id: any, cambio: number) => {
    setCarrito(prev =>
      prev.map(item => {
        if (String(item.producto.id) === String(id)) {
          const nuevaCant = item.cantidad + cambio;
          return nuevaCant > 0 ? { ...item, cantidad: nuevaCant } : item;
        }
        return item;
      }).filter(item => item.cantidad > 0)
    );
  };

  const eliminarDelCarrito = (id: any) => {
    setCarrito(prev => prev.filter(i => String(i.producto.id) !== String(id)));
  };

  const vaciarCarrito = () => setCarrito([]);

  const generarTicket = (tipo: 'cotizacion' | 'factura') => {
    const ticket = `
  ${tipo === 'factura' ? '=== FACTURA ===' : '=== COTIZACIÓN ==='}
  SET - Punto de Ventas
  Fecha: ${new Date().toLocaleString('es-HN')}
  ----------------------------------------
  ${carrito.map(i => `${i.producto.sku} | ${i.producto.nombre} x${i.cantidad} = L${(Number(i.producto.precio || 0) * i.cantidad).toFixed(2)}`).join('\n')}
  ----------------------------------------
  Subtotal: L${subtotal.toFixed(2)}
  ISV (${(taxRate*100).toFixed(2)}%): L${isvTotal.toFixed(2)}
  Impuesto 18%: L${imp18Total.toFixed(2)}
  Impuesto turístico (${(taxTouristRate*100).toFixed(2)}%): L${impTouristTotal.toFixed(2)}
  TOTAL: L${total.toFixed(2)}
  ${tipo === 'factura' ? '\n¡Gracias por su compra!' : '\nVálida por 24 horas'}
    `.trim();
    alert(ticket);
    if (tipo === 'factura') vaciarCarrito();
  };

  // Facturación: modal de selección y generación de factura HTML
  const [facturarModalOpen, setFacturarModalOpen] = useState(false)
  const [printingMode, setPrintingMode] = useState<'factura'|'cotizacion'>('factura')
  // confirmación para guardar cotización (aparecerá AL FINAL del flujo)
  const [cotizacionConfirmOpen, setCotizacionConfirmOpen] = useState(false)
  const [cotizacionPendingClient, setCotizacionPendingClient] = useState<{ cliente?: string; rtn?: string | null } | null>(null)
  const [cotizacionEditId, setCotizacionEditId] = useState<string | null>(null)
  const [clienteNormalModalOpen, setClienteNormalModalOpen] = useState(false)
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteRTN, setClienteRTN] = useState('')
    const clienteNombreRef = useRef<HTMLInputElement | null>(null);
    const clienteNombreInputRef = useRef<HTMLInputElement | null>(null);
  const [clienteTipo, setClienteTipo] = useState<'final'|'normal'|'juridico'>('final')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteCorreo, setClienteCorreo] = useState('')
  const [clienteExonerado, setClienteExonerado] = useState<boolean>(false)
  const [createClienteModalOpen, setCreateClienteModalOpen] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentDone, setPaymentDone] = useState(false)
  const [paymentInfo, setPaymentInfo] = useState<any | null>(null)
  const [invoiceAfterPayment, setInvoiceAfterPayment] = useState(false)
  const [printFormat, setPrintFormat] = useState<'carta' | 'cinta'>('carta')

  // Autocomplete RTN -> nombre: intenta traer nombre desde `clientenatural` o `clientejuridico` según `clienteTipo`
  const handleRTNChange = async (val: string) => {
    setClienteRTN(val)
    if (!val || String(val).trim() === '') {
      setClienteNombre('')
      return
    }
    try {
      if (clienteTipo === 'juridico') {
        console.debug('handleRTNChange: buscando cliente juridico para RTN=', val)
        const { data, error } = await supabase.from('clientes').select('id,nombre,telefono,correo_electronico,exonerado').eq('rtn', val).eq('tipo_cliente','juridico').maybeSingle()
        console.debug('handleRTNChange: supabase response', { data, error })
        if (!error && data && (data as any).nombre) {
          setClienteNombre((data as any).nombre || '')
          setClienteTelefono((data as any).telefono || '')
          setClienteCorreo((data as any).correo_electronico || '')
          setClienteExonerado(Boolean((data as any).exonerado))
          setTimeout(() => { try { clienteNombreInputRef.current?.focus() } catch (e) {} }, 50)
          return
        } else {
          setClienteNombre('')
          setClienteTelefono('')
          setClienteCorreo('')
          setClienteExonerado(false)
          return
        }
      }
      const tableName = 'clientenatural'
      console.debug('handleRTNChange: buscando clientenatural para RTN=', val)
      const { data, error } = await supabase.from(tableName).select('nombre').eq('rtn', val).maybeSingle()
      console.debug('handleRTNChange: supabase response clientenatural', { data, error })
      if (!error && data && (data as any).nombre) {
        setClienteNombre((data as any).nombre || '')
        // mover foco al nombre para permitir edición si el usuario quiere
        setTimeout(() => { try { clienteNombreInputRef.current?.focus() } catch (e) {} }, 50)
      } else {
        // no existe, limpiar nombre para nuevo registro
        setClienteNombre('')
      }
    } catch (e) {
      console.warn('Error buscando cliente por RTN:', e)
    }
  }

  const openSelector = (mode: 'factura'|'cotizacion') => {
    if (mode === 'cotizacion') {
      // iniciar flujo de cotización (la confirmación para guardar se hará al final)
      setPrintingMode('cotizacion')
      setFacturarModalOpen(true)
      return
    }
    setPrintingMode(mode)
    setFacturarModalOpen(true)
  }

  // guarda la cotización y sus detalles en la base de datos
  const saveCotizacion = async (opts: { cliente?: string, rtn?: string | null, cliente_id?: number, cotizacion_id?: string | number } = {}) => {
    try {
      if (!carrito || carrito.length === 0) return null
      const subtotalVal = subtotalCalc()
      const isvVal = isvTotal
      const imp18Val = imp18Total
      const impTurVal = impTouristTotal
      const impuestoVal = Number(isvVal || 0) + Number(imp18Val || 0) + Number(impTurVal || 0)
      const totalVal = subtotalVal + impuestoVal

      // try resolve cliente_id if rtn provided or use opts.cliente_id
      let clienteId: number | null = opts.cliente_id ?? null
      if (!clienteId && opts.rtn) {
        try {
          const { data: found, error: fErr } = await supabase.from('clientes').select('id').eq('rtn', opts.rtn).maybeSingle()
          if (!fErr && found && (found as any).id) clienteId = (found as any).id
        } catch (e) { /* ignore */ }
      }

      const usuarioVal = userName || 'system'
      const numeroCot = String(Math.floor(Math.random() * 900000) + 100000)

      const payload: any = {
        cliente_id: clienteId,
        usuario: usuarioVal,
        numero_cotizacion: numeroCot,
        validez_dias: 30,
        subtotal: subtotalVal,
        impuesto: impuestoVal,
        total: totalVal,
        estado: 'pendiente'
      }

      // si estamos editando una cotización existente, actualizarla en lugar de insertar
      let cotizacionId: any = opts['cotizacion_id'] ?? cotizacionEditId
      if (cotizacionId) {
        const updatePayload: any = {
          cliente_id: payload.cliente_id || null,
          usuario: payload.usuario,
          validez_dias: payload.validez_dias,
          subtotal: payload.subtotal,
          impuesto: payload.impuesto,
          total: payload.total,
          estado: payload.estado
        }
        const { error: upErr } = await supabase.from('cotizaciones').update(updatePayload).eq('id', cotizacionId)
        if (upErr) {
          console.warn('Error actualizando cotizacion:', upErr)
          return null
        }
      } else {
        const { data: insData, error: insErr } = await supabase.from('cotizaciones').insert([payload]).select('id').maybeSingle()
        if (insErr) {
          console.warn('Error insertando cotizacion:', insErr)
          return null
        }
        cotizacionId = (insData as any)?.id || null
        if (!cotizacionId) return null
      }

      const detalles = carrito.map(it => {
        const price = Number(it.producto.precio || 0)
        const qty = Number(it.cantidad || 0)
        const exento = Boolean(it.producto.exento)
        const aplica18 = Boolean((it.producto as any).aplica_impuesto_18)
        const aplicaTur = Boolean((it.producto as any).aplica_impuesto_turistico)
        const isvItem = exento ? 0 : (aplica18 ? 0 : price * (taxRate || 0) * qty)
        const imp18Item = exento ? 0 : (aplica18 ? price * (tax18Rate || 0) * qty : 0)
        const turItem = exento ? 0 : (aplicaTur ? price * (taxTouristRate || 0) * qty : 0)
        const subtotalItem = price * qty
        const totalItem = subtotalItem + isvItem + imp18Item + turItem
        return {
          cotizacion_id: cotizacionId,
          producto_id: it.producto.id || null,
          descripcion: it.producto.nombre || '',
          cantidad: qty,
          precio_unitario: price,
          subtotal: subtotalItem,
          descuento: 0,
          total: totalItem
        }
      })

      // reemplazar detalles: borrar existentes y volver a insertar
      try {
        await supabase.from('cotizaciones_detalle').delete().eq('cotizacion_id', cotizacionId)
      } catch (e) {
        // ignore
      }
      const { error: detErr } = await supabase.from('cotizaciones_detalle').insert(detalles)
      if (detErr) console.warn('Error insertando cotizaciones_detalle:', detErr)
      else console.debug('Cotizacion guardada id=', cotizacionId)
      return cotizacionId
    } catch (e) {
      console.warn('Error guardando cotizacion:', e)
      return null
    }
  }

  // generateFacturaHTML moved to src/lib/generateFacturaHTML.ts

  const subtotalCalc = () => {
    const gross = carrito.reduce((s, it) => s + (Number(it.producto.precio || 0) * it.cantidad), 0)
    let isv = 0
    let imp18 = 0
    let tur = 0
    for (const item of carrito) {
      const price = Number(item.producto.precio || 0) * item.cantidad
      const exento = Boolean(item.producto.exento)
      const aplica18 = Boolean((item.producto as any).aplica_impuesto_18)
      const aplicaTur = Boolean((item.producto as any).aplica_impuesto_turistico)
      if (exento) continue
      const mainRate = aplica18 ? (tax18Rate || 0) : (taxRate || 0)
      const turRate = aplicaTur ? (taxTouristRate || 0) : 0
      const combined = (Number(mainRate) || 0) + (Number(turRate) || 0)
      if (combined <= 0) continue
      const taxAmount = price - (price / (1 + combined))
      if (aplica18) imp18 += taxAmount * (mainRate / combined)
      else isv += taxAmount * (mainRate / combined)
      if (aplicaTur) tur += taxAmount * (turRate / combined)
    }
    return Math.max(0, gross - (isv + imp18 + tur))
  }
  const taxableSubtotalCalc = () => carrito.reduce((s, it) => s + ((it.producto.exento ? 0 : (Number(it.producto.precio || 0) * it.cantidad))), 0)

  const doFacturaClienteFinal = async () => {
    // abrir flujo de pago antes de facturar para Consumidor Final
    setClienteTipo('final')
    setClienteNombre('Consumidor Final')
    setClienteRTN('C/F')
    console.debug('doFacturaClienteFinal: abrir modal pago (invoiceAfterPayment)')
    setInvoiceAfterPayment(true)
    setPaymentModalOpen(true)
    setFacturarModalOpen(false)
  }

  const doFacturaClienteNormal = () => {
    setClienteTipo('normal')
    setClienteNombre('')
    setClienteRTN('')
    setPaymentDone(false)
    setPaymentInfo(null)
    setClienteNormalModalOpen(true)
    setFacturarModalOpen(false)
  }

  const doFacturaClienteJuridico = () => {
    setClienteTipo('juridico')
    setClienteNombre('')
    setClienteRTN('')
    setPaymentDone(false)
    setPaymentInfo(null)
    setClienteNormalModalOpen(true)
    setFacturarModalOpen(false)
  }

  // finalize factura: mark cotizacion, insert venta, print
  const finalizeFacturaForCliente = async (cliente: string, rtn: string, paymentPayload: any) => {
    const generator = (printFormat === 'cinta') ? generateFacturaHTMLCinta : generateFacturaHTML
    const html = await generator({ cliente, rtn }, printingMode, {
      carrito,
      subtotal: subtotalCalc(),
      isvTotal,
      imp18Total,
      impTouristTotal,
      taxRate,
      tax18Rate,
      taxTouristRate,
      total: total,
      pagos: paymentPayload
    })

    // Si estamos facturando desde una cotización en edición, marcarla primero
    if (printingMode === 'factura' && cotizacionEditId) {
      try {
        console.debug('Pre-print: marcando cotizacion como aceptada, id=', cotizacionEditId)
        const { error: upErr } = await supabase.from('cotizaciones').update({ estado: 'aceptada' }).eq('id', cotizacionEditId)
        if (upErr) console.warn('Error marcando cotizacion (pre-print):', upErr)
        else try { setCotizacionEditId(null) } catch (e) {}
      } catch (e) {
        console.warn('Error marcacion pre-print:', e)
      }
    }

    // registrar venta y detalles
    if (printingMode === 'factura') {
      try {
        // intentar obtener datos de CAI del usuario actual (buscar por nombre de cajero en la columna `cajero`)
        let caiData = null
        let userId: string | null = null
        try {
          const rawU = localStorage.getItem('user')
          const parsedU = rawU ? JSON.parse(rawU) : null
          userId = parsedU && (parsedU.id || parsedU.user?.id || parsedU.sub || parsedU.user_id) ? (parsedU.id || parsedU.user?.id || parsedU.sub || parsedU.user_id) : null
          const userNameFromStorage = parsedU && (parsedU.username || parsedU.user?.username || parsedU.name || parsedU.user?.name) ? (parsedU.username || parsedU.user?.username || parsedU.name || parsedU.user?.name) : null
          console.debug('PV: CAI lookup - raw localStorage.user:', rawU)
          console.debug('PV: CAI lookup - parsed user object:', parsedU)
          console.debug('PV: CAI lookup - extracted userId:', userId, 'typeof', typeof userId)
          console.debug('PV: CAI lookup - extracted userNameFromStorage:', userNameFromStorage)
          if (userId) {
            // normalizar id para la consulta: si parece un entero, pasar Number()
            const userIdQuery: any = (typeof userId === 'string' && /^\d+$/.test(userId)) ? Number(userId) : userId
              try {
              // solicitar columnas relevantes incluyendo identificador y secuencia_actual
              const { data: caiRowsByUser, error: caiUserErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('usuario_id', userIdQuery).order('id', { ascending: false }).limit(1)
              if (!caiUserErr && Array.isArray(caiRowsByUser) && caiRowsByUser.length > 0) caiData = caiRowsByUser[0]
            } catch (e) {
              console.debug('PV: CAI lookup by usuario_id failed (likely column missing):', e)
            }
          }
          if (!caiData && userNameFromStorage) {
            try {
              const { data: caiRows, error: caiErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('cajero', userNameFromStorage).order('id', { ascending: false }).limit(1)
              if (!caiErr && Array.isArray(caiRows) && caiRows.length > 0) caiData = caiRows[0]
            } catch (e) {
              console.debug('PV: CAI lookup by cajero failed:', e)
            }
          }
        } catch (e) {
          console.debug('No se pudo cargar CAI desde frontend:', e)
        }
        await insertVenta({ clienteName: cliente, rtn, paymentPayload, caiData, usuarioId: userId })
      } catch (e) {
        console.warn('Error preparando venta antes de imprimir:', e)
        alert('Error preparando venta antes de imprimir: ' + String(e))
      }
    }

    // imprimir: abrir ventana, esperar a que imágenes carguen y luego imprimir
    const w = window.open('', '_blank')
    if (w) {
      w.document.open(); w.document.write(html); w.document.close()
      const printWhenReady = () => {
        try { w.focus(); w.print() } catch (e) { console.warn('Error during print (finalize):', e) }
        setTimeout(() => { try { w.close() } catch (e) {} }, 800)
      }

      const tryPrint = () => {
        try {
          const imgs = w.document.images
          if (imgs && imgs.length > 0) {
            let loaded = 0
            for (let i = 0; i < imgs.length; i++) {
              const img = imgs[i] as HTMLImageElement
              if (img.complete) {
                loaded++
              } else {
                img.addEventListener('load', () => { loaded++; if (loaded === imgs.length) printWhenReady() })
                img.addEventListener('error', () => { loaded++; if (loaded === imgs.length) printWhenReady() })
              }
            }
            if (loaded === imgs.length) printWhenReady()
          } else {
            printWhenReady()
          }
        } catch (e) {
          // Fallback: esperar al evento load de la ventana y/o un timeout
          try {
            w.addEventListener('load', printWhenReady)
          } catch (e) {}
          setTimeout(printWhenReady, 1000)
        }
      }

      try {
        if (w.document.readyState === 'complete') {
          tryPrint()
        } else {
          w.addEventListener('load', tryPrint)
          setTimeout(tryPrint, 1500)
        }
      } catch (e) {
        setTimeout(tryPrint, 800)
      }
    }

    // post-print cleanup
    if (printingMode === 'factura') {
      vaciarCarrito()
      await handlePostPrint()
    }
    if (printingMode === 'cotizacion') {
      setCotizacionPendingClient({ cliente, rtn })
      setCotizacionConfirmOpen(true)
    }
  }

  // helper: inserta venta y sus detalles en supabase
// opcional: caiData { id, cai, fecha_limite_emision, rango_desde, rango_hasta, secuencia_actual }
const insertVenta = async ({ clienteName, rtn, paymentPayload, caiData, usuarioId }: { clienteName?: string, rtn?: string | null, paymentPayload?: any, caiData?: any, usuarioId?: string | null }) => {
    if (!carrito || carrito.length === 0) return null
    const tipoPagoValue = paymentPayload && paymentPayload.tipoPagoString ? String(paymentPayload.tipoPagoString) : ''
    const totalPaid = paymentPayload && paymentPayload.totalPaid ? Number(paymentPayload.totalPaid || 0) : 0
    const cambioVal = totalPaid > Number(total || 0) ? (totalPaid - Number(total || 0)) : 0

    // try compute invoice number from CAI if available (use caiInfoState first)
    let facturaNum: string = String(Math.floor(Math.random() * 900000) + 100000)
    const usedCai = caiInfoState || caiData || null
    let computedSeqNum: number | null = null
    let padWidth = 0
    let nextSeqPadded: string | null = null
    let currentSeqPadded: string | null = null
    if (usedCai && (usedCai.rango_de !== undefined || usedCai.secuencia_actual !== undefined)) {
      try {
        const rangoDeRaw = usedCai.rango_de != null ? String(usedCai.rango_de) : ''
        const rangoHastaRaw = usedCai.rango_hasta != null ? String(usedCai.rango_hasta) : ''
        const seqRaw = usedCai.secuencia_actual != null ? String(usedCai.secuencia_actual) : ''
        // extract numeric portions
        const rangoDeNum = Number(String(rangoDeRaw).replace(/[^0-9]/g, '')) || 0
        const rangoHastaNum = Number(String(rangoHastaRaw).replace(/[^0-9]/g, '')) || 0
        const currentSeqNum = Number(String(seqRaw).replace(/[^0-9]/g, '')) || rangoDeNum || 0

        // determine padding width using rango_hasta or current seq length
        padWidth = Math.max((rangoHastaRaw || rangoDeRaw || '').length, String(currentSeqNum).length, 1)

        // current factura numeric part (use secuencia_actual if present else rango_de)
        currentSeqPadded = String(currentSeqNum).padStart(padWidth, '0')
        // compose factura including identificador if available
        const identificador = usedCai.identificador ? String(usedCai.identificador) : ''
        facturaNum = identificador + currentSeqPadded

        // prepare next sequence (to persist after successful save)
        const nextSeq = currentSeqNum + 1
        computedSeqNum = nextSeq
        nextSeqPadded = String(nextSeq).padStart(padWidth, '0')
      } catch (e) {
        console.debug('Error computing factura from caiInfoState, falling back to random:', e)
      }
    }

    const ventaPayload: any = {
      rtn: rtn || null,
      nombre_cliente: clienteName || null,
      usuario: userName || 'system',
      factura: facturaNum,
      tipo_pago: tipoPagoValue,
      subtotal: Number(subtotal || 0),
      impuesto: Number((isvTotal + imp18Total + impTouristTotal) || 0),
      total: Number(total || 0),
      estado: 'pagada',
      cambio: String(Number(cambioVal).toFixed(2)),
      // include CAI metadata when available
      cai: usedCai?.cai ?? null,
      // compose rango_desde/hasta including identificador when possible
      rango_desde: (usedCai && usedCai.identificador ? String(usedCai.identificador) : '') + (usedCai?.rango_de != null ? String(usedCai.rango_de) : '' ) || null,
      rango_hasta: (usedCai && usedCai.identificador ? String(usedCai.identificador) : '') + (usedCai?.rango_hasta != null ? String(usedCai.rango_hasta) : '' ) || null,
      fecha_limite_emision: usedCai?.fecha_vencimiento ?? usedCai?.fecha_limite_emision ?? null
    }

    // Try inserting venta; if server reports missing columns (PGRST204 / Could not find...), retry without CAI-related fields
    let ventaInsRaw: any = null
    let ventaErr: any = null
    try {
      const res = await supabase.from('ventas').insert([ventaPayload]).select('id, factura')
      ventaInsRaw = (res as any).data ?? res
      ventaErr = (res as any).error ?? null
    } catch (e) {
      ventaErr = e
    }
    console.debug('Insert venta response:', { ventaInsRaw, ventaErr })
    if (ventaErr) {
      const msg = String((ventaErr && (ventaErr.message || ventaErr.msg || ventaErr.details)) || '')
      const code = (ventaErr && ventaErr.code) ? String(ventaErr.code) : ''
      const looksLikeMissingCol = code === 'PGRST204' || msg.includes("Could not find the") || /column .* of 'ventas'/.test(msg)
      if (looksLikeMissingCol) {
        console.warn('Insert venta failed due missing column(s). Retrying without CAI fields.', { msg, code })
        const minimalPayload: any = { ...ventaPayload }
        delete minimalPayload.cai
        delete minimalPayload.rango_desde
        delete minimalPayload.rango_hasta
        delete minimalPayload.fecha_limite_emision
        try {
          const res2 = await supabase.from('ventas').insert([minimalPayload]).select('id, factura')
          ventaInsRaw = (res2 as any).data ?? res2
          ventaErr = (res2 as any).error ?? null
          console.debug('Fallback insert ventas response:', { ventaInsRaw, ventaErr })
          if (ventaErr) throw ventaErr
        } catch (e) {
          console.error('Fallback insert also failed:', e)
          throw e
        }
      } else {
        throw ventaErr
      }
    }

    const ventaRow: any = Array.isArray(ventaInsRaw) ? ventaInsRaw[0] : ventaInsRaw
    let ventaId: string | null = ventaRow ? (ventaRow.id || ventaRow['id']) : null
    if (!ventaId) {
      try {
        const { data: foundByFact, error: fbErr } = await supabase.from('ventas').select('id').eq('factura', facturaNum).maybeSingle()
        if (fbErr) console.debug('Error buscando venta por factura (fallback):', fbErr)
        if (foundByFact && (foundByFact as any).id) ventaId = (foundByFact as any).id
      } catch (e) { console.debug('fallback lookup error', e) }
    }

    if (!ventaId) {
      console.warn('No se pudo obtener venta.id tras insertar. Respuesta:', ventaInsRaw)
      return null
    }

    const detalles = carrito.map(it => {
      const price = Number(it.producto.precio || 0)
      const qty = Number(it.cantidad || 0)
      const subtotalItem = price * qty
      const descuento = 0
      const totalItem = subtotalItem - descuento
      return {
        venta_id: ventaId,
        factura: facturaNum,
        producto_id: it.producto.id,
        cantidad: qty,
        precio_unitario: price,
        subtotal: subtotalItem,
        descuento,
        total: totalItem
      }
    })
    // Si existe caiData y usuarioId, preferimos crear venta vía función RPC atómica
    // Pero sólo llamamos al RPC si el usuarioId parece un UUID (la función espera UUID en muchas instalaciones).
    const isUuid = (v: any) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
    if (caiData && usuarioId && isUuid(usuarioId)) {
      try {
        const rpcDetalles = carrito.map(it => ({
          producto_id: String(it.producto.id),
          cantidad: Number(it.cantidad || 0),
          precio_unitario: Number(it.producto.precio || 0),
          subtotal: Number((Number(it.producto.precio || 0) * it.cantidad).toFixed(6)),
          descuento: 0,
          total: Number((Number(it.producto.precio || 0) * it.cantidad).toFixed(6))
        }))

        const { data: rpcData, error: rpcErr } = await supabase.rpc('create_venta_with_detalle', {
          p_usuario_id: usuarioId,
          p_usuario: userName || usuarioId,
          p_rtn: rtn || null,
          p_nombre_cliente: clienteName || null,
          p_tipo_pago: tipoPagoValue,
          p_subtotal: Number(subtotal || 0),
          p_impuesto: Number((isvTotal + imp18Total + impTouristTotal) || 0),
          p_total: Number(total || 0),
          p_cambio: String(Number(cambioVal).toFixed(2)),
          p_detalles: rpcDetalles
        })

        console.debug('RPC create_venta_with_detalle response:', { rpcData, rpcErr })
        if (rpcErr) {
          console.warn('RPC create_venta_with_detalle failed, falling back to client inserts', rpcErr)
        } else if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const row = rpcData[0] as any
          // Refresh CAI info after RPC (RPC may have updated sequence server-side)
          try {
            if (usedCai && usedCai.id != null) {
              try {
                const { data: refreshed, error: refErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('id', usedCai.id).maybeSingle()
                if (!refErr && refreshed) {
                  setCaiInfoState(refreshed)
                  try { localStorage.setItem('caiInfo', JSON.stringify(refreshed)) } catch (e) {}
                }
              } catch (e) { console.debug('Error refreshing cai after RPC:', e) }
            }
          } catch (e) { console.debug('Error during post-RPC cai refresh:', e) }
          return row.venta_id || row.venta_id === 0 ? row.venta_id : ventaId
        } else if (rpcData && (rpcData as any).venta_id) {
          // also attempt refresh when RPC returns scalar
          try {
            if (usedCai && usedCai.id != null) {
              try {
                const { data: refreshed, error: refErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('id', usedCai.id).maybeSingle()
                if (!refErr && refreshed) {
                  setCaiInfoState(refreshed)
                  try { localStorage.setItem('caiInfo', JSON.stringify(refreshed)) } catch (e) {}
                }
              } catch (e) { console.debug('Error refreshing cai after RPC (scalar):', e) }
            }
          } catch (e) { console.debug('Error during post-RPC cai refresh (scalar):', e) }
          return (rpcData as any).venta_id
        }
        // si RPC no devolvió datos utilizamos el insert manual siguiente
      } catch (e) {
        console.warn('Error calling RPC create_venta_with_detalle:', e)
        // continuar con inserción manual
      }
    } else if (caiData && usuarioId) {
      console.debug('Skipping RPC create_venta_with_detalle because usuarioId is not a UUID. usuarioId:', usuarioId)
    }

    const { data: detalleIns, error: detErr } = await supabase.from('ventas_detalle').insert(detalles).select('id')
    console.debug('Insert ventas_detalle response:', { detalleIns, detErr })
    if (detErr) {
      throw detErr
    }
    // If we inserted manually and computed a new sequence, attempt to persist secuencia_actual in the cai row
    const manualCaiId = (usedCai && (usedCai.id || usedCai.id === 0)) ? usedCai.id : null
    if (manualCaiId != null && computedSeqNum != null) {
      try {
        // Only persist the next padded sequence if we were able to compute padding
        const seqToStore = nextSeqPadded != null ? nextSeqPadded : String(computedSeqNum)

        // Optional: validate not exceeding rango_hasta numeric bound
        try {
          const rangoHastaRaw = usedCai?.rango_hasta != null ? String(usedCai.rango_hasta) : ''
          const rangoHastaNum = Number(rangoHastaRaw.replace(/[^0-9]/g, '')) || null
          const toStoreNum = Number(String(seqToStore).replace(/[^0-9]/g, '')) || null
          if (rangoHastaNum != null && toStoreNum != null && toStoreNum > rangoHastaNum) {
            console.warn('No se actualizará cai.secuencia_actual porque excede rango_hasta', { toStoreNum, rangoHastaNum })
          } else {
              const { error: updCaiErr } = await supabase.from('cai').update({ secuencia_actual: seqToStore }).eq('id', manualCaiId)
              if (updCaiErr) console.debug('Error updating cai.secuencia_actual (manual path):', updCaiErr)
              else {
                console.debug('Updated cai.secuencia_actual to', seqToStore, 'for cai id', manualCaiId)
                try {
                  const newCai = { ...(usedCai || {}), secuencia_actual: seqToStore }
                  setCaiInfoState(newCai)
                  try { localStorage.setItem('caiInfo', JSON.stringify(newCai)) } catch (e) { }
                } catch (e) { console.debug('Error updating local caiInfoState/localStorage:', e) }
              }
          }
        } catch (e) {
          console.debug('Validation error while checking rango_hasta:', e)
          const { error: updCaiErr } = await supabase.from('cai').update({ secuencia_actual: seqToStore }).eq('id', manualCaiId)
          if (updCaiErr) console.debug('Error updating cai.secuencia_actual (manual path, after validation fail):', updCaiErr)
          else {
            console.debug('Updated cai.secuencia_actual to', seqToStore, 'for cai id', manualCaiId)
            try {
              const newCai = { ...(usedCai || {}), secuencia_actual: seqToStore }
              setCaiInfoState(newCai)
              try { localStorage.setItem('caiInfo', JSON.stringify(newCai)) } catch (e) { }
            } catch (e) { console.debug('Error updating local caiInfoState/localStorage (after validation):', e) }
          }
        }
      } catch (e) {
        console.debug('Exception updating cai.secuencia_actual:', e)
      }
    }
    return ventaId
  }

  // handle cleanup after a print/factura: delete original cotizacion if editing
  const handlePostPrint = async () => {
    if (printingMode === 'factura' && cotizacionEditId) {
      try {
        console.debug('handlePostPrint: marcando cotizacion como facturado, id=', cotizacionEditId)
        const { error: upErr } = await supabase.from('cotizaciones').update({ estado: 'aceptada' }).eq('id', cotizacionEditId)
        if (upErr) {
          console.warn('Error marcando cotizacion como facturado:', upErr)
        } else {
          console.debug('Cotizacion marcada como facturado:', cotizacionEditId)
        }
        // opcional: si prefieres eliminar, descomenta las siguientes líneas
        // await supabase.from('cotizaciones_detalle').delete().eq('cotizacion_id', cotizacionEditId)
        // await supabase.from('cotizaciones').delete().eq('id', cotizacionEditId)
        // setCotizacionEditId(null)
      } catch (e) {
        console.warn('Error procesando cotizacion tras facturar', e)
      }
    }
  }

    useEffect(() => {
      if (clienteNormalModalOpen) {
        setTimeout(() => {
          try { clienteNombreRef.current?.focus() } catch (e) { }
        }, 80)
      }
    }, [clienteNormalModalOpen])

  const submitClienteNormal = async () => {
    // guardar/actualizar cliente en la tabla `clientenatural`
    try {
      if (clienteRTN && clienteNombre) {
        const payload = { rtn: clienteRTN, nombre: clienteNombre }
        const { error } = await supabase.from('clientenatural').upsert(payload, { onConflict: 'rtn' })
        if (error) console.warn('Error guardando clientenatural:', error)
      }
    } catch (e) {
      console.warn('Error upsert clientenatural:', e)
    }

    // guardar/actualizar cliente en la tabla correspondiente según tipo
    try {
      if (clienteRTN && clienteNombre) {
        if (clienteTipo === 'juridico') {
          // buscar si existe cliente con ese RTN y tipo juridico
          const { data: found, error: findErr } = await supabase.from('clientes').select('id').eq('rtn', clienteRTN).eq('tipo_cliente', 'juridico').maybeSingle()
          if (findErr) console.warn('Error buscando cliente juridico:', findErr)
          if (found && (found as any).id) {
            // actualizar por id
            const { error: updErr } = await supabase.from('clientes').update({ nombre: clienteNombre, telefono: clienteTelefono || null, correo_electronico: clienteCorreo || null, exonerado: clienteExonerado }).eq('id', (found as any).id)
            if (updErr) console.warn('Error actualizando cliente juridico:', updErr)
          } else {
            // insertar nuevo cliente con tipo_cliente = 'juridico'
            const { error: insErr } = await supabase.from('clientes').insert([{ nombre: clienteNombre, rtn: clienteRTN, telefono: clienteTelefono || null, correo_electronico: clienteCorreo || null, tipo_cliente: 'juridico', exonerado: clienteExonerado }])
            if (insErr) console.warn('Error insertando cliente juridico:', insErr)
          }
        } else {
          // natural: usar clientenatural table (como antes)
          const payload = { rtn: clienteRTN, nombre: clienteNombre }
          const { error } = await supabase.from('clientenatural').upsert(payload, { onConflict: 'rtn' })
          if (error) console.warn('Error guardando clientenatural:', error)
        }
      }
    } catch (e) {
      console.warn('Error upsert cliente:', e)
    }

    const html = await generateFacturaHTML({ cliente: clienteNombre || 'Cliente', rtn: clienteRTN || '' }, printingMode, {
      carrito,
      subtotal: subtotalCalc(),
      isvTotal,
      imp18Total,
      impTouristTotal,
      taxRate,
      tax18Rate,
      taxTouristRate,
      total: total,
      pagos: paymentInfo
    })

    if (printingMode === 'factura' && cotizacionEditId) {
      try {
        console.debug('Pre-print: marcando cotizacion como facturado, id=', cotizacionEditId)
        const { error: upErr } = await supabase.from('cotizaciones').update({ estado: 'aceptada' }).eq('id', cotizacionEditId)
        if (upErr) {
          console.warn('Error marcando cotizacion como facturado (pre-print):', upErr)
        } else {
          console.debug('Cotizacion marcada como facturado (pre-print):', cotizacionEditId)
          try { setCotizacionEditId(null) } catch (e) {}
        }
      } catch (e) {
        console.warn('Error marcacion pre-print:', e)
      }
    }

    // registrar venta si estamos facturando
    if (printingMode === 'factura') {
      try {
        // no hay paymentPayload en flujo clienteNormal, pasar paymentInfo
        // intentar obtener datos de CAI del usuario actual (buscar por nombre de cajero en la columna `cajero`)
        let caiData = null
        let userId: string | null = null
        try {
          const rawU = localStorage.getItem('user')
          const parsedU = rawU ? JSON.parse(rawU) : null
          userId = parsedU && (parsedU.id || parsedU.user?.id || parsedU.sub || parsedU.user_id) ? (parsedU.id || parsedU.user?.id || parsedU.sub || parsedU.user_id) : null
          const userNameFromStorage = parsedU && (parsedU.username || parsedU.user?.username || parsedU.name || parsedU.user?.name) ? (parsedU.username || parsedU.user?.username || parsedU.name || parsedU.user?.name) : null
          console.debug('PV (clienteNormal): CAI lookup - raw localStorage.user:', rawU)
          console.debug('PV (clienteNormal): CAI lookup - parsed user object:', parsedU)
          console.debug('PV (clienteNormal): CAI lookup - extracted userId:', userId, 'typeof', typeof userId)
          console.debug('PV (clienteNormal): CAI lookup - extracted userNameFromStorage:', userNameFromStorage)
          if (userId) {
            const userIdQuery: any = (typeof userId === 'string' && /^\d+$/.test(userId)) ? Number(userId) : userId
            try {
              const { data: caiRowsByUser, error: caiUserErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('usuario_id', userIdQuery).order('id', { ascending: false }).limit(1)
              if (!caiUserErr && Array.isArray(caiRowsByUser) && caiRowsByUser.length > 0) caiData = caiRowsByUser[0]
            } catch (e) {
              console.debug('PV (clienteNormal): CAI lookup by usuario_id failed (likely column missing):', e)
            }
          }
          if (!caiData && userNameFromStorage) {
            try {
              const { data: caiRows, error: caiErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('cajero', userNameFromStorage).order('id', { ascending: false }).limit(1)
              if (!caiErr && Array.isArray(caiRows) && caiRows.length > 0) caiData = caiRows[0]
            } catch (e) {
              console.debug('PV (clienteNormal): CAI lookup by cajero failed:', e)
            }
          }
        } catch (e) {
          console.debug('No se pudo cargar CAI desde frontend (cliente normal):', e)
        }
        await insertVenta({ clienteName: clienteNombre || 'Cliente', rtn: clienteRTN || null, paymentPayload: paymentInfo, caiData, usuarioId: userId })
      } catch (e) {
        console.warn('Error insertando venta en flujo cliente normal:', e)
      }
    }

    const w = window.open('', '_blank')
    if (w) {
      w.document.open(); w.document.write(html); w.document.close()
      const printWhenReady = () => {
        try { w.focus(); w.print() } catch (e) { console.warn('Error during print (cliente normal):', e) }
        setTimeout(() => { try { w.close() } catch (e) {} }, 800)
      }

      const tryPrint = () => {
        try {
          const imgs = w.document.images
          if (imgs && imgs.length > 0) {
            let loaded = 0
            for (let i = 0; i < imgs.length; i++) {
              const img = imgs[i] as HTMLImageElement
              if (img.complete) {
                loaded++
              } else {
                img.addEventListener('load', () => { loaded++; if (loaded === imgs.length) printWhenReady() })
                img.addEventListener('error', () => { loaded++; if (loaded === imgs.length) printWhenReady() })
              }
            }
            if (loaded === imgs.length) printWhenReady()
          } else {
            printWhenReady()
          }
        } catch (e) {
          try {
            w.addEventListener('load', printWhenReady)
          } catch (e) {}
          setTimeout(printWhenReady, 1000)
        }
      }

      try {
        if (w.document.readyState === 'complete') {
          tryPrint()
        } else {
          w.addEventListener('load', tryPrint)
          setTimeout(tryPrint, 1500)
        }
      } catch (e) {
        setTimeout(tryPrint, 800)
      }
    }
    const afterFinish = async () => {
      if (printingMode === 'factura') {
        vaciarCarrito()
        await handlePostPrint()
      }
      if (printingMode === 'cotizacion') {
        setCotizacionPendingClient({ cliente: clienteNombre || 'Cliente', rtn: clienteRTN || null })
        setCotizacionConfirmOpen(true)
      }
    }
    await afterFinish()
    setClienteNormalModalOpen(false)
  }

  const [view, setView] = useState<string | null>(null);
  const [entradas, setEntradas] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEntrada, setSelectedEntrada] = useState<any | null>(null);

  // Header menu handled inside `HeaderBar`

  useEffect(() => {
    // Cargar inventario público (dev) — contiene imágenes y coincide con entradas
    fetch('/data-base/inventario.json')
      .then(async (r) => {
        if (!r.ok) {
          console.warn('inventario.json no disponible, status', r.status)
          return null
        }
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('application/json')) {
          console.warn('inventario.json no es JSON, content-type:', ct)
          return null
        }
        try {
          return await r.json()
        } catch (err) {
          console.warn('Error parseando inventario.json:', err)
          return null
        }
      })
      .then(data => {
        if (data && Array.isArray(data.items)) setEntradas(data.items)
        console.log('inventario cargado:', data && data.items ? data.items.length : 0)
      }).catch((err) => {
        console.warn('Error cargando inventario:', err)
      })
  }, [])

  // Load products from DB: inventario + precios + registro_de_inventario
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: invData, error: invErr } = await supabase.from('inventario').select('id, sku, nombre, categoria, imagen, modelo, descripcion, exento, aplica_impuesto_18, aplica_impuesto_turistico')
        if (invErr) throw invErr
        const invRows = Array.isArray(invData) ? invData : []
        const ids = invRows.map((r: any) => String(r.id))

        if (ids.length === 0) {
          if (mounted) setProductos([])
          return
        }

        // prices: fetch all price rows and build a map, avoids type-mismatch on .in()
        const priceMap: Record<string, number> = {}
        try {
          const { data: prices, error: pricesErr } = await supabase.from('precios').select('producto_id, precio').order('id', { ascending: false })
          if (pricesErr) throw pricesErr
          console.debug('PV: precios total rows', Array.isArray(prices) ? prices.length : 0)
          if (Array.isArray(prices)) {
            for (const p of prices) {
              const pid = String((p as any).producto_id)
              if (!priceMap[pid]) priceMap[pid] = Number((p as any).precio || 0)
            }
          }
        } catch (e) {
          console.warn('Error cargando precios en PV:', e)
        }

        // stock from registro_de_inventario
        let stockMap: Record<string, number> = {}
        try {
          const { data: regData, error: regErr } = await supabase.from('registro_de_inventario').select('producto_id, cantidad, tipo_de_movimiento').in('producto_id', ids)
          if (regErr) throw regErr
          const regRows = Array.isArray(regData) ? regData : []
          stockMap = {}
          ids.forEach(id => stockMap[id] = 0)
          for (const r of regRows) {
            const pid = String((r as any).producto_id)
            const qty = Number((r as any).cantidad) || 0
            const tipo = String((r as any).tipo_de_movimiento || '').toUpperCase()
            if (tipo === 'ENTRADA') stockMap[pid] = (stockMap[pid] || 0) + qty
            else if (tipo === 'SALIDA') stockMap[pid] = (stockMap[pid] || 0) - qty
          }
        } catch (e) {
          console.warn('Error cargando registro_de_inventario en PV:', e)
          // initialize zero stock map to avoid crashes
          stockMap = {}
          ids.forEach(id => stockMap[id] = 0)
        }

        console.debug('PV: priceMap sample', Object.keys(priceMap).slice(0,5).map(k=>[k, priceMap[k]]))
        const products: Producto[] = invRows.map((r: any) => ({
          id: String(r.id),
          sku: r.sku,
          nombre: r.nombre,
          categoria: r.categoria,
          imagen: r.imagen,
          precio: (priceMap[String(r.id)] !== undefined ? priceMap[String(r.id)] : (r.precio !== undefined ? Number(r.precio) : 0)),
          exento: (r.exento === true || String(r.exento) === 'true' || Number(r.exento) === 1) || false,
          aplica_impuesto_18: (r.aplica_impuesto_18 === true || String(r.aplica_impuesto_18) === 'true' || Number(r.aplica_impuesto_18) === 1) || false,
          aplica_impuesto_turistico: (r.aplica_impuesto_turistico === true || String(r.aplica_impuesto_turistico) === 'true' || Number(r.aplica_impuesto_turistico) === 1) || false,
          stock: Number((stockMap[String(r.id)] || 0).toFixed(2))
        }))

        if (mounted) setProductos(products)
      } catch (e) {
        console.warn('Error cargando productos desde inventario:', e)
        if (mounted) setProductos([])
      }
    })()
    return () => { mounted = false }
  }, [])

  // Si hay una cotización para cargar desde otra vista, cargarla en el carrito
  useEffect(() => {
    const doLoad = (payloadRaw?: any) => {
      try {
        const parsed = payloadRaw || (() => {
          const raw = localStorage.getItem('cotizacion_to_load')
          return raw ? JSON.parse(raw) : null
        })()
        if (!parsed) return
        // si la payload contiene header.id, marcar que estamos editando esa cotización
        try { setCotizacionEditId(parsed.header && parsed.header.id ? String(parsed.header.id) : null) } catch (e) {}
        const detalles = Array.isArray(parsed.detalles) ? parsed.detalles : []
        const items: ItemCarrito[] = detalles.map((d: any) => {
          const prodMatch = productos.find(p => String(p.id) === String(d.producto_id))
          const producto: Producto = prodMatch ? { ...prodMatch } : {
            id: String(d.producto_id || ('temp-' + Math.random().toString(36).slice(2,8))),
            sku: d.sku ?? undefined,
            nombre: d.descripcion || d.nombre || 'Artículo',
            precio: Number(d.precio_unitario || d.precio || 0),
            categoria: undefined,
            exento: false,
            aplica_impuesto_18: false,
            aplica_impuesto_turistico: false,
            stock: 0,
            imagen: undefined
          }
          return { producto, cantidad: Number(d.cantidad || 1) }
        })
        if (items.length > 0) setCarrito(items)
        try { localStorage.removeItem('cotizacion_to_load') } catch (e) {}
      } catch (e) {
        // ignore parse errors
      }
    }

    // attempt load from storage when productos change (fallback)
    doLoad()

    // listen for explicit event dispatch
    const handler = (ev: Event) => {
      try {
        const ce = ev as CustomEvent
        doLoad(ce.detail)
      } catch (e) {}
    }
    window.addEventListener('cotizacion:load', handler as EventListener)
    return () => { window.removeEventListener('cotizacion:load', handler as EventListener) }
  }, [productos])

  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userIdState, setUserIdState] = useState<number | string | null>(null)
  const [caiInfoState, setCaiInfoState] = useState<any | null>(null)
  const [datosFacturaOpen, setDatosFacturaOpen] = useState(false)
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({})

  // function to refresh caiInfo from backend and update state/localStorage
  const refreshCaiInfo = async () => {
    try {
      let caiFetched: any = null
      try {
        const raw = localStorage.getItem('user')
        const parsed = raw ? JSON.parse(raw) : null
        let extractedId: any = userIdState ?? (parsed && (parsed.id || parsed.user?.id || parsed.sub || parsed.user_id) ? (parsed.id || parsed.user?.id || parsed.sub || parsed.user_id) : null)
        const userNameLocal = userName ?? (parsed && (parsed.username || parsed.user?.username || parsed.name || parsed.user?.name) ? (parsed.username || parsed.user?.username || parsed.name || parsed.user?.name) : null)
        const userIdQuery: any = (extractedId != null && typeof extractedId === 'string' && /^\d+$/.test(extractedId)) ? Number(extractedId) : extractedId
        if (userIdQuery != null) {
          try {
            const { data: byUser, error: byUserErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('usuario_id', userIdQuery).order('id', { ascending: false }).limit(1)
            if (!byUserErr && Array.isArray(byUser) && byUser.length > 0) caiFetched = byUser[0]
          } catch (e) { console.debug('refreshCaiInfo: lookup by usuario_id failed:', e) }
        }
        if (!caiFetched && userNameLocal) {
          try {
            const { data: byName, error: byNameErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('cajero', userNameLocal).order('id', { ascending: false }).limit(1)
            if (!byNameErr && Array.isArray(byName) && byName.length > 0) caiFetched = byName[0]
          } catch (e) { console.debug('refreshCaiInfo: lookup by cajero failed:', e) }
        }
      } catch (e) { console.debug('refreshCaiInfo: error building lookup params', e) }
      if (caiFetched) {
        setCaiInfoState(caiFetched)
        try { localStorage.setItem('caiInfo', JSON.stringify(caiFetched)) } catch (e) {}
        console.debug('refreshCaiInfo: updated caiInfoState', caiFetched)
      }
    } catch (e) {
      console.debug('refreshCaiInfo: unexpected error', e)
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user')
      if (raw) {
        const u = JSON.parse(raw)
        setUserName(u.username || u.name || null)
        setUserRole(u.role || null)
        // declare extractedId in outer scope so nested functions can access it
        let extractedId: any = null
        try {
          extractedId = u && (u.id || u.user?.id || u.sub || u.user_id) ? (u.id || u.user?.id || u.sub || u.user_id) : null
          setUserIdState(extractedId ?? null)
          console.debug('PV: localStorage.user parsed:', u)
          console.debug('PV: extracted userId for CAI/RPC usage:', extractedId)
        } catch (e) {
          console.debug('PV: error parsing localStorage.user for debug:', e)
        }
        // also try to read cai info stored at login
        try {
          const rawCai = localStorage.getItem('caiInfo')
          if (rawCai) {
            const parsedCai = JSON.parse(rawCai)
            setCaiInfoState(parsedCai)
            console.debug('PV: loaded caiInfo from localStorage:', parsedCai);
            // If some expected fields are missing, try to refetch the latest CAI row from Supabase
            (async () => {
              try {
                const hasAll = parsedCai && (parsedCai.rango_de !== undefined && parsedCai.rango_hasta !== undefined && parsedCai.fecha_vencimiento !== undefined && parsedCai.secuencia_actual !== undefined)
                if (!hasAll) {
                  const userNameLocal = u && (u.username || u.user?.username || u.name || u.user?.name) ? (u.username || u.user?.username || u.name || u.user?.name) : null
                  const userIdLocal: any = extractedId && (typeof extractedId === 'string' && /^\d+$/.test(extractedId)) ? Number(extractedId) : extractedId
                  let fetched: any = null
                  try {
                    if (userIdLocal != null) {
                      const { data: byUser, error: byUserErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('usuario_id', userIdLocal).order('id', { ascending: false }).limit(1)
                      if (!byUserErr && Array.isArray(byUser) && byUser.length > 0) fetched = byUser[0]
                    }
                  } catch (e) {
                    console.debug('PV: refetch CAI by usuario_id failed (column may be missing):', e)
                  }
                  if (!fetched && userNameLocal) {
                    try {
                      const { data: byName, error: byNameErr } = await supabase.from('cai').select('id,cai,identificador,rango_de,rango_hasta,fecha_vencimiento,secuencia_actual').eq('cajero', userNameLocal).order('id', { ascending: false }).limit(1)
                      if (!byNameErr && Array.isArray(byName) && byName.length > 0) fetched = byName[0]
                    } catch (e) {
                      console.debug('PV: refetch CAI by cajero failed:', e)
                    }
                  }
                  if (fetched) {
                    setCaiInfoState(fetched)
                    try { localStorage.setItem('caiInfo', JSON.stringify(fetched)) } catch (e) {}
                    console.debug('PV: refreshed caiInfo from Supabase:', fetched)
                  }
                }
              } catch (e) {
                console.debug('PV: error trying to refresh caiInfo:', e)
              }
            })()
          }
        } catch (e) {
          console.debug('PV: error parsing localStorage.caiInfo:', e)
        }
      }
    } catch (e) {
      // ignore
    }
  }, [])

  // Load tax rate from DB (table `impuesto`, first row). Normalize to decimal (e.g. 15 -> 0.15)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Cargar todas las filas de impuesto y mapear por id (solo columna existente)
        const { data, error } = await supabase.from('impuesto').select('id, impuesto_venta')
        if (error) throw error
        if (!data || !Array.isArray(data)) return
        const findVal = (id: number) => {
          const row = (data as any[]).find(r => Number(r.id) === id)
          if (!row) return null
          const raw = row.impuesto_venta
          if (raw === undefined || raw === null) return null
          const n = Number(raw)
          if (Number.isNaN(n)) return null
          return n > 1 ? n / 100 : n
        }
        const v1 = findVal(1)
        const v2 = findVal(2)
        const v3 = findVal(3)
        if (mounted) {
          // Prefer resolved values, but provide fallbacks: try fetching single ids if missing, then default constants
          let finalV1 = v1
          let finalV2 = v2
          let finalV3 = v3
          try {
            if ((finalV1 === null || finalV1 === 0) && mounted) {
              const r1 = await supabase.from('impuesto').select('impuesto_venta').eq('id', 1).maybeSingle()
              const raw1 = (r1 as any)?.data?.impuesto_venta ?? null
              const n1 = raw1 == null ? null : Number(raw1)
              if (n1 != null && !Number.isNaN(n1)) finalV1 = n1 > 1 ? n1 / 100 : n1
            }
            if ((finalV2 === null || finalV2 === 0) && mounted) {
              const r2 = await supabase.from('impuesto').select('impuesto_venta').eq('id', 2).maybeSingle()
              const raw2 = (r2 as any)?.data?.impuesto_venta ?? null
              const n2 = raw2 == null ? null : Number(raw2)
              if (n2 != null && !Number.isNaN(n2)) finalV2 = n2 > 1 ? n2 / 100 : n2
            }
            if ((finalV3 === null || finalV3 === 0) && mounted) {
              const r3 = await supabase.from('impuesto').select('impuesto_venta').eq('id', 3).maybeSingle()
              const raw3 = (r3 as any)?.data?.impuesto_venta ?? null
              const n3 = raw3 == null ? null : Number(raw3)
              if (n3 != null && !Number.isNaN(n3)) finalV3 = n3 > 1 ? n3 / 100 : n3
            }
          } catch (err) {
            console.warn('PV: fallback single-id impuesto fetch failed', err)
          }

          // final fallbacks to sensible defaults if still missing
          if (finalV1 === null || finalV1 === 0) finalV1 = 0.15
          if (finalV2 === null || finalV2 === 0) finalV2 = 0.18
          if (finalV3 === null || finalV3 === 0) finalV3 = 0.04

          setTaxRate(finalV1)
          setTax18Rate(finalV2)
          setTaxTouristRate(finalV3)

          // debug log loaded impuesto rows and resolved rates
          console.debug('PV: impuestos raw rows', data)
          console.debug('PV: resolved tax rates', { taxRate: finalV1, tax18Rate: finalV2, taxTouristRate: finalV3 })
        }
      } catch (e) {
        console.warn('Error cargando impuesto en PV:', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  const openUbicacion = (sku: string) => {
    console.log('openUbicacion', sku, 'entradasCount', entradas.length)
    // Try to find product in loaded products (from inventario)
    let ent: any = null
    try {
      ent = productos.find(p => String(p.sku || '') === String(sku) || String(p.id) === String(sku)) || null
    } catch (e) {
      ent = null
    }

    // If we found product info, build a normalized object for modal
      if (ent) {
      const cantidad = Number((ent.stock ?? 0))
      const sel = {
        id: ent.id,
        producto: ent.nombre || '',
        sku: ent.sku || '',
        imagen: ent.imagen || null,
        descripcion: (ent as any).descripcion || '',
        ubicacion: (ent as any).ubicacion || null,
        cantidad
      }
      setSelectedEntrada(sel)
      setModalOpen(true)
      return
    }

    // Fallback: try to find in entradas JSON
    const ent2 = entradas.find(e => e.sku === sku) || null;
    console.log('entrada encontrada', ent2)
    setSelectedEntrada(ent2);
    setModalOpen(true);
  }

  // Resolve image URLs for products using storage public URL or signed URL
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const BUCKET = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string) || 'inventario'
        const urlMap: Record<string, string | null> = {}
        await Promise.all((productos || []).map(async (p) => {
          const raw = (p as any).imagen
          if (!raw) { urlMap[String(p.id)] = null; return }
          const src = String(raw)
          if (src.startsWith('http')) { urlMap[String(p.id)] = src; return }
          let objectPath = src
          const m = String(src).match(/\/storage\/v1\/object\/public\/([^/]+)\/(.*)/)
          if (m) objectPath = decodeURIComponent(m[2])
          try {
            const publicRes = await supabase.storage.from(BUCKET).getPublicUrl(objectPath)
            const candidate = (publicRes as any)?.data?.publicUrl || (publicRes as any)?.data?.publicURL || null
            if (candidate) { urlMap[String(p.id)] = candidate; return }
          } catch (e) {
            // continue
          }
          try {
            const signed = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, 60 * 60 * 24 * 7)
            const signedUrl = (signed as any)?.data?.signedUrl ?? null
            urlMap[String(p.id)] = signedUrl
          } catch (e) {
            urlMap[String(p.id)] = null
          }
        }))
        if (mounted) setImageUrls(urlMap)
      } catch (e) {
        console.warn('Error resolviendo imágenes en PV', e)
      }
    })()
    return () => { mounted = false }
  }, [productos])
  if (view) {
    if (view === 'DevolucionCaja') return <DevolucionCaja onBack={() => setView(null)} />
    if (view === 'IngresoEfectivo') return <IngresoEfectivo onBack={() => setView(null)} />
    if (view === 'CotizacionesGuardadas') return <CotizacionesGuardadas onBack={() => setView(null)} />
    if (view === 'PedidosEnLinea') return <PedidosEnLinea onBack={() => setView(null)} />
    if (view === 'CorteCajaParcial') return <CorteCajaParcial onBack={() => setView(null)} />
    if (view === 'CorteCajaTotal') return <CorteCajaTotal onBack={() => setView(null)} />
  }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      {/* Header */}
      <HeaderBar
        userName={userName}
        userRole={userRole}
        userId={userIdState}
        caiInfo={caiInfoState}
        onLogout={onLogout}
        onNavigate={(v) => setView(v)}
        onOpenDatosFactura={() => setDatosFacturaOpen(true)}
        onPrintFormatChange={(fmt) => setPrintFormat(fmt)}
        printFormat={printFormat}
      />

      <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
        {/* Buscador y Filtro */}
        <div style={{
          background: 'white', padding: 14, borderRadius: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 16,
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const q = String(busqueda || '').trim().toLowerCase()
                if (!q) return
                // Prefer exact SKU match, otherwise take first filtered
                const exact = productosFiltrados.find(p => String(p.sku || '').toLowerCase() === q)
                const candidato = exact || productosFiltrados[0]
                if (candidato) {
                  const stockNum = Number(candidato.stock ?? 0)
                  const precioNum = Number(candidato.precio ?? 0)
                  if (stockNum >= 1 && precioNum > 0) {
                    agregarAlCarrito(candidato)
                  } else {
                    // opcional: mostrar indicación rápida
                    console.debug('No se puede agregar por stock/precio', { id: candidato.id, stockNum, precioNum })
                  }
                }
              }
            }}
            style={{ flex: 1, minWidth: 220, padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <select
            value={categoriaFiltro}
            onChange={e => setCategoriaFiltro(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', minWidth: 140 }}
          >
            {categorias.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Layout de 2 columnas: Tabla + Carrito */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16 }}>
          
          {/* TABLA DE PRODUCTOS (componente separado) */}
          <div style={{
            background: 'white', borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)', minHeight: '60vh'
          }}>
            <ProductTable
              productos={productosFiltrados}
              imageUrls={imageUrls}
              agregarAlCarrito={agregarAlCarrito}
              openUbicacion={openUbicacion}
              thStyle={thStyle}
              tdStyle={tdStyle}
              skuStyle={skuStyle}
            />
          </div>

          {/* CARRITO: componente separado */}
          <Cart
            carrito={carrito}
            actualizarCantidad={actualizarCantidad}
            eliminarDelCarrito={eliminarDelCarrito}
            vaciarCarrito={vaciarCarrito}
            subtotal={subtotal}
            perItemTaxes={perItemTaxes}
            taxRate={taxRate}
            tax18Rate={tax18Rate}
            taxTouristRate={taxTouristRate}
            total={total}
            openSelector={openSelector}
            btnStyle={btnStyle}
          />
        </div>
      </div>

      <LocationModal open={modalOpen} selectedEntrada={selectedEntrada} onClose={() => { setModalOpen(false); setSelectedEntrada(null) }} imageUrls={imageUrls} />

      {/* Payment modal component (independent) */}
      <PaymentModal open={paymentModalOpen} totalDue={total} onClose={() => setPaymentModalOpen(false)} onConfirm={async (p) => {
        setPaymentInfo(p)
        setPaymentDone(true)
        // si se abrió para facturar inmediatamente (cliente final), proceder a facturar
        if (invoiceAfterPayment) {
          try {
            setInvoiceAfterPayment(false)
            await finalizeFacturaForCliente('Consumidor Final', 'C/F', p)
          } catch (e) {
            console.warn('Error facturando después del pago:', e)
          }
        }
        setPaymentModalOpen(false)
      }} />

      {/* Confirmación para guardar cotización (separada) */}
      <CotizacionConfirmModal
        open={cotizacionConfirmOpen}
        onClose={() => setCotizacionConfirmOpen(false)}
        onCancel={() => { setCotizacionConfirmOpen(false); setCotizacionPendingClient(null) }}
        onSave={async () => {
          setCotizacionConfirmOpen(false)
          try {
            const savedId = await saveCotizacion(cotizacionPendingClient || {})
            if (savedId) setCotizacionEditId(String(savedId))
          } catch (e) {
            console.warn('Error guardando cotizacion desde confirm modal', e)
          }
          setCotizacionPendingClient(null)
        }}
      />

      <FacturarSelectorModal
        open={facturarModalOpen}
        onClose={() => setFacturarModalOpen(false)}
        doFacturaClienteFinal={doFacturaClienteFinal}
        doFacturaClienteNormal={doFacturaClienteNormal}
        doFacturaClienteJuridico={doFacturaClienteJuridico}
        carritoLength={carrito.length}
        subtotal={subtotalCalc()}
        taxRate={taxRate}
        taxableSubtotal={taxableSubtotalCalc()}
      />

      <ClienteNormalModal
        open={clienteNormalModalOpen}
        onClose={() => setClienteNormalModalOpen(false)}
        clienteTipo={clienteTipo}
        clienteRTN={clienteRTN}
        clienteNombre={clienteNombre}
        clienteTelefono={clienteTelefono}
        clienteCorreo={clienteCorreo}
        clienteExonerado={clienteExonerado}
        clienteSearchOpen={clienteSearchOpen}
        setClienteSearchOpen={(v) => setClienteSearchOpen(v)}
        onRTNChange={(v) => handleRTNChange(v)}
        onNombreChange={(v) => setClienteNombre(v)}
        onTelefonoChange={(v) => setClienteTelefono(v)}
        onCorreoChange={(v) => setClienteCorreo(v)}
        onExoneradoChange={(v) => setClienteExonerado(v)}
        onCreateCliente={() => setCreateClienteModalOpen(true)}
        onCancel={() => setClienteNormalModalOpen(false)}
        onOpenCreateCliente={() => setCreateClienteModalOpen(true)}
        onOpenPayment={() => setPaymentModalOpen(true)}
        paymentDone={paymentDone}
        submitClienteNormal={submitClienteNormal}
      />

      <CreateClienteModal
        open={createClienteModalOpen}
        onClose={() => setCreateClienteModalOpen(false)}
        clienteRTN={clienteRTN}
        clienteNombre={clienteNombre}
        clienteTelefono={clienteTelefono}
        clienteCorreo={clienteCorreo}
        clienteExonerado={clienteExonerado}
        onChangeRTN={(v) => setClienteRTN(v)}
        onChangeNombre={(v) => setClienteNombre(v)}
        onChangeTelefono={(v) => setClienteTelefono(v)}
        onChangeCorreo={(v) => setClienteCorreo(v)}
        onChangeExonerado={(v) => setClienteExonerado(v)}
        onCreate={async () => {
          try {
            if (!clienteNombre || !clienteRTN) return
            const { data: existing, error: findErr } = await supabase.from('clientes').select('id').eq('rtn', clienteRTN).maybeSingle()
            if (findErr) console.warn('Error buscando cliente al crear:', findErr)
            if (existing && (existing as any).id) {
              const { error: updErr } = await supabase.from('clientes').update({ nombre: clienteNombre, telefono: clienteTelefono || null, correo_electronica: clienteCorreo || null, tipo_cliente: 'juridico', exonerado: clienteExonerado }).eq('id', (existing as any).id)
              if (updErr) console.warn('Error actualizando cliente al crear:', updErr)
            } else {
              const { error: insErr } = await supabase.from('clientes').insert([{ nombre: clienteNombre, rtn: clienteRTN, telefono: clienteTelefono || null, correo_electronica: clienteCorreo || null, tipo_cliente: 'juridico', exonerado: clienteExonerado }])
              if (insErr) console.warn('Error insertando cliente al crear:', insErr)
            }
          } catch (e) {
            console.warn('Error creando cliente juridico:', e)
          }
          setCreateClienteModalOpen(false)
        }}
      />

      <DatosFacturaModal open={datosFacturaOpen} onClose={() => setDatosFacturaOpen(false)} caiInfo={caiInfoState} onRefresh={refreshCaiInfo} />

    </div>
  );
}

// Estilos
const thStyle: React.CSSProperties = {
  padding: '12px 10px',
  textAlign: 'left',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#475569',
};

const tdStyle: React.CSSProperties = {
  padding: '10px',
  fontSize: '0.9rem',
  verticalAlign: 'middle'
};

const skuStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  background: '#e2e8f0',
  padding: '2px 6px',
  borderRadius: 4,
  fontFamily: 'monospace'
};

const btnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: 'none',
  background: '#e2e8f0', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem'
};

const actionBtn = (_bg: string): React.CSSProperties => ({
  padding: '10px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: 'all 0.2s'
});