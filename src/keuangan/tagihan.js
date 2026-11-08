// Perhitungan tagihan, angsuran, dan status pembayaran (dipakai PMB dan pemohon).
export const KOMPONEN_TAGIHAN = {
  pendaftaran: 'Biaya pendaftaran', asesmen: 'Biaya asesmen', matrikulasi: 'Biaya matrikulasi', moocs: 'Biaya MOOCs', lain_lain: 'Biaya lain-lain',
}
export const KOMPONEN_TAMBAHAN = ['matrikulasi', 'moocs', 'lain_lain']

export const STATUS_TAGIHAN = {
  belum: { label: 'Belum dibayar', warna: 'slate' },
  diperiksa: { label: 'Menunggu verifikasi', warna: 'amber' },
  sebagian: { label: 'Dibayar sebagian', warna: 'indigo' },
  lunas: { label: 'Lunas', warna: 'green' },
  bebas: { label: 'Tidak ada biaya', warna: 'green' },
}

const hariIni = () => new Date().toISOString().slice(0, 10)

// Satu tagihan beserta pembayarannya -> angsuran dengan status masing-masing.
export function ringkasTagihan(t, pembayaran) {
  const total = Math.max(Number(t.nominal) - Number(t.potongan || 0), 0)
  const bayar = pembayaran.filter((b) => b.tagihan_id === t.id)
  const daftar = (t.angsuran && t.angsuran.length ? t.angsuran : [{ ke: 1, jumlah: total, jatuh_tempo: null }]).map((a) => {
    const milik = bayar.filter((b) => (b.angsuran_ke || 1) === a.ke)
    const lunas = milik.find((b) => b.status === 'lunas')
    const menunggu = milik.find((b) => b.status === 'menunggu')
    const ditolak = milik.filter((b) => b.status === 'ditolak').sort((x, y) => (x.created_at < y.created_at ? 1 : -1))[0]
    const status = lunas ? 'lunas' : menunggu ? 'diperiksa' : 'belum'
    const terlambat = status === 'belum' && a.jatuh_tempo && a.jatuh_tempo < hariIni()
    return { ...a, jumlah: Number(a.jumlah), status, bukti: lunas || menunggu || null, ditolak: !lunas && !menunggu ? ditolak : null, terlambat }
  })
  const terbayar = daftar.filter((a) => a.status === 'lunas').reduce((n, a) => n + a.jumlah, 0)
  const status = total <= 0 ? 'bebas' : terbayar >= total ? 'lunas' : daftar.some((a) => a.status === 'diperiksa') && terbayar === 0 ? 'diperiksa' : terbayar > 0 ? 'sebagian' : 'belum'
  const terkunci = bayar.some((b) => b.status === 'menunggu' || b.status === 'lunas')
  return { total, terbayar, sisa: Math.max(total - terbayar, 0), status, angsuran: daftar, cicilan: daftar.length > 1, terkunci }
}

// Semua tagihan satu pengajuan.
export function ringkasPengajuan(tagihan, pembayaran) {
  const rinci = tagihan.map((t) => ({ t, r: ringkasTagihan(t, pembayaran) }))
  const total = rinci.reduce((n, x) => n + x.r.total, 0)
  const terbayar = rinci.reduce((n, x) => n + x.r.terbayar, 0)
  const potongan = tagihan.reduce((n, t) => n + Number(t.potongan || 0), 0)
  const menunggu = rinci.reduce((n, x) => n + x.r.angsuran.filter((a) => a.status === 'diperiksa').length, 0)
  const terlambat = rinci.reduce((n, x) => n + x.r.angsuran.filter((a) => a.terlambat).length, 0)
  const status = !tagihan.length ? 'belum' : total <= 0 ? 'bebas' : terbayar >= total ? 'lunas' : terbayar > 0 ? 'sebagian' : menunggu ? 'diperiksa' : 'belum'
  return { rinci, total, terbayar, sisa: Math.max(total - terbayar, 0), potongan, menunggu, terlambat, status, cicilan: rinci.some((x) => x.r.cicilan) }
}

// Potongan dari skema diskon (cermin fungsi hitung_potongan di basis data).
export function potonganDiskon(nominal, d) {
  if (!d) return 0
  const v = d.jenis === 'persen' ? Math.round(Number(nominal) * Number(d.nilai) / 100) : Number(d.nilai)
  return Math.min(v, Number(nominal))
}

// Angsuran dari templat skema bayar: dibulatkan ke ribuan, sisa pembulatan masuk angsuran terakhir.
export function angsuranDariSkema(rincian, total, mulai) {
  const awal = new Date(`${mulai || hariIni()}T00:00:00`)
  let terpakai = 0
  return rincian.map((r, i) => {
    const akhir = i === rincian.length - 1
    const jumlah = akhir ? total - terpakai : Math.round((total * Number(r.persen)) / 100 / 1000) * 1000
    terpakai += jumlah
    const tgl = new Date(awal.getTime() + Number(r.hari || 0) * 86400000)
    return { ke: i + 1, jumlah, jatuh_tempo: `${tgl.getFullYear()}-${String(tgl.getMonth() + 1).padStart(2, '0')}-${String(tgl.getDate()).padStart(2, '0')}` }
  })
}
