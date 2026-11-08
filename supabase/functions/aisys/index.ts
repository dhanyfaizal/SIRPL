// Edge Function "aisys": alat bantu asesor membaca transkrip dan mengusulkan
// pasangan mata kuliah asal untuk mata kuliah transfer yang diajukan.
// Keputusan tetap di tangan asesor; hasil hanya mengisi formulir sebagai usulan.
//
//   POST { tugas: 'transkrip', pengajuan_id, teks?, gambar?: string[] (data URL) }
//   -> { terbaca: [{ nama, kode, sks, nilai }], usulan: [{ mk_id, asal, alasan }] }
//
// Kunci API hanya ada di variabel lingkungan Supabase (AISYS_API_KEY), tidak
// pernah dikirim ke peramban. Pemanggil diperiksa dengan fungsi cek_aisys.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (isi: unknown, status = 200) =>
  new Response(JSON.stringify(isi), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SKALA = ['A', 'AB', 'B', 'BC', 'C', 'CD', 'D', 'E']
const MAKS_GAMBAR = 6
const MAKS_UKURAN_GAMBAR = 2_000_000 // karakter data URL
const MAKS_TEKS = 60_000

type Asal = { nama: string; kode: string | null; sks: number | null; nilai: string | null }

function bersihkanNilai(v: unknown): string | null {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '').replace('+', '')
  return SKALA.includes(s) ? s : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ galat: 'Metode tidak didukung' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ galat: 'Silakan masuk terlebih dahulu' }, 401)

  let m: { tugas?: string; pengajuan_id?: string; teks?: string; gambar?: string[] }
  try { m = await req.json() } catch { return json({ galat: 'Permintaan tidak valid' }, 400) }
  if (m.tugas !== 'transkrip') return json({ galat: 'Tugas AISYS tidak dikenal' }, 400)
  if (!m.pengajuan_id || !/^[0-9a-f-]{36}$/i.test(m.pengajuan_id)) return json({ galat: 'Pengajuan tidak valid' }, 400)
  const teks = typeof m.teks === 'string' ? m.teks.slice(0, MAKS_TEKS) : ''
  const gambar = (Array.isArray(m.gambar) ? m.gambar : [])
    .filter((g) => typeof g === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(g) && g.length <= MAKS_UKURAN_GAMBAR)
    .slice(0, MAKS_GAMBAR)
  if (!teks.trim() && !gambar.length) return json({ galat: 'Transkrip kosong atau tidak dapat dibaca' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  // Klien atas nama pengguna: memeriksa hak memakai AISYS.
  const pengguna = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData } = await pengguna.auth.getUser()
  const uid = userData?.user?.id
  if (!uid) return json({ galat: 'Sesi tidak berlaku. Silakan masuk ulang' }, 401)
  const { data: alasan, error: eCek } = await pengguna.rpc('cek_aisys', { p_pengajuan: m.pengajuan_id })
  if (eCek) return json({ galat: 'Hak akses tidak dapat diperiksa' }, 500)
  if (alasan) return json({ galat: alasan }, 403)

  const kunci = Deno.env.get('AISYS_API_KEY')
  if (!kunci) return json({ galat: 'AISYS belum dikonfigurasi. Hubungi Admin (AISYS_API_KEY)' }, 503)
  const apiUrl = (Deno.env.get('AISYS_API_URL') || 'https://ai.sumopod.com/v1').replace(/\/$/, '')
  const model = Deno.env.get('AISYS_MODEL') || 'gpt-5-mini'

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: diajukan } = await db.from('mk_diajukan').select('mk_id').eq('pengajuan_id', m.pengajuan_id).eq('mekanisme', 'transfer')
  const ids = (diajukan ?? []).map((x) => x.mk_id)
  if (!ids.length) return json({ galat: 'Tidak ada mata kuliah transfer yang diajukan' }, 400)
  const { data: tujuan } = await db.from('mata_kuliah_kurikulum').select('id, kode_mk, nama_mk, sks, semester').in('id', ids)
  const daftarTujuan = (tujuan ?? []).map((t) => ({ id: t.id, kode: t.kode_mk, nama: t.nama_mk, sks: t.sks }))

  const perintah = `Anda membantu asesor RPL STIKOM Yos Sudarso membaca transkrip nilai pemohon transfer kredit.

Langkah:
1. Baca SEMUA mata kuliah pada transkrip (nama, kode bila ada, SKS, nilai huruf). Jangan menebak baris yang tidak terbaca. Nilai dikonversi ke skala A, AB, B, BC, C, CD, D, E (A- atau B+ ditulis apa adanya tanpa tanda bila skala berbeda, atau null bila tidak dapat dipastikan).
2. Untuk setiap mata kuliah tujuan di bawah, pilih SATU mata kuliah asal yang capaian/isinya paling setara berdasarkan nama dan SKS. Bila tidak ada yang setara, isi asal dengan null. Satu mata kuliah asal boleh dipakai untuk lebih dari satu tujuan hanya bila memang setara.

Mata kuliah tujuan (id, kode, nama, sks):
${JSON.stringify(daftarTujuan)}

Jawab HANYA dengan JSON:
{"terbaca":[{"nama":"...","kode":"..."|null,"sks":3|null,"nilai":"B"|null}],
 "usulan":[{"mk_id":"<id tujuan>","asal":<indeks pada terbaca>|null,"alasan":"singkat, maks 15 kata"}]}`

  const isi: unknown[] = [{ type: 'text', text: perintah }]
  if (teks.trim()) isi.push({ type: 'text', text: `Teks transkrip (hasil ekstraksi PDF):\n${teks}` })
  for (const g of gambar) isi.push({ type: 'image_url', image_url: { url: g } })

  const catat = (berhasil: boolean, pakai?: { prompt_tokens?: number; completion_tokens?: number }) =>
    db.from('penggunaan_aisys').insert({ pengguna_id: uid, pengajuan_id: m.pengajuan_id, tugas: 'transkrip', berhasil, model,
      token_masuk: pakai?.prompt_tokens ?? null, token_keluar: pakai?.completion_tokens ?? null })

  let hasil: { terbaca?: unknown[]; usulan?: unknown[] }
  try {
    const r = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kunci}` },
      body: JSON.stringify({
        model, temperature: 0, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Anda asisten akademik yang teliti. Jawaban selalu JSON valid tanpa teks lain.' },
          { role: 'user', content: isi },
        ],
      }),
      signal: AbortSignal.timeout(110_000),
    })
    const badan = await r.json().catch(() => null)
    if (!r.ok) {
      await catat(false)
      return json({ galat: `Layanan AISYS menolak permintaan (${r.status})` }, 502)
    }
    const konten = String(badan?.choices?.[0]?.message?.content ?? '').replace(/^```(json)?|```$/g, '').trim()
    hasil = JSON.parse(konten)
    await catat(true, badan?.usage)
  } catch (_e) {
    await catat(false)
    return json({ galat: 'AISYS tidak dapat membaca transkrip saat ini. Coba lagi atau isi manual' }, 502)
  }

  // Validasi keluaran: hanya mata kuliah tujuan yang diajukan, nilai sesuai skala.
  const semua: Asal[] = (Array.isArray(hasil?.terbaca) ? hasil.terbaca : []).slice(0, 200).map((x: any) => ({
    nama: String(x?.nama ?? '').trim().slice(0, 160),
    kode: x?.kode ? String(x.kode).trim().slice(0, 30) : null,
    sks: Number.isFinite(Number(x?.sks)) && Number(x.sks) > 0 && Number(x.sks) <= 12 ? Number(x.sks) : null,
    nilai: bersihkanNilai(x?.nilai),
  }))
  const terbaca = semua.filter((x) => x.nama)
  const sah = new Set(ids)
  const usulan = (Array.isArray(hasil?.usulan) ? hasil.usulan : []).map((u: any) => {
    const i = Number.isInteger(u?.asal) ? u.asal : null
    return { mk_id: String(u?.mk_id ?? ''), asal: i !== null && i >= 0 && i < semua.length && semua[i].nama ? semua[i] : null, alasan: String(u?.alasan ?? '').slice(0, 160) }
  }).filter((u) => sah.has(u.mk_id))

  return json({ terbaca, usulan, model })
})
