import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  BadgeCheck, Bell, CalendarDays, ChevronDown, ClipboardList, Contact, CreditCard, FileCheck,
  Files, FolderOpen, House, Lock, LogOut, Moon, RefreshCw, Sun, UserRound,
} from 'lucide-react'
import { AppShell } from '../shell/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { PemohonDataProvider, usePemohon } from './PemohonData'
import { BISA_DIUBAH } from './konstanta'
import { hitungKelengkapan } from './kelengkapan'
import './pemohon.css'

const BRAND = { name: 'SIRPL', sub: 'STIKOM Yos Sudarso', logo: '/logo-sys.png' }

function useNav() {
  const { data, pengajuan } = usePemohon()
  return useMemo(() => {
    const ikon = { data: ClipboardList, f07: Contact, bukti: Files, f03: FileCheck, kirim: BadgeCheck }
    const k = data ? hitungKelengkapan(data) : null
    const anak = k && pengajuan ? k.langkah.map((l) => ({
      to: l.to,
      label: `${l.no} · ${l.label}`,
      icon: l.terbuka ? ikon[l.id] : Lock,
      badge: l.terbuka && l.info ? l.info : null,
    })) : [
      { to: '/pemohon/pengajuan/data', label: '1 · Data dan persyaratan', icon: ClipboardList },
    ]
    return [
      { section: 'Beranda' },
      { id: 'beranda', label: 'Beranda', icon: House, to: '/pemohon' },
      { section: 'Pengajuan' },
      { id: 'pengajuan', label: 'Pengajuan RPL', icon: FolderOpen, children: [{ section: 'Langkah pengajuan' }, ...anak] },
      { id: 'pembayaran', label: 'Pembayaran', icon: CreditCard, to: '/pemohon/pembayaran' },
      { id: 'jadwal', label: 'Jadwal asesmen', icon: CalendarDays, to: '/pemohon/jadwal',
        badge: (data?.jadwal || []).filter((j) => j.status === 'dijadwalkan').length || null },
      { id: 'hasil', label: 'Hasil rekognisi', icon: BadgeCheck, to: '/pemohon/hasil',
        badge: pengajuan?.status === 'hasil_disampaikan' ? '1' : null },
      { section: 'Akun' },
      { id: 'profil', label: 'Profil', icon: UserRound, to: '/pemohon/profil' },
    ]
  }, [data, pengajuan])
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
  const nama = profile?.nama_lengkap || profile?.email || 'Pemohon'
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
          <button type="button" role="menuitem" onClick={() => { setBuka(false); navigate('/pemohon/profil') }}>
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
  const { muat, sinkron } = usePemohon()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { pengajuan } = usePemohon()
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
      <button type="button" className="shell-icon-btn" aria-label="Riwayat aktivitas" title="Riwayat aktivitas"
        onClick={() => navigate('/pemohon#aktivitas')}>
        <Bell size={17} />
        {pengajuan && !BISA_DIUBAH.includes(pengajuan.status) && pengajuan.status === 'hasil_disampaikan'
          ? <span className="pm-titik" aria-hidden="true" /> : null}
      </button>
      <MenuAkun />
    </>
  )
}

function KakiSidebar() {
  const { profile } = useAuth()
  const { pengajuan } = usePemohon()
  return (
    <div className="pm-kaki">
      <div className="pm-kaki-nama">{profile?.nama_lengkap || profile?.email}</div>
      <div className="pm-kaki-sub">{pengajuan?.nomor_pendaftaran || 'Belum ada pengajuan'}</div>
    </div>
  )
}

function Shell() {
  const nav = useNav()
  const { data } = usePemohon()
  return (
    <AppShell
      storageKey="sirpl-pemohon"
      nav={nav}
      brand={BRAND}
      sidebarTop={
        <div className="pm-peran">
          <span className="badge-pill badge-indigo">Pemohon RPL</span>
          {data?.periode ? <span className="badge-pill badge-slate">Periode {data.periode.nama}</span> : null}
        </div>
      }
      sidebarFooter={<KakiSidebar />}
      headerRight={<AksiHeader />}
    >
      <div className="pm-isi">
        <Outlet />
      </div>
    </AppShell>
  )
}

export default function PemohonLayout() {
  return (
    <PemohonDataProvider>
      <Shell />
    </PemohonDataProvider>
  )
}
