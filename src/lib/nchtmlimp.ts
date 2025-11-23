import generateFacturaHTML from './generateFacturaHTML'

export async function generateNcHTML(opts: any = {}, params: any = {}) {
  // Ensure ncInfo is provided as caiInfo for reuse of generateFacturaHTML
  try {
    if (!opts.caiInfo) {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('ncInfo') : null
      if (raw) {
        try { opts.caiInfo = JSON.parse(raw) } catch (e) { opts.caiInfo = raw }
      }
    }
  } catch (e) {
    // ignore
  }

  // reuse factura HTML generator, then replace header title to Nota de crédito
  const html = await generateFacturaHTML(opts, 'factura', params)
  // Replace the main title "FACTURA" with "NOTA DE CRÉDITO" (preserve styling)
  let replaced = html.replace(/<h1[^>]*>\s*FACTURA\s*<\/h1>/i, '<h1 class="header-title">NOTA DE CRÉDITO</h1>')
  try {
    // remove the final totals block that contains TOTAL FACTURA, Efectivo/Tarjeta/Transferencia/Cambio, etc.
    replaced = replaced.replace(/<section[^>]*class="[^"]*total-final[^"]*"[\s\S]*?<\/section>/i, '')
    // remove the footer that contains Total Pagado, firma, copias y mensajes
    replaced = replaced.replace(/<footer[^>]*class="footer-info"[\s\S]*?<\/footer>/i, '')
  } catch (e) {
    // if regex fails, silently continue
    console.debug('nchtmlimp: error cleaning nota de credito html', e)
  }
  return replaced
}

export async function generateNotaAbonoHTML(opts: any = {}, params: any = {}) {
  // Simple nota de abono: reuse factura layout but change title
  try {
    if (!opts.caiInfo) {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('ncInfo') : null
      if (raw) {
        try { opts.caiInfo = JSON.parse(raw) } catch (e) { opts.caiInfo = raw }
      }
    }
  } catch (e) {}
  const html = await generateFacturaHTML(opts, 'factura', params)
  let note = html.replace(/<h1[^>]*>\s*FACTURA\s*<\/h1>/i, '<h1 class="header-title">NOTA DE ABONO</h1>')
  try {
    // remove the product table/details section entirely
    note = note.replace(/<section[^>]*class="details-section"[\s\S]*?<\/section>/i, '')
    // remove final totals block and footer as in NC
    note = note.replace(/<section[^>]*class="[^"]*total-final[^"]*"[\s\S]*?<\/section>/i, '')
    note = note.replace(/<footer[^>]*class="footer-info"[\s\S]*?<\/footer>/i, '')

    // replace the transaccion-section label to show "VALOR NOTA DE ABONO"
    // capture the amount already rendered and reuse it
    note = note.replace(/<section[^>]*class="transaccion-section"[\s\S]*?<span class="label">[\s\S]*?<\/span>\s*<span class="value">\s*L\s*([^<]+)<\/span>[\s\S]*?<\/section>/i,
      '<section class="transaccion-section"><hr class="divider" /><span class="label">VALOR NOTA DE ABONO:</span><span class="value">L $1</span></section>')
  } catch (e) {
    console.debug('nchtmlimp: error cleaning nota de abono html', e)
  }
  return note
}

export default generateNcHTML
