// Label dan aturan modul Admin.
export const PERAN = [
  { v: 'admin', l: 'Admin', grup: 'Pengelola sistem' },
  { v: 'ketua_tim', l: 'Ketua Tim Pengelola RPL', grup: 'Tim Pengelola RPL' },
  { v: 'sekretaris', l: 'Sekretaris / Sekretariat RPL', grup: 'Tim Pengelola RPL' },
  { v: 'asessor', l: 'Asesor', grup: 'Tim Penilai' },
  { v: 'kaprodi_si', l: 'Ka. Prodi Sistem Informasi', grup: 'Tim Penilai', prodi: 'SI' },
  { v: 'kaprodi_ti', l: 'Ka. Prodi Teknik Informatika', grup: 'Tim Penilai', prodi: 'TI' },
  { v: 'kaprodi_ka', l: 'Ka. Prodi Komputerisasi Akuntansi', grup: 'Tim Penilai', prodi: 'KA' },
  { v: 'kaprodi_dkv', l: 'Ka. Prodi Desain Komunikasi Visual', grup: 'Tim Penilai', prodi: 'DKV' },
  { v: 'komite', l: 'Komite RPL', grup: 'Pimpinan' },
  { v: 'eksekutif', l: 'Pimpinan / Ketua STIKOM', grup: 'Pimpinan' },
  { v: 'lpmp', l: 'Penjaminan Mutu (LPM)', grup: 'Pimpinan' },
  { v: 'baak', l: 'BAAK', grup: 'Unit layanan' },
  { v: 'pmb', l: 'PMB / Keuangan', grup: 'Unit layanan' },
  { v: 'calon_rpl', l: 'Pemohon RPL', grup: 'Pemohon' },
]
export const LABEL_PERAN = Object.fromEntries(PERAN.map((p) => [p.v, p.l]))
export const GRUP_PERAN = [...new Set(PERAN.map((p) => p.grup))]

export const PELAPORAN = [
  { v: 'belum', l: 'Belum dilaporkan', warna: 'slate', aksi: null },
  { v: 'dilaporkan_sistem_rpl', l: 'Dilaporkan ke Sistem RPL', warna: 'indigo', aksi: 'Tandai dilaporkan ke Sistem RPL', kolom: 'dilaporkan_sistem_rpl_at' },
  { v: 'diverifikasi_lldikti', l: 'Diverifikasi LLDIKTI', warna: 'amber', aksi: 'Tandai diverifikasi LLDIKTI', kolom: 'diverifikasi_lldikti_at' },
  { v: 'diinput_pddikti', l: 'Masuk PDDikti', warna: 'green', aksi: 'Tandai sudah masuk PDDikti', kolom: 'dilaporkan_pddikti_at' },
]
export const INDEKS_PELAPORAN = Object.fromEntries(PELAPORAN.map((p, i) => [p.v, i]))

export const KOMPONEN_TARIF = [
  { v: 'pendaftaran', l: 'Biaya pendaftaran', satuan: 'sekali' },
  { v: 'asesmen_per_sks', l: 'Biaya asesmen', satuan: 'per SKS' },
  { v: 'kuliah_per_semester', l: 'Biaya kuliah', satuan: 'per semester' },
  { v: 'matrikulasi_per_mk', l: 'Biaya matrikulasi', satuan: 'per mata kuliah' },
  { v: 'moocs_per_mk', l: 'Biaya MOOCs', satuan: 'per mata kuliah' },
  { v: 'cuti_per_semester', l: 'Biaya cuti', satuan: 'per semester' },
  { v: 'lain_lain', l: 'Lain-lain', satuan: '' },
]
export const LABEL_KOMPONEN = Object.fromEntries(KOMPONEN_TARIF.map((k) => [k.v, k.l]))

export const LABEL_AKSI_LOG = {
  atur_pengguna: 'Ubah pengguna', aktifkan_periode: 'Aktifkan periode', batalkan_pengajuan: 'Batalkan pengajuan', ubah_prodi: 'Ubah program studi',
  ubah_status: 'Ubah status', status_pelaporan: 'Status pelaporan',
}

export const STATUS_AKTIF = ['diajukan', 'dikembalikan_sekretariat', 'terverifikasi', 'asesmen', 'menunggu_bukti_tambahan', 'pleno_awal',
  'penilaian_lanjutan', 'pleno', 'hasil_disampaikan', 'klarifikasi', 'menunggu_komite', 'dikembalikan_komite', 'menunggu_sk']
export const BISA_DIBATALKAN = (s) => !['sk_terbit', 'selesai', 'dibatalkan'].includes(s)

export function unduhCsv(nama, baris) {
  const sel = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const isi = '﻿' + baris.map((r) => r.map(sel).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = nama
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
