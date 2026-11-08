import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  BookOpen, CalendarRange, ChevronDown, FileCog, FolderOpen, FolderTree, GraduationCap, History, House, LayoutDashboard, ListChecks,
  LogOut, MessageSquare, Moon, PenLine, RefreshCw, Send, Sun, UserRound, Users,
} from 'lucide-react'
import { AppShell } from '../shell/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { AdminDataProvider, useAdmin } from './AdminData'
import '../pemohon/pemohon.css'
import '../tim/tim.css'
import './admin.css'

const BRAND = { name: 'SIRPL', sub: 'Konsol Admin', logo: '/logo-sys.png' }

function useNav() {
  const { data } = useAdmin()
  return useMemo(() => {
    const belumVerif = (data?.pengguna || []).filter((u) => !u.is_verified && u.role !== 'calon_rpl').length || null
    const belumLapor = (data?.pengajuan || []).filter((p) => ['sk_terbit', 'selesai'].includes(p.status) && p.status_pelaporan !== 'diinput_pddikti').length || null
    return [
      { section: 'Beranda' },
      { id: 'beranda', label: 'Beranda', icon: House, to: '/admin' },
      { section: 'Layanan RPL' },
      { id: 'pengajuan', label: 'Semua pengajuan', icon: FolderOpen, to: '/admin/pengajuan' },
      { id: 'pelaporan', label: 'Pelaporan', icon: Send, to: '/admin/pelaporan', badge: belumLapor },
      { id: 'repo', label: 'Repositori pelaporan', icon: FolderTree, to: '/repositori' },
      { id: 'laporan', label: 'Laporan dan analitik', icon: History, to: '/pimpinan/laporan' },
      { section: 'Pengaturan' },
      { id: 'pengguna', label: 'Pengguna dan peran', icon: Users, to: '/admin/pengguna', badge: belumVerif },
      { id: 'periode', label: 'Periode dan tarif', icon: CalendarRange, to: '/admin/periode' },
      { id: 'prodi', label: 'Program studi', icon: GraduationCap, to: '/admin/prodi' },
      { id: 'kurikulum', label: 'Kurikulum', icon: BookOpen, children: [
        { to: '/curriculum', label: 'Data kurikulum', icon: BookOpen },
        { to: '/kurikulum-rpl', label: 'Mata kuliah RPL', icon: ListChecks },
      ] },
      { id: 'atur-dok', label: 'Pengaturan dokumen', icon: FileCog, to: '/pengaturan-dokumen' },
      { id: 'log', label: 'Log aktivitas', icon: History, to: '/admin/log' },
      { section: 'Modul lain' },
      { id: 'tim', label: 'Modul Tim Pengelola', icon: LayoutDashboard, to: '/tim' },
      { id: 'pimpinan', label: 'Komite, SK, dan NIM', icon: LayoutDashboard, to: '/pimpinan' },
      { id: 'keuangan', label: 'PMB dan keuangan', icon: LayoutDashboard, to: '/keuangan' },
      { id: 'ttd', label: 'Tanda tangan', icon: PenLine, to: '/tanda-tangan' },
      { id: 'umpan', label: 'Umpan balik layanan', icon: MessageSquare, to: '/feedback' },
      { section: 'Akun' },
      { id: 'profil', label: 'Profil', icon: UserRound, to: '/admin/profil' },
    ]
  }, [data])
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
  const nama = profile?.nama_lengkap || profile?.email || 'Admin'
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
          <button type="button" role="menuitem" onClick={() => { setBuka(false); navigate('/admin/profil') }}>
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
  const { muat, sinkron } = useAdmin()
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
  const { data } = useAdmin()
  const { profile } = useAuth()
  const aktif = data?.periode?.find((p) => p.is_aktif)
  return (
    <AppShell
      storageKey="sirpl-admin"
      nav={nav}
      brand={BRAND}
      sidebarTop={
        <div className="pm-peran">
          <span className="badge-pill badge-indigo">Admin</span>
          {aktif ? <span className="badge-pill badge-slate">Periode {aktif.nama}</span> : <span className="badge-pill badge-amber">Belum ada periode aktif</span>}
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

export default function AdminLayout() {
  return (
    <AdminDataProvider>
      <Shell />
    </AdminDataProvider>
  )
}
