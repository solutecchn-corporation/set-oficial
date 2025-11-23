import getCompanyData from './getCompanyData'

export async function generateFacturaHTML(
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

	const htmlOutput = `
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Factura Detallada</title>
	<style>
		@page { size: letter; margin: 0.5in; }
		* { letter-spacing: 0 !important; word-spacing: 0 !important; margin: 0; padding: 0; line-height: 1.2 !important; box-sizing: border-box; }
		body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; margin: 0; padding: 0; }
		.factura-container { width: 100%; max-width: 8.5in; margin: 0 auto; padding: 0.25in; }
		.divider { border: none; border-top: 1px solid #ddd; margin: 8px 0; }
		.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 12px; }
		.header img { width: 140px; height: auto; object-fit: contain; margin-right: 12px; }
		.header-title { font-size: 28px; color: #0f172a; text-align: right; flex-grow: 1; font-weight: 700 !important; }
		.info-section h3, .info-section p { font-size: 11px; margin-bottom: 3px; }

		/* Tabla: diseño moderno para impresión (igual que cotización) */
		.tabla { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; font-size: 10px; box-shadow: 0 2px 6px rgba(2,6,23,0.06); border-radius: 6px; overflow: hidden; }
		.tabla thead tr { background: linear-gradient(180deg,#0f172a,#0b1220); color: #fff; }
		.tabla th { padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700 !important; border-bottom: 1px solid rgba(255,255,255,0.08); }
		.tabla td { padding: 10px 8px; font-size: 10px; vertical-align: middle; background: #fff; font-weight: 400 !important; border-bottom: 1px solid #eef2f7; }
		.tabla tbody tr:nth-child(even) td { background: #f8fafc; }
		.tabla td:nth-child(2), .tabla td:nth-child(3), .tabla td:nth-child(4) { text-align: right; }
		.tabla td:first-child { text-align: left; }
		.tabla tfoot td { font-weight: 700 !important; }

		.totals-section { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 0; }
		.totals-section span.label { text-align: left; padding-left: 2px; font-weight: 600 !important; }
		.totals-section span.value { text-align: right; padding-right: 2px; font-weight: 700 !important; }
		.total-final { font-size: 11px; margin-top: 6px; border-top: 1px solid #e6edf3; padding-top: 6px; font-weight: 800 !important; }
		.footer-info { text-align: center; margin-top: 12px; font-size: 10px; color: #374151; }
		.letras { font-size: 11px; margin: 6px 0; text-align: center; }
		.firma-section { margin-top: 16px; display: flex; justify-content: space-around; text-align: center; }
		.copias-info { text-align: center; margin-top: 8px; }
		.final-message { font-size: 10px; text-align: center; margin-top: 10px; color: #374151; }

		@media print {
			.factura-container { box-shadow: none; border-radius: 0; }
			.tabla thead tr { background: #0f172a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
			.tabla th, .tabla td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		}

		html, body, .factura-container, .header, .header-title, .header-title-container, .tabla, .tabla th, .totals-section, .total-final, .footer-info { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
		.header-title-container { text-align: right; }
		.numero-factura { font-size: 22px; color: #0f172a; margin-top: -3px; font-weight: 700 !important; }
	</style>
</head>
<body>
	<main class="factura-container">

		<header class="header">
    <img src="${logoSrc}" alt="Logo del Comercio" />
    <div class="header-title-container">
        <h1 class="header-title">FACTURA</h1>
        <h2 class="numero-factura">No. ${factura}</h2>
    </div>
</header>

		<hr class="divider" />

		<section class="info-section">
			<h3>${comercio}</h3>
			<p>RTN: ${rtnEmp}</p>
			<p>Dirección: ${direccion}</p>
			<p>Teléfono: ${telefono}</p>
			<p>Email: ${EM}</p>
		</section>
		<hr class="divider" />

		<section class="info-dates">
			<p>Fecha y hora: ${Ahora}</p>
			<p>Factura No: ${factura}</p>
			<p>CAI: ${CAI}</p>
			<p>Fecha límite de emisión: ${fechaLimiteEmision}</p>
			<p>Rango autorizado: ${identificador ? (identificador + ' ' + rangoAutorizadoDe + ' al ' + identificador + ' ' + rangoAutorizadoHasta) : (rangoAutorizadoDe + ' al ' + rangoAutorizadoHasta)}</p>
		</section>
		<hr class="divider" />

		<section class="info-section">
			<p>Cliente: ${cliente}</p>
			<p>RTN Cliente: ${identidad}</p>
		</section>
		<hr class="divider" />

		<section class="details-section">
			<table class="tabla">
				<thead>
					<tr>
						<th>Descripción</th>
						<th style="width: 10%;">Cant</th>
							<th style="width: 15%;">Precio unitario</th>
							<th style="width: 15%;">Total</th>
					</tr>
				</thead>
				<tbody>
					${tabla} </tbody>
			</table>
		</section>
		<hr class="divider" />

	<section class="totals-section">
    <span class="label">Descuento:</span> <span class="value">L ${DSC.toFixed(2)}</span>
    <span class="label">Sub Total Exonerado:</span> <span class="value">L ${Number(exonerado).toFixed(2)}</span>
    <span class="label">Sub Total Gravado:</span> <span class="value">L ${Number(Gravado).toFixed(2)}</span>
    <span class="label">Sub Total Exento:</span> <span class="value">L ${Number(Exento).toFixed(2)}</span>
    <span class="label">Tasa Turística 4%:</span> <span class="value">L ${Number(isv4).toFixed(2)}</span>
    <span class="label">ISV 15%:</span> <span class="value">L ${Number(impuesto).toFixed(2)}</span>
    <span class="label">ISV 18%:</span> <span class="value">L ${Number(ISV18).toFixed(2)}</span>
</section>

<section class="transaccion-section"><hr class="divider" />
    <span class="label">TOTAL TRANSACCIÓN:</span>
    <span class="value">L ${Number(transaccion).toFixed(2)}</span>
</section>

<hr class="divider" />


		<section class="totals-section total-final">
			<span class="label">**TOTAL FACTURA:**</span> <span class="value">**L ${ft.toFixed(2)}**</span>
			<span class="label">Efectivo:</span> <span class="value">L ${Number(Efectivo).toFixed(2)}</span>
			<span class="label">Tarjeta:</span> <span class="value">L ${Number(Tarjeta).toFixed(2)}</span>
			<span class="label">Transferencia:</span> <span class="value">L ${Number(Transferencia).toFixed(2)}</span>
			<span class="label">Cambio:</span> <span class="value">L ${Number(cambio).toFixed(2)}</span>
		</section>
		<hr class="divider" />

		<footer class="footer-info">
			<div class="letras">
				<p>Total Pagado: L ${totalPagadoCalc.toFixed(2)}</p>
				<p>*** ${letras} Lempiras ***</p>
			</div>
			<hr class="divider" />
			
			<div class="firma-section">
				<p>Firma del Cliente: ______________________</p>
				<p>Firma del Emisor: ______________________</p>
			</div>
			
			<div class="copias-info">
				<p>Original: Cliente | Copia: Obligado tributario emisor</p>
			</div>
			
			<div class="final-message">
				<h5>Para cualquier reclamo debe presentar su factura</h5>
				<h5>¡Gracias por su compra!</h5>
				<h5>¡LA FACTURA ES BENEFICIO DE TODOS EXÍJALA!</h5>
			</div>
		</footer>

	</main>
</body>
</html>`

	return htmlOutput
}

export default generateFacturaHTML

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

