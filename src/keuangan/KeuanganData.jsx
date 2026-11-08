// Data modul PMB / Keuangan: dimuat sekali, diperbarui di latar belakang.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)
export const useKeuangan = () => useContext(Ctx)

export function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}

async function muatSemua() {
  const [pengajuan, tagihan, pembayaran, diskon, skema, prodi, periode] = await Promise.all([
    supabase.from('pengajuan_rpl').select('id, user_id, prodi_pilihan_id, periode_id, status, jenis_rpl, nomor_pendaftaran, nim, submitted_at, created_at, alur_versi')
      .neq('status', 'draft').order('submitted_at', { ascending: false }).then(cek),
    supabase.from('tagihan_rpl').select('*').order('created_at').then(cek),
    supabase.from('pembayaran_rpl').select('*').order('created_at', { ascending: false }).then(cek),
    supabase.from('skema_diskon').select('*').order('created_at', { ascending: false }).then(cek),
    supabase.from('skema_bayar').select('*').order('created_at', { ascending: false }).then(cek),
    supabase.from('program_studi').select('id, nama, kode').order('nama').then(cek),
    supabase.from('periode_rpl').select('id, nama, is_aktif').order('created_at', { ascending: false }).then(cek),
  ])
  const ids = [...new Set([...(pengajuan || []).map((p) => p.user_id), ...(pembayaran || []).map((b) => b.diverifikasi_oleh).filter(Boolean)])]
  const orang = []
  for (let i = 0; i < ids.length; i += 200) {
    orang.push(...(cek(await supabase.from('profiles').select('id, nama_lengkap, email, no_whatsapp').in('id', ids.slice(i, i + 200))) || []))
  }
  return {
    pengajuan: (pengajuan || []).filter((p) => p.alur_versi !== 1), tagihan: tagihan || [], pembayaran: pembayaran || [],
    diskon: diskon || [], skema: skema || [], prodi: prodi || [], periode: periode || [], orang,
  }
}

export function KeuanganDataProvider({ children }) {
  const { user, role } = useAuth()
  const [data, setData] = useState(null)
  const [galat, setGalat] = useState(null)
  const [sinkron, setSinkron] = useState(false)
  const jalan = useRef(0)

  const muat = useCallback(async () => {
    if (!user?.id) return
    const id = ++jalan.current
    setSinkron(true)
    try {
      const hasil = await muatSemua()
      if (id === jalan.current) { setData(hasil); setGalat(null) }
    } catch (e) {
      if (id === jalan.current) setGalat(e.message)
    } finally {
      if (id === jalan.current) setSinkron(false)
    }
  }, [user?.id])
  useEffect(() => { muat() }, [muat])

  const ubah = useCallback((fn) => setData((d) => (d ? { ...d, ...fn(d) } : d)), [])

  const nilai = useMemo(() => {
    const tagihanPer = {}
    for (const t of data?.tagihan || []) (tagihanPer[t.pengajuan_id] ||= []).push(t)
    const bayarPer = {}
    for (const b of data?.pembayaran || []) (bayarPer[b.pengajuan_id] ||= []).push(b)
    return {
      data, galat, sinkron, muat, ubah, role, siap: !!data,
      peta: {
        orang: Object.fromEntries((data?.orang || []).map((u) => [u.id, u])),
        prodi: Object.fromEntries((data?.prodi || []).map((p) => [p.id, p])),
        periode: Object.fromEntries((data?.periode || []).map((p) => [p.id, p])),
        pengajuan: Object.fromEntries((data?.pengajuan || []).map((p) => [p.id, p])),
        tagihan: Object.fromEntries((data?.tagihan || []).map((t) => [t.id, t])),
        diskon: Object.fromEntries((data?.diskon || []).map((d) => [d.id, d])),
        tagihanPer, bayarPer,
      },
    }
  }, [data, galat, sinkron, muat, ubah, role])

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}
