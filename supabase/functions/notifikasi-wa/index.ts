// Edge Function "notifikasi-wa": mengirim antrean notifikasi WhatsApp lewat Fonnte.
//
// Dipanggil oleh:
//   * Database Webhook (INSERT pada antrean_notifikasi) dengan header
//     x-sirpl-rahasia = NOTIFIKASI_RAHASIA, atau
//   * Admin dari Konsol Admin (JWT pengguna berperan admin).
// Token Fonnte (FONNTE_TOKEN) hanya ada di server.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sirpl-rahasia',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (isi: unknown, status = 200) =>
  new Response(JSON.stringify(isi), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function samaAman(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let beda = 0
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return beda === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ galat: 'Metode tidak didukung' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

  // Siapa pemanggilnya: webhook (rahasia bersama) atau admin.
  const rahasia = Deno.env.get('NOTIFIKASI_RAHASIA') ?? ''
  let sah = samaAman(req.headers.get('x-sirpl-rahasia') ?? '', rahasia)
  if (!sah) {
    const auth = req.headers.get('Authorization') ?? ''
    if (auth.startsWith('Bearer ')) {
      const { data } = await db.auth.getUser(auth.slice(7))
      if (data?.user) {
        const { data: p } = await db.from('profiles').select('role, is_verified').eq('id', data.user.id).maybeSingle()
        sah = p?.role === 'admin' && p?.is_verified === true
      }
    }
  }
  if (!sah) return json({ galat: 'Tidak berhak' }, 401)

  const token = Deno.env.get('FONNTE_TOKEN')
  if (!token) return json({ galat: 'FONNTE_TOKEN belum diatur di Secrets Edge Function' }, 503)

  const { data: antrean, error } = await db.rpc('ambil_antrean_wa', { p_batas: 20 })
  if (error) return json({ galat: 'Antrean tidak dapat dibaca' }, 500)

  let terkirim = 0, gagal = 0
  for (const n of antrean ?? []) {
    try {
      const badan = new FormData()
      badan.append('target', n.no_wa)
      badan.append('message', n.pesan)
      badan.append('countryCode', '62')
      const r = await fetch('https://api.fonnte.com/send', {
        method: 'POST', headers: { Authorization: token }, body: badan, signal: AbortSignal.timeout(20_000),
      })
      const hasil = await r.json().catch(() => ({}))
      if (!r.ok || hasil?.status === false) throw new Error(String(hasil?.reason || hasil?.detail || `HTTP ${r.status}`).slice(0, 300))
      await db.from('antrean_notifikasi').update({ status: 'terkirim', terkirim_at: new Date().toISOString(), galat: null }).eq('id', n.id)
      terkirim++
    } catch (e) {
      const habis = n.percobaan >= 3
      await db.from('antrean_notifikasi').update({ status: habis ? 'gagal' : 'menunggu', galat: String((e as Error)?.message ?? e).slice(0, 300) }).eq('id', n.id)
      gagal++
    }
  }
  return json({ diproses: (antrean ?? []).length, terkirim, gagal })
})
