import getCompanyData from './getCompanyData'

export async function generateAnulacionHTML(
    opts: any = {},
    params: any = {}
): Promise<string> {
    let comercio = opts.comercio || ''
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

    // Intentar incrustar (inline) el logo como data URL
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
            // ignore fetch/convert errors
        }
    }

    let factura = opts.factura || ''
    // Datos de la factura original
    let CAI = opts.CAI || opts.cai || ''
    let fechaLimiteEmision = opts.fechaLimiteEmision || opts.fecha_limite_emision || (opts.fecha_vencimiento || '')
    let rangoAutorizadoDe = opts.rangoAutorizadoDe || opts.rango_desde || ''
    let rangoAutorizadoHasta = opts.rangoAutorizadoHasta || opts.rango_hasta || ''
    let identificador = opts.identificador || opts.identificadorCAI || ''

    const cliente = opts.cliente || 'Consumidor Final'
    const identidad = opts.identidad || opts.rtnCliente || opts.clientRTN || opts.rtn || params.identidad || 'C/F'
    const Ahora = new Date().toLocaleString()
    const fechaAnulacion = opts.fechaAnulacion || Ahora

    const carrito = Array.isArray(params.carrito) ? params.carrito : []
    const subtotal = typeof params.subtotal === 'number' ? params.subtotal : 0
    const impuesto = typeof params.isvTotal === 'number' ? params.isvTotal : 0
    const total = typeof params.total === 'number' ? params.total : 0

    const buildProductosTabla = () => {
        return carrito.map((i: any) => {
            const desc = String((i.producto && (i.producto.nombre || i.producto.descripcion)) || i.descripcion || i.nombre || '')
            const cant = Number(i.cantidad || 0)
            const precioBrutoUnit = Number((i.producto && (i.producto.precio ?? i.producto.precio_unitario)) ?? (i.precio_unitario ?? i.precio) ?? 0)
            const subtotalLinea = (precioBrutoUnit * cant)
            const subtotalStr = Number(subtotalLinea || 0).toFixed(2)
            const sku = (i.producto && i.producto.sku) || (i.sku || '')
            return `<tr><td>${sku} ${desc}</td><td style="text-align:center">${cant}</td><td style="text-align:right">L ${Number(precioBrutoUnit).toFixed(2)}</td><td style="text-align:right">L ${subtotalStr}</td></tr>`
        }).join('\n')
    }

    const tabla = buildProductosTabla()

    const htmlOutput = `
<!DOCTYPE html>
<html lang="es">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Comprobante de Anulación</title>
	<style>
		@page { size: letter; margin: 0.5in; }
		* { letter-spacing: 0 !important; word-spacing: 0 !important; margin: 0; padding: 0; line-height: 1.2 !important; box-sizing: border-box; }
		body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; margin: 0; padding: 0; }
		.factura-container { width: 100%; max-width: 8.5in; margin: 0 auto; padding: 0.25in; }
		.divider { border: none; border-top: 1px solid #ddd; margin: 8px 0; }
		.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 12px; }
		.header img { width: 140px; height: auto; object-fit: contain; margin-right: 12px; }
		.header-title { font-size: 24px; color: #ef4444; text-align: right; flex-grow: 1; font-weight: 700 !important; text-transform: uppercase; }
		.info-section h3, .info-section p { font-size: 11px; margin-bottom: 3px; }

		.tabla { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; font-size: 10px; box-shadow: 0 2px 6px rgba(2,6,23,0.06); border-radius: 6px; overflow: hidden; }
		.tabla thead tr { background: #ef4444; color: #fff; }
		.tabla th { padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700 !important; border-bottom: 1px solid rgba(255,255,255,0.08); }
		.tabla td { padding: 10px 8px; font-size: 10px; vertical-align: middle; background: #fff; font-weight: 400 !important; border-bottom: 1px solid #eef2f7; }
		.tabla tbody tr:nth-child(even) td { background: #f8fafc; }
		.tabla td:nth-child(2), .tabla td:nth-child(3), .tabla td:nth-child(4) { text-align: right; }
		.tabla td:first-child { text-align: left; }

		.totals-section { margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 0; }
		.totals-section span.label { text-align: left; padding-left: 2px; font-weight: 600 !important; }
		.totals-section span.value { text-align: right; padding-right: 2px; font-weight: 700 !important; }
		.total-final { font-size: 11px; margin-top: 6px; border-top: 1px solid #e6edf3; padding-top: 6px; font-weight: 800 !important; }
		.footer-info { text-align: center; margin-top: 12px; font-size: 10px; color: #374151; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(239, 68, 68, 0.1); font-weight: bold; z-index: -1; pointer-events: none; }

		@media print {
			.factura-container { box-shadow: none; border-radius: 0; }
			.tabla thead tr { background: #ef4444 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header-title { color: #ef4444 !important; }
		}
        .numero-factura { font-size: 18px; color: #0f172a; margin-top: -3px; font-weight: 700 !important; }
	</style>
</head>
<body>
    <div class="watermark">ANULADA</div>
	<main class="factura-container">

		<header class="header">
            <img src="${logoSrc}" alt="Logo del Comercio" />
            <div class="header-title-container" style="text-align: right;">
                <h1 class="header-title">COMPROBANTE DE ANULACIÓN</h1>
                <h2 class="numero-factura">Ref. Factura: ${factura}</h2>
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
			<p><strong>Fecha de Anulación: ${fechaAnulacion}</strong></p>
			<p>Factura Original No: ${factura}</p>
			<p>CAI Original: ${CAI}</p>
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
						<th style="width: 15%;">Precio</th>
						<th style="width: 15%;">Total</th>
					</tr>
				</thead>
				<tbody>
					${tabla} 
                </tbody>
			</table>
		</section>
		<hr class="divider" />

        <section class="totals-section total-final">
            <span class="label">**TOTAL ANULADO:**</span> <span class="value">**L ${Number(total).toFixed(2)}**</span>
        </section>
		<hr class="divider" />

		<footer class="footer-info">
			<div class="final-message">
				<h5>Este documento certifica la anulación de la factura mencionada.</h5>
			</div>
		</footer>

	</main>
</body>
</html>`

    return htmlOutput
}
