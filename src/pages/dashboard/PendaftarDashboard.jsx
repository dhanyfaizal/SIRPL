import { useState, useEffect } from 'react'
import { dbPengajuan, dbProdi } from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import { FileUp, Clipboard, Award, Shield, CheckCircle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PendaftarDashboard() {
  const { user } = useAuth()
  const [prodis, setProdis] = useState([])
  const [pengajuan, setPengajuan] = useState(null)
  const [loading, setLoading] = useState(true)

  // Form State
  const [selectedProdi, setSelectedProdi] = useState('')
  const [ijazahName, setIjazahName] = useState('')
  const [transkripName, setTranskripName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: prodiData } = await dbProdi.getAll()
      setProdis(prodiData || [])

      const { data: pengajuanData } = await dbPengajuan.getByUserId(user.id)
      if (pengajuanData && pengajuanData.length > 0) {
        setPengajuan(pengajuanData[0]) // Ambil pengajuan terbaru
      } else {
        setPengajuan(null)
      }
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id])

  const handleFileChange = (e, type) => {
    const file = e.target.files[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Hanya berkas PDF yang diperbolehkan')
        return
      }
      if (type === 'ijazah') setIjazahName(file.name)
      if (type === 'transkrip') setTranskripName(file.name)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedProdi) {
      toast.error('Silakan pilih Program Studi Pilihan')
      return
    }
    if (!ijazahName || !transkripName) {
      toast.error('Silakan unggah kedua dokumen wajib (Ijazah & Transkrip)')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        user_id: user.id,
        prodi_pilihan_id: selectedProdi,
        file_ijazah_url: ijazahName,
        file_transkrip_url: transkripName,
      }

      await dbPengajuan.create(payload)
      toast.success('Pengajuan RPL berhasil dikirim!')
      loadData()
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengirimkan pengajuan')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper untuk menentukan status index stepper
  const getStatusStep = (status) => {
    switch (status) {
      case 'submitted': return 1
      case 'validated_baak': return 2
      case 'recognized_kaprodi': return 3
      case 'assessed_asessor': return 4
      case 'mapped_admin': return 5
      default: return 0
    }
  }

  const stepIndex = pengajuan ? getStatusStep(pengajuan.status) : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Portal Pendaftaran RPL</h1>
        <p className="page-subtitle">Ajukan rekognisi mata kuliah dari studi/pengalaman lampau Anda</p>
      </div>

      {!pengajuan ? (
        /* Form Pengajuan */
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Formulir Pengajuan RPL</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="card-body form-grid">
              <div className="input-group">
                <label className="input-label">Program Studi Pilihan</label>
                <select
                  value={selectedProdi}
                  onChange={(e) => setSelectedProdi(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--gray-200)',
                    background: 'var(--surface)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                  required
                >
                  <option value="">-- Pilih Program Studi --</option>
                  {prodis.map(p => (
                    <option key={p.id} value={p.id}>{p.nama}</option>
                  ))}
                </select>
                <span className="input-hint">Pilih prodi tujuan transfer kredit Anda di STIKOM Yos Sudarso</span>
              </div>

              <div className="form-grid-2 form-grid">
                {/* Upload Ijazah */}
                <div style={{
                  border: '2px dashed var(--gray-200)',
                  borderRadius: '10px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'var(--surface-alt)',
                  cursor: 'pointer',
                  position: 'relative'
                }}>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, 'ijazah')}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  />
                  <FileUp size={32} color="var(--indigo-600)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Unggah Ijazah Wajib</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Format PDF (Maks. 5MB)</div>
                  {ijazahName && (
                    <div style={{ marginTop: 12, padding: '4px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={12} /> {ijazahName}
                    </div>
                  )}
                </div>

                {/* Upload Transkrip */}
                <div style={{
                  border: '2px dashed var(--gray-200)',
                  borderRadius: '10px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'var(--surface-alt)',
                  cursor: 'pointer',
                  position: 'relative'
                }}>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, 'transkrip')}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  />
                  <FileUp size={32} color="var(--indigo-600)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Unggah Transkrip Nilai (Hi-Res)</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Format PDF (Maks. 5MB)</div>
                  {transkripName && (
                    <div style={{ marginTop: 12, padding: '4px 8px', background: '#d1fae5', color: '#065f46', borderRadius: 4, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={12} /> {transkripName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? 'Mengirimkan...' : 'Kirim Pengajuan RPL'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Status Tracker & Timeline */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Timeline Details */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Status Pelacakan Berkas RPL</h3>
              <span className={`badge-pill status-${pengajuan.status}`}>
                {pengajuan.status.toUpperCase()}
              </span>
            </div>
            <div className="card-body">
              <div className="stepper-timeline">
                {/* Step 1 */}
                <div className={`step-item ${stepIndex >= 1 ? (stepIndex > 1 ? 'completed' : 'active') : ''}`}>
                  <div className="step-node" />
                  <div className="step-title">Fase 1: Berkas Dikirim</div>
                  <div className="step-desc">Calon mahasiswa berhasil mengirim berkas pendaftaran (Ijazah & Transkrip) untuk divalidasi.</div>
                  {stepIndex === 1 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Menunggu validasi oleh petugas BAAK.</div>}
                </div>

                {/* Step 2 */}
                <div className={`step-item ${stepIndex >= 2 ? (stepIndex > 2 ? 'completed' : 'active') : ''}`}>
                  <div className="step-node" />
                  <div className="step-title">Fase 2: Validasi Dokumen (BAAK)</div>
                  <div className="step-desc">Pemeriksaan keaslian dan resolusi berkas transkrip nilai oleh administrasi BAAK.</div>
                  {stepIndex === 2 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Berkas valid! Menunggu proses pencocokan mata kuliah oleh Ka. Prodi.</div>}
                </div>

                {/* Step 3 */}
                <div className={`step-item ${stepIndex >= 3 ? (stepIndex > 3 ? 'completed' : 'active') : ''}`}>
                  <div className="step-node" />
                  <div className="step-title">Fase 3: Smart Recognition (Ka. Prodi)</div>
                  <div className="step-desc">Pencocokan mata kuliah transkrip asal dengan mata kuliah kurikulum menggunakan AI/OCR.</div>
                  {stepIndex === 3 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Rekognisi selesai oleh Ka. Prodi! Menunggu asesmen portofolio dan biaya dari Asessor.</div>}
                </div>

                {/* Step 4 */}
                <div className={`step-item ${stepIndex >= 4 ? (stepIndex > 4 ? 'completed' : 'active') : ''}`}>
                  <div className="step-node" />
                  <div className="step-title">Fase 4: Asesmen Akademik & Biaya (Asessor)</div>
                  <div className="step-desc">Verifikasi akademik akhir, penambahan mata kuliah diakui, dan kalkulasi biaya awal.</div>
                  {stepIndex === 4 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Asesmen portofolio selesai! Menunggu penetapan jalur kelas dan pencetakan rencana studi oleh Admin.</div>}
                </div>

                {/* Step 5 */}
                <div className={`step-item ${stepIndex >= 5 ? 'completed' : ''}`}>
                  <div className="step-node" />
                  <div className="step-title">Fase 5: Pemetaan Jalur & Finalisasi (Admin)</div>
                  <div className="step-desc">Pemisahan jalur kuliah (MOOCs Asinkron & Tatap Muka Sinkron) serta penyusunan Rencana Studi resmi.</div>
                  {stepIndex === 5 && (
                    <div style={{
                      marginTop: 12,
                      padding: 12,
                      background: '#d1fae5',
                      color: '#065f46',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <CheckCircle size={16} /> Proses evaluasi RPL selesai! Silakan cetak lembar Rencana Studi Mahasiswa RPL.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary Box */}
            <div className="card" style={{ background: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-700)', marginBottom: 12 }}>
                  <Clipboard size={18} />
                  <span style={{ fontWeight: 700 }}>Ringkasan Ajuan</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
                  <div>
                    <span style={{ color: 'var(--gray-500)' }}>Prodi Pilihan:</span><br />
                    <strong>{pengajuan.prodi?.nama}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--gray-500)' }}>Berkas Ijazah:</span><br />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                      <FileText size={12} /> {pengajuan.file_ijazah_url}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--gray-500)' }}>Berkas Transkrip:</span><br />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                      <FileText size={12} /> {pengajuan.file_transkrip_url}
                    </span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--indigo-100)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Tanggal Kirim:</span><br />
                    <strong>{new Date(pengajuan.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Action (If Complete) */}
            {stepIndex === 5 && (
              <button
                onClick={() => window.open(`/report/${pengajuan.id}/print`, '_blank')}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontWeight: 700,
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                }}
              >
                <FileText size={16} /> Cetak Rencana Studi (PDF)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
