import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PanelLeftOpen, PanelLeftClose, Sun, Moon,
  ChevronDown, LogOut, User, KeyRound, ShieldAlert, Bell
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useSidebar } from './AppLayout'
import { dbNotifikasi } from '../../lib/db'
import toast from 'react-hot-toast'

export default function Header() {
  const { profile, signOut, isMock, role, switchMockRole } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { open, toggle } = useSidebar()
  const navigate = useNavigate()

  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef(null)

  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const fetchNotifications = async () => {
    if (!profile?.id) return
    try {
      const { data, error } = await dbNotifikasi.getByUserId(profile.id)
      if (!error && data) {
        setNotifications(data)
      }
    } catch (e) {
      console.error('Error fetching notifications:', e)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 15000)
    return () => clearInterval(interval)
  }, [profile?.id])

  const handleMarkAllRead = async () => {
    if (!profile?.id) return
    try {
      const { error } = await dbNotifikasi.markAllAsRead(profile.id)
      if (error) throw error
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
      toast.success('Semua notifikasi ditandai dibaca')
    } catch (e) {
      console.error(e)
      toast.error('Gagal menandai notifikasi')
    }
  }

  const handleNotifClick = async (notif) => {
    setNotifOpen(false)
    if (!notif.is_read) {
      try {
        await dbNotifikasi.markAsRead(notif.id)
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      } catch (e) {
        console.error(e)
      }
    }
    if (notif.link) {
      navigate(notif.link)
    }
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)

    if (seconds < 60) return 'Baru saja'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m yang lalu`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}j yang lalu`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Kemarin'
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  }

  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
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
      if (newRole === 'admin') label = 'Admin SIRPL'

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

        {/* Notification Bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button 
            className="btn btn-ghost btn-icon" 
            onClick={() => setNotifOpen(v => !v)}
            title="Notifikasi"
            style={{ position: 'relative' }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: 'var(--danger, #ef4444)',
                color: 'white',
                fontSize: '8px',
                fontWeight: 'bold',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid var(--surface)'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="dropdown-menu notif-dropdown" style={{ 
              width: 320, 
              maxHeight: 380, 
              overflowY: 'auto', 
              right: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ 
                padding: '12px 14px', 
                borderBottom: '1px solid var(--gray-100)', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: 'var(--surface)',
                zIndex: 10
              }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-900)' }}>
                  Notifikasi
                </span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--indigo-600, #4f46e5)', 
                      fontSize: 11, 
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    Tandai semua dibaca
                  </button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>
                    Tidak ada notifikasi baru
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      style={{ 
                        padding: '12px 14px', 
                        borderBottom: '1px solid var(--gray-50)', 
                        background: notif.is_read ? 'transparent' : 'var(--indigo-50-glow, rgba(79, 70, 229, 0.03))',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        fontSize: 12.5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                      className="notif-item"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontWeight: notif.is_read ? 500 : 700, color: 'var(--gray-800)' }}>
                          {notif.title}
                        </span>
                        {!notif.is_read && (
                          <span style={{ 
                            width: 6, 
                            height: 6, 
                            borderRadius: '50%', 
                            background: 'var(--indigo-600, #4f46e5)',
                            flexShrink: 0,
                            marginTop: 5
                          }} />
                        )}
                      </div>
                      <p style={{ color: 'var(--gray-500)', margin: 0, lineHeight: 1.4, fontSize: 11.5 }}>
                        {notif.message}
                      </p>
                      <span style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2 }}>
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
 
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
                    <option value="admin">Admin SIRPL</option>
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
