import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Layout
import AppLayout from '../components/layout/AppLayout'

// Auth Pages
import Login from '../pages/auth/Login'
import AuthCallback from '../pages/auth/AuthCallback'

// Dashboard Router
import DashboardRouter from '../pages/dashboard/DashboardRouter'
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
import TandaTanganDokumen, { TandaTanganModul } from '../dokumen/pages/TandaTangan'
import WaKeluar from '../notifikasi/WaKeluar'
import PengaturanDokumen from '../dokumen/pages/Pengaturan'
import PemohonDokumen from '../pemohon/pages/Dokumen'
import PetunjukF01 from '../dokumen/pages/Petunjuk'
import Repositori from '../repositori/Repositori'
import BerbagiRepositori from '../repositori/Berbagi'
import AsesorBiodata from '../asesor/pages/Biodata'
import KeuanganLayout from '../keuangan/KeuanganLayout'
import KuBeranda from '../keuangan/pages/Beranda'
import KuVerifikasi from '../keuangan/pages/Verifikasi'
import KuTagihan from '../keuangan/pages/Tagihan'
import KuTagihanDetail from '../keuangan/pages/TagihanDetail'
import KuDiskon from '../keuangan/pages/Diskon'
import KuSkema from '../keuangan/pages/Skema'
import Laporan from '../laporan/Laporan'
import AdminLayout from '../admin/AdminLayout'
import { AdminDataProvider } from '../admin/AdminData'
import AdminBeranda from '../admin/pages/Beranda'
import AdminPengajuan from '../admin/pages/Pengajuan'
import AdminPelaporan from '../admin/pages/Pelaporan'
import AdminPengguna from '../admin/pages/Pengguna'
import AdminPeriode from '../admin/pages/Periode'
import AdminProdi from '../admin/pages/Prodi'
import AdminLog from '../admin/pages/Log'
import AdminNotifikasi from '../admin/pages/Notifikasi'
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

function AkunMenunggu({ profile }) {
  const { signOut } = useAuth()
  return (
    <div className="akun-tunggu">
      <div className="card akun-tunggu-kartu">
        <img src="/logo-sys.png" alt="" width="48" height="48" />
        <h1>Akun belum aktif</h1>
        <p>Anda masuk sebagai <b>{profile.email}</b>. Akun staf ini belum diaktifkan atau sedang dinonaktifkan oleh Admin SIRPL.</p>
        <p className="akun-tunggu-kecil">Hubungi Admin SIRPL STIKOM Yos Sudarso, lalu periksa kembali.</p>
        <div className="akun-tunggu-aksi">
          <button type="button" className="btn btn-secondary" onClick={() => signOut()}>Keluar</button>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Periksa status</button>
        </div>
      </div>
    </div>
  )
}

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
  if (profile && profile.is_verified === false) return <AkunMenunggu profile={profile} />

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
        <Route path="/berbagi/:token" element={<BerbagiRepositori />} />
        <Route path="/petunjuk" element={<ProtectedRoute><PetunjukF01 /></ProtectedRoute>} />
        <Route path="/repositori" element={<ProtectedRoute allowedRoles={['admin', 'eksekutif', 'baak', 'ketua_tim', 'sekretaris', 'komite', 'lpmp', 'asessor', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka']}><Repositori /></ProtectedRoute>} />

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
          <Route path="/users" element={<Navigate to="/admin/pengguna" replace />} />
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
        <Route path="/keuangan" element={<ProtectedRoute allowedRoles={['admin', 'pmb']}><KeuanganLayout /></ProtectedRoute>}>
          <Route index element={<KuBeranda />} />
          <Route path="verifikasi" element={<KuVerifikasi />} />
          <Route path="tagihan" element={<KuTagihan />} />
          <Route path="tagihan/:id" element={<KuTagihanDetail />} />
          <Route path="diskon" element={<KuDiskon />} />
          <Route path="skema" element={<KuSkema />} />
          <Route path="wa" element={<WaKeluar />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>

        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminBeranda />} />
          <Route path="pengajuan" element={<AdminPengajuan />} />
          <Route path="pelaporan" element={<AdminPelaporan />} />
          <Route path="pengguna" element={<AdminPengguna />} />
          <Route path="periode" element={<AdminPeriode />} />
          <Route path="prodi" element={<AdminProdi />} />
          <Route path="log" element={<AdminLog />} />
          <Route path="notifikasi" element={<AdminNotifikasi />} />
          <Route path="tanda-tangan" element={<TandaTanganModul />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>

        <Route path="/pimpinan" element={<ProtectedRoute allowedRoles={['admin', 'komite', 'eksekutif', 'lpmp', 'baak', 'ketua_tim', 'sekretaris']}><PimpinanLayout /></ProtectedRoute>}>
          <Route index element={<PimpinanBeranda />} />
          <Route path="komite" element={<PimpinanKomite />} />
          <Route path="komite/:id" element={<PimpinanKomite />} />
          <Route path="sk" element={<PimpinanSk />} />
          <Route path="nim" element={<PimpinanNim />} />
          <Route path="laporan" element={<Laporan />} />
          <Route path="tanda-tangan" element={<TandaTanganModul />} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>

        {/* Modul Asesor (Tim Penilai RPL) */}
        <Route path="/asesor" element={<ProtectedRoute allowedRoles={['admin', 'asessor', 'ketua_tim', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka']}><AsesorLayout /></ProtectedRoute>}>
          <Route index element={<AsesorBeranda />} />
          <Route path="tugas" element={<Navigate to="/asesor/tugas/dinilai" replace />} />
          <Route path="tugas/:kelompok" element={<AsesorDaftar />} />
          <Route path="tugas/:kelompok/:id" element={<AsesorPenilaian />} />
          <Route path="jadwal" element={<AsesorJadwal />} />
          <Route path="biodata" element={<AsesorBiodata />} />
          <Route path="tanda-tangan" element={<TandaTanganModul />} />
          <Route path="rekap" element={<ProtectedRoute allowedRoles={['admin', 'kaprodi_si', 'kaprodi_ti', 'kaprodi_dkv', 'kaprodi_ka']}><Laporan /></ProtectedRoute>} />
          <Route path="profil" element={<ProfilePage />} />
        </Route>

        {/* Modul Tim Pengelola RPL: Sekretariat, Sekretaris, Ketua Tim */}
        <Route path="/tim" element={<ProtectedRoute allowedRoles={['admin', 'ketua_tim', 'sekretaris', 'baak']}><TimLayout /></ProtectedRoute>}>
          <Route index element={<TimBeranda />} />
          <Route path="antrean" element={<Navigate to="/tim/antrean/verifikasi" replace />} />
          <Route path="antrean/:kelompok" element={<TimDaftar />} />
          <Route path="antrean/:kelompok/:id" element={<TimDetail />} />
          <Route path="jadwal" element={<TimJadwal />} />
          <Route path="pleno" element={<TimPleno />} />
          <Route path="pleno/:id" element={<TimPlenoDetail />} />
          <Route path="pembayaran" element={<TimPembayaran />} />
          <Route path="pelaporan" element={<AdminDataProvider><AdminPelaporan /></AdminDataProvider>} />
          <Route path="wa" element={<WaKeluar />} />
          <Route path="tanda-tangan" element={<TandaTanganModul />} />
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
