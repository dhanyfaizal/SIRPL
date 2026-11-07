// Data modul Komite dan Pimpinan: dimuat sekali, diperbarui di latar belakang.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { STATUS_PASCA } from './aturan'

const Ctx = createContext(null)
export const usePimpinan = () => useContext(Ctx)

function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}

async function muatSemua() {
  const [pengajuan, prodi, periode, sk] = await Promise.all([
    supabase.from('pengajuan_rpl').select('*').in('status', STATUS_PASCA).order('submitted_at', { ascending: true }).then(cek),
    supabase.from('program_studi').select('*').order('nama').then(cek),
    supabase.from('periode_rpl').select('*').order('created_at', { ascending: false }).then(cek),
    supabase.from('sk_rekognisi').select('*').order('tanggal_sk', { ascending: false }).then(cek),
  ])
  const ids = (pengajuan || []).map((p) => p.id)
  const prodiIds = [...new Set((pengajuan || []).map((p) => p.prodi_pilihan_id).filter(Boolean))]
  const kosong = Promise.resolve([])
  const [mkDiajukan, penilaian, komite, penetapan, klarifikasi, mataKuliah, pemohon] = await Promise.all([
    ids.length ? supabase.from('mk_diajukan').select('pengajuan_id, mk_id, mekanisme').in('pengajuan_id', ids).then(cek) : kosong,
    ids.length ? supabase.from('penilaian_mk').select('pengajuan_id, mk_id, mekanisme, keputusan, nilai_huruf, catatan').in('pengajuan_id', ids).then(cek) : kosong,
    ids.length ? supabase.from('persetujuan_komite').select('*').in('pengajuan_id', ids).order('created_at', { ascending: false }).then(cek) : kosong,
    ids.length ? supabase.from('penetapan_akhir').select('*').in('pengajuan_id', ids).then(cek) : kosong,
    ids.length ? supabase.from('klarifikasi_rpl').select('id, pengajuan_id, status, keputusan, created_at').in('pengajuan_id', ids).then(cek) : kosong,
    prodiIds.length ? supabase.from('mata_kuliah_kurikulum').select('id, prodi_id, kode_mk, nama_mk, sks, semester').in('prodi_id', prodiIds).then(cek) : kosong,
    ids.length ? supabase.from('profiles').select('id, nama_lengkap, email, no_whatsapp').in('id', [...new Set(pengajuan.map((p) => p.user_id))]).then(cek) : kosong,
  ])
  return {
    pengajuan: pengajuan || [], prodi: prodi || [], periode: periode || [], sk: sk || [],
    mkDiajukan: mkDiajukan || [], penilaian: penilaian || [], komite: komite || [], penetapan: penetapan || [],
    klarifikasi: klarifikasi || [], mataKuliah: mataKuliah || [], pemohon: pemohon || [],
  }
}

export function PimpinanDataProvider({ children }) {
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

  const nilai = useMemo(() => ({
    data, galat, sinkron, muat, role, userId: user?.id, siap: !!data,
    peta: {
      orang: Object.fromEntries((data?.pemohon || []).map((u) => [u.id, u])),
      prodi: Object.fromEntries((data?.prodi || []).map((p) => [p.id, p])),
      sk: Object.fromEntries((data?.sk || []).map((s) => [s.id, s])),
    },
  }), [data, galat, sinkron, muat, role, user?.id])

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}
