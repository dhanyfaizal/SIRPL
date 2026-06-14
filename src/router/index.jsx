import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Layout
import AppLayout from '../components/layout/AppLayout'

// Auth Pages
import Login from '../pages/auth/Login'
import AuthCallback from '../pages/auth/AuthCallback'

// Dashboard Router
import DashboardRouter from '../pages/dashboard/DashboardRouter'
import AdminUsersPage from '../pages/dashboard/AdminUsersPage'
import AdminCurriculumPage from '../pages/dashboard/AdminCurriculumPage'

// Print page
import ReportPrintPage from '../pages/public/ReportPrintPage'

// Protected Route Wrapper
function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Memuat keamanan...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Cek verifikasi pengguna oleh Admin
  if (profile && profile.is_verified === false) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        backgroundColor: '#f1f5f9', padding: '0 16px',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}>
        <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32, textAlign: 'center', borderTop: '4px solid var(--amber-500)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Akun Menunggu Verifikasi</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
            Akun Anda (<strong>{profile.email}</strong>) berhasil masuk via SSO, namun memerlukan verifikasi dari Admin sebelum dapat mengakses sistem SI-RPL.
          </p>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Silakan hubungi Administrator Akademik untuk menyetujui akun Anda.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Periksa Status
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Simple Placeholder Page
function PlaceholderPage({ title }) {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <div className="empty-state-text">Fitur Segera Hadir</div>
            <div className="empty-state-sub">Modul {title} sedang dalam pengembangan dan penyesuaian regulasi internal.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppRouter() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Menghubungkan ke SI-RPL...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected Application Routes */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardRouter />} />
          
          {/* Redirect link dari menu 'Ajukan RPL Baru' */}
          <Route path="/pengajuan/baru" element={<Navigate to="/dashboard" replace />} />
          
          {/* Manajemen Pengguna (Admin) */}
          <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/curriculum" element={<ProtectedRoute allowedRoles={['admin']}><AdminCurriculumPage /></ProtectedRoute>} />
          
          {/* Profile & Settings */}
          <Route path="/profile" element={<PlaceholderPage title="Profil Saya" />} />
          <Route path="/settings/ai" element={<ProtectedRoute allowedRoles={['admin']}><PlaceholderPage title="Pengaturan AI Key" /></ProtectedRoute>} />
        </Route>

        {/* Standalone Print Route */}
        <Route path="/report/:id/print" element={<ProtectedRoute><ReportPrintPage /></ProtectedRoute>} />

        {/* Fallbacks */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
