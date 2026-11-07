// Edge Function "repositori": membuka repositori pelaporan RPL lewat tautan
// berbagi (LLDIKTI, asesor eksternal, dsb.) tanpa akun.
//
//   POST { token, sandi?, aksi: 'daftar' }              -> daftar berkas
//   POST { token, sandi?, aksi: 'buka', berkas: <id> }  -> URL bertanda tangan
//                                                          (berkas unggahan) atau
//                                                          isi dokumen terbit
//
// Kunci service role hanya ada di sini (variabel lingkungan Supabase), tidak
// pernah dikirim ke peramban. Hanya pemohon yang sudah ber-SK yang ditampilkan.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (isi: unknown, status = 200) =>
  new Response(JSON.stringify(isi), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sidik(teks: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks))
  return Array.from(new Uint8Array(h)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ galat: 'Metode tidak didukung' }, 405)

  let masukan: { token?: string; sandi?: string; aksi?: string; berkas?: string }
  try { masukan = await req.json() } catch { return json({ galat: 'Permintaan tidak valid' }, 400) }
  const { token, sandi, aksi = 'daftar', berkas } = masukan
  if (!token || typeof token !== 'string' || token.length > 100) return json({ valid: false, alasan: 'tidak_berlaku' })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const ua = req.headers.get('user-agent') ?? ''

  const { data: t, error: eT } = await db.rpc('periksa_tautan_berbagi', { p_token: token, p_kata_sandi: sandi || null })
  if (eT) return json({ galat: 'Tautan tidak dapat diperiksa' }, 500)
  if (!t?.valid) return json({ valid: false, alasan: t?.alasan ?? 'tidak_berlaku', nama: t?.nama ?? null })

  let q = db.from('v_berkas_repositori').select('*').eq('sudah_sk', true)
  if (t.periode_id) q = q.eq('periode_id', t.periode_id)
  if (t.prodi_ids?.length) q = q.in('prodi_id', t.prodi_ids)
  if (t.mekanisme) q = q.eq('mekanisme', t.mekanisme)
  if (t.pengajuan_ids?.length) q = q.in('pengajuan_id', t.pengajuan_ids)
  const { data: baris, error: eB } = await q
  if (eB) return json({ galat: 'Repositori tidak dapat dimuat' }, 500)

  const daftar = await Promise.all((baris ?? []).map(async (b) => ({
    id: await sidik(`${b.pengajuan_id}|${b.mekanisme}|${b.sumber}|${b.sumber_id ?? ''}|${b.storage_path}`),
    folder_semester: b.folder_semester, folder_prodi: b.folder_prodi, folder_mekanisme: b.folder_mekanisme,
    folder_mahasiswa: b.folder_mahasiswa, subfolder: b.subfolder, nama_berkas: b.nama_berkas,
    jenis: b.sumber === 'dokumen' ? 'dokumen' : 'berkas', _b: b,
  })))

  if (aksi === 'daftar') {
    await db.rpc('catat_akses_tautan', { p_tautan: t.id, p_aksi: 'lihat', p_path: '/', p_ip: ip, p_ua: ua })
    return json({ valid: true, nama: t.nama, kedaluwarsa_at: t.kedaluwarsa_at, berkas: daftar.map(({ _b, ...x }) => x) })
  }

  if (aksi === 'buka') {
    const x = daftar.find((d) => d.id === berkas)
    if (!x) return json({ galat: 'Berkas tidak ditemukan' }, 404)
    const b = x._b
    await db.rpc('catat_akses_tautan', {
      p_tautan: t.id, p_aksi: 'buka', p_ip: ip, p_ua: ua,
      p_path: `${b.folder_prodi}/${b.folder_mekanisme}/${b.folder_mahasiswa}/${b.subfolder}/${b.nama_berkas}`,
    })
    if (b.sumber === 'dokumen') {
      const [{ data: dok }, { data: ttd }] = await Promise.all([
        db.from('dokumen_terbit').select('id, jenis_kode, nomor, tanggal_dokumen, judul, status, sha256, isi_snapshot, final_at').eq('id', b.sumber_id).single(),
        db.from('tanda_tangan_dokumen').select('id, nama_snapshot, jabatan_snapshot, urutan, kode_verifikasi, status, ditandatangani_at').eq('dokumen_id', b.sumber_id).order('urutan'),
      ])
      if (!dok) return json({ galat: 'Dokumen tidak ditemukan' }, 404)
      return json({ dokumen: { ...dok, ttd: ttd ?? [] } })
    }
    if (/^https?:\/\//.test(b.storage_path)) return json({ url: b.storage_path })
    const { data: s, error: eS } = await db.storage.from('rpl-documents').createSignedUrl(b.storage_path, 300)
    if (eS || !s) return json({ galat: 'Berkas tidak dapat dibuka' }, 500)
    return json({ url: s.signedUrl })
  }
  return json({ galat: 'Aksi tidak dikenal' }, 400)
})
