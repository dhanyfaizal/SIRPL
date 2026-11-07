// Penyimpan data modul Pemohon.
// Data dimuat sekali saat modul dibuka; pindah halaman tidak memuat ulang.
// Tombol "Muat ulang" di header menyegarkan data di latar belakang tanpa
// mengosongkan tampilan.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as api from './api'
import { BISA_DIUBAH } from './konstanta'

const Ctx = createContext(null)
export const usePemohon = () => useContext(Ctx)

export function PemohonDataProvider({ children }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [galat, setGalat] = useState(null)
  const [sinkron, setSinkron] = useState(false)
  const jalan = useRef(0)

  const muat = useCallback(async () => {
    if (!user?.id) return
    const id = ++jalan.current
    setSinkron(true)
    try {
      const hasil = await api.muatSemua(user.id)
      if (id === jalan.current) { setData(hasil); setGalat(null) }
    } catch (e) {
      if (id === jalan.current) setGalat(e.message)
    } finally {
      if (id === jalan.current) setSinkron(false)
    }
  }, [user?.id])

  useEffect(() => { muat() }, [muat])

  // Muat ulang hanya detail pengajuan (lebih ringan) setelah perubahan.
  const muatDetail = useCallback(async (pengajuanBaru) => {
    const p = pengajuanBaru || data?.pengajuan
    if (!p) return
    setSinkron(true)
    try {
      const detail = await api.muatDetail(p)
      setData((d) => ({ ...d, pengajuan: p, ...detail }))
    } catch (e) {
      setGalat(e.message)
    } finally {
      setSinkron(false)
    }
  }, [data?.pengajuan])

  const ubah = useCallback((fn) => setData((d) => (d ? { ...d, ...fn(d) } : d)), [])

  const nilai = useMemo(() => {
    const p = data?.pengajuan
    return {
      data, galat, sinkron, muat, muatDetail, ubah,
      userId: user?.id,
      pengajuan: p,
      bisaDiubah: !!p && BISA_DIUBAH.includes(p.status) && p.alur_versi !== 1,
      siap: !!data,
    }
  }, [data, galat, sinkron, muat, muatDetail, ubah, user?.id])

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}
