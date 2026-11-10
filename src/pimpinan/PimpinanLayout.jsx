import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChartColumn, ChevronDown, FileBadge, FolderTree, Gavel, PenLine, House, IdCard, LayoutDashboard, LogOut, Moon, RefreshCw, Sun, UserRound,
} from 'lucide-react'
import { AppShell } from '../shell/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { PimpinanDataProvider, usePimpinan } from './PimpinanData'
import { bolehLihat } from './aturan'
import { jumlahTtdMenunggu } from '../dokumen/api'
import '../pemohon/pemohon.css'
import '../tim/tim.css'
import './pimpinan.css'

const BRAND = { name: 'SIRPL', sub: 'Komite dan Pimpinan', logo: '/logo-sys.png' }
const LABEL_PERAN = { admin: 'Admin', komite: 'Komite RPL', eksekutif: 'Pimpinan', baak: 'BAAK', ketua_tim: 'Ketua Tim Pengelola', sekretaris: 'Sekretariat RPL' }

function useNav() {
  const { data, role } = usePimpinan()
  const { user } = useAuth()
  const { pathname } = useLocation()
  // Badge dokumen yang menunggu tanda tangan saya; dihitung ulang saat pindah halaman.
  const [ttd, setTtd] = useState(null)
  useEffect(() => {
    if (!user?.id) return undefined
    let batal = false
    jumlahTtdMenunggu(user.id).then((n) => { if (!batal) setTtd(n || null) }).catch(() => {})
    return () => { batal = true }
  }, [user?.id, pathname])
  return useMemo(() => {
    const hit = (st) => (data?.pengajuan || []).filter((p) => st.includes(p.status)).length || null
    const nav = [
      { section: 'Beranda' },
      { id: 'beranda', label: 'Beranda', icon: House, to: '/pimpinan' },
      { section: 'Penetapan' },
    ]
    if (bolehLihat(role, 'komite')) nav.push({ id: 'komite', label: 'Persetujuan Komite', icon: Gavel, to: '/pimpinan/komite', badge: hit(['menunggu_komite']) })
    if (bolehLihat(role, 'sk')) nav.push({ id: 'sk', label: 'SK Rekognisi', icon: FileBadge, to: '/pimpinan/sk', badge: hit(['menunggu_sk']) })
    if (bolehLihat(role, 'nim')) nav.push({ id: 'nim', label: 'Penetapan NIM', icon: IdCard, to: '/pimpinan/nim', badge: hit(['sk_terbit']) })
    nav.push({ section: 'Laporan' }, { id: 'laporan', label: 'Laporan dan analitik', icon: ChartColumn, to: '/pimpinan/laporan' })
    nav.push({ section: 'Dokumen' }, { id: 'ttd', label: 'Tanda tangan dokumen', icon: PenLine, to: '/pimpinan/tanda-tangan', badge: ttd })
    nav.push({ id: 'repo', label: 'Repositori pelaporan', icon: FolderTree, to: '/repositori' })
    nav.push({ section: 'Akun' }, { id: 'profil', label: 'Profil', icon: UserRound, to: '/pimpinan/profil' })
    const modul = { ketua_tim: ['Modul Tim Pengelola', '/tim'], sekretaris: ['Modul Tim Pengelola', '/tim'], baak: ['Modul BAAK', '/tim'], admin: ['Konsol Admin', '/admin'] }[role]
    if (modul) nav.push({ id: 'dasbor', label: modul[0], icon: LayoutDashboard, to: modul[1] })
    return nav
  }, [data, role, ttd])
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
  const nama = profile?.nama_lengkap || profile?.email || 'Pengguna'
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
          <button type="button" role="menuitem" onClick={() => { setBuka(false); navigate('/pimpinan/profil') }}>
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
  const { muat, sinkron } = usePimpinan()
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
  const { data, role } = usePimpinan()
  const { profile } = useAuth()
  const aktif = data?.periode?.find((p) => p.is_aktif)
  return (
    <AppShell
      storageKey="sirpl-pimpinan"
      nav={nav}
      brand={BRAND}
      sidebarTop={
        <div className="pm-peran">
          <span className="badge-pill badge-indigo">{LABEL_PERAN[role] || 'Pimpinan'}</span>
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

export default function PimpinanLayout() {
  return (
    <PimpinanDataProvider>
      <Shell />
    </PimpinanDataProvider>
  )
}
