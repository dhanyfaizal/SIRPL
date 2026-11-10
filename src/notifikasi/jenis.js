// Jenis pesan WhatsApp (selaras dengan pemicu di migrasi notifikasi_wa) dan pengelompokannya.
import { supabase } from '../lib/supabase'

// Jumlah pesan yang menunggu dikirim manual (badge menu "WA keluar"); 0 bila bukan staf pengirim.
export async function jumlahWaMenunggu() {
  const { data, error } = await supabase.rpc('jumlah_wa_menunggu')
  if (error) return 0
  return data || 0
}
export const JENIS_WA = [
  { grup: 'Untuk pemohon', daftar: [
    ['pengajuan_diterima', 'Pengajuan diterima'], ['berkas_dikembalikan', 'Berkas dikembalikan untuk perbaikan'], ['berkas_terverifikasi', 'Berkas terverifikasi'],
    ['tidak_memenuhi', 'Tidak memenuhi syarat'], ['bukti_tambahan', 'Permintaan bukti tambahan'], ['penilaian_lanjutan', 'Masuk penilaian lanjutan'],
    ['jadwal_baru', 'Jadwal wawancara/uji baru'], ['jadwal_ubah', 'Perubahan jadwal'], ['jadwal_batal', 'Jadwal dibatalkan'], ['hasil_rpl', 'Hasil asesmen tersedia'],
    ['sk_terbit', 'SK terbit'], ['nim_terbit', 'NIM ditetapkan'], ['bayar_lunas', 'Pembayaran lunas'], ['bayar_ditolak', 'Bukti bayar ditolak'],
  ] },
  { grup: 'Untuk staf', daftar: [
    ['berkas_masuk', 'BAAK: pengajuan baru'], ['perlu_asesor', 'Ketua Tim: perlu penugasan asesor'], ['tugas_asesor', 'Asesor: penugasan baru'],
    ['jadwal_asesor', 'Asesor: jadwal wawancara/uji'], ['siap_pleno', 'Tim: siap pleno'], ['perlu_komite', 'Komite: menunggu keputusan'],
    ['dikembalikan_komite', 'Ketua Tim: dikembalikan Komite'], ['perlu_nim', 'BAAK: SK terbit, tetapkan NIM'], ['bukti_bayar', 'PMB: bukti bayar baru'],
    ['tanda_tangan', 'Penandatangan: dokumen menunggu tanda tangan'],
  ] },
]
export const LABEL_WA = Object.fromEntries(JENIS_WA.flatMap((g) => g.daftar).concat([['uji', 'Pesan uji']]))

// Kelompok kerja: dipakai untuk menyaring halaman WA keluar per bagian.
export const KATEGORI_WA = [
  { v: 'berkas', l: 'Berkas', jenis: ['pengajuan_diterima', 'berkas_dikembalikan', 'berkas_terverifikasi', 'tidak_memenuhi', 'bukti_tambahan', 'berkas_masuk'] },
  { v: 'asesmen', l: 'Asesmen dan jadwal', jenis: ['penilaian_lanjutan', 'jadwal_baru', 'jadwal_ubah', 'jadwal_batal', 'hasil_rpl', 'perlu_asesor', 'tugas_asesor', 'jadwal_asesor', 'siap_pleno', 'tanda_tangan'] },
  { v: 'keputusan', l: 'Komite, SK, NIM', jenis: ['perlu_komite', 'dikembalikan_komite', 'sk_terbit', 'perlu_nim', 'nim_terbit'] },
  { v: 'pembayaran', l: 'Pembayaran', jenis: ['bayar_lunas', 'bayar_ditolak', 'bukti_bayar'] },
]
export const kategoriWa = (jenis) => KATEGORI_WA.find((k) => k.jenis.includes(jenis))?.v || 'lain'

// Tautan klik-untuk-kirim: membuka WhatsApp Desktop/Web (komputer) atau aplikasi (HP).
export const tautanWa = (noWa, pesan = '') => {
  const no = String(noWa || '').replace(/\D/g, '').replace(/^0/, '62')
  return `https://wa.me/${no}${pesan ? `?text=${encodeURIComponent(pesan)}` : ''}`
}
