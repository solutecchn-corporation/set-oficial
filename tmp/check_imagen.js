const url = 'https://sqwqlvsjtimallidxrsz.supabase.co/rest/v1/inventario?select=id,imagen&limit=10';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd3FsdnNqdGltYWxsaWR4cnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MjM4NTYsImV4cCI6MjA3ODk5OTg1Nn0.5s_2Dz76gha9Zb-0RPzJ_vBz-TTP6zHrNyAugBpxnEQ';

(async function(){
  try {
    const res = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' } });
    const text = await res.text();
    console.log('STATUS', res.status, res.statusText);
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch(e) { console.log(text); }
  } catch (err) {
    console.error('ERROR', err);
  }
})();
