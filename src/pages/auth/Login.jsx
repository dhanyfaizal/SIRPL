import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const ERROR_MESSAGES = {
  domain_not_allowed: 'Email Anda tidak terdaftar dalam domain institusi yang diizinkan.',
  callback_failed: 'Gagal menyelesaikan proses login. Silakan coba lagi.',
  unexpected: 'Terjadi kesalahan tak terduga. Silakan coba lagi.',
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#ffffff" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#ffffff" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#ffffff" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ffffff" />
    </svg>
  )
}

function MiniSpinner() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,.35)',
      borderTopColor: '#fff',
      animation: 'spin .7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

export default function Login() {
  const { signInWithGoogle } = useAuth()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const urlError = searchParams.get('error')
  const urlEmail = searchParams.get('email')
  const displayError = error ?? (urlError ? (ERROR_MESSAGES[urlError] ?? 'Terjadi kesalahan.') : null)
  const errorDetail = urlError === 'domain_not_allowed' && urlEmail
    ? `Email yang digunakan: ${decodeURIComponent(urlEmail)}`
    : null

  async function handleLogin() {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f1f5f9',
      padding: '0 16px',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }}>
      <div style={{ width: '100%', maxWidth: 384 }}>

        {/* Accent bar atas — identik SIRASYS */}
        <div style={{
          height: 4,
          borderRadius: '8px 8px 0 0',
          background: 'linear-gradient(to right, #6366f1, #4f46e5, #4338ca)',
        }} />

        {/* Card */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '36px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04)',
        }}>

          {/* Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 28 }}>
            <img
              src="/logo-sys.png"
              alt="STIKOM Yos Sudarso"
              style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 12 }}
            />
            <h1 style={{
              fontSize: 24, fontWeight: 700, color: '#111827',
              letterSpacing: '-0.3px', margin: 0,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}>
              SI-RPL
            </h1>
            <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, color: '#6b7280', margin: '6px 0 0' }}>
              Sistem Informasi Pendaftaran Program Rekognisi Pembelajaran Lampau
              <br />
              <span style={{ fontWeight: 600, color: '#374151' }}>STIKOM Yos Sudarso</span>
            </p>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f1f5f9', marginBottom: 24 }} />

          {/* Description */}
          <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>
            Daftar dan Login hanya dengan Akun Google Anda.
          </p>

          {/* Error Alert */}
          {displayError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 14px', borderRadius: 6,
              border: '1px solid #fecaca', backgroundColor: '#fef2f2',
              fontSize: 13, color: '#991b1b', marginBottom: 16,
            }}>
              <svg style={{ marginTop: 1, flexShrink: 0 }} width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <span>{displayError}</span>
                {errorDetail && <p style={{ marginTop: 4, fontSize: 11, color: '#b91c1c' }}>{errorDetail}</p>}
              </div>
            </div>
          )}

          {/* Login Button — identik SIRASYS */}
          <button
            id="btn-login-google"
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 6, border: 'none',
              backgroundColor: '#4f46e5',
              color: '#ffffff', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,.12)',
              transition: 'background-color .15s, box-shadow .15s',
              opacity: loading ? .7 : 1,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#4338ca'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(67,56,202,.35)' } }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#4f46e5'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.12)' }}
          >
            {loading ? <MiniSpinner /> : <GoogleIcon />}
            <span>{loading ? 'Mengalihkan...' : 'Login dengan Email Google'}</span>
          </button>

          {/* Footer note */}
          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.6, margin: '24px 0 0' }}>
            Hanya Akun Google resmi yang diizinkan.
            <br />
            Hubungi admin jika Anda tidak dapat masuk.
          </p>
        </div>

        {/* Copyright */}
        <p style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          © 2026 STIKOM Yos Sudarso - SI-RPL
        </p>
      </div>
    </div>
  )
}
