import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarDays, ChevronDown, ClipboardCheck, FolderOpen, History, House, LayoutDashboard, ListChecks, LogOut, Moon, RefreshCw, Sun, UserRound,
} from 'lucide-react'
import { AppShell } from '../shell/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { AsesorDataProvider, useAsesor } from './AsesorData'
import { KELOMPOK } from './aturan'
import '../pemohon/pemohon.css'
import '../tim/tim.css'
import './asesor.css'

const BRAND = { name: 'SIRPL', sub: 'Tim Penilai RPL', logo: '/logo-sys.png' }
const LABEL_PERAN = { admin: 'Admin', ketua_tim: 'Ketua Tim Pengelola', asessor: 'Asesor', kaprodi_si: 'Ka. Prodi SI', kaprodi_ti: 'Ka. Prodi TI', kaprodi_dkv: 'Ka. Prodi DKV', kaprodi_ka: 'Ka. Prodi KA' }

function useNav() {
  const { data, role, userId } = useAsesor()
  return useMemo(() => {
    const saya = new Set(data?.idTugas || [])
    const hit = (status) => (data?.pengajuan || []).filter((p) => saya.has(p.id) && status.includes(p.status)).length || null
    const besok7 = Date.now() + 7 * 86400000
    const jadwalDekat = (data?.jadwal || []).filter((j) => saya.has(j.pengajuan_id) && j.status === 'dijadwalkan' && new Date(j.waktu).getTime() < besok7).length || null
    const nav = [
      { section: 'Beranda' },
      { id: 'beranda', label: 'Beranda', icon: House, to: '/asesor' },
      { section: 'Penilaian' },
      { id: 'tugas', label: 'Tugas penilaian', icon: ClipboardCheck, children: [
        { section: 'Kelompok status' },
        ...KELOMPOK.map((k) => ({ to: `/asesor/tugas/${k.id}`, label: k.label, icon: ListChecks, badge: k.id === 'dinilai' || k.id === 'lanjutan' ? hit(k.status) : null })),
        { to: '/asesor/tugas/semua', label: 'Semua', icon: FolderOpen },
      ] },
      { id: 'jadwal', label: 'Jadwal saya', icon: CalendarDays, to: '/asesor/jadwal', badge: jadwalDekat },
      { section: 'Akun' },
      { id: 'profil', label: 'Profil', icon: UserRound, to: '/asesor/profil' },
      { id: 'lama', label: 'Dasbor alur lama', icon: History, to: '/dashboard?lama=1' },
    ]
    if (role === 'admin') nav.push({ id: 'admin', label: 'Dasbor admin', icon: LayoutDashboard, to: '/dashboard' })
    return nav
  }, [data, role, userId])
}

function MenuAkun() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [buka, setBuka] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!buka) return undefined
    const tutup = (e) => { if (!ref.current?.contains(e.target)) setBuka(false) }
    const esc = (e) => { if (e.key === 'Escape') setBuka(false) }
    document.addEventListener('mousedown', tutup)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', tutup); document.removeEventListener('keydown', esc) }
  }, [buka])
  const nama = profile?.nama_lengkap || profile?.email || 'Asesor'
  const inisial = nama.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="pm-akun" ref={ref}>
      <button type="button" className="pm-avatar-btn" aria-haspopup="menu" aria-expanded={buka} onClick={() => setBuka((v) => !v)}>
        <span className="pm-avatar">{inisial}</span>
        <span className="pm-avatar-nama">{nama}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {buka ? (
        <div className="pm-menu" role="menu">
          <div className="pm-menu-kepala">
            <div className="pm-menu-nama">{nama}</div>
            <div className="pm-menu-sub">{profile?.email}</div>
          </div>
          <button type="button" role="menuitem" onClick={() => { setBuka(false); navigate('/asesor/profil') }}>
            <UserRound size={14} aria-hidden="true" /> Profil
          </button>
          <button type="button" role="menuitem" onClick={() => signOut()}>
            <LogOut size={14} aria-hidden="true" /> Keluar
          </button>
        </div>
      ) : null}
    </div>
  )
}

function AksiHeader() {
  const { muat, sinkron } = useAsesor()
  const { theme, toggleTheme } = useTheme()
  return (
    <>
      {sinkron ? <span className="pm-sinkron" aria-live="polite">Menyegarkan</span> : null}
      <button type="button" className="shell-icon-btn" onClick={muat} aria-label="Muat ulang data" title="Muat ulang data" disabled={sinkron}>
        <RefreshCw size={17} className={sinkron ? 'pm-putar' : ''} />
      </button>
      <button type="button" className="shell-icon-btn" onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Tema terang' : 'Tema gelap'} title={theme === 'dark' ? 'Tema terang' : 'Tema gelap'}>
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <MenuAkun />
    </>
  )
}

function Shell() {
  const nav = useNav()
  const { data, role } = useAsesor()
  const { profile } = useAuth()
  const aktif = data?.periode?.find((p) => p.is_aktif)
  return (
    <AppShell
      storageKey="sirpl-asesor"
      nav={nav}
      brand={BRAND}
      sidebarTop={
        <div className="pm-peran">
          <span className="badge-pill badge-indigo">{LABEL_PERAN[role] || 'Tim Penilai'}</span>
          {aktif ? <span className="badge-pill badge-slate">Periode {aktif.nama}</span> : null}
        </div>
      }
      sidebarFooter={<div className="pm-kaki"><div className="pm-kaki-nama">{profile?.nama_lengkap || profile?.email}</div><div className="pm-kaki-sub">STIKOM Yos Sudarso</div></div>}
      headerRight={<AksiHeader />}
    >
      <div className="pm-isi">
        <Outlet />
      </div>
    </AppShell>
  )
}

export default function AsesorLayout() {
  return (
    <AsesorDataProvider>
      <Shell />
    </AsesorDataProvider>
  )
}
