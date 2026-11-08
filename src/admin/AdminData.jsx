// Data modul Admin: dimuat sekali, diperbarui di latar belakang.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)
export const useAdmin = () => useContext(Ctx)

export function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}

async function muatSemua() {
  const [pengajuan, pengguna, prodi, periode, tarif, sk, penetapan] = await Promise.all([
    supabase.from('pengajuan_rpl').select('id, user_id, prodi_pilihan_id, periode_id, status, jenis_rpl, nomor_pendaftaran, nim, submitted_at, created_at, updated_at, alur_versi, is_archived, sk_id, status_pelaporan, dilaporkan_sistem_rpl_at, diverifikasi_lldikti_at, dilaporkan_pddikti_at, pt_asal, prodi_asal')
      .order('created_at', { ascending: false }).then(cek),
    supabase.from('profiles').select('id, email, nama_lengkap, role, is_verified, prodi_id, no_whatsapp, created_at').order('created_at', { ascending: false }).then(cek),
    supabase.from('program_studi').select('*').order('nama').then(cek),
    supabase.from('periode_rpl').select('*').order('created_at', { ascending: false }).then(cek),
    supabase.from('tarif_biaya').select('*').then(cek),
    supabase.from('sk_rekognisi').select('id, nomor_sk, tanggal_sk, prodi_id, periode_id').order('tanggal_sk', { ascending: false }).then(cek),
    supabase.from('penetapan_akhir').select('pengajuan_id, total_sks_diakui, total_sks_sisa').then(cek),
  ])
  return { pengajuan: pengajuan || [], pengguna: pengguna || [], prodi: prodi || [], periode: periode || [], tarif: tarif || [], sk: sk || [], penetapan: penetapan || [] }
}

export function AdminDataProvider({ children }) {
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
      orang: Object.fromEntries((data?.pengguna || []).map((u) => [u.id, u])),
      prodi: Object.fromEntries((data?.prodi || []).map((p) => [p.id, p])),
      periode: Object.fromEntries((data?.periode || []).map((p) => [p.id, p])),
      sk: Object.fromEntries((data?.sk || []).map((s) => [s.id, s])),
      penetapan: Object.fromEntries((data?.penetapan || []).map((s) => [s.pengajuan_id, s])),
    },
  }), [data, galat, sinkron, muat, role, user?.id])

  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}
