import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BaakDashboard from './BaakDashboard'
import KaprodiDashboard from './KaprodiDashboard'
import AsessorDashboard from './AsessorDashboard'
import AdminDashboard from './AdminDashboard'
import PmbDashboard from './PmbDashboard'
import ExecutiveDashboard from './ExecutiveDashboard'

export default function DashboardRouter() {
  const { role, loading } = useAuth()
  const [param] = useSearchParams()
  const lama = param.get('lama') === '1'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Memuat dashboard...</p>
      </div>
    )
  }

  // Pemohon memakai modul baru (alur Juknis RPL Tipe A).
  if (role === 'calon_rpl') return <Navigate to="/pemohon" replace />
  if (role === 'ketua_tim' || role === 'sekretaris') return <Navigate to="/tim" replace />
  if (role === 'komite') return <Navigate to="/pimpinan" replace />
  if (role === 'pmb') return <PmbDashboard />
  if (role === 'baak') return <BaakDashboard />
  if (role?.startsWith('kaprodi_')) return <KaprodiDashboard />
  // Asesor memakai modul penilaian baru; dasbor lama untuk pengajuan alur versi 1.
  if (role === 'asessor') return lama ? <AsessorDashboard /> : <Navigate to="/asesor" replace />
  if (role === 'admin') return lama ? <AdminDashboard /> : <Navigate to="/admin" replace />
  if (role === 'eksekutif') return <ExecutiveDashboard />

  return (
    <div className="card">
      <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
        <h3>Peran tidak dikenal</h3>
        <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 8 }}>
          Akun Anda tidak memiliki peran yang valid untuk mengakses sistem SI-RPL.
        </p>
      </div>
    </div>
  )
}
