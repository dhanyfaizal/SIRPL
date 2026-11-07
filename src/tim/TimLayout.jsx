import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarDays, ChevronDown, CreditCard, FolderOpen, House, LayoutDashboard, ListChecks, LogOut, Moon, RefreshCw, Sun, UserRound,
} from 'lucide-react'
import { AppShell } from '../shell/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { TimDataProvider, useTim } from './TimData'
import { KELOMPOK } from './aturan'
import '../pemohon/pemohon.css'
import './tim.css'

const BRAND = { name: 'SIRPL', sub: 'Tim Pengelola RPL', logo: '/logo-sys.png' }
const LABEL_PERAN = { admin: 'Admin', ketua_tim: 'Ketua Tim Pengelola', sekretaris: 'Sekretaris / Sekretariat' }

function useNav() {
  const { data, role } = useTim()
  return useMemo(() => {
    const hit = (status) => (data?.pengajuan || []).filter((p) => status.includes(p.status)).length || null
    const besok7 = Date.now() + 7 * 86400000
    const jadwalDekat = (data?.jadwal || []).filter((j) => j.status === 'dijadwalkan' && new Date(j.waktu).getTime() < besok7).length || null
    const bayar = (data?.pembayaran || []).filter((b) => b.status === 'menunggu').length || null
    const nav = [
      { section: 'Beranda' },
      { id: 'beranda', label: 'Beranda', icon: House, to: '/tim' },
      { section: 'Layanan' },
      { id: 'pengajuan', label: 'Pengajuan', icon: FolderOpen, children: [
        { section: 'Kelompok status' },
        ...KELOMPOK.map((k) => ({ to: `/tim/antrean/${k.id}`, label: k.label, icon: ListChecks, badge: k.id === 'verifikasi' || k.id === 'siap' ? hit(k.status) : null })),
        { to: '/tim/antrean/semua', label: 'Semua pengajuan', icon: FolderOpen },
      ] },
      { id: 'jadwal', label: 'Jadwal asesmen', icon: CalendarDays, to: '/tim/jadwal', badge: jadwalDekat },
      { id: 'pembayaran', label: 'Pembayaran', icon: CreditCard, to: '/tim/pembayaran', badge: bayar },
      { section: 'Akun' },
      { id: 'profil', label: 'Profil', icon: UserRound, to: '/tim/profil' },
    ]
    if (role === 'admin') nav.push({ id: 'admin', label: 'Dasbor admin', icon: LayoutDashboard, to: '/dashboard' })
    return nav
  }, [data, role])
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
  const nama = profile?.nama_lengkap || profile?.email || 'Tim RPL'
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
          <button type="button" role="menuitem" onClick={() => { setBuka(false); navigate('/tim/profil') }}>
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
  const { muat, sinkron } = useTim()
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
  const { data, role } = useTim()
  const { profile } = useAuth()
  const aktif = data?.periode?.find((p) => p.is_aktif)
  return (
    <AppShell
      storageKey="sirpl-tim"
      nav={nav}
      brand={BRAND}
      sidebarTop={
        <div className="pm-peran">
          <span className="badge-pill badge-indigo">{LABEL_PERAN[role] || 'Tim RPL'}</span>
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

export default function TimLayout() {
  return (
    <TimDataProvider>
      <Shell />
    </TimDataProvider>
  )
}
