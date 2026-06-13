import { useState, useEffect } from 'react'
import { dbPengajuan } from '../../lib/db'
import { supabase, isMock } from '../../lib/supabase'
import { ClipboardCheck, FileText, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'

// Helper: Preview component for BAAK with signed URL support
function BaakDocPreview({ selectedItem, previewType, previewSignedUrl, setPreviewSignedUrl }) {
  const [loading, setLoading] = useState(false)

  const filePath = previewType === 'ijazah' ? selectedItem.file_ijazah_url : selectedItem.file_transkrip_url
  const isStoragePath = filePath && filePath.includes('/')

  useEffect(() => {
    if (!isMock && isStoragePath && !previewSignedUrl) {
      setLoading(true)
      supabase.storage
        .from('rpl-documents')
        .createSignedUrl(filePath, 3600)
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) setPreviewSignedUrl(data.signedUrl)
          else setPreviewSignedUrl(null)
        })
        .finally(() => setLoading(false))
    }
  }, [filePath, isStoragePath, previewSignedUrl])

  if (loading) {
    return (
      <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!isMock && isStoragePath && previewSignedUrl) {
    return (
      <div style={{ height: 400, background: '#fff' }}>
        <iframe title="Pratinjau Dokumen PDF BAAK" src={previewSignedUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    )
  }

  return (
    <div style={{ height: 400, background: '#fff' }}>
      <iframe
        title="Pratinjau Dokumen BAAK"
        srcDoc={generateMockDocSrcDoc(
          previewType,
          filePath,
          selectedItem.profile?.nama_lengkap || 'Calon Mahasiswa',
          selectedItem.prodi?.nama || '-'
        )}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}

export default function BaakDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewType, setPreviewType] = useState('ijazah')

  // Verification Checklist State (simplified: 2 checkboxes)
  const [chkIjazah, setChkIjazah] = useState(false)
  const [chkTranskrip, setChkTranskrip] = useState(false)
  const [previewSignedUrl, setPreviewSignedUrl] = useState(null)

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      // Filter yang statusnya 'submitted'
      setSubmissions((data || []).filter(item => item.status === 'submitted'))
      setSelectedItem(null)
      // Reset checklist
      setChkIjazah(false)
      setChkTranskrip(false)
      setPreviewSignedUrl(null)
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat daftar pengajuan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
  }, [])

  const handleApprove = async () => {
    if (!chkIjazah || !chkTranskrip) {
      toast.error('Kedua berkas (Ijazah & Transkrip) wajib dicentang')
      return
    }

    try {
      await dbPengajuan.updateStatus(selectedItem.id, 'validated_baak')
      toast.success('Pengajuan berhasil divalidasi dan diteruskan ke Ka. Prodi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memvalidasi pengajuan')
    }
  }

  const handleReject = () => {
    toast.error('Pengajuan ditolak. Calon mahasiswa akan diberitahu (Simulasi).')
    setSelectedItem(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Validasi Berkas (BAAK)</h1>
        <p className="page-subtitle">Verifikasi keabsahan dokumen persyaratan masuk program RPL</p>
      </div>

      {!selectedItem ? (
        /* List submissions */
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Daftar Pengajuan Masuk</h3>
            <span className="badge-pill badge-indigo">{submissions.length} Pengajuan</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {submissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📥</div>
                <div className="empty-state-text">Tidak ada pengajuan masuk</div>
                <div className="empty-state-sub">Semua dokumen masuk telah diproses atau belum ada pendaftar baru.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama Pendaftar</th>
                      <th>Email</th>
                      <th>Prodi Pilihan</th>
                      <th>Tanggal Masuk</th>
                      <th style={{ width: 100 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.profile?.nama_lengkap}</strong></td>
                        <td>{item.profile?.email}</td>
                        <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                        <td>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="btn btn-primary btn-sm"
                          >
                            Periksa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Detailed inspection screen */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
          {/* Main Inspection Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Informasi Berkas Dokumen</h3>
                <button onClick={() => setSelectedItem(null)} className="btn btn-secondary btn-sm">Kembali</button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Biodata info */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 13 }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Biodata Pendaftar:</strong>
                  <table style={{ width: '100%', fontSize: 12.5 }}>
                    <tbody>
                      <tr>
                        <td style={{ width: 140, padding: '4px 0', color: 'var(--gray-500)' }}>Nama Lengkap</td>
                        <td style={{ padding: '4px 0' }}>: <strong>{selectedItem.profile?.nama_lengkap}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Alamat Email</td>
                        <td style={{ padding: '4px 0' }}>: {selectedItem.profile?.email}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Pilihan Program Studi</td>
                        <td style={{ padding: '4px 0' }}>: {selectedItem.prodi?.nama}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Document selector & preview iframe */}
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)', padding: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-700)', paddingLeft: 8 }}>
                      Pratinjau: {previewType === 'ijazah' ? 'Ijazah' : 'Transkrip'}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button 
                        onClick={() => { setPreviewType('ijazah'); setPreviewSignedUrl(null) }} 
                        className={`btn btn-sm ${previewType === 'ijazah' ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        Ijazah
                      </button>
                      <button 
                        onClick={() => { setPreviewType('transkrip'); setPreviewSignedUrl(null) }} 
                        className={`btn btn-sm ${previewType === 'transkrip' ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        Transkrip
                      </button>
                    </div>
                  </div>
                  <BaakDocPreview
                    selectedItem={selectedItem}
                    previewType={previewType}
                    previewSignedUrl={previewSignedUrl}
                    setPreviewSignedUrl={setPreviewSignedUrl}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Verification Side Panel */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Checklist Kelayakan Berkas</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>Periksa dokumen di sebelah kiri, kemudian tandai kriteria kelayakan di bawah:</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: 'pointer',
                  padding: '12px 14px', borderRadius: 8,
                  border: chkIjazah ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                  background: chkIjazah ? '#f0fdf4' : 'var(--surface)',
                  transition: 'all .15s ease'
                }}>
                  <input type="checkbox" checked={chkIjazah} onChange={() => setChkIjazah(!chkIjazah)} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>✅ Ijazah Terverifikasi</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Dokumen ijazah terbaca jelas, nama sesuai, dan memiliki tanda tangan/stempel sah.</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: 'pointer',
                  padding: '12px 14px', borderRadius: 8,
                  border: chkTranskrip ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                  background: chkTranskrip ? '#f0fdf4' : 'var(--surface)',
                  transition: 'all .15s ease'
                }}>
                  <input type="checkbox" checked={chkTranskrip} onChange={() => setChkTranskrip(!chkTranskrip)} style={{ width: 18, height: 18, accentColor: 'var(--success)' }} />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>✅ Transkrip Terverifikasi</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Transkrip menampilkan kode MK, SKS, dan nilai dengan jelas serta resolusi cukup untuk OCR.</div>
                  </div>
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={handleApprove}
                  disabled={!chkIjazah || !chkTranskrip}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', gap: 6, opacity: (!chkIjazah || !chkTranskrip) ? 0.5 : 1 }}
                >
                  <CheckCircle size={15} /> Setujui & Kirim ke Ka. Prodi
                </button>
                <button
                  onClick={handleReject}
                  className="btn btn-danger"
                  style={{ width: '100%', justifyContent: 'center', gap: 6 }}
                >
                  <XCircle size={15} /> Tolak Pengajuan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
