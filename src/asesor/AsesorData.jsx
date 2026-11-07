// Penyimpan data modul Asesor: ringkasan dimuat sekali, detail per pengajuan
// disimpan sehingga pindah tab tidak memuat ulang.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as api from './api'

const Ctx = createContext(null)
export const useAsesor = () => useContext(Ctx)

export function AsesorDataProvider({ children }) {
  const { user, role } = useAuth()
  const [data, setData] = useState(null)
  const [detail, setDetail] = useState({})
  const [galat, setGalat] = useState(null)
  const [sinkron, setSinkron] = useState(false)
  const jalan = useRef(0)

  const muat = useCallback(async () => {
    if (!user?.id) return
    const id = ++jalan.current
    setSinkron(true)
    try {
      const hasil = await api.muatRingkas(user.id, role)
      if (id === jalan.current) { setData(hasil); setGalat(null) }
    } catch (e) {
      if (id === jalan.current) setGalat(e.message)
    } finally {
      if (id === jalan.current) setSinkron(false)
    }
  }, [user?.id, role])
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

  const ubahDetail = useCallback((id, fn) => setDetail((d) => ({ ...d, [id]: { ...(d[id] || {}), ...fn(d[id] || {}) } })), [])
  const ubah = useCallback((fn) => setData((d) => (d ? { ...d, ...fn(d) } : d)), [])
  const gantiPengajuan = useCallback((baru) => setData((d) => (d ? { ...d, pengajuan: d.pengajuan.map((p) => (p.id === baru.id ? baru : p)) } : d)), [])

  // Simpan satu baris penilaian ke detail dan ringkasan sekaligus.
  const pasangPenilaian = useCallback((pengajuanId, baris) => {
    setDetail((d) => {
      const x = d[pengajuanId]
      if (!x) return d
      return { ...d, [pengajuanId]: { ...x, penilaian: [...(x.penilaian || []).filter((r) => r.mk_id !== baris.mk_id), baris] } }
    })
    setData((d) => (d ? { ...d, penilaian: [...d.penilaian.filter((r) => !(r.pengajuan_id === pengajuanId && r.mk_id === baris.mk_id)), baris] } : d))
  }, [])

  const nilai = useMemo(() => {
    const orang = Object.fromEntries((data?.pemohon || []).map((u) => [u.id, u]))
    const prodi = Object.fromEntries((data?.prodi || []).map((p) => [p.id, p]))
    const tugasSaya = (pengajuanId) => (data?.penugasan || []).find((x) => x.pengajuan_id === pengajuanId && x.asesor_id === user?.id) || null
    return {
      data, detail, galat, sinkron, muat, muatDetail, ubah, ubahDetail, gantiPengajuan, pasangPenilaian,
      role, userId: user?.id, siap: !!data, peta: { orang, prodi }, tugasSaya,
    }
  }, [data, detail, galat, sinkron, muat, muatDetail, ubah, ubahDetail, gantiPengajuan, pasangPenilaian, role, user?.id])

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}
