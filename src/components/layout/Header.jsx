import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PanelLeftOpen, PanelLeftClose, Sun, Moon,
  ChevronDown, LogOut, User, KeyRound, ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useSidebar } from './AppLayout'
import toast from 'react-hot-toast'

export default function Header() {
  const { profile, signOut, isMock, role, switchMockRole } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { open, toggle } = useSidebar()
  const navigate = useNavigate()

  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = profile?.nama_lengkap
    ? profile.nama_lengkap.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const handleRoleSwitch = async (newRole) => {
    try {
      let label = ''
      if (newRole === 'calon_mhs') label = 'Pendaftar (Calon Mhs)'
      if (newRole === 'baak') label = 'BAAK Officer'
      if (newRole === 'kaprodi') label = 'Ka. Prodi'
      if (newRole === 'asessor') label = 'Asessor RPL'
      if (newRole === 'admin') label = 'Admin Akademik'

      await switchMockRole(newRole)
      toast.success(`Role simulasi beralih ke: ${label}`)
      navigate('/dashboard')
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengalihkan role simulasi')
    }
  }

  return (
    <header className="app-header">
      {/* Sidebar toggle */}
      <button onClick={toggle} className="btn btn-ghost btn-icon" title={open ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}>
        {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <span className="header-sep" />

      {/* Brand */}
      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-900)', letterSpacing: '-.3px' }}>
        SI-RPL
      </span>

      {/* Mock Role Switcher (Hanya aktif dalam Mode Mock) */}
      {isMock && (
        <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge-pill badge-indigo" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldAlert size={12} /> Mode Simulasi
          </span>
          <select 
            value={role || ''} 
            onChange={(e) => handleRoleSwitch(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid var(--gray-200)',
              background: 'var(--surface)',
              color: 'var(--gray-700)',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="calon_mhs">Pendaftar (Calon Mhs)</option>
            <option value="baak">BAAK (Validasi)</option>
            <option value="kaprodi">Ka. Prodi (AI/OCR)</option>
            <option value="asessor">Asessor (Kalkulasi)</option>
            <option value="admin">Admin (Pemetaan & Cetak)</option>
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="header-actions">
        {/* Theme toggle */}
        <button className="btn btn-ghost btn-icon" onClick={toggleTheme} title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}>
          {theme === 'dark' ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} />}
        </button>

        {/* User dropdown */}
        <div ref={dropRef} style={{ position: 'relative' }}>
          <button className="avatar-btn" onClick={() => setDropOpen(v => !v)}>
            <div className="avatar">
              {profile?.foto_url ? (
                <img src={profile.foto_url} alt={profile.nama_lengkap} />
              ) : (
                initials
              )}
            </div>
            <span className="avatar-name" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.nama_lengkap || 'Pengguna'}
            </span>
            <ChevronDown size={12} color="var(--gray-400)" />
          </button>

          {dropOpen && (
            <div className="dropdown-menu">
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-900)' }}>
                  {profile?.nama_lengkap || 'Pengguna'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                  {role?.toUpperCase()}
                </div>
              </div>

              <button className="dropdown-item" onClick={() => { navigate('/profile'); setDropOpen(false) }}>
                <User size={14} /> Profil Saya
              </button>
              <button className="dropdown-item" onClick={() => { navigate('/settings/ai'); setDropOpen(false) }}>
                <KeyRound size={14} /> Pengaturan AI Key
              </button>

              <div className="dropdown-sep" />

              <button className="dropdown-item danger" onClick={signOut}>
                <LogOut size={14} /> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
