import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileText, PlusCircle, BookOpen,
  LogOut, Shield, Award, Settings, GraduationCap, ClipboardCheck
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSidebar } from './AppLayout'

const ROLE_META = {
  admin: { label: 'Admin Akademik', color: 'badge-red' },
  asessor: { label: 'Asessor RPL', color: 'badge-indigo' },
  kaprodi: { label: 'Ka. Prodi', color: 'badge-indigo' },
  baak: { label: 'BAAK Officer', color: 'badge-slate' },
  calon_mhs: { label: 'Pendaftar RPL', color: 'badge-amber' },
}

function NavItem({ label, icon: Icon, to }) {
  return (
    <NavLink to={to} end={to === '/dashboard'}
      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
      <Icon size={16} className="sidebar-icon" />
      {label}
    </NavLink>
  )
}

export default function Sidebar() {
  const { role, profile, signOut } = useAuth()
  const { open } = useSidebar()

  const roleMeta = ROLE_META[role]

  return (
    <aside className="app-sidebar"
      style={{
        width: open ? 'var(--sidebar-w)' : 0,
        overflow: open ? 'visible' : 'hidden',
        transition: 'width .22s ease',
        minWidth: open ? 'var(--sidebar-w)' : 0
      }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justify: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>
          SR
        </div>
        <div>
          <div className="sidebar-logo-brand">SI-RPL</div>
          <div className="sidebar-logo-sub">STIKOM Yos Sudarso</div>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '10px 16px 4px', minHeight: 34 }}>
        {roleMeta ? (
          <span className={`badge-pill ${roleMeta.color}`}>{roleMeta.label}</span>
        ) : (
          <div style={{ height: 20, width: 80, borderRadius: 99 }} className="skeleton" />
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, paddingBottom: 8, overflowY: 'auto' }}>
        <div className="sidebar-section-label">Beranda</div>
        <NavItem label="Dashboard" icon={LayoutDashboard} to="/dashboard" />

        {/* Menu Pendaftar */}
        {role === 'calon_mhs' && (
          <>
            <div className="sidebar-section-label">Layanan RPL</div>
            <NavItem label="Ajukan RPL Baru" icon={PlusCircle} to="/pengajuan/baru" />
          </>
        )}

        {/* Menu BAAK */}
        {role === 'baak' && (
          <>
            <div className="sidebar-section-label">Validasi</div>
            <NavItem label="Berkas Masuk" icon={ClipboardCheck} to="/dashboard" />
          </>
        )}

        {/* Menu Kaprodi */}
        {role === 'kaprodi' && (
          <>
            <div className="sidebar-section-label">Ekstraksi & Rekognisi</div>
            <NavItem label="Evaluasi Transkrip" icon={Award} to="/dashboard" />
          </>
        )}

        {/* Menu Asessor */}
        {role === 'asessor' && (
          <>
            <div className="sidebar-section-label">Asesmen Akademik</div>
            <NavItem label="Penilaian RPL" icon={GraduationCap} to="/dashboard" />
          </>
        )}

        {/* Menu Admin */}
        {role === 'admin' && (
          <>
            <div className="sidebar-section-label">Studi & Keuangan</div>
            <NavItem label="Rencana Studi & Biaya" icon={BookOpen} to="/dashboard" />
          </>
        )}

        {/* Menu Umum */}
        {role && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section-label">Profil</div>
            <NavItem label="Profil Saya" icon={GraduationCap} to="/profile" />
            <NavItem label="Pengaturan AI Key" icon={Settings} to="/settings/ai" />
          </>
        )}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: '1px solid var(--gray-100)', padding: '10px 8px' }}>
        {profile && (
          <div style={{ padding: '4px 8px 8px', fontSize: 12, color: 'var(--gray-400)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile.nama_lengkap}
          </div>
        )}
        <button onClick={signOut}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff1f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background .12s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}>
          <LogOut size={15} />
          Keluar
        </button>
      </div>
    </aside>
  )
}
