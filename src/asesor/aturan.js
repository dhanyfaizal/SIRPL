// Aturan tampilan modul Asesor (Tim Penilai RPL).

// Skala Peraturan Akademik STIKOM. Mata kuliah diakui bila minimal C.
export const SKALA_NILAI = ['A', 'AB', 'B', 'BC', 'C', 'CD', 'D', 'E']
export const NILAI_LULUS = ['A', 'AB', 'B', 'BC', 'C']
export const nilaiLulus = (n) => NILAI_LULUS.includes((n || '').toUpperCase())

// Status saat penilaian masih dapat diubah (dijaga juga oleh database).
export const BISA_DINILAI = ['asesmen', 'menunggu_bukti_tambahan', 'penilaian_lanjutan', 'klarifikasi']

export const KELOMPOK = [
  { id: 'dinilai', label: 'Perlu dinilai', status: ['asesmen', 'menunggu_bukti_tambahan'] },
  { id: 'lanjutan', label: 'Penilaian lanjutan', status: ['penilaian_lanjutan', 'klarifikasi'] },
  { id: 'pleno', label: 'Menunggu pleno', status: ['pleno_awal', 'pleno'] },
  { id: 'selesai', label: 'Hasil ditetapkan', status: ['hasil_disampaikan', 'menunggu_komite', 'dikembalikan_komite', 'menunggu_sk', 'sk_terbit', 'selesai'] },
]
export const kelompokDari = (status) => KELOMPOK.find((k) => k.status.includes(status))?.id || 'selesai'

export const KEPUTUSAN = {
  belum_dinilai: { label: 'Belum dinilai', warna: 'slate' },
  diakui: { label: 'Diakui', warna: 'green' },
  tidak_diakui: { label: 'Tidak diakui', warna: 'red' },
  perlu_asesmen_lanjutan: { label: 'Perlu asesmen lanjutan', warna: 'amber' },
}

export const PERAN = { koordinator: 'Koordinator asesor', anggota: 'Anggota (akademisi)', praktisi: 'Praktisi / profesi' }

export const VATM = [
  { k: 'valid', l: 'V', judul: 'Valid: bukti berhubungan jelas dengan kemampuan yang dinilai' },
  { k: 'autentik', l: 'A', judul: 'Autentik: dapat diverifikasi dan karya pemohon sendiri' },
  { k: 'terkini', l: 'T', judul: 'Terkini: menunjukkan kemampuan saat ini' },
  { k: 'memadai', l: 'M', judul: 'Memadai: cukup menunjukkan indikator kinerja' },
]

export function daftarSubCpmk(mk) {
  const sub = Array.isArray(mk?.sub_cpmk) ? mk.sub_cpmk : []
  if (sub.length) return sub.map((s, i) => ({ kode: s.kode || `Sub-CPMK ${i + 1}`, deskripsi: s.deskripsi || s.teks || '' }))
  return [{ kode: 'CPMK', deskripsi: mk?.cpmk || 'Capaian pembelajaran mata kuliah (program studi belum merinci sub-CPMK).' }]
}

// Ringkasan keputusan semua MK satu pengajuan.
export function ringkasPenilaian(mkDiajukan, penilaian, mataKuliah) {
  const baris = mkDiajukan.map((m) => {
    const mk = mataKuliah.find((x) => x.id === m.mk_id)
    const pn = penilaian.find((x) => x.mk_id === m.mk_id)
    return { ...m, mk, pn, keputusan: pn?.keputusan || 'belum_dinilai' }
  }).filter((b) => b.mk)
  const hit = (k) => baris.filter((b) => b.keputusan === k)
  return {
    baris,
    belum: hit('belum_dinilai').length,
    lanjutan: hit('perlu_asesmen_lanjutan').length,
    diakui: hit('diakui').length,
    sksDiakui: hit('diakui').reduce((n, b) => n + b.mk.sks, 0),
    sksDiajukan: baris.reduce((n, b) => n + b.mk.sks, 0),
  }
}

// Tujuan "Ajukan ke pleno" sesuai status, sama dengan RPC ajukan_ke_pleno.
export function tujuanPleno(p, ringkas) {
  const perolehan = ringkas.baris.some((b) => b.mekanisme === 'perolehan')
  if (p.status === 'asesmen') return perolehan ? 'pleno_awal' : 'pleno'
  if (['penilaian_lanjutan', 'klarifikasi'].includes(p.status)) return 'pleno'
  return null
}
