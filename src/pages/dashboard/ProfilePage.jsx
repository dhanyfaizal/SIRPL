import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { User, Mail, Phone, Shield, Calendar, CheckCircle, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
  admin: 'Admin Akademik',
  asessor: 'Asessor RPL',
  kaprodi_si: 'Ka. Prodi Sistem Informasi',
  kaprodi_ti: 'Ka. Prodi Teknik Informatika',
  kaprodi_dkv: 'Ka. Prodi Desain Komunikasi Visual',
  kaprodi_ka: 'Ka. Prodi Komputerisasi Akuntansi',
  baak: 'BAAK Officer',
  pmb: 'PMB Officer',
  calon_rpl: 'Calon Mahasiswa RPL'
}

export default function ProfilePage() {
  const { profile, updateProfile } = useAuth()
  const [namaLengkap, setNamaLengkap] = useState(profile?.nama_lengkap || '')
  const [noWhatsapp, setNoWhatsapp] = useState(profile?.no_whatsapp || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    
    if (!namaLengkap.trim()) {
      toast.error('Nama lengkap tidak boleh kosong!')
      return
    }

    // WhatsApp format validation (Indonesian format)
    if (noWhatsapp && !/^[0-9+() -]+$/.test(noWhatsapp)) {
      toast.error('Format nomor WhatsApp tidak valid!')
      return
    }

    setSaving(true)
    const toastId = toast.loading('Memperbarui profil Anda...')
    try {
      const { error } = await updateProfile({
        nama_lengkap: namaLengkap,
        no_whatsapp: noWhatsapp
      })

      if (error) {
        throw error
      }
      toast.success('Profil berhasil diperbarui!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error(`Gagal memperbarui profil: ${err.message}`, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  // Predefined avatars matching names
  const initials = namaLengkap
    ? namaLengkap.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'CM'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Profil Saya</h1>
        <p className="page-subtitle">Kelola informasi data diri Anda dan nomor kontak sistem</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Avatar and Quick Metadata */}
        <div className="card" style={{ textAlign: 'center', padding: '24px 20px' }}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* Avatar Circle */}
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--indigo-500), var(--indigo-700))',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
              boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)',
              userSelect: 'none'
            }}>
              {initials}
            </div>

            {/* Quick Info */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', margin: '0 0 4px 0' }}>
                {profile?.nama_lengkap}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--gray-400)', margin: 0, fontFamily: 'monospace' }}>
                {profile?.email}
              </p>
            </div>

            {/* Status & Role Badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', alignItems: 'center' }}>
              <span className="badge-pill badge-indigo" style={{ fontSize: 12, padding: '4px 12px', width: 'fit-content' }}>
                {ROLE_LABELS[profile?.role] || profile?.role?.toUpperCase()}
              </span>

              {profile?.is_verified ? (
                <span className="badge-pill badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 12px' }}>
                  <CheckCircle size={12} /> Akun Terverifikasi
                </span>
              ) : (
                <span className="badge-pill badge-amber" style={{ fontSize: 12, padding: '4px 12px' }}>
                  Menunggu Verifikasi
                </span>
              )}
            </div>

            {/* Created At Metadata */}
            {profile?.created_at && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                color: 'var(--gray-400)',
                marginTop: 8,
                borderTop: '1px solid var(--gray-100)',
                paddingTop: 12,
                width: '100%',
                justifyContent: 'center'
              }}>
                <Calendar size={13} />
                <span>Terdaftar sejak: {new Date(profile.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Form */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Informasi Data Diri</h3>
          </div>
          <div className="card-body" style={{ padding: '24px 30px' }}>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Full Name Input */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={14} color="var(--gray-400)" /> Nama Lengkap
                </label>
                <input
                  type="text"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Masukkan nama lengkap Anda"
                  className="input"
                  disabled={saving}
                />
                <span className="input-hint">Gunakan nama resmi yang sesuai dengan identitas KTP / Ijazah Anda.</span>
              </div>

              {/* Email (SSO Readonly) */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={14} color="var(--gray-400)" /> Alamat Email (SSO)
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  className="input"
                  style={{ background: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }}
                  disabled
                />
                <span className="input-hint">Email tersinkronisasi otomatis dengan akun Single Sign-On (SSO) Google Anda dan tidak dapat diubah.</span>
              </div>

              {/* WhatsApp Contact Input */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={14} color="var(--gray-400)" /> Nomor WhatsApp
                </label>
                <input
                  type="text"
                  value={noWhatsapp}
                  onChange={(e) => setNoWhatsapp(e.target.value)}
                  placeholder="Contoh: 081234567890 atau 628123456789"
                  className="input"
                  disabled={saving}
                />
                <span className="input-hint">Nomor kontak aktif ini digunakan untuk menerima notifikasi berkas dari sistem melalui WA Gateway Fonnte.</span>
              </div>

              {/* Role Badge Readonly */}
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={14} color="var(--gray-400)" /> Peran Sistem (Access Role)
                </label>
                <input
                  type="text"
                  value={ROLE_LABELS[profile?.role] || profile?.role || ''}
                  className="input"
                  style={{ background: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }}
                  disabled
                />
                <span className="input-hint">Peran akses diatur sepenuhnya oleh Administrator Akademik Kampus.</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--gray-100)', paddingTop: 18, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ gap: 6, fontWeight: 700 }}
                >
                  <Save size={16} />
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
