import { useAuth } from '../../contexts/AuthContext'
import PendaftarDashboard from './PendaftarDashboard'
import BaakDashboard from './BaakDashboard'
import KaprodiDashboard from './KaprodiDashboard'
import AsessorDashboard from './AsessorDashboard'
import AdminDashboard from './AdminDashboard'

export default function DashboardRouter() {
  const { role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Memuat dashboard...</p>
      </div>
    )
  }

  if (role === 'calon_rpl') return <PendaftarDashboard />
  if (role === 'baak') return <BaakDashboard />
  if (role?.startsWith('kaprodi_')) return <KaprodiDashboard />
  if (role === 'asessor') return <AsessorDashboard />
  if (role === 'admin') return <AdminDashboard />

  return (
    <div className="card">
      <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h3>Peran Tidak Dikenal</h3>
        <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 8 }}>
          Akun Anda tidak memiliki peran yang valid untuk mengakses sistem SI-RPL.
        </p>
      </div>
    </div>
  )
}
