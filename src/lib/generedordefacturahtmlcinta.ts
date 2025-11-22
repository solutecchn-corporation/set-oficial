import getCompanyData from './getCompanyData'

export async function generateFacturaHTMLCinta(
    opts: any = {},
    tipo: 'factura' | 'cotizacion' = 'factura',
    params: any = {}
): Promise<string> {
    let comercio = opts.comercio || ''
    // `rtnEmp` is the company's RTN; do not use opts.rtn (client RTN) for this
    let rtnEmp = opts.companyRTN || opts.rtnEmpresa || opts.RTN || ''
    let direccion = opts.direccion || ''
    let telefono = opts.telefono || ''
    let EM = opts.email || opts.EM || ''
    let logoSrc = opts.logo || opts.logoUrl || opts.logo_src || null

    // Si faltan datos importantes, intentar obtenerlos desde Supabase
    if ((!comercio || !rtnEmp || !direccion || !telefono || !EM || !logoSrc)) {
        try {
            const company = await getCompanyData()
            if (company) {
                comercio = comercio || company.nombre || company.comercio || comercio
                rtnEmp = rtnEmp || company.rtn || rtnEmp
                direccion = direccion || company.direccion || company.direccion_fiscal || direccion
                telefono = telefono || company.telefono || company.telefono_fijo || telefono
                EM = EM || company.email || company.correo || EM
                logoSrc = logoSrc || (company.logoUrl || company.logo) || logoSrc
            }
        } catch (e) {
            // ignore errors fetching company data
        }
    }

    // Intentar incrustar (inline) el logo como data URL para evitar problemas en impresión
    if (logoSrc && typeof window !== 'undefined' && opts.inlineLogo !== false) {
        try {
            if (!String(logoSrc).startsWith('data:')) {
                const resp = await fetch(String(logoSrc), { mode: 'cors' })
                if (resp.ok) {
                    const blob = await resp.blob()
                    const dataUrl = await new Promise<string | null>((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => { resolve(typeof reader.result === 'string' ? reader.result : null) }
                        reader.onerror = () => { resolve(null) }
                        reader.readAsDataURL(blob)
                    })
                    if (dataUrl) logoSrc = dataUrl
                }
            }
        } catch (e) {
            // ignore fetch/convert errors and keep original logoSrc
        }
    }
    let factura = opts.factura || ''
    let CAI = opts.CAI || opts.cai || ''
    let fechaLimiteEmision = opts.fechaLimiteEmision || opts.fecha_limite_emision || (opts.fecha_vencimiento || '')
    let rangoAutorizadoDe = opts.rangoAutorizadoDe || opts.rango_desde || ''
    let rangoAutorizadoHasta = opts.rangoAutorizadoHasta || opts.rango_hasta || ''
    let identificador = opts.identificador || opts.identificadorCAI || ''

    // Si no se pasó factura en opts, la intentamos derivar desde CAI info
    try {
        let caiInfo: any = opts.caiInfo || null
        if (!caiInfo && typeof window !== 'undefined') {
            const raw = window.localStorage.getItem('caiInfo')
            if (raw) {
                try { caiInfo = JSON.parse(raw) } catch (e) { caiInfo = null }
            }
        }
        if (caiInfo) {
            // populate CAI and ranges from caiInfo when available
            CAI = CAI || caiInfo.cai || caiInfo.CAI || ''
            fechaLimiteEmision = fechaLimiteEmision || caiInfo.fecha_vencimiento || caiInfo.fecha_limite_emision || ''
                rangoAutorizadoDe = rangoAutorizadoDe || caiInfo.rango_de || caiInfo.rangoDesde || ''
                rangoAutorizadoHasta = rangoAutorizadoHasta || caiInfo.rango_hasta || caiInfo.rangoHasta || ''
                identificador = identificador || caiInfo.identificador || ''

            // compute factura number from identificador + secuencia_actual or rango_de when factura not provided
            if (!factura) {
                try {
                    const identificador = caiInfo.identificador ? String(caiInfo.identificador) : ''
                    const seqRaw = caiInfo.secuencia_actual != null ? String(caiInfo.secuencia_actual) : (caiInfo.rango_de != null ? String(caiInfo.rango_de) : '')
                    // strip non-digits for numeric part
                    const numericPart = String(seqRaw).replace(/[^0-9]/g, '') || ''
                    let padWidth = 0
                    if (caiInfo.rango_hasta || caiInfo.rango_de) padWidth = Math.max(String(caiInfo.rango_hasta || caiInfo.rango_de).length, numericPart.length)
                    const padded = numericPart ? String(numericPart).padStart(padWidth || numericPart.length || 1, '0') : ''
                    factura = (identificador || '') + (padded || String(Math.floor(Math.random() * 900000) + 100000))
                } catch (e) {
                    factura = String(Math.floor(Math.random() * 900000) + 100000)
                }
            }
        }
    } catch (e) {
        // ignore cai parsing errors
    }

    // ensure factura has a value
    if (!factura) factura = String(Math.floor(Math.random() * 900000) + 100000)
    const cliente = opts.cliente || (tipo === 'factura' ? 'Consumidor Final' : 'Cotización Cliente')
    // identidad = RTN del cliente (accept legacy `opts.rtn` as client RTN)
    const identidad = opts.identidad || opts.rtnCliente || opts.clientRTN || opts.rtn || params.identidad || 'C/F'
    const Ahora = new Date().toLocaleString()

    const carrito = Array.isArray(params.carrito) ? params.carrito : []
    const subtotal = typeof params.subtotal === 'number' ? params.subtotal : carrito.reduce((s: number, it: any) => s + (Number((it.producto && it.producto.precio) || it.precio || 0) * (it.cantidad || 1)), 0)
    const DSC = typeof params.descuento === 'number' ? params.descuento : 0
    const exonerado = typeof params.exonerado === 'number' ? params.exonerado : 0
    const Gravado = typeof params.gravado === 'number' ? params.gravado : subtotal
    const Exento = typeof params.exento === 'number' ? params.exento : 0
    const impuesto = typeof params.isvTotal === 'number' ? params.isvTotal : 0
    const ISV18 = typeof params.imp18Total === 'number' ? params.imp18Total : 0
    const isv4 = typeof params.impTouristTotal === 'number' ? params.impTouristTotal : 0
    // Determine gross total (totalFactura). Prefer explicit `params.total` if provided,
    // otherwise compute as subtotal (net) + taxes passed in params.
    const grossFromParams = typeof params.total === 'number' ? params.total : null
    const computedGross = subtotal + (impuesto || 0) + (ISV18 || 0) + (isv4 || 0)
    const transaccion = (grossFromParams != null) ? grossFromParams : computedGross
    const ft = transaccion

    const pagos = params.pagos || {}
    const Efectivo = typeof pagos.efectivo === 'number' ? pagos.efectivo : (typeof params.Efectivo === 'number' ? params.Efectivo : 0)
    const Tarjeta = typeof pagos.tarjeta === 'number' ? pagos.tarjeta : (typeof params.Tarjeta === 'number' ? params.Tarjeta : 0)
    const Transferencia = typeof pagos.transferencia === 'number' ? pagos.transferencia : (typeof params.Transferencia === 'number' ? params.Transferencia : 0)
    const totalPaid = (typeof pagos.totalPaid === 'number') ? pagos.totalPaid : (Efectivo + Tarjeta + Transferencia)
    let cambio: number
    if (typeof pagos.cambio === 'number') {
        cambio = pagos.cambio
    } else if (typeof params.cambio === 'number') {
        cambio = params.cambio
    } else {
        const computed = Number(totalPaid) - Number(ft || 0)
        cambio = isNaN(computed) ? 0 : (computed > 0 ? computed : 0)
    }

    const buildProductosTabla = () => {
        return carrito.map((i: any) => {
            const desc = String((i.producto && (i.producto.nombre || i.producto.descripcion)) || i.descripcion || i.nombre || '')
            const cant = Number(i.cantidad || 0)
            // precio por unidad incluyendo impuestos (valor bruto tal como está en producto.precio)
            const precioBrutoUnit = Number((i.producto && (i.producto.precio ?? i.producto.precio_unitario)) ?? (i.precio_unitario ?? i.precio) ?? 0)
            // determinar si el producto está exento o aplica impuestos especiales
            const exento = Boolean(i.producto && i.producto.exento) || Boolean(i.exento)
            const aplica18 = Boolean(i.producto && (i.producto.aplica_impuesto_18)) || Boolean(i.aplica_impuesto_18)
            const aplicaTur = Boolean(i.producto && (i.producto.aplica_impuesto_turistico)) || Boolean(i.aplica_impuesto_turistico)
            // tasas preferidas desde params (si fueron pasadas al generar la factura)
            const mainRate = aplica18 ? (params.tax18Rate ?? params.tax18 ?? 0) : (params.taxRate ?? params.tax ?? 0)
            const turRate = aplicaTur ? (params.taxTouristRate ?? params.taxTourist ?? 0) : 0
            const combined = (Number(mainRate) || 0) + (Number(turRate) || 0)
            // precio unitario SIN impuestos: si está exento o no hay tasas, es igual al bruto
            let precioUnitario = precioBrutoUnit
            if (!exento && combined > 0) {
                precioUnitario = precioBrutoUnit / (1 + combined)
            }
            const precioStr = Number(precioUnitario || 0).toFixed(2)
            const subtotalLinea = (precioUnitario * cant)
            const subtotalStr = Number(subtotalLinea || 0).toFixed(2)
            const sku = (i.producto && i.producto.sku) || (i.sku || '')
            return `<tr><td>${sku} ${desc}</td><td style="text-align:center">${cant}</td><td style="text-align:right">L ${precioStr}</td><td style="text-align:right">L ${subtotalStr}</td></tr>`
        }).join('\n')
    }

    const tabla = buildProductosTabla()

    // Calcular Total Pagado mostrado: efectivo + transferencia + tarjeta - cambio
    const totalPagadoCalcRaw = (Number(Efectivo) || 0) + (Number(Transferencia) || 0) + (Number(Tarjeta) || 0) - (Number(cambio) || 0)
    const totalPagadoCalc = isNaN(totalPagadoCalcRaw) ? 0 : totalPagadoCalcRaw
    const letras = numeroALetras(totalPagadoCalc)

    const htmlOutput = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Factura Cinta</title>

<style>
    body {
        font-family: monospace;
        font-size: 12px;
        width: 260px; /* tamaño para impresora térmica 58mm */
        margin: 0 auto;
        padding: 0;
    }

    .center { text-align: center; }
    .line { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; }
    th { border-bottom: 1px solid #000; }
    .right { text-align: right; }
    .left { text-align: left; }
    .bold { font-weight: bold; }
</style>
</head>

<body>

<div class="center">
    <img src="${logoSrc}" alt="logo" style="width:120px; height:auto;" />
</div>

<div class="center bold">FACTURA</div>
<div class="center">No. ${factura}</div>

<div class="line"></div>

<div class="center bold">${comercio}</div>
<p>RTN: ${rtnEmp}</p>
<p>Dirección: ${direccion}</p>
<p>Tel: ${telefono}</p>
<p>Email: ${EM}</p>

<div class="line"></div>

<p>Fecha/Hora: ${Ahora}</p>
<p>CAI: ${CAI}</p>
<p>F. Límite: ${fechaLimiteEmision}</p>
<p>Rango:  
${identificador ? (identificador + ' ' + rangoAutorizadoDe + ' al ' + identificador + ' ' + rangoAutorizadoHasta) : (rangoAutorizadoDe + ' al ' + rangoAutorizadoHasta)}</p>

<div class="line"></div>

<p>Cliente: ${cliente}</p>
<p>RTN Cliente: ${identidad}</p>

<div class="line"></div>

<table>
    <thead>
        <tr>
            <th class="left">Descripción</th>
            <th class="right">Cant</th>
            <th class="right">P.U</th>
            <th class="right">Total</th>
        </tr>
    </thead>
    <tbody>
        ${tabla}
    </tbody>
</table>

<div class="line"></div>

<p>Descuento: <span class="right">L ${DSC.toFixed(2)}</span></p>
<p>SubT Exonerado: <span class="right">L ${Number(exonerado).toFixed(2)}</span></p>
<p>SubT Gravado: <span class="right">L ${Number(Gravado).toFixed(2)}</span></p>
<p>SubT Exento: <span class="right">L ${Number(Exento).toFixed(2)}</span></p>
<p>Tasa Turística 4%: <span class="right">L ${Number(isv4).toFixed(2)}</span></p>
<p>ISV 15%: <span class="right">L ${Number(impuesto).toFixed(2)}</span></p>
<p>ISV 18%: <span class="right">L ${Number(ISV18).toFixed(2)}</span></p>

<div class="line"></div>

<p class="bold">TOTAL TRANSACCIÓN:
   <span class="right bold">L ${Number(transaccion).toFixed(2)}</span>
</p>

<div class="line"></div>

<p class="bold">TOTAL FACTURA:
   <span class="right bold">L ${ft.toFixed(2)}</span>
</p>

<p>Efectivo: <span class="right">L ${Number(Efectivo).toFixed(2)}</span></p>
<p>Tarjeta: <span class="right">L ${Number(Tarjeta).toFixed(2)}</span></p>
<p>Transferencia: <span class="right">L ${Number(Transferencia).toFixed(2)}</span></p>
<p>Cambio: <span class="right">L ${Number(cambio).toFixed(2)}</span></p>

<div class="line"></div>

<div class="center">
    <p>Total Pagado: L ${totalPagadoCalc.toFixed(2)}</p>
    <p>*** ${letras} Lempiras ***</p>
</div>

<div class="line"></div>

<p>Firma Cliente: ____________________</p>
<p>Firma Emisor: _____________________</p>

<div class="center">
    <p>Original: Cliente</p>
    <p>Copia: Obligado tributario emisor</p>
</div>

<div class="center">
    <p>Para cualquier reclamo debe<br/>presentar su factura</p>
    <p>¡Gracias por su compra!</p>
    <p>¡LA FACTURA ES BENEFICIO DE TODOS,<br/>EXÍJALA!</p>
</div>

</body>
</html>
`

    return htmlOutput
}

export default generateFacturaHTMLCinta

function numeroALetras(num: number) {
    // Convert number to words in Spanish (simplified, handles integers)
    if (!isFinite(num)) return ''
    const unidades = ['', 'uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciseis','diecisiete','dieciocho','diecinueve','veinte']
    const decenas = ['', '', 'veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa']
    const centenas = ['', 'cien','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos']

    function numeroMenorDeMil(n: number): string {
        let s = ''
        if (n === 0) return ''
        if (n < 21) return unidades[n]
        if (n < 100) {
            const d = Math.floor(n/10)
            const r = n%10
            return decenas[d] + (r? (' y ' + unidades[r]) : '')
        }
        if (n < 1000) {
            const c = Math.floor(n/100)
            const rest = n%100
            const cent = (c === 1 && rest === 0) ? 'cien' : (centenas[c] || '')
            return cent + (rest ? ' ' + numeroMenorDeMil(rest) : '')
        }
        return ''
    }

    const entero = Math.floor(Math.abs(num))
    if (entero === 0) return 'cero'
    const partes: string[] = []
    let remainder = entero
    const unidadesMiles = ['', 'mil', 'millón', 'mil millones']
    let idx = 0
    while (remainder > 0) {
        const chunk = remainder % 1000
        if (chunk) {
            let chunkStr = numeroMenorDeMil(chunk)
            if (idx === 2 && chunk === 1) chunkStr = 'un'
            partes.unshift(chunkStr + (unidadesMiles[idx] ? ' ' + unidadesMiles[idx] : ''))
        }
        remainder = Math.floor(remainder/1000)
        idx++
    }
    return partes.join(' ').trim()
}
// Utility to generate factura/cotización HTML from provided cart and totals




