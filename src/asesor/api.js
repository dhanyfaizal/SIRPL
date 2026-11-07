// Akses data modul Asesor. Hak tulis dijaga database: hanya asesor yang
// ditugaskan, dan hanya selama asesmen berlangsung.
import { supabase } from '../lib/supabase'

function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}

const KODE_KAPRODI = { kaprodi_ti: 'IF', kaprodi_si: 'SI', kaprodi_dkv: 'DKV', kaprodi_ka: 'KA' }

// Daftar pengajuan: yang ditugaskan kepada saya, ditambah pengajuan prodi
// untuk Ka. Prodi (hanya baca) dan semua pengajuan untuk admin.
export async function muatRingkas(userId, role) {
  const [penugasanSaya, prodi, periode] = await Promise.all([
    supabase.from('penugasan_asesor').select('*').eq('asesor_id', userId).then(cek),
    supabase.from('program_studi').select('*').order('nama').then(cek),
    supabase.from('periode_rpl').select('*').order('created_at', { ascending: false }).then(cek),
  ])
  const idTugas = (penugasanSaya || []).map((x) => x.pengajuan_id)
  const kode = KODE_KAPRODI[role]
  const prodiSaya = kode ? (prodi || []).find((p) => p.kode === kode) : null

  let q = supabase.from('pengajuan_rpl').select('*').neq('status', 'draft')
  if (role === 'admin') { /* semua */ } else if (prodiSaya) q = idTugas.length ? q.or(`id.in.(${idTugas.join(',')}),prodi_pilihan_id.eq.${prodiSaya.id}`) : q.eq('prodi_pilihan_id', prodiSaya.id)
  else if (idTugas.length) q = q.in('id', idTugas)
  else return { pengajuan: [], prodi: prodi || [], periode: periode || [], penugasan: [], jadwal: [], penilaian: [], mkDiajukan: [], pemohon: [], staf: [], idTugas: [] }
  // Pengajuan alur lama (versi 1) tetap di dasbor lama. Sebelum asesmen hanya
  // tampil bila sudah ditugaskan kepada saya.
  const SEBELUM = ['diajukan', 'dikembalikan_sekretariat', 'dibatalkan', 'terverifikasi', 'tidak_memenuhi_syarat']
  const pengajuan = (cek(await q.order('submitted_at', { ascending: true })) || [])
    .filter((p) => p.alur_versi !== 1 && (!SEBELUM.includes(p.status) || idTugas.includes(p.id)))
  const ids = pengajuan.map((p) => p.id)
  if (!ids.length) return { pengajuan: [], prodi: prodi || [], periode: periode || [], penugasan: [], jadwal: [], penilaian: [], mkDiajukan: [], pemohon: [], staf: [], idTugas }

  const [penugasan, jadwal, penilaian, mkDiajukan] = await Promise.all([
    supabase.from('penugasan_asesor').select('*').in('pengajuan_id', ids).then(cek),
    supabase.from('jadwal_asesmen').select('*').in('pengajuan_id', ids).order('waktu').then(cek),
    supabase.from('penilaian_mk').select('id, pengajuan_id, mk_id, mekanisme, keputusan, nilai_huruf').in('pengajuan_id', ids).then(cek),
    supabase.from('mk_diajukan').select('pengajuan_id, mk_id, mekanisme').in('pengajuan_id', ids).then(cek),
  ])
  const orang = [...new Set([...pengajuan.map((p) => p.user_id), ...(penugasan || []).map((x) => x.asesor_id)])]
  const profil = orang.length ? cek(await supabase.from('profiles').select('id, nama_lengkap, email, no_whatsapp, role').in('id', orang)) : []
  return {
    pengajuan, prodi: prodi || [], periode: periode || [], penugasan: penugasan || [], jadwal: jadwal || [],
    penilaian: penilaian || [], mkDiajukan: mkDiajukan || [], pemohon: profil || [], staf: profil || [], idTugas,
  }
}

export async function muatDetail(p) {
  const q = (t) => supabase.from(t).select('*').eq('pengajuan_id', p.id)
  const [biodata, riwayat, butir, mataKuliah, mkDiajukan, evaluasi, bukti, verPddikti, penilaian, lanjutan, log, batas] = await Promise.all([
    supabase.from('biodata_pemohon').select('*').eq('user_id', p.user_id).maybeSingle().then(cek),
    supabase.from('riwayat_hidup').select('*').eq('user_id', p.user_id).maybeSingle().then(cek),
    supabase.from('riwayat_hidup_butir').select('*').eq('user_id', p.user_id).order('kategori').order('urutan').then(cek),
    p.prodi_pilihan_id ? supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', p.prodi_pilihan_id).order('semester').order('kode_mk').then(cek) : [],
    q('mk_diajukan').then(cek),
    q('evaluasi_diri').then(cek),
    q('bukti_portofolio').order('nomor').then(cek),
    q('verifikasi_pddikti').maybeSingle().then(cek),
    q('penilaian_mk').then(cek),
    q('penilaian_lanjutan').then(cek),
    q('log_aktivitas_rpl').order('created_at', { ascending: false }).limit(60).then(cek),
    p.prodi_pilihan_id ? supabase.rpc('batas_sks_rpl', { p_prodi: p.prodi_pilihan_id, p_periode: p.periode_id }).then(cek) : null,
  ])
  return {
    biodata, riwayat, butirRiwayat: butir || [], mataKuliah: mataKuliah || [], mkDiajukan: mkDiajukan || [],
    evaluasi: evaluasi || [], bukti: bukti || [], verPddikti, penilaian: penilaian || [], lanjutan: lanjutan || [],
    log: log || [], batasSks: batas,
  }
}

// ── Aksi ────────────────────────────────────────────────────────
export async function simpanPenilaian(nilai) {
  return cek(await supabase.from('penilaian_mk').upsert(nilai, { onConflict: 'pengajuan_id,mk_id' }).select().single())
}

export async function simpanLanjutan(nilai) {
  return cek(await supabase.from('penilaian_lanjutan').upsert(nilai, { onConflict: 'jadwal_id,mk_id' }).select().single())
}

export async function catatJadwal(id, nilai) {
  return cek(await supabase.from('jadwal_asesmen').update(nilai).eq('id', id).select().single())
}

export async function simpanPddikti(pengajuanId, nilai) {
  return cek(await supabase.from('verifikasi_pddikti')
    .upsert({ ...nilai, pengajuan_id: pengajuanId }, { onConflict: 'pengajuan_id' }).select().single())
}

export async function ajukanPleno(pengajuanId, catatan) {
  return cek(await supabase.rpc('ajukan_ke_pleno', { p_pengajuan: pengajuanId, p_catatan: catatan || null }))
}

export async function mintaBuktiTambahan(pengajuanId, pesan) {
  return cek(await supabase.rpc('minta_bukti_tambahan', { p_pengajuan: pengajuanId, p_pesan: pesan }))
}

export async function muatPengajuan(id) {
  return cek(await supabase.from('pengajuan_rpl').select('*').eq('id', id).single())
}
