import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { signInMock, signInWithGoogle, isMock } = useAuth()
  const [mockRole, setMockRole] = useState('calon_mhs')
  const [mockName, setMockName] = useState('Dr. Hermawan, M.T.')
  const [loading, setLoading] = useState(false)

  // Auto-name suggestions based on role
  const handleRoleChange = (e) => {
    const role = e.target.value
    setMockRole(role)
    if (role === 'calon_mhs') setMockName('Budi Setiawan (Pendaftar)')
    if (role === 'baak') setMockName('Riana Lestari (BAAK Officer)')
    if (role === 'kaprodi') setMockName('Hendra Wijaya, M.T. (Ka. Prodi IF)')
    if (role === 'asessor') setMockName('Prof. Antonius (Asessor RPL)')
    if (role === 'admin') setMockName('Ignatius Adi (Admin Akademik)')
  }

  const handleMockLogin = async (e) => {
    e.preventDefault()
    if (!mockName.trim()) {
      toast.error('Nama lengkap simulasi wajib diisi')
      return
    }
    setLoading(true)
    try {
      await signInMock(mockRole, mockName)
      toast.success(`Berhasil login sebagai ${mockName}`)
    } catch (err) {
      console.error(err)
      toast.error('Gagal melakukan login simulasi')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error(err)
      toast.error('Gagal login via Google: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '20px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header Gradient Accent */}
        <div style={{ height: '5px', background: 'linear-gradient(to right, #4f46e5, #7c3aed)' }} />

        {/* Card Body */}
        <div style={{ padding: '40px 32px' }}>
          {/* Logo & Title */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="/logo-sys.png" alt="STIKOM" style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain',
              margin: '0 auto 16px',
            }} onError={e => e.target.style.display='none'} />
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              SI-RPL
            </h1>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, fontWeight: 500 }}>
              Sistem Rekognisi Pembelajaran Lampau
            </p>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              STIKOM Yos Sudarso
            </span>
          </div>

          {/* Google SSO Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="btn btn-secondary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '11px 16px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background 0.15s, border-color 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          >
            <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.51 14.99 1 12 1 7.35 1 3.39 3.65 1.5 7.5l3.85 2.99C6.27 7.02 8.94 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.03 3.67-5.01 3.67-8.66z" />
              <path fill="#FBBC05" d="M5.35 10.49c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.5 2.92C.54 4.84 0 7.02 0 9.3s.54 4.46 1.5 6.38l3.85-2.99z" />
              <path fill="#34A853" d="M12 18.96c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.1.74-2.5 1.18-4.2 1.18-3.06 0-5.73-1.98-6.65-5.45L1.5 11.86c1.89 3.85 5.85 6.5 10.5 6.5z" />
            </svg>
            Masuk dengan Google Workspace
          </button>

        </div>
      </div>
    </div>
  )
}
