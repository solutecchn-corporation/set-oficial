import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sqwqlvsjtimallidxrsz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd3FsdnNqdGltYWxsaWR4cnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjM4NTYsImV4cCI6MjA3ODk5OTg1Nn0.5s_2Dz76gha9Zb-0RPzJ_vBz-TTP6zHrNyAugBpxnEQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectData() {
    // 1. Get the latest active session for the user (assuming 'miguel' or similar, but let's just get the latest open session)
    const { data: session, error: sErr } = await supabase
        .from('caja_sesiones')
        .select('*')
        .is('fecha_cierre', null)
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .single()

    if (sErr || !session) {
        console.log('No active session found or error:', sErr)
        return
    }

    console.log('Active Session:', session)
    const user = session.usuario
    let since = session.fecha_apertura

    // Simulate the fix: append -06:00 if missing, then convert to ISO UTC
    if (since && !since.includes('Z') && !since.includes('+') && !since.match(/-\d\d:\d\d$/)) {
        since = `${since}-06:00`
    }
    const sinceDate = new Date(since)
    const sinceIso = sinceDate.toISOString()
    console.log(`Adjusted session start time (ISO): ${sinceIso}`)

    console.log(`Fetching sales for user '${user}' since '${sinceIso}'`)

    // 2. Fetch sales
    const { data: ventas, error: vErr } = await supabase
        .from('ventas')
        .select('id, fecha_venta, total')
        .eq('usuario', user)
        .gte('fecha_venta', sinceIso)

    if (vErr) {
        console.error('Error fetching ventas:', vErr)
        return
    }

    console.log(`Found ${ventas.length} sales.`)
    if (ventas.length > 0) {
        console.log('Sample sales:', ventas.slice(0, 3))

        const ventaIds = ventas.map(v => v.id)

        // 3. Fetch payments
        const { data: pagos, error: pErr } = await supabase
            .from('pagos')
            .select('*')
            .in('venta_id', ventaIds)

        if (pErr) {
            console.error('Error fetching pagos:', pErr)
        } else {
            console.log(`Found ${pagos.length} payments.`)

            // Calculate total cash
            let totalCash = 0
            pagos.forEach(p => {
                const tipo = (p.tipo || '').toLowerCase()
                if (tipo.includes('efectivo') || tipo === 'cash') {
                    totalCash += Number(p.monto || 0)
                }
            })
            console.log('Calculated Total Cash from Pagos:', totalCash)
            console.log('Sample payments:', pagos.slice(0, 5))
        }
    } else {
        console.log('No sales found, so no payments should be calculated.')
    }
}

inspectData()
