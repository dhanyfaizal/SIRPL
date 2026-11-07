// Label dan aturan tampilan modul Pemohon.

export const STATUS = {
  draft:                    { label: 'Draf', warna: 'amber', tahap: 2 },
  diajukan:                 { label: 'Menunggu verifikasi', warna: 'indigo', tahap: 3 },
  dikembalikan_sekretariat: { label: 'Dikembalikan Sekretariat', warna: 'red', tahap: 2 },
  terverifikasi:            { label: 'Terverifikasi', warna: 'indigo', tahap: 4 },
  asesmen:                  { label: 'Dalam asesmen', warna: 'indigo', tahap: 4 },
  menunggu_bukti_tambahan:  { label: 'Perlu bukti tambahan', warna: 'amber', tahap: 4 },
  pleno_awal:               { label: 'Pleno awal', warna: 'indigo', tahap: 4 },
  penilaian_lanjutan:       { label: 'Penilaian lanjutan', warna: 'indigo', tahap: 4 },
  pleno:                    { label: 'Pleno hasil', warna: 'indigo', tahap: 5 },
  hasil_disampaikan:        { label: 'Hasil menunggu tanggapan', warna: 'amber', tahap: 5 },
  klarifikasi:              { label: 'Sanggahan diproses', warna: 'amber', tahap: 5 },
  menunggu_komite:          { label: 'Menunggu Komite', warna: 'indigo', tahap: 6 },
  dikembalikan_komite:      { label: 'Dikembalikan Komite', warna: 'amber', tahap: 6 },
  menunggu_sk:              { label: 'Menunggu SK', warna: 'indigo', tahap: 7 },
  sk_terbit:                { label: 'SK terbit', warna: 'green', tahap: 7 },
  selesai:                  { label: 'Selesai', warna: 'green', tahap: 8 },
  tidak_memenuhi_syarat:    { label: 'Tidak memenuhi syarat', warna: 'red', tahap: 3 },
  dibatalkan:               { label: 'Dibatalkan', warna: 'slate', tahap: 0 },
}

export const TAHAPAN = [
  'Pendaftaran', 'Pengajuan berkas', 'Verifikasi Sekretariat', 'Asesmen',
  'Pleno dan hasil', 'Persetujuan Komite', 'SK dan rencana studi',
]

export const BISA_DIUBAH = ['draft', 'dikembalikan_sekretariat']
export const HASIL_TERLIHAT = ['hasil_disampaikan', 'klarifikasi', 'menunggu_komite', 'dikembalikan_komite',
  'menunggu_sk', 'sk_terbit', 'selesai']

export const JENIS_RPL = {
  transfer:  { label: 'Transfer kredit', ket: 'Pengakuan dari mata kuliah yang pernah ditempuh di perguruan tinggi sebelumnya.' },
  perolehan: { label: 'Perolehan kredit', ket: 'Pengakuan dari pelatihan, sertifikasi, atau pengalaman kerja.' },
  gabungan:  { label: 'Gabungan', ket: 'Sebagian dari studi sebelumnya, sebagian dari pengalaman kerja atau pelatihan.' },
}

export const STATUS_PDDIKTI = {
  lulus: 'Lulus', aktif: 'Aktif', cuti: 'Cuti', mengundurkan_diri: 'Mengundurkan diri',
  putus_studi: 'Putus studi', dikeluarkan: 'Dikeluarkan', tidak_ada: 'Tidak tercatat',
}

// 15 jenis bukti pada F03 resmi. wajibSah = harus disahkan atasan (tanda * di Juknis).
export const JENIS_BUKTI = [
  { v: 'ijazah', l: 'Ijazah', no: 1 },
  { v: 'transkrip', l: 'Transkrip nilai', no: 1 },
  { v: 'riwayat_pekerjaan', l: 'Daftar riwayat pekerjaan dan rincian tugas', no: 2 },
  { v: 'sertifikat_kompetensi', l: 'Sertifikat kompetensi', no: 3 },
  { v: 'lisensi', l: 'Sertifikat pengoperasian / lisensi jabatan kerja', no: 4 },
  { v: 'foto_pekerjaan', l: 'Foto pekerjaan dan deskripsinya', no: 5, wajibSah: true },
  { v: 'buku_harian', l: 'Buku harian pekerjaan', no: 6, wajibSah: true },
  { v: 'lembar_kerja', l: 'Lembar tugas / lembar kerja di perusahaan', no: 7, wajibSah: true },
  { v: 'dokumen_perancangan', l: 'Dokumen analisis / perancangan', no: 8, wajibSah: true },
  { v: 'logbook', l: 'Logbook', no: 9, wajibSah: true },
  { v: 'catatan_pelatihan', l: 'Catatan pelatihan di tempat kerja', no: 10 },
  { v: 'keanggotaan_asosiasi', l: 'Keanggotaan asosiasi profesi', no: 11 },
  { v: 'surat_referensi', l: 'Referensi / surat keterangan pemberi kerja', no: 12 },
  { v: 'penghargaan', l: 'Penghargaan dari industri', no: 13 },
  { v: 'penilaian_kinerja', l: 'Penilaian kinerja dari perusahaan', no: 14, wajibSah: true },
  { v: 'lainnya', l: 'Dokumen lain yang relevan', no: 15 },
]
export const LABEL_BUKTI = Object.fromEntries(JENIS_BUKTI.map((j) => [j.v, j.l]))
export const BUKTI_WAJIB_SAH = new Set(['foto_pekerjaan', 'dokumentasi_pekerjaan', 'buku_harian', 'lembar_kerja',
  'dokumen_perancangan', 'logbook', 'penilaian_kinerja'])

export const PROFISIENSI = [
  { v: 'sangat_baik', l: 'Sangat baik' },
  { v: 'baik', l: 'Baik' },
  { v: 'tidak_pernah', l: 'Tidak pernah' },
]

export const KATEGORI_RIWAYAT = [
  { v: 'pendidikan', l: 'Riwayat pendidikan', kolom: ['nama', 'tahun', 'jurusan'],
    label: { nama: 'Nama sekolah / perguruan tinggi', tahun: 'Tahun lulus', jurusan: 'Jurusan / program studi' } },
  { v: 'pelatihan', l: 'Pelatihan profesional', kolom: ['tahun', 'nama', 'penyelenggara', 'jangka_waktu'],
    label: { tahun: 'Tahun', nama: 'Nama pelatihan dan uraian materi', penyelenggara: 'Penyelenggara', jangka_waktu: 'Jangka waktu' } },
  { v: 'seminar', l: 'Konferensi / seminar / lokakarya', kolom: ['tahun', 'nama', 'penyelenggara', 'peran'],
    label: { tahun: 'Tahun', nama: 'Judul kegiatan', penyelenggara: 'Penyelenggara', peran: 'Panitia / peserta / pembicara' } },
  { v: 'penghargaan', l: 'Penghargaan / piagam', kolom: ['tahun', 'nama', 'penyelenggara'],
    label: { tahun: 'Tahun', nama: 'Bentuk penghargaan', penyelenggara: 'Pemberi penghargaan' } },
  { v: 'organisasi', l: 'Organisasi profesi / ilmiah', kolom: ['tahun', 'nama', 'peran'],
    label: { tahun: 'Tahun', nama: 'Nama organisasi', peran: 'Jabatan / jenjang keanggotaan' } },
  { v: 'pekerjaan', l: 'Riwayat pekerjaan', kolom: ['nama', 'mulai', 'selesai', 'peran', 'uraian'],
    label: { nama: 'Nama dan alamat institusi', mulai: 'Mulai', selesai: 'Selesai', peran: 'Posisi / jabatan', uraian: 'Uraian tugas utama' } },
]

export const KEPUTUSAN = {
  diakui: { label: 'Diakui', warna: 'green' },
  tidak_diakui: { label: 'Tidak diakui', warna: 'red' },
  perlu_asesmen_lanjutan: { label: 'Perlu asesmen lanjutan', warna: 'amber' },
  belum_dinilai: { label: 'Belum dinilai', warna: 'slate' },
}

export function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID')
}

export function tanggal(d, jam = false) {
  if (!d) return '-'
  const opsi = { day: 'numeric', month: 'short', year: 'numeric' }
  if (jam) Object.assign(opsi, { hour: '2-digit', minute: '2-digit' })
  return new Date(d).toLocaleString('id-ID', opsi)
}
