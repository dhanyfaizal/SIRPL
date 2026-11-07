// Hak lihat halaman modul Komite dan Pimpinan. Hak ubah dijaga RPC database.
const AKSES = {
  komite: ['admin', 'komite', 'eksekutif', 'ketua_tim', 'sekretaris'],
  sk: ['admin', 'eksekutif', 'sekretaris', 'ketua_tim'],
  nim: ['admin', 'baak', 'sekretaris', 'ketua_tim'],
}
export const bolehLihat = (role, halaman) => (AKSES[halaman] || []).includes(role)

export const BOLEH = {
  putuskanKomite: (role) => ['admin', 'komite'].includes(role),
  terbitkanSk: (role) => ['admin', 'eksekutif', 'sekretaris'].includes(role),
  tetapkanNim: (role) => ['admin', 'baak'].includes(role),
}

export const STATUS_PASCA = ['menunggu_komite', 'dikembalikan_komite', 'menunggu_sk', 'sk_terbit', 'selesai']

export function ringkasHasil(p, d) {
  const pn = d.penilaian.filter((x) => x.pengajuan_id === p.id)
  const mk = d.mkDiajukan.filter((x) => x.pengajuan_id === p.id)
  const baris = mk.map((m) => {
    const k = d.mataKuliah.find((x) => x.id === m.mk_id)
    const n = pn.find((x) => x.mk_id === m.mk_id)
    return { ...m, mk: k, pn: n, keputusan: n?.keputusan || 'belum_dinilai' }
  }).filter((b) => b.mk)
  const diakui = baris.filter((b) => b.keputusan === 'diakui')
  return {
    baris, diakui,
    sksDiakui: diakui.reduce((n, b) => n + b.mk.sks, 0),
    sksTransfer: diakui.filter((b) => b.mekanisme === 'transfer').reduce((n, b) => n + b.mk.sks, 0),
    sksPerolehan: diakui.filter((b) => b.mekanisme === 'perolehan').reduce((n, b) => n + b.mk.sks, 0),
  }
}
