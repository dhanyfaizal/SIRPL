// Pengelompokan status dan daftar periksa kelengkapan untuk Tim Pengelola RPL.
import { BERKAS, mkPerolehan, evaluasiLengkap, perluTanggalKeluar } from '../pemohon/kelengkapan'
import { STATUS_PDDIKTI } from '../pemohon/konstanta'

export const KELOMPOK = [
  { id: 'verifikasi', label: 'Perlu verifikasi', status: ['diajukan'] },
  { id: 'dikembalikan', label: 'Dikembalikan', status: ['dikembalikan_sekretariat'] },
  { id: 'siap', label: 'Siap asesmen', status: ['terverifikasi'] },
  { id: 'asesmen', label: 'Asesmen berjalan', status: ['asesmen', 'menunggu_bukti_tambahan', 'pleno_awal', 'penilaian_lanjutan', 'pleno'] },
  { id: 'hasil', label: 'Hasil dan keputusan', status: ['hasil_disampaikan', 'klarifikasi', 'menunggu_komite', 'dikembalikan_komite', 'menunggu_sk', 'sk_terbit'] },
  { id: 'akhir', label: 'Selesai atau ditolak', status: ['selesai', 'tidak_memenuhi_syarat', 'dibatalkan'] },
]
export const kelompokDari = (status) => KELOMPOK.find((k) => k.status.includes(status))?.id || 'akhir'

export function lamaHari(dari) {
  if (!dari) return null
  return Math.max(0, Math.floor((Date.now() - new Date(dari).getTime()) / 86400000))
}

export const PERAN_PENUGASAN = [
  { v: 'koordinator', l: 'Koordinator asesor' },
  { v: 'anggota', l: 'Anggota (akademisi)' },
  { v: 'praktisi', l: 'Praktisi / profesi' },
]

export const JENIS_ASESMEN = [
  { v: 'wawancara', l: 'Wawancara' }, { v: 'praktik', l: 'Unjuk kerja / praktik' }, { v: 'tulis', l: 'Uji tulis' },
  { v: 'presentasi', l: 'Presentasi' }, { v: 'observasi', l: 'Observasi' }, { v: 'tugas', l: 'Penugasan' },
]
export const TAHAP_JADWAL = [
  { v: 'penilaian_lanjutan', l: 'Penilaian lanjutan' },
  { v: 'penilaian_awal', l: 'Penilaian awal' },
  { v: 'klarifikasi', l: 'Klarifikasi / sanggahan' },
]
export const STATUS_JADWAL = {
  dijadwalkan: { label: 'Dijadwalkan', warna: 'indigo' },
  selesai: { label: 'Selesai', warna: 'green' },
  tidak_hadir: { label: 'Tidak hadir', warna: 'red' },
  dijadwalkan_ulang: { label: 'Dijadwalkan ulang', warna: 'amber' },
  dibatalkan: { label: 'Dibatalkan', warna: 'slate' },
}
export const STATUS_BAYAR = {
  menunggu: { label: 'Menunggu verifikasi', warna: 'amber' },
  lunas: { label: 'Lunas', warna: 'green' },
  ditolak: { label: 'Ditolak', warna: 'red' },
}
export const KOMPONEN_BAYAR = { pendaftaran: 'Biaya pendaftaran', asesmen: 'Biaya asesmen', lainnya: 'Lainnya' }

// Butir daftar periksa kelengkapan awal (Pedoman 2.7: Sekretariat memeriksa
// kelengkapan awal). Setiap butir membawa ringkasan isi agar pemeriksa tidak
// perlu berpindah halaman.
export function butirPeriksa(p, d) {
  const transfer = ['transfer', 'gabungan'].includes(p.jenis_rpl)
  const perolehan = ['perolehan', 'gabungan'].includes(p.jenis_rpl)
  const b = d.biodata
  const daftar = [
    { kode: 'identitas', label: 'Data pribadi (F02 bagian 1)', ket: 'Nama, tempat dan tanggal lahir, alamat, kewarganegaraan sesuai dokumen identitas.',
      ada: !!(b?.tempat_lahir && b?.tanggal_lahir && b?.alamat) },
  ]
  for (const x of BERKAS) {
    const wajib = x.wajibUntuk.includes(p.jenis_rpl)
    if (!wajib && !p[x.kolom]) continue
    daftar.push({ kode: x.kolom, label: x.label + (wajib ? '' : ' (tambahan)'), path: p[x.kolom], ada: !!p[x.kolom],
      ket: 'Berkas terbaca, utuh, dan atas nama pemohon.' })
  }
  if (transfer) {
    daftar.push({ kode: 'pt_asal', label: 'Perguruan tinggi asal dan status di PDDikti',
      ket: `${p.pt_asal || '-'} · ${STATUS_PDDIKTI[p.status_pddikti_asal] || 'status belum diisi'}${perluTanggalKeluar(p.status_pddikti_asal) ? ` · keluar ${p.tanggal_mengundurkan_diri || '-'}` : ''}`,
      ada: !!(p.pt_asal && p.status_pddikti_asal) })
  }
  const pegawaiTetap = d.riwayat?.status_pekerjaan === 'pegawai_tetap'
  daftar.push({ kode: 'f07', label: 'Daftar Riwayat Hidup (F07)' + (pegawaiTetap ? ' bertanda tangan atasan' : ''),
    path: pegawaiTetap ? p.file_f07_ttd_url : null, ada: !!d.riwayat?.status_pekerjaan && (!pegawaiTetap || !!p.file_f07_ttd_url),
    ket: pegawaiTetap ? 'Pegawai tetap: F07 diunggah setelah ditandatangani atasan.' : 'Riwayat pendidikan, pekerjaan, pelatihan, dan organisasi.' })
  daftar.push({ kode: 'bukti', label: 'Bukti portofolio bernomor', ada: (d.bukti || []).length > 0,
    ket: `${(d.bukti || []).length} bukti. Nomor dan nama dokumen jelas, berkas dapat dibuka.` })
  if (perolehan) {
    const mkP = mkPerolehan(d)
    const lengkap = mkP.filter((m) => evaluasiLengkap((d.evaluasi || []).find((e) => e.mk_id === m.mk_id))).length
    daftar.push({ kode: 'f03', label: 'Formulir Evaluasi Diri (F03)', ada: mkP.length > 0 && lengkap === mkP.length,
      ket: `${lengkap} dari ${mkP.length} mata kuliah perolehan kredit terisi dan dinyatakan benar.` })
  }
  daftar.push({ kode: 'mk', label: 'Daftar mata kuliah yang diajukan (F02 bagian 2)', ada: (d.mkDiajukan || []).length > 0,
    ket: 'Mata kuliah sesuai kurikulum prodi tujuan dan bukan tugas akhir.' })
  return daftar
}

// Gabungkan hasil pemeriksaan tersimpan dengan butir terkini.
export function gabungPeriksa(butir, tersimpan) {
  const lama = Object.fromEntries((tersimpan?.butir || []).map((x) => [x.kode, x]))
  return butir.map((x) => ({ ...x, sesuai: lama[x.kode]?.sesuai ?? null, catatan: lama[x.kode]?.catatan || '' }))
}

export function catatanPerbaikan(periksa) {
  return periksa.filter((x) => x.sesuai === false)
    .map((x, i) => `${i + 1}. ${x.label}${x.catatan ? `: ${x.catatan}` : ''}`).join('\n')
}
