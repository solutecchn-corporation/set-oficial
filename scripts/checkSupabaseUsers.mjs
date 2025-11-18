import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sqwqlvsjtimallidxrsz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd3FsdnNqdGltYWxsaWR4cnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjM4NTYsImV4cCI6MjA3ODk5OTg1Nn0.5s_2Dz76gha9Zb-0RPzJ_vBz-TTP6zHrNyAugBpxnEQ'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log('Testing Supabase connection to', SUPABASE_URL)
  try {
    const { data, error, status } = await supabase.from('users').select('id, username, role').limit(5)
    console.log('status:', status)
    if (error) {
      console.error('Supabase error:', error)
      process.exit(1)
    }
    console.log('rows:', data)
  } catch (err) {
    console.error('Exception:', err)
    process.exit(2)
  }
}

main()
