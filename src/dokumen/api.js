// Akses data mesin dokumen. Penerbitan, tanda tangan, dan finalisasi
// dijalankan oleh RPC database (terbitkan_dokumen, tandatangani_dokumen).
import { supabase } from '../lib/supabase'

function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}

export async function muatDokumen(id) {
  const [dok, ttd] = await Promise.all([
    supabase.from('dokumen_terbit').select('*').eq('id', id).maybeSingle().then(cek),
    supabase.from('tanda_tangan_dokumen').select('*').eq('dokumen_id', id).order('urutan').then(cek),
  ])
  return dok ? { ...dok, ttd: ttd || [] } : null
}

export async function daftarDokumen({ pengajuanId, plenoId, skId } = {}) {
  let q = supabase.from('dokumen_terbit').select('*').order('created_at', { ascending: false })
  if (pengajuanId) q = q.eq('pengajuan_id', pengajuanId)
  if (plenoId) q = q.eq('pleno_id', plenoId)
  if (skId) q = q.eq('sk_id', skId)
  const dok = cek(await q) || []
  const ids = dok.map((d) => d.id)
  const ttd = ids.length ? cek(await supabase.from('tanda_tangan_dokumen').select('*').in('dokumen_id', ids).order('urutan')) : []
  return dok.map((d) => ({ ...d, ttd: ttd.filter((t) => t.dokumen_id === d.id) }))
}

// Tanda tangan yang menunggu saya, beserta dokumennya.
export async function ttdSaya(userId) {
  const ttd = cek(await supabase.from('tanda_tangan_dokumen').select('*').eq('penandatangan_id', userId).order('created_at', { ascending: false })) || []
  const ids = [...new Set(ttd.map((t) => t.dokumen_id))]
  const dok = ids.length ? cek(await supabase.from('dokumen_terbit').select('id, jenis_kode, judul, nomor, tanggal_dokumen, status, pengajuan_id, created_at').in('id', ids)) : []
  return ttd.map((t) => ({ ...t, dokumen: dok.find((d) => d.id === t.dokumen_id) })).filter((t) => t.dokumen)
}

export async function terbitkan({ jenis, isi, judul, pengajuanId, plenoId, skId, jadwalId, klarifikasiId, tanggal, nomor }) {
  return cek(await supabase.rpc('terbitkan_dokumen', {
    p_jenis: jenis, p_isi: isi, p_judul: judul || null, p_pengajuan: pengajuanId || null, p_pleno: plenoId || null,
    p_sk: skId || null, p_jadwal: jadwalId || null, p_klarifikasi: klarifikasiId || null,
    p_tanggal: tanggal || new Date().toLocaleDateString('sv-SE'), p_nomor: nomor || null,
  }))
}

export async function tandatangani(ttdId) {
  return cek(await supabase.rpc('tandatangani_dokumen', { p_ttd: ttdId }))
}
export async function tolak(ttdId, catatan) {
  return cek(await supabase.rpc('tolak_tanda_tangan', { p_ttd: ttdId, p_catatan: catatan }))
}
export async function cabut(dokumenId, alasan) {
  return cek(await supabase.rpc('cabut_dokumen', { p_dokumen: dokumenId, p_alasan: alasan }))
}
export async function verifikasi(kode) {
  return cek(await supabase.rpc('verifikasi_dokumen', { p_kode: kode }))
}

// ── Pengaturan ──────────────────────────────────────────────────
export async function muatPengaturan() {
  const [jenis, nomor, ttd, orang] = await Promise.all([
    supabase.from('jenis_dokumen').select('*').order('urutan').then(cek),
    supabase.from('penomoran_dokumen').select('*').then(cek),
    supabase.from('penandatangan_dokumen').select('*').order('jenis_kode').order('urutan').then(cek),
    supabase.from('profiles').select('id, nama_lengkap, email, role').neq('role', 'calon_rpl').order('nama_lengkap').then(cek),
  ])
  return { jenis: jenis || [], nomor: nomor || [], ttd: ttd || [], orang: orang || [] }
}
export async function simpanPenomoran(jenis, nilai) {
  const hasil = cek(await supabase.from('penomoran_dokumen').update(nilai).eq('jenis_kode', jenis).select())
  if (!hasil?.length) throw new Error('Tidak berwenang mengubah penomoran')
  return hasil[0]
}
export async function simpanPenandatangan(id, nilai) {
  const hasil = cek(await supabase.from('penandatangan_dokumen').update(nilai).eq('id', id).select())
  if (!hasil?.length) throw new Error('Hanya admin yang dapat mengubah penanda tangan')
  return hasil[0]
}

// Jumlah dokumen yang menunggu tanda tangan saya (untuk badge menu).
export async function jumlahTtdMenunggu(userId) {
  const ttd = cek(await supabase.from('tanda_tangan_dokumen').select('dokumen_id').eq('penandatangan_id', userId).eq('status', 'menunggu')) || []
  const ids = [...new Set(ttd.map((t) => t.dokumen_id))]
  if (!ids.length) return 0
  const { count, error } = await supabase.from('dokumen_terbit').select('id', { count: 'exact', head: true }).in('id', ids).eq('status', 'menunggu_ttd')
  if (error) throw new Error(error.message)
  return count || 0
}
