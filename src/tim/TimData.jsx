// Penyimpan data modul Tim Pengelola RPL.
// Ringkasan dimuat sekali saat modul dibuka; detail pengajuan disimpan per id
// sehingga pindah tab atau halaman tidak memuat ulang. Tombol "Muat ulang"
// menyegarkan di latar belakang tanpa mengosongkan tampilan.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as api from './api'

const Ctx = createContext(null)
export const useTim = () => useContext(Ctx)

// Verifikasi kelengkapan berkas oleh BAAK (Ketua Tim sebagai cadangan).
export const BISA_VERIFIKASI = ['admin', 'ketua_tim', 'baak']
export const BISA_VERIFIKASI_BAYAR = ['admin', 'pmb']
export const BISA_TUGASKAN = ['admin', 'ketua_tim']

export function TimDataProvider({ children }) {
  const { role } = useAuth()
  const [data, setData] = useState(null)
  const [detail, setDetail] = useState({})
  const [galat, setGalat] = useState(null)
  const [sinkron, setSinkron] = useState(false)
  const jalan = useRef(0)

  const muat = useCallback(async () => {
    const id = ++jalan.current
    setSinkron(true)
    try {
      const hasil = await api.muatRingkas()
      if (id === jalan.current) { setData(hasil); setGalat(null) }
    } catch (e) {
      if (id === jalan.current) setGalat(e.message)
    } finally {
      if (id === jalan.current) setSinkron(false)
    }
  }, [])
  useEffect(() => { muat() }, [muat])

  const muatDetail = useCallback(async (p, paksa = false) => {
    if (!p) return
    setDetail((d) => (d[p.id] && !paksa ? d : { ...d, [p.id]: { ...(d[p.id] || {}), memuat: true } }))
    try {
      const isi = await api.muatDetail(p)
      setDetail((d) => ({ ...d, [p.id]: { ...isi, memuat: false } }))
    } catch (e) {
      setDetail((d) => ({ ...d, [p.id]: { ...(d[p.id] || {}), memuat: false, galat: e.message } }))
    }
  }, [])

  // Perbarui sebagian data ringkas atau detail setelah aksi berhasil.
  const ubah = useCallback((fn) => setData((d) => (d ? { ...d, ...fn(d) } : d)), [])
  const ubahDetail = useCallback((id, fn) => setDetail((d) => ({ ...d, [id]: { ...(d[id] || {}), ...fn(d[id] || {}) } })), [])
  const gantiPengajuan = useCallback((baru) => setData((d) => (d ? { ...d, pengajuan: d.pengajuan.map((p) => (p.id === baru.id ? baru : p)) } : d)), [])

  const nilai = useMemo(() => {
    const pemohon = Object.fromEntries((data?.pemohon || []).map((u) => [u.id, u]))
    const staf = Object.fromEntries((data?.staf || []).map((u) => [u.id, u]))
    const prodi = Object.fromEntries((data?.prodi || []).map((p) => [p.id, p]))
    return {
      data, detail, galat, sinkron, muat, muatDetail, ubah, ubahDetail, gantiPengajuan, role,
      siap: !!data, peta: { pemohon, staf, prodi },
      bisaVerifikasi: BISA_VERIFIKASI.includes(role),
      bisaTugaskan: BISA_TUGASKAN.includes(role),
      bisaVerifikasiBayar: BISA_VERIFIKASI_BAYAR.includes(role),
    }
  }, [data, detail, galat, sinkron, muat, muatDetail, ubah, ubahDetail, gantiPengajuan, role])

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}
