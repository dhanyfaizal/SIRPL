// Kelengkapan dan kunci tahapan pengajuan.
// Tahap berikutnya terbuka bila semua tahap sebelumnya selesai. Pemeriksaan
// resmi tetap dilakukan database lewat cek_syarat_pengajuan saat dikirim.
import { BISA_DIUBAH } from './konstanta'

const ada = (v) => v !== null && v !== undefined && String(v).trim() !== ''

export function mkPerolehan(data) {
  return (data.mkDiajukan || []).filter((m) => m.mekanisme === 'perolehan')
}

export function evaluasiLengkap(e) {
  if (!e || !e.pernyataan_setuju) return false
  const butir = Array.isArray(e.butir) ? e.butir : []
  return butir.length > 0 && butir.every((b) => b.profisiensi && (b.profisiensi === 'tidak_pernah' || (b.bukti || []).length > 0))
}

export const mkTertutup = (mk) => !mk || mk.is_tugas_akhir || mk.rangkaian_ta || mk.dapat_rpl === false

export const perluTanggalKeluar = (status) => ['mengundurkan_diri', 'putus_studi', 'dikeluarkan'].includes(status)

// Berkas wajib per jenis RPL
export const BERKAS = [
  { kolom: 'file_ijazah_sma_url', label: 'Ijazah SMA/SMK/MA atau sederajat', wajibUntuk: ['perolehan', 'gabungan'] },
  { kolom: 'file_transkrip_sma_url', label: 'Transkrip nilai SLTA', wajibUntuk: [] },
  { kolom: 'file_ijazah_url', label: 'Ijazah perguruan tinggi asal', wajibUntuk: [] },
  { kolom: 'file_transkrip_url', label: 'Transkrip nilai perguruan tinggi asal', wajibUntuk: ['transfer', 'gabungan'] },
]

// Bagian berurutan di dalam tahap 1 (Data dan persyaratan)
export function bagianData(data) {
  const p = data.pengajuan
  const b = data.biodata
  const transfer = ['transfer', 'gabungan'].includes(p?.jenis_rpl)
  const daftar = [
    { id: 'prodi', judul: 'Program studi dan jenis RPL',
      selesai: !!p?.prodi_pilihan_id && !!p?.jenis_rpl },
    { id: 'pribadi', judul: 'Data pribadi',
      selesai: ada(b?.tempat_lahir) && ada(b?.tanggal_lahir) && ada(b?.alamat) },
  ]
  if (transfer) {
    daftar.push({ id: 'pt', judul: 'Perguruan tinggi asal',
      selesai: ada(p?.pt_asal) && ada(p?.status_pddikti_asal) && (!perluTanggalKeluar(p?.status_pddikti_asal) || ada(p?.tanggal_mengundurkan_diri)) })
  }
  daftar.push({ id: 'berkas', judul: 'Berkas wajib',
    selesai: BERKAS.filter((x) => x.wajibUntuk.includes(p?.jenis_rpl)).every((x) => ada(p?.[x.kolom])) })
  const tutup = (data.mkDiajukan || []).filter((m) => mkTertutup((data.mataKuliah || []).find((k) => k.id === m.mk_id)))
  daftar.push({ id: 'mk', judul: 'Mata kuliah yang diajukan', selesai: (data.mkDiajukan || []).length > 0 && !tutup.length, adaTertutup: tutup.length })
  return daftar
}

export function hitungKelengkapan(data) {
  const p = data.pengajuan
  const perolehan = ['perolehan', 'gabungan'].includes(p?.jenis_rpl)
  const bagian = p ? bagianData(data) : []
  const dataOk = !!p && bagian.every((x) => x.selesai)
  const riwayatOk = !!data.riwayat && !!data.riwayat.status_pekerjaan
    && (data.riwayat.status_pekerjaan !== 'pegawai_tetap' || ada(p?.file_f07_ttd_url))
  const jumlahBukti = (data.bukti || []).length
  const mkP = mkPerolehan(data)
  const terkirim = !!p && !BISA_DIUBAH.includes(p.status)
  // Aturan bukti F03 berlaku saat mengisi. Pengajuan yang sudah dikirim tidak
  // dinilai ulang dengan aturan baru (data lama tetap dianggap lengkap).
  const fedOk = mkP.filter((m) => {
    const e = (data.evaluasi || []).find((x) => x.mk_id === m.mk_id)
    return terkirim ? !!e?.pernyataan_setuju : evaluasiLengkap(e)
  }).length

  const langkah = [
    { id: 'data', to: '/pemohon/pengajuan/data', label: 'Data dan persyaratan', selesai: dataOk,
      info: p ? `${bagian.filter((x) => x.selesai).length}/${bagian.length}` : null,
      ket: 'Lengkapi program studi, data pribadi, berkas wajib, dan pilih mata kuliah yang diajukan.' },
    { id: 'f07', to: '/pemohon/pengajuan/riwayat-hidup', label: 'Riwayat hidup (F07)', selesai: riwayatOk,
      ket: 'Isi Daftar Riwayat Hidup. Pegawai tetap mengunggah F07 yang sudah ditandatangani atasan.' },
    { id: 'bukti', to: '/pemohon/pengajuan/bukti', label: 'Bukti portofolio', selesai: jumlahBukti > 0,
      info: jumlahBukti ? `${jumlahBukti} bukti` : null,
      ket: 'Unggah bukti yang mendukung klaim kemampuan Anda. Setiap bukti diberi nomor untuk dirujuk di F03.' },
  ]
  if (perolehan) {
    langkah.push({ id: 'f03', to: '/pemohon/pengajuan/evaluasi-diri', label: 'Evaluasi diri (F03)',
      selesai: mkP.length > 0 && fedOk === mkP.length, info: mkP.length ? `${fedOk}/${mkP.length}` : null,
      ket: 'Isi Formulir Evaluasi Diri untuk setiap mata kuliah perolehan kredit.' })
  }
  langkah.push({ id: 'kirim', to: '/pemohon/pengajuan/kirim', label: 'Ringkasan dan kirim', selesai: terkirim,
    ket: 'Periksa daftar syarat, lalu kirim pengajuan ke Sekretariat RPL.' })

  // Kunci: terbuka bila semua tahap sebelumnya selesai (atau pengajuan sudah dikirim).
  let semuaSebelumSelesai = !!p
  langkah.forEach((l, i) => {
    l.no = i + 1
    l.terbuka = terkirim || semuaSebelumSelesai
    l.status = l.selesai ? 'selesai' : l.terbuka ? 'proses' : 'kunci'
    semuaSebelumSelesai = semuaSebelumSelesai && l.selesai
  })

  const sksDiajukan = (data.mkDiajukan || []).reduce((n, m) => n + ((data.mataKuliah || []).find((k) => k.id === m.mk_id)?.sks || 0), 0)
  const langkahBerikut = !p || terkirim ? null : langkah.find((l) => !l.selesai) || null
  const tahap = (id) => langkah.find((l) => l.id === id)
  const sesudah = (id) => langkah[langkah.findIndex((l) => l.id === id) + 1] || null
  const sebelumBelum = (id) => langkah.slice(0, langkah.findIndex((l) => l.id === id)).find((l) => !l.selesai) || null

  return { langkah, bagian, selesai: langkah.filter((l) => l.selesai).length, langkahBerikut,
    sksDiajukan, dataOk, riwayatOk, fedOk, terkirim, tahap, sesudah, sebelumBelum }
}
