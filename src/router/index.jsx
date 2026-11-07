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
import PengaturanMkRpl from '../kurikulum/PengaturanMkRpl'
import TimLayout from '../tim/TimLayout'
import TimBeranda from '../tim/pages/Beranda'
import TimDaftar from '../tim/pages/Daftar'
import TimDetail from '../tim/pages/Detail'
import TimJadwal from '../tim/pages/Jadwal'
import TimPembayaran from '../tim/pages/Pembayaran'
import TimPleno from '../tim/pages/Pleno'
import TimPlenoDetail from '../tim/pages/PlenoDetail'
import AsesorLayout from '../asesor/AsesorLayout'
import PimpinanLayout from '../pimpinan/PimpinanLayout'
import LihatDokumen from '../dokumen/pages/LihatDokumen'
import VerifikasiDokumen from '../dokumen/pages/Verifikasi'
import TandaTanganDokumen from '../dokumen/pages/TandaTangan'
import PengaturanDokumen from '../dokumen/pages/Pengaturan'
import PemohonDokumen from '../pemohon/pages/Dokumen'
import PimpinanBeranda from '../pimpinan/pages/Beranda'
import PimpinanKomite from '../pimpinan/pages/Komite'
import PimpinanSk from '../pimpinan/pages/Sk'
import PimpinanNim from '../pimpinan/pages/Nim'
import AsesorBeranda from '../asesor/pages/Beranda'
import AsesorDaftar from '../asesor/pages/Daftar'
import AsesorPenilaian from '../asesor/pages/Penilaian'
import AsesorJadwal from '../asesor/pages/Jadwal'
import ProfilePage from '../pages/dashboard/ProfilePage'
import FeedbackPage from '../pages/dashboard/FeedbackPage'

// Print page
import ReportPrintPage from '../pages/public/ReportPrintPage'

// Modul Pemohon (alur Juknis RPL Tipe A)
import PemohonLayout from '../pemohon/PemohonLayout'
import PemohonBeranda from '../pemohon/pages/Beranda'
import PemohonPersyaratan from '../pemohon/pages/Persyaratan'
import PemohonRiwayatHidup from '../pemohon/pages/RiwayatHidup'
import PemohonBukti from '../pemohon/pages/Bukti'
import PemohonEvaluasiDiri from '../pemohon/pages/EvaluasiDiri'
import PemohonRingkasan from '../pemohon/pages/Ringkasan'
import PemohonHasil from '../pemohon/pages/Hasil'
import PemohonJadwal from '../pemohon/pages/Jadwal'
import PemohonPembayaran from '../pemohon/pages/Pembayaran'
import PemohonCetakF07 from '../pemohon/pages/CetakF07'

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
        <Route path="/verifikasi" element={<VerifikasiDokumen />} />
        <Route path="/verifikasi/:kode" element={<VerifikasiDokumen />} />

        {/* Dokumen RPL (cetak A4 dan tanda tangan elektronik) */}
        <Route path="/dokumen/:id" element={<ProtectedRoute><LihatDokumen /></ProtectedRoute>} />
        <Route path="/tanda-tangan" element={<ProtectedRoute><TandaTanganDokumen /></ProtectedRoute>} />
        <Route path="/pengaturan-dokumen" element={<ProtectedRoute allowedRoles={['admin', 'ketua_tim', 'sekretaris']}><PengaturanDokumen /></ProtectedRoute>} />

        {/* Protected Application Routes */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardRouter />} />
          
          {/* Redirect link dari menu 'Ajukan RPL Baru' */}
          <Route path="/pengajuan/baru" element={<Navigate to="/dashboard" replace />} />
          
          {/* Manajemen Pengguna (Admin) */}
          <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/curriculum" element={<ProtectedRoute allowedRoles={['admin']}><AdminCurriculumPage /></ProtectedRoute>} />
          <Route path="/kurikulum-rpl" element={<ProtectedRoute allowedRoles={['admin', 'kaprodi_ti', 'kaprodi_si', 'kaprodi_dkv', 'kaprodi_ka']}><PengaturanMkRpl /></ProtectedRoute>} />
          
          {/* Profile & Settings */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/feedback" element={<ProtectedRoute allowedRoles={['admin', 'baak', 'pmb', 'eksekutif']}><FeedbackPage /></ProtectedRoute>} />
          <Route path="/settings/ai" element={<ProtectedRoute allowedRoles={['admin']}><PlaceholderPage title="Pengaturan AI Key" /></ProtectedRoute>} />
        </Route>

        {/* Modul Pemohon: shell sendiri (AppShell bersama BAAKSYS & SIRENA) */}
        <Route path="/pemohon" element={<ProtectedRoute allowedRoles={['calon_rpl']}><PemohonLayout /></ProtectedRoute>}>
          <Route index element={<PemohonBeranda />} />
          <Route path="pengajuan" element={<Navigate to="/pemohon/pengajuan/data" replace />} />
          <Route path="pengajuan/data" element={<PemohonPersyaratan />} />
          <Route path="pengajuan/riwayat-hidup" element={<PemohonRiwayatHidup />} />
          <Route path="pengajuan/bukti" element={<PemohonBukti />} />
          <Route path="pengajuan/evaluasi-diri" element={<PemohonEvaluasiDiri />} />
          <Route path="pengajuan/kirim" element={<PemohonRingkasan />} />
          <Route path="pembayaran" element={<PemohonPembayaran />} />
          <Route path="jadwal" element={<PemohonJadwal />} />
          <Route path="hasil" element={<PemohonHasil />} />
          <Route path="dokumen" element={<PemohonDokumen />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>
        <Route path="/pemohon/cetak/f07" element={<ProtectedRoute allowedRoles={['calon_rpl']}><PemohonCetakF07 /></ProtectedRoute>} />

        {/* Modul Komite, Pimpinan, dan BAAK (tahap akhir) */}
        <Route path="/pimpinan" element={<ProtectedRoute allowedRoles={['admin', 'komite', 'eksekutif', 'baak', 'ketua_tim', 'sekretaris']}><PimpinanLayout /></ProtectedRoute>}>
          <Route index element={<PimpinanBeranda />} />
          <Route path="komite" element={<PimpinanKomite />} />
          <Route path="komite/:id" element={<PimpinanKomite />} />
          <Route path="sk" element={<PimpinanSk />} />
          <Route path="nim" element={<PimpinanNim />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>

        {/* Modul Asesor (Tim Penilai RPL) */}
        <Route path="/asesor" element={<ProtectedRoute allowedRoles={['admin', 'asessor', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka']}><AsesorLayout /></ProtectedRoute>}>
          <Route index element={<AsesorBeranda />} />
          <Route path="tugas" element={<Navigate to="/asesor/tugas/dinilai" replace />} />
          <Route path="tugas/:kelompok" element={<AsesorDaftar />} />
          <Route path="tugas/:kelompok/:id" element={<AsesorPenilaian />} />
          <Route path="jadwal" element={<AsesorJadwal />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>

        {/* Modul Tim Pengelola RPL: Sekretariat, Sekretaris, Ketua Tim */}
        <Route path="/tim" element={<ProtectedRoute allowedRoles={['admin', 'ketua_tim', 'sekretaris']}><TimLayout /></ProtectedRoute>}>
          <Route index element={<TimBeranda />} />
          <Route path="antrean" element={<Navigate to="/tim/antrean/verifikasi" replace />} />
          <Route path="antrean/:kelompok" element={<TimDaftar />} />
          <Route path="antrean/:kelompok/:id" element={<TimDetail />} />
          <Route path="jadwal" element={<TimJadwal />} />
          <Route path="pleno" element={<TimPleno />} />
          <Route path="pleno/:id" element={<TimPlenoDetail />} />
          <Route path="pembayaran" element={<TimPembayaran />} />
          <Route path="profil" element={<ProfilePage />} />
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
