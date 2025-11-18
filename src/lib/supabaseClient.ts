import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Prefer using Vite environment variables in dev/production.
// If no env vars are provided, se usan las credenciales pasadas por el usuario.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://sqwqlvsjtimallidxrsz.supabase.co'
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd3FsdnNqdGltYWxsaWR4cnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjM4NTYsImV4cCI6MjA3ODk5OTg1Nn0.5s_2Dz76gha9Zb-0RPzJ_vBz-TTP6zHrNyAugBpxnEQ'

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // No persistir sesión por defecto en este cliente de lectura/escritura en frontend
    persistSession: false
  }
})

export default supabase
