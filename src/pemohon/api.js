// Akses data modul Pemohon (alur Juknis RPL Tipe A).
// Semua aturan dijaga di database (RLS dan trigger); fungsi di sini hanya
// membaca/menulis dan meneruskan pesan galat database apa adanya.
import { supabase } from '../lib/supabase'

const BUCKET = 'rpl-documents'

function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}

// ── Baca ────────────────────────────────────────────────────────
export async function muatSemua(userId) {
  const [prodi, periode, biodata, riwayat, butir, pengajuanList, jenisDok, wilayah, pt] = await Promise.all([
    supabase.from('program_studi').select('*').eq('is_active', true).order('nama').then(cek),
    supabase.from('periode_rpl').select('*').eq('is_aktif', true).maybeSingle().then(cek),
    supabase.from('biodata_pemohon').select('*').eq('user_id', userId).maybeSingle().then(cek),
    supabase.from('riwayat_hidup').select('*').eq('user_id', userId).maybeSingle().then(cek),
    supabase.from('riwayat_hidup_butir').select('*').eq('user_id', userId).order('kategori').order('urutan').then(cek),
    supabase.from('pengajuan_rpl').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(cek),
    supabase.from('jenis_dokumen').select('*').order('urutan').then(cek),
    supabase.from('ref_wilayah').select('nama, provinsi').order('provinsi').order('nama').then((r) => r.data || []),
    supabase.from('ref_perguruan_tinggi').select('nama, kota').order('nama').limit(6000).then((r) => r.data || []),
  ])

  const pengajuan = (pengajuanList || []).find((p) => p.status !== 'dibatalkan') || null
  const detail = pengajuan ? await muatDetail(pengajuan) : kosongDetail()
  const tarif = periode ? await supabase.from('tarif_biaya').select('*').eq('periode_id', periode.id).then(cek) : []

  return {
    refWilayah: wilayah || [], refPt: pt || [],
    prodi: prodi || [], periode, tarif: tarif || [], jenisDokumen: jenisDok || [],
    biodata, riwayat, butirRiwayat: butir || [],
    pengajuan, riwayatPengajuan: pengajuanList || [],
    ...detail,
  }
}

function kosongDetail() {
  return { mataKuliah: [], klaster: [], mkDiajukan: [], evaluasi: [], bukti: [], penilaian: [], lanjutan: [], jadwal: [],
           klarifikasi: [], pembayaran: [], log: [], dokumen: [], batasSks: null }
}

export async function muatDetail(p) {
  const prodiId = p.prodi_pilihan_id
  const q = (t) => supabase.from(t).select('*').eq('pengajuan_id', p.id)
  const [mataKuliah, klaster, mkDiajukan, evaluasi, bukti, penilaian, lanjutan, jadwal, klarifikasi, pembayaran, log, dokumen, batas] =
    await Promise.all([
      prodiId ? supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', prodiId).order('semester').order('kode_mk').then(cek) : [],
      prodiId ? supabase.from('klaster_mk').select('*').eq('prodi_id', prodiId).then(cek) : [],
      q('mk_diajukan').then(cek),
      q('evaluasi_diri').then(cek),
      q('bukti_portofolio').order('nomor').then(cek),
      q('penilaian_mk').then(cek),            // RLS: baru terlihat setelah hasil disampaikan
      // Hasil F10 (asesmen lanjutan) per mata kuliah; RLS sama: baru terlihat setelah hasil disampaikan
      supabase.from('penilaian_lanjutan').select('mk_id, jadwal_id, hasil, catatan, updated_at').eq('pengajuan_id', p.id).then(cek),
      q('jadwal_asesmen').order('waktu').then(cek),
      q('klarifikasi_rpl').order('created_at', { ascending: false }).then(cek),
      q('pembayaran_rpl').order('created_at', { ascending: false }).then(cek),
      q('log_aktivitas_rpl').order('created_at', { ascending: false }).limit(20).then(cek),
      q('dokumen_terbit').order('created_at', { ascending: false }).then(cek),
      prodiId ? supabase.rpc('batas_sks_rpl', { p_prodi: prodiId, p_periode: p.periode_id }).then(cek) : null,
    ])
  return {
    mataKuliah: mataKuliah || [], klaster: klaster || [], mkDiajukan: mkDiajukan || [], evaluasi: evaluasi || [],
    bukti: bukti || [], penilaian: penilaian || [], lanjutan: lanjutan || [], jadwal: jadwal || [], klarifikasi: klarifikasi || [],
    pembayaran: pembayaran || [], log: log || [], dokumen: dokumen || [], batasSks: batas,
  }
}

export async function cekSyarat(pengajuanId) {
  return cek(await supabase.rpc('cek_syarat_pengajuan', { p_pengajuan: pengajuanId })) || []
}

// ── Pengajuan ───────────────────────────────────────────────────
export async function buatPengajuan({ userId, prodiId, jenisRpl, periodeId }) {
  return cek(await supabase.from('pengajuan_rpl')
    .insert({ user_id: userId, prodi_pilihan_id: prodiId, jenis_rpl: jenisRpl, periode_id: periodeId || null, status: 'draft' })
    .select().single())
}

export async function ubahPengajuan(id, nilai) {
  return cek(await supabase.from('pengajuan_rpl').update(nilai).eq('id', id).select().single())
}

export async function ubahStatus(id, status) {
  return ubahPengajuan(id, { status })
}

// ── Biodata (F02) dan riwayat hidup (F07) ───────────────────────
export async function simpanBiodata(userId, nilai) {
  return cek(await supabase.from('biodata_pemohon').upsert({ ...nilai, user_id: userId }).select().single())
}

export async function simpanRiwayat(userId, nilai) {
  return cek(await supabase.from('riwayat_hidup').upsert({ ...nilai, user_id: userId }).select().single())
}

export async function simpanButirRiwayat(userId, kategori, baris) {
  const del = await supabase.from('riwayat_hidup_butir').delete().eq('user_id', userId).eq('kategori', kategori)
  cek(del)
  const isi = baris.filter((b) => (b.nama || '').trim()).map((b, i) => ({
    user_id: userId, kategori, urutan: i,
    tahun: b.tahun ? Number(b.tahun) : null, nama: b.nama.trim(), jurusan: b.jurusan || null,
    penyelenggara: b.penyelenggara || null, jangka_waktu: b.jangka_waktu || null, peran: b.peran || null,
    mulai: b.mulai || null, selesai: b.selesai || null, uraian: b.uraian || null,
  }))
  if (!isi.length) return []
  return cek(await supabase.from('riwayat_hidup_butir').insert(isi).select())
}

// ── Daftar MK diajukan (F02 bagian 2) ───────────────────────────
export async function simpanMkDiajukan(pengajuanId, pilihan, tertutupIds = []) {
  // pilihan: { [mk_id]: 'transfer' | 'perolehan' }
  // Upsert lalu hapus yang tidak dipilih, agar simpan berulang tidak bentrok (409).
  // MK yang sudah ditutup admin tidak di-upsert ulang (ditolak database), tetapi
  // tetap tersimpan selama masih dipilih agar tampil bertanda.
  const tutup = new Set(tertutupIds)
  const isi = Object.entries(pilihan).filter(([, m]) => m).map(([mk_id, mekanisme]) => ({ pengajuan_id: pengajuanId, mk_id, mekanisme }))
  const dipilih = isi.map((r) => r.mk_id)
  let hapus = supabase.from('mk_diajukan').delete().eq('pengajuan_id', pengajuanId)
  if (dipilih.length) hapus = hapus.not('mk_id', 'in', `(${dipilih.join(',')})`)
  cek(await hapus)
  const baru = isi.filter((r) => !tutup.has(r.mk_id))
  if (!baru.length) return []
  return cek(await supabase.from('mk_diajukan').upsert(baru, { onConflict: 'pengajuan_id,mk_id' }).select())
}

// ── Evaluasi diri (F03) ─────────────────────────────────────────
export async function simpanEvaluasi({ pengajuanId, mkId, butir, pernyataan, tempat }) {
  return cek(await supabase.from('evaluasi_diri')
    .upsert({ pengajuan_id: pengajuanId, mk_id: mkId, butir, pernyataan_setuju: pernyataan, tempat_pernyataan: tempat || null },
            { onConflict: 'pengajuan_id,mk_id' })
    .select().single())
}

// ── Berkas ──────────────────────────────────────────────────────
function namaAman(nama) {
  return (nama || 'berkas').normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80)
}

export async function unggahBerkas(userId, pengajuanId, file, awalan) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran berkas maksimal 10 MB')
  const path = `${userId}/${pengajuanId}/${awalan}_${Date.now()}_${namaAman(file.name)}`
  cek(await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }))
  return path
}

export async function urlBerkas(path) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw new Error('Berkas tidak dapat dibuka: ' + error.message)
  return data.signedUrl
}

export async function hapusBerkasStorage(path) {
  if (!path || /^https?:\/\//.test(path)) return
  await supabase.storage.from(BUCKET).remove([path])
}

// ── Bukti portofolio ────────────────────────────────────────────
export async function tambahBukti(nilai) {
  return cek(await supabase.from('bukti_portofolio').insert(nilai).select().single())
}
export async function ubahBukti(id, nilai) {
  return cek(await supabase.from('bukti_portofolio').update(nilai).eq('id', id).select().single())
}
export async function hapusBukti(id) {
  return cek(await supabase.from('bukti_portofolio').delete().eq('id', id))
}

// ── Hasil, sanggahan, jadwal, pembayaran ────────────────────────
export async function ajukanKlarifikasi({ pengajuanId, butir, alasan }) {
  const k = cek(await supabase.from('klarifikasi_rpl')
    .insert({ pengajuan_id: pengajuanId, mk_ids: butir.map((b) => b.mk_id), butir, alasan })
    .select().single())
  const p = await ubahStatus(pengajuanId, 'klarifikasi')
  return { klarifikasi: k, pengajuan: p }
}

export async function konfirmasiHadir(jadwalId) {
  return cek(await supabase.rpc('konfirmasi_hadir', { p_jadwal: jadwalId }))
}

export async function kirimBuktiBayar({ pengajuanId, tagihanId, angsuranKe = 1, komponen, jumlah, path }) {
  // Jumlah dan komponen dipastikan ulang oleh basis data sesuai tagihan.
  return cek(await supabase.from('pembayaran_rpl')
    .insert({ pengajuan_id: pengajuanId, tagihan_id: tagihanId, angsuran_ke: angsuranKe, komponen, jumlah, bukti_bayar_url: path, status: 'menunggu' })
    .select().single())
}

// Bukti tambahan yang diminta asesor sudah diunggah: kembalikan ke asesor.
export async function kirimBuktiTambahan(pengajuanId) {
  return cek(await supabase.rpc('kirim_bukti_tambahan', { p_pengajuan: pengajuanId }))
}
