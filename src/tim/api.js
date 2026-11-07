// Akses data modul Tim Pengelola RPL (Sekretariat, Sekretaris, Ketua Tim).
// Aturan alur dijaga database (RLS, trigger cek_tahap_tim, cek_penugasan_asesor);
// pesan galat database diteruskan apa adanya.
import { supabase } from '../lib/supabase'

function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}

export const PERAN_ASESOR = ['asessor', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka', 'ketua_tim']

// ── Muat ringkas untuk daftar dan beranda ───────────────────────
export async function muatRingkas() {
  let [pengajuan, prodi, periode, mk, penugasan, jadwal, bayar, staf] = await Promise.all([
    supabase.from('pengajuan_rpl').select('*').neq('status', 'draft')
      .order('submitted_at', { ascending: true, nullsFirst: false }).then(cek),
    supabase.from('program_studi').select('*').order('nama').then(cek),
    supabase.from('periode_rpl').select('*').order('created_at', { ascending: false }).then(cek),
    supabase.from('mk_diajukan').select('pengajuan_id, mekanisme').then(cek),
    supabase.from('penugasan_asesor').select('*').then(cek),
    supabase.from('jadwal_asesmen').select('*').order('waktu').then(cek),
    supabase.from('pembayaran_rpl').select('*').order('created_at', { ascending: false }).then(cek),
    supabase.from('profiles').select('id, nama_lengkap, email, role, prodi_id, no_whatsapp')
      .in('role', [...PERAN_ASESOR, 'sekretaris', 'admin', 'komite', 'eksekutif', 'lpmp']).then(cek),
  ])
  pengajuan = (pengajuan || []).filter((p) => p.alur_versi !== 1)
  const userIds = [...new Set(pengajuan.map((p) => p.user_id))]
  const pemohon = userIds.length
    ? cek(await supabase.from('profiles').select('id, nama_lengkap, email, no_whatsapp').in('id', userIds))
    : []
  return {
    pengajuan: pengajuan || [], prodi: prodi || [], periode: periode || [], mkDiajukan: mk || [],
    penugasan: penugasan || [], jadwal: jadwal || [], pembayaran: bayar || [],
    staf: staf || [], pemohon: pemohon || [],
  }
}

// ── Detail satu pengajuan ───────────────────────────────────────
export async function muatDetail(p) {
  const q = (t) => supabase.from(t).select('*').eq('pengajuan_id', p.id)
  const [biodata, riwayat, butir, mataKuliah, mkDiajukan, evaluasi, bukti, verBerkas, verPddikti, log] = await Promise.all([
    supabase.from('biodata_pemohon').select('*').eq('user_id', p.user_id).maybeSingle().then(cek),
    supabase.from('riwayat_hidup').select('*').eq('user_id', p.user_id).maybeSingle().then(cek),
    supabase.from('riwayat_hidup_butir').select('*').eq('user_id', p.user_id).order('kategori').order('urutan').then(cek),
    p.prodi_pilihan_id ? supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', p.prodi_pilihan_id).order('semester').order('kode_mk').then(cek) : [],
    q('mk_diajukan').then(cek),
    q('evaluasi_diri').then(cek),
    q('bukti_portofolio').order('nomor').then(cek),
    q('verifikasi_berkas').maybeSingle().then(cek),
    q('verifikasi_pddikti').maybeSingle().then(cek),
    q('log_aktivitas_rpl').order('created_at', { ascending: false }).limit(100).then(cek),
  ])
  return {
    biodata, riwayat, butirRiwayat: butir || [], mataKuliah: mataKuliah || [], mkDiajukan: mkDiajukan || [],
    evaluasi: evaluasi || [], bukti: bukti || [], verBerkas, verPddikti, log: log || [],
  }
}

// ── Aksi ────────────────────────────────────────────────────────
export async function ubahPengajuan(id, nilai) {
  return cek(await supabase.from('pengajuan_rpl').update(nilai).eq('id', id).select().single())
}

export async function simpanVerifikasiBerkas(pengajuanId, butir, catatan) {
  return cek(await supabase.from('verifikasi_berkas')
    .upsert({ pengajuan_id: pengajuanId, butir, catatan: catatan || null }, { onConflict: 'pengajuan_id' })
    .select().single())
}

export async function simpanVerifikasiPddikti(pengajuanId, nilai) {
  return cek(await supabase.from('verifikasi_pddikti')
    .upsert({ ...nilai, pengajuan_id: pengajuanId }, { onConflict: 'pengajuan_id' }).select().single())
}

export async function tugaskanAsesor(pengajuanId, asesorId, peran) {
  return cek(await supabase.from('penugasan_asesor')
    .insert({ pengajuan_id: pengajuanId, asesor_id: asesorId, peran }).select().single())
}

export async function cabutAsesor(pengajuanId, asesorId) {
  return cek(await supabase.from('penugasan_asesor').delete().eq('pengajuan_id', pengajuanId).eq('asesor_id', asesorId))
}

export async function simpanJadwal(nilai) {
  const { id, ...isi } = nilai
  const kueri = id
    ? supabase.from('jadwal_asesmen').update(isi).eq('id', id)
    : supabase.from('jadwal_asesmen').insert(isi)
  return cek(await kueri.select().single())
}

export async function ubahPembayaran(id, nilai) {
  return cek(await supabase.from('pembayaran_rpl').update(nilai).eq('id', id).select().single())
}
