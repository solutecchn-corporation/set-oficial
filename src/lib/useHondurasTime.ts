// Hook / util functions to consistently produce Honduras (America/Tegucigalpa) timestamps
// Honduras is UTC-6 (no DST). We generate ISO strings with the -06:00 offset so
// Postgres/Supabase stores the intended local time with timezone info.

export function hondurasNowISO(): string {
  // Format as YYYY-MM-DDTHH:mm:ss-06:00
  const fmt = new Intl.DateTimeFormat('sv', {
    timeZone: 'America/Tegucigalpa',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  const parts = fmt.format(new Date()) // returns "YYYY-MM-DD HH:mm:ss"
  const isoNoTZ = parts.replace(' ', 'T')
  // Honduras is always -06:00
  return `${isoNoTZ}-06:00`
}

export function hondurasNowLocalInput(): string {
  // For <input type="datetime-local"> we want "YYYY-MM-DDTHH:MM" (no seconds, no TZ)
  const fmt = new Intl.DateTimeFormat('sv', {
    timeZone: 'America/Tegucigalpa',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
  return fmt.format(new Date()).replace(' ', 'T')
}

export default function useHondurasTime() {
  return {
    hondurasNowISO,
    hondurasNowLocalInput,
    nowDate: () => new Date(hondurasNowISO())
  }
}

export function hondurasTodayDate(): string {
  // Returns YYYY-MM-DD for Honduras timezone
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(new Date())
}
