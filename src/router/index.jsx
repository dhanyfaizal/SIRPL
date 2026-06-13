import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Layout
import AppLayout from '../components/layout/AppLayout'

// Auth Pages
import Login from '../pages/auth/Login'
import AuthCallback from '../pages/auth/AuthCallback'

// Dashboard Router
import DashboardRouter from '../pages/dashboard/DashboardRouter'

// Print page
import ReportPrintPage from '../pages/public/ReportPrintPage'

// Protected Route Wrapper
function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Memuat keamanan...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

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
          
          {/* Profile & Settings */}
          <Route path="/profile" element={<PlaceholderPage title="Profil Saya" />} />
          <Route path="/settings/ai" element={<PlaceholderPage title="Pengaturan AI Key" />} />
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
