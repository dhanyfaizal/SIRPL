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
      if (newRole === 'calon_rpl') label = 'Pendaftar RPL (Calon)'
      if (newRole === 'pmb') label = 'PMB Officer'
      if (newRole === 'baak') label = 'BAAK Officer'
      if (newRole === 'kaprodi_ti') label = 'Ka. Prodi TI'
      if (newRole === 'kaprodi_si') label = 'Ka. Prodi SI'
      if (newRole === 'kaprodi_dkv') label = 'Ka. Prodi DKV'
      if (newRole === 'kaprodi_ka') label = 'Ka. Prodi KA'
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

              {isMock && (
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray-500)', display: 'block', marginBottom: 6 }}>SIMULASI PERAN:</label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleSwitch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--gray-200)',
                      fontSize: 12,
                      background: 'var(--surface)',
                      color: 'var(--gray-700)',
                      outline: 'none',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    <option value="calon_rpl">Calon RPL</option>
                    <option value="pmb">PMB Officer</option>
                    <option value="baak">BAAK Officer</option>
                    <option value="kaprodi_ti">Ka. Prodi TI</option>
                    <option value="kaprodi_si">Ka. Prodi SI</option>
                    <option value="kaprodi_dkv">Ka. Prodi DKV</option>
                    <option value="kaprodi_ka">Ka. Prodi KA</option>
                    <option value="asessor">Asessor RPL</option>
                    <option value="admin">Admin Akademik</option>
                  </select>
                </div>
              )}
 
              <button className="dropdown-item" onClick={() => { navigate('/profile'); setDropOpen(false) }}>
                <User size={14} /> Profil Saya
              </button>
              {role === 'admin' && (
                <button className="dropdown-item" onClick={() => { navigate('/settings/ai'); setDropOpen(false) }}>
                  <KeyRound size={14} /> Pengaturan AI Key
                </button>
              )}
 
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
