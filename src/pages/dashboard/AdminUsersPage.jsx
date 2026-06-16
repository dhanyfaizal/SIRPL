import { useState, useEffect } from 'react'
import { dbProfiles } from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import { Shield, Search, Check, X, UserCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES_LIST = [
  { value: 'calon_rpl', label: 'Calon RPL' },
  { value: 'pmb', label: 'PMB Officer' },
  { value: 'baak', label: 'BAAK' },
  { value: 'kaprodi_si', label: 'Ka. Prodi SI' },
  { value: 'kaprodi_ti', label: 'Ka. Prodi TI' },
  { value: 'kaprodi_dkv', label: 'Ka. Prodi DKV' },
  { value: 'kaprodi_ka', label: 'Ka. Prodi KA' },
  { value: 'asessor', label: 'Asessor' },
  { value: 'admin', label: 'Admin' }
]

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data } = await dbProfiles.getAll()
      setUsers(data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data pengguna')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleRoleChange = async (userId, newRole) => {
    if (userId === currentUser?.id) {
      toast.error('Anda tidak dapat mengubah peran Anda sendiri!')
      return
    }

    try {
      const { error } = await dbProfiles.updateUser(userId, { role: newRole })
      if (error) throw error
      toast.success('Peran pengguna berhasil diperbarui')
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (e) {
      console.error(e)
      toast.error('Gagal memperbarui peran pengguna')
    }
  }

  const handleVerificationToggle = async (userId, currentStatus) => {
    if (userId === currentUser?.id) {
      toast.error('Anda tidak dapat mengubah status verifikasi Anda sendiri!')
      return
    }

    const nextStatus = !currentStatus
    try {
      const { error } = await dbProfiles.updateUser(userId, { is_verified: nextStatus })
      if (error) throw error
      toast.success(nextStatus ? 'Pengguna berhasil diverifikasi!' : 'Akses pengguna ditangguhkan!')
      setUsers(users.map(u => u.id === userId ? { ...u, is_verified: nextStatus } : u))
    } catch (e) {
      console.error(e)
      toast.error('Gagal memperbarui status verifikasi')
    }
  }

  const filteredUsers = users.filter(u => 
    u.nama_lengkap?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Manajemen Pengguna</h1>
        <p className="page-subtitle">Kelola verifikasi akun SSO dan penetapan peran akses sistem SI-RPL</p>
      </div>

      <div className="card">
        {/* Search bar & statistics */}
        <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--gray-200)', padding: '6px 12px', borderRadius: 8, width: '100%', maxWidth: 320 }}>
            <Search size={16} color="var(--gray-400)" />
            <input 
              type="text" 
              placeholder="Cari nama atau email..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="badge-pill badge-slate">{users.length} Total Akun</span>
            <span className="badge-pill badge-amber">{users.filter(u => !u.is_verified).length} Menunggu Verifikasi</span>
          </div>
        </div>

        {/* User Table */}
        <div className="card-body" style={{ padding: 0 }}>
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-text">Tidak ada pengguna ditemukan</div>
              <div className="empty-state-sub">Coba ubah kata kunci pencarian Anda.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nama Pengguna</th>
                    <th>Email</th>
                    <th style={{ width: 140 }}>Status Akun</th>
                    <th style={{ width: 180 }}>Peran Akses (Role)</th>
                    <th style={{ width: 140, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} style={{ opacity: u.is_verified ? 1 : 0.85, background: !u.is_verified ? 'rgba(245, 158, 11, 0.02)' : 'transparent' }}>
                        {/* Name */}
                        <td>
                          <strong>{u.nama_lengkap}</strong>
                          {isSelf && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--gray-200)', color: 'var(--gray-600)', padding: '2px 6px', borderRadius: 4 }}>Anda</span>}
                        </td>
                        
                        {/* Email */}
                        <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{u.email}</td>
                        
                        {/* Verification Status */}
                        <td>
                          {u.is_verified ? (
                            <span className="badge-pill badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={11} /> Aktif / Terverifikasi
                            </span>
                          ) : (
                            <span className="badge-pill badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <X size={11} /> Menunggu Verifikasi
                            </span>
                          )}
                        </td>
                        
                        {/* Role selection */}
                        <td>
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--gray-200)',
                              fontSize: 12.5,
                              width: '100%',
                              outline: 'none',
                              background: isSelf ? 'var(--gray-50)' : 'var(--surface)',
                              cursor: isSelf ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {ROLES_LIST.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </td>
                        
                        {/* Action buttons */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleVerificationToggle(u.id, u.is_verified)}
                            disabled={isSelf}
                            className={`btn btn-sm ${u.is_verified ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ 
                              justifyContent: 'center', 
                              width: '100%', 
                              fontSize: 12,
                              padding: '4px 10px',
                              opacity: isSelf ? 0.5 : 1,
                              cursor: isSelf ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {u.is_verified ? 'Tangguhkan' : 'Verifikasi'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
