import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BadgePercent, CalendarRange, ChevronDown, House, LayoutDashboard, LogOut, MessageCircle, MessageSquare, Moon, ReceiptText, RefreshCw, Sun, UserRound, Wallet,
} from 'lucide-react'
import { AppShell } from '../shell/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { KeuanganDataProvider, useKeuangan } from './KeuanganData'
import { jumlahWaMenunggu } from '../notifikasi/jenis'
import '../pemohon/pemohon.css'
import '../tim/tim.css'
import './keuangan.css'

const BRAND = { name: 'SIRPL', sub: 'PMB dan Keuangan', logo: '/logo-sys.png' }

function useNav() {
  const { data } = useKeuangan()
  const { role } = useAuth()
  const { pathname } = useLocation()
  // Badge pesan WhatsApp yang menunggu dikirim manual; dihitung ulang saat pindah halaman.
  const [wa, setWa] = useState(null)
  useEffect(() => {
    let batal = false
    jumlahWaMenunggu().then((n) => { if (!batal) setWa(n || null) })
    return () => { batal = true }
  }, [pathname])
  return useMemo(() => {
    const menunggu = (data?.pembayaran || []).filter((b) => b.status === 'menunggu').length || null
    const nav = [
      { section: 'Beranda' },
      { id: 'beranda', label: 'Beranda', icon: House, to: '/keuangan' },
      { section: 'Pembayaran' },
      { id: 'verifikasi', label: 'Verifikasi pembayaran', icon: ReceiptText, to: '/keuangan/verifikasi', badge: menunggu },
      { id: 'tagihan', label: 'Tagihan pemohon', icon: Wallet, to: '/keuangan/tagihan' },
      { id: 'wa', label: 'WA keluar', icon: MessageCircle, to: '/keuangan/wa', badge: wa },
      { section: 'Pengaturan' },
      { id: 'diskon', label: 'Diskon', icon: BadgePercent, to: '/keuangan/diskon' },
      { id: 'skema', label: 'Skema bayar', icon: CalendarRange, to: '/keuangan/skema' },
      { section: 'Lainnya' },
      { id: 'umpan', label: 'Umpan balik layanan', icon: MessageSquare, to: '/feedback' },
      { section: 'Akun' },
      { id: 'profil', label: 'Profil', icon: UserRound, to: '/keuangan/profil' },
    ]
    if (role === 'admin') nav.push({ id: 'admin', label: 'Konsol Admin', icon: LayoutDashboard, to: '/admin' })
    return nav
  }, [data, role, wa])
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
          <button type="button" role="menuitem" onClick={() => { setBuka(false); navigate('/keuangan/profil') }}>
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
  const { muat, sinkron } = useKeuangan()
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
  const { data } = useKeuangan()
  const { profile } = useAuth()
  const aktif = data?.periode?.find((p) => p.is_aktif)
  return (
    <AppShell
      storageKey="sirpl-keuangan"
      nav={nav}
      brand={BRAND}
      sidebarTop={
        <div className="pm-peran">
          <span className="badge-pill badge-indigo">PMB</span>
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

export default function KeuanganLayout() {
  return (
    <KeuanganDataProvider>
      <Shell />
    </KeuanganDataProvider>
  )
}
