// Ringkasan kelengkapan pengajuan untuk tampilan (cek resmi tetap
// dilakukan database lewat cek_syarat_pengajuan saat dikirim).
import { BISA_DIUBAH } from './konstanta'

export function mkPerolehan(data) {
  return (data.mkDiajukan || []).filter((m) => m.mekanisme === 'perolehan')
}

export function evaluasiLengkap(e) {
  if (!e || !e.pernyataan_setuju) return false
  const butir = Array.isArray(e.butir) ? e.butir : []
  return butir.length > 0 && butir.every((b) => b.profisiensi)
}

export function hitungKelengkapan(data) {
  const p = data.pengajuan
  const b = data.biodata
  const ada = (v) => v !== null && v !== undefined && String(v).trim() !== ''
  const transfer = ['transfer', 'gabungan'].includes(p?.jenis_rpl)
  const perolehan = ['perolehan', 'gabungan'].includes(p?.jenis_rpl)

  const dataOk = !!p?.jenis_rpl && !!p?.prodi_pilihan_id && ada(b?.tempat_lahir) && ada(b?.tanggal_lahir) && ada(b?.alamat)
    && (!transfer || (ada(p?.pt_asal) && ada(p?.status_pddikti_asal) && ada(p?.file_transkrip_url)))
    && (!perolehan || ada(p?.file_ijazah_sma_url))
    && (data.mkDiajukan || []).length > 0
  const riwayatOk = !!data.riwayat && (data.riwayat.status_pekerjaan !== 'pegawai_tetap' || ada(p?.file_f07_ttd_url))
  const jumlahBukti = (data.bukti || []).length
  const mkP = mkPerolehan(data)
  const fedOk = mkP.filter((m) => evaluasiLengkap((data.evaluasi || []).find((e) => e.mk_id === m.mk_id))).length

  const terkirim = p && !BISA_DIUBAH.includes(p.status)
  const langkah = [
    { to: '/pemohon/pengajuan/data', label: 'Data dan persyaratan', status: dataOk ? 'selesai' : (p ? 'proses' : 'belum'),
      ket: 'Lengkapi data pribadi, perguruan tinggi asal, berkas wajib, dan pilih mata kuliah yang diajukan.' },
    { to: '/pemohon/pengajuan/riwayat-hidup', label: 'Riwayat hidup (F07)', status: riwayatOk ? 'selesai' : (data.riwayat ? 'proses' : 'belum'),
      ket: 'Isi Daftar Riwayat Hidup. Pegawai tetap mengunggah F07 yang sudah ditandatangani atasan.' },
    { to: '/pemohon/pengajuan/bukti', label: 'Bukti portofolio', status: jumlahBukti ? 'selesai' : 'belum',
      info: jumlahBukti ? `${jumlahBukti} bukti` : null,
      ket: 'Unggah bukti yang mendukung klaim kemampuan Anda. Setiap bukti diberi nomor untuk dirujuk di F03.' },
  ]
  if (perolehan) {
    langkah.push({ to: '/pemohon/pengajuan/evaluasi-diri', label: 'Evaluasi diri (F03)',
      status: mkP.length && fedOk === mkP.length ? 'selesai' : (fedOk ? 'proses' : 'belum'),
      info: mkP.length ? `${fedOk} dari ${mkP.length} MK` : null,
      ket: `Isi Formulir Evaluasi Diri untuk ${mkP.length - fedOk || 'setiap'} mata kuliah perolehan kredit.` })
  }
  langkah.push({ to: '/pemohon/pengajuan/kirim', label: 'Ringkasan dan kirim', status: terkirim ? 'selesai' : 'belum',
    ket: 'Periksa daftar syarat, lalu kirim pengajuan ke Sekretariat RPL.' })

  const sksDiajukan = (data.mkDiajukan || []).reduce((n, m) => n + (data.mataKuliah.find((k) => k.id === m.mk_id)?.sks || 0), 0)
  const langkahBerikut = !p || terkirim ? null : langkah.find((l) => l.status !== 'selesai') || null

  return { langkah, selesai: langkah.filter((l) => l.status === 'selesai').length, langkahBerikut, sksDiajukan, dataOk, riwayatOk, fedOk }
}
