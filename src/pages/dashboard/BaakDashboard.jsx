import { useState, useEffect } from 'react'
import { dbPengajuan, dbPenetapan, getDocumentProgress } from '../../lib/db'
import { supabase, isMock } from '../../lib/supabase'
import { ClipboardCheck, FileText, CheckCircle, XCircle, Award, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'
import { exportToCSV } from '../../utils/exporter'
import AnalyticsTab from '../../components/AnalyticsTab'

// Helper: Preview component for BAAK with signed URL support
function BaakDocPreview({ selectedItem, fileUrl, previewType, previewSignedUrl, setPreviewSignedUrl }) {
  const [loading, setLoading] = useState(false)
  const isStoragePath = fileUrl && fileUrl.includes('/')

  useEffect(() => {
    if (!isMock && isStoragePath && !previewSignedUrl) {
      setLoading(true)
      supabase.storage
        .from('rpl-documents')
        .createSignedUrl(fileUrl, 3600)
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) setPreviewSignedUrl(data.signedUrl)
          else setPreviewSignedUrl(null)
        })
        .finally(() => setLoading(false))
    }
  }, [fileUrl, isStoragePath, previewSignedUrl])

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
          fileUrl,
          selectedItem.profile?.nama_lengkap || 'Calon Mahasiswa',
          selectedItem.prodi?.nama || '-'
        )}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}

// Helper to clean and format WhatsApp number link
function getWhatsAppUrl(num) {
  if (!num) return ''
  let cleaned = num.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1)
  }
  return `https://wa.me/${cleaned}`
}

export default function BaakDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewType, setPreviewType] = useState('ijazah')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewSignedUrl, setPreviewSignedUrl] = useState(null)

  // Verification Checklist State
  const [chkIjazah, setChkIjazah] = useState(false)
  const [chkTranskrip, setChkTranskrip] = useState(false)
  const [chkIjazahPt, setChkIjazahPt] = useState(false)
  const [chkTranskripPt, setChkTranskripPt] = useState(false)
  const [chkCertificates, setChkCertificates] = useState({})
  const [chkExperiences, setChkExperiences] = useState({})
  
  const [catatanRevisi, setCatatanRevisi] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [submitting, setSubmitting] = useState(false)

  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadSubmissions(true)
      toast.success('Data berhasil diperbarui!')
    } catch (e) {
      toast.error('Gagal memperbarui data')
    } finally {
      setRefreshing(false)
    }
  }

  const loadSubmissions = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      const allSubmissions = data || []
      
      const enriched = await Promise.all(
        allSubmissions.map(async (item) => {
          const { data: penData } = await dbPenetapan.getByPengajuanId(item.id)
          return {
            ...item,
            total_sks_diakui: penData ? penData.total_sks_diakui : 0,
            total_sks_sisa: penData ? penData.total_sks_sisa : 0,
            biaya_total: penData ? penData.biaya_total : 0,
            potongan_biaya: penData ? penData.potongan_biaya : 0
          }
        })
      )
      setSubmissions(enriched)
      setSelectedItem(null)
      // Reset checklists
      setChkIjazah(false)
      setChkTranskrip(false)
      setChkIjazahPt(false)
      setChkTranskripPt(false)
      setChkCertificates({})
      setChkExperiences({})
      setPreviewSignedUrl(null)
      setPreviewUrl('')
      setCatatanRevisi('')
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat daftar pengajuan')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
  }, [])

  useEffect(() => {
    if (selectedItem) {
      const isPending = selectedItem.status === 'submitted' || selectedItem.status === 'returned_kaprodi'
      const certs = selectedItem.sertifikat_kompetensi || []
      const exprs = selectedItem.pengalaman_kerja || []

      if (!isPending) {
        setChkIjazah(true)
        setChkTranskrip(true)
        setChkIjazahPt(true)
        setChkTranskripPt(true)
        
        const certMap = {}
        certs.forEach((_, idx) => { certMap[idx] = true })
        setChkCertificates(certMap)
        
        const exprMap = {}
        exprs.forEach((_, idx) => { exprMap[idx] = true })
        setChkExperiences(exprMap)
      } else {
        setChkIjazah(false)
        setChkTranskrip(false)
        setChkIjazahPt(false)
        setChkTranskripPt(false)
        setChkCertificates({})
        setChkExperiences({})
      }
      
      setCatatanRevisi(selectedItem.catatan_revisi || '')
      setPreviewType('ijazah')
      setPreviewUrl(selectedItem.file_ijazah_url || '')
      setPreviewSignedUrl(null)
    }
  }, [selectedItem])

  const toggleCertificateCheck = (idx) => {
    setChkCertificates(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }))
  }

  const toggleExperienceCheck = (idx) => {
    setChkExperiences(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }))
  }

  const handlePreviewFile = (type, url) => {
    setPreviewType(type)
    setPreviewUrl(url)
    setPreviewSignedUrl(null)
  }

  const handleApprove = async () => {
    if (!chkIjazah || !chkTranskrip) {
      toast.error('Berkas SMA (Ijazah & Transkrip) wajib dicentang!')
      return
    }
    if (!chkIjazahPt || !chkTranskripPt) {
      toast.error('Berkas Perguruan Tinggi (Ijazah & Transkrip) wajib dicentang!')
      return
    }

    // Validate certificates checklist
    const certs = selectedItem.sertifikat_kompetensi || []
    for (let i = 0; i < certs.length; i++) {
      if (!chkCertificates[i]) {
        toast.error(`Sertifikat "${certs[i].nama}" belum dicentang/diverifikasi!`)
        return
      }
    }

    // Validate experiences checklist
    const exprs = selectedItem.pengalaman_kerja || []
    for (let i = 0; i < exprs.length; i++) {
      if (!chkExperiences[i]) {
        toast.error(`Pengalaman kerja di "${exprs[i].perusahaan}" belum dicentang/diverifikasi!`)
        return
      }
    }

    setSubmitting(true)
    try {
      await dbPengajuan.updateStatus(selectedItem.id, 'validated_baak', '')
      toast.success('Pengajuan berhasil divalidasi dan diteruskan ke Ka. Prodi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memvalidasi pengajuan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturn = async () => {
    if (!catatanRevisi.trim()) {
      toast.error('Silakan isi catatan revisi / alasan pengembalian!')
      return
    }

    setSubmitting(true)
    try {
      await dbPengajuan.updateStatus(selectedItem.id, 'returned_baak', catatanRevisi)
      toast.success('Pengajuan dikembalikan ke calon mahasiswa untuk revisi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengembalikan pengajuan')
    } finally {
      setSubmitting(false)
    }
  }

  const pendingList = submissions.filter(item => item.status === 'submitted' || item.status === 'returned_kaprodi')
  const completedList = submissions.filter(item => ['validated_baak', 'recognized_kaprodi', 'assessed_asessor', 'mapped_admin'].includes(item.status))
  const returnedList = submissions.filter(item => item.status === 'returned_baak')

  const activeList = activeTab === 'pending' ? pendingList : activeTab === 'completed' ? completedList : returnedList

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  const isEditable = selectedItem && (selectedItem.status === 'submitted' || selectedItem.status === 'returned_kaprodi' || selectedItem.status === 'validated_baak')
  const canApprove = selectedItem && (selectedItem.status === 'submitted' || selectedItem.status === 'returned_kaprodi')

  // Approval Button State Check
  const allCertsChecked = selectedItem ? (selectedItem.sertifikat_kompetensi || []).every((_, idx) => !!chkCertificates[idx]) : true
  const allExprsChecked = selectedItem ? (selectedItem.pengalaman_kerja || []).every((_, idx) => !!chkExperiences[idx]) : true
  const approvalReady = chkIjazah && chkTranskrip && chkIjazahPt && chkTranskripPt && allCertsChecked && allExprsChecked

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 className="page-title">Validasi Berkas (BAAK)</h1>
          <p className="page-subtitle">Verifikasi keabsahan dokumen persyaratan masuk program RPL</p>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
        >
          <RotateCw size={14} className={refreshing ? 'spin-anim' : ''} /> 
          {refreshing ? 'Memuat...' : 'Refresh Data'}
        </button>
      </div>

      {!selectedItem ? (
        /* List submissions with tabs */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab Control */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('pending')}
              className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Menunggu Validasi ({pendingList.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`btn btn-sm ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Selesai Diproses ({completedList.length})
            </button>
            <button
              onClick={() => setActiveTab('returned')}
              className={`btn btn-sm ${activeTab === 'returned' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Direvisi Calon ({returnedList.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              📊 Analitik & Grafik
            </button>
          </div>

          {activeTab === 'analytics' ? (
            <AnalyticsTab submissions={submissions} />
          ) : (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                    {activeTab === 'pending' ? 'Daftar Pengajuan Masuk' : activeTab === 'completed' ? 'Daftar Pengajuan Selesai' : 'Daftar Pengajuan Dikembalikan'}
                  </h3>
                  <span className="badge-pill badge-indigo">{activeList.length} Pengajuan</span>
                </div>
                <button
                  onClick={() => exportToCSV(activeList, `laporan-rpl-baak-${activeTab}.csv`)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  📥 Ekspor Data (.CSV)
                </button>
              </div>
            <div className="card-body" style={{ padding: 0 }}>
              {activeList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📥</div>
                  <div className="empty-state-text">Tidak ada pengajuan</div>
                  <div className="empty-state-sub">Belum ada pengajuan untuk kategori ini.</div>
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
                        <th style={{ width: 150 }}>Progress Berkas</th>
                        <th>Status Internal</th>
                        <th style={{ width: 100 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeList.map(item => (
                        <tr key={item.id} style={{ borderLeft: item.status === 'returned_kaprodi' ? '4px solid var(--danger)' : '' }}>
                          <td>
                            <strong>{item.profile?.nama_lengkap}</strong>
                            {item.status === 'returned_kaprodi' && (
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>
                                ⚠️ Dikembalikan oleh Ka. Prodi: "{item.catatan_revisi}"
                              </span>
                            )}
                          </td>
                          <td>{item.profile?.email}</td>
                          <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                          <td>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td>
                            {(() => {
                              const prog = getDocumentProgress(item);
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--gray-500)' }}>
                                    <span>Berkas: {prog.percent}%</span>
                                  </div>
                                  <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden', display: 'flex', width: 120 }}>
                                    <div style={{ width: `${prog.percent}%`, background: prog.percent === 100 ? 'var(--success)' : 'var(--amber-500)', height: '100%', borderRadius: 2 }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td><span className={`badge-pill status-${item.status}`}>{item.status.toUpperCase()}</span></td>
                          <td>
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="btn btn-primary btn-sm"
                            >
                              {activeTab === 'pending' ? 'Periksa' : 'Lihat'}
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
        )}
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
                        <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Nomor WhatsApp</td>
                        <td style={{ padding: '4px 0' }}>
                          : {selectedItem.profile?.no_whatsapp ? (
                            <a 
                              href={getWhatsAppUrl(selectedItem.profile.no_whatsapp)}
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: '#10b981', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              💬 {selectedItem.profile.no_whatsapp}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Belum diisi</span>
                          )}
                        </td>
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
                  <div style={{ display: 'flex', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)', padding: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-700)', paddingLeft: 8 }}>
                      Pratinjau: {previewType.toUpperCase()}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selectedItem.file_ijazah_sma_url && (
                        <button 
                          onClick={() => handlePreviewFile('ijazah_sma', selectedItem.file_ijazah_sma_url)} 
                          className={`btn btn-sm ${previewType === 'ijazah_sma' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 11 }}
                        >
                          Ijazah SMA
                        </button>
                      )}
                      {selectedItem.file_transkrip_sma_url && (
                        <button 
                          onClick={() => handlePreviewFile('transkrip_sma', selectedItem.file_transkrip_sma_url)} 
                          className={`btn btn-sm ${previewType === 'transkrip_sma' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 11 }}
                        >
                          Transkrip SMA
                        </button>
                      )}
                      {selectedItem.file_ijazah_url && (
                        <button 
                          onClick={() => handlePreviewFile('ijazah', selectedItem.file_ijazah_url)} 
                          className={`btn btn-sm ${previewType === 'ijazah' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 11 }}
                        >
                          Ijazah D3
                        </button>
                      )}
                      {selectedItem.file_transkrip_url && (
                        <button 
                          onClick={() => handlePreviewFile('transkrip', selectedItem.file_transkrip_url)} 
                          className={`btn btn-sm ${previewType === 'transkrip' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 11 }}
                        >
                          Transkrip D3
                        </button>
                      )}
                      {selectedItem.sertifikat_kompetensi?.map((c, idx) => (
                        <button
                          key={`cert-${idx}`}
                          onClick={() => handlePreviewFile('sertifikat', c.file_url)}
                          className={`btn btn-sm ${previewType === 'sertifikat' && previewUrl === c.file_url ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Sertifikat {idx + 1}
                        </button>
                      ))}
                      {selectedItem.pengalaman_kerja?.map((ex, idx) => (
                        <button
                          key={`expr-${idx}`}
                          onClick={() => handlePreviewFile('pengalaman', ex.file_url)}
                          className={`btn btn-sm ${previewType === 'pengalaman' && previewUrl === ex.file_url ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Pengalaman {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                  <BaakDocPreview
                    selectedItem={selectedItem}
                    fileUrl={previewUrl}
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
              <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>Status Pemeriksaan Kelayakan Dokumen:</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: canApprove ? 'pointer' : 'default',
                  padding: '12px 14px', borderRadius: 8,
                  border: chkIjazah ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                  background: chkIjazah ? '#f0fdf4' : 'var(--surface)',
                  transition: 'all .15s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={chkIjazah}
                    disabled={!canApprove}
                    onChange={() => setChkIjazah(!chkIjazah)}
                    style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>✅ Ijazah SMA Terverifikasi</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Dokumen ijazah SMA terbaca jelas, nama sesuai, dan tanda tangan/stempel sah.</div>
                  </div>
                </label>
 
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: canApprove ? 'pointer' : 'default',
                  padding: '12px 14px', borderRadius: 8,
                  border: chkTranskrip ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                  background: chkTranskrip ? '#f0fdf4' : 'var(--surface)',
                  transition: 'all .15s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={chkTranskrip}
                    disabled={!canApprove}
                    onChange={() => setChkTranskrip(!chkTranskrip)}
                    style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>✅ Transkrip SMA Terverifikasi</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Transkrip SMA menampilkan mata kuliah, SKS, dan nilai dengan jelas.</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: canApprove ? 'pointer' : 'default',
                  padding: '12px 14px', borderRadius: 8,
                  border: chkIjazahPt ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                  background: chkIjazahPt ? '#f0fdf4' : 'var(--surface)',
                  transition: 'all .15s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={chkIjazahPt}
                    disabled={!canApprove}
                    onChange={() => setChkIjazahPt(!chkIjazahPt)}
                    style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>✅ Ijazah Perguruan Tinggi Terverifikasi</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Dokumen ijazah perguruan tinggi terbaca jelas, nama sesuai, dan tanda tangan/stempel sah.</div>
                  </div>
                </label>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: canApprove ? 'pointer' : 'default',
                  padding: '12px 14px', borderRadius: 8,
                  border: chkTranskripPt ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                  background: chkTranskripPt ? '#f0fdf4' : 'var(--surface)',
                  transition: 'all .15s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={chkTranskripPt}
                    disabled={!canApprove}
                    onChange={() => setChkTranskripPt(!chkTranskripPt)}
                    style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>✅ Transkrip Perguruan Tinggi Terverifikasi</div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Transkrip perguruan tinggi menampilkan mata kuliah, SKS, dan nilai dengan jelas.</div>
                  </div>
                </label>

                {/* Certificates Checklist */}
                {selectedItem.sertifikat_kompetensi?.map((c, idx) => {
                  const isChecked = !!chkCertificates[idx]
                  return (
                    <label key={`cert-chk-${idx}`} style={{
                      display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: canApprove ? 'pointer' : 'default',
                      padding: '12px 14px', borderRadius: 8,
                      border: isChecked ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                      background: isChecked ? '#f0fdf4' : 'var(--surface)',
                      transition: 'all .15s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!canApprove}
                        onChange={() => toggleCertificateCheck(idx)}
                        style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>🏆 Sertifikat: {c.nama}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Penerbit: {c.penerbit} ({c.tahun}). Keabsahan dokumen kompetensi valid.</div>
                      </div>
                    </label>
                  )
                })}

                {/* Experiences Checklist */}
                {selectedItem.pengalaman_kerja?.map((ex, idx) => {
                  const isChecked = !!chkExperiences[idx]
                  return (
                    <label key={`expr-chk-${idx}`} style={{
                      display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, cursor: canApprove ? 'pointer' : 'default',
                      padding: '12px 14px', borderRadius: 8,
                      border: isChecked ? '2px solid var(--success)' : '2px solid var(--gray-200)',
                      background: isChecked ? '#f0fdf4' : 'var(--surface)',
                      transition: 'all .15s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!canApprove}
                        onChange={() => toggleExperienceCheck(idx)}
                        style={{ width: 18, height: 18, accentColor: 'var(--success)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>💼 Pengalaman: {ex.posisi}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Perusahaan: {ex.perusahaan} ({ex.durasi}). Bukti/surat portofolio valid.</div>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Teks Catatan Revisi */}
              {isEditable && (
                <div className="input-group" style={{ marginTop: 10 }}>
                  <label className="input-label" style={{ fontWeight: 600 }}>Catatan Revisi / Alasan Pengembalian</label>
                  <textarea
                    value={catatanRevisi}
                    disabled={selectedItem.status === 'validated_baak' && !canApprove}
                    onChange={(e) => setCatatanRevisi(e.target.value)}
                    placeholder="Contoh: Lampiran transkrip nilai buram dan tidak terbaca."
                    className="input"
                    rows={3}
                    style={{ resize: 'none', padding: '8px 12px', fontSize: 12.5 }}
                  />
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {canApprove && (
                  <button
                    onClick={handleApprove}
                    disabled={!approvalReady || submitting}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', gap: 6, opacity: !approvalReady ? 0.5 : 1 }}
                  >
                    <CheckCircle size={15} /> Setujui & Kirim ke Ka. Prodi
                  </button>
                )}
                
                {isEditable ? (
                  <button
                    onClick={handleReturn}
                    disabled={submitting}
                    className="btn btn-danger"
                    style={{ width: '100%', justifyContent: 'center', gap: 6 }}
                  >
                    <XCircle size={15} /> Kembalikan ke Calon
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                    {selectedItem.status === 'mapped_admin' && (
                      <button
                        onClick={() => window.open(`/report/${selectedItem.id}/print`, '_blank')}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <FileText size={15} /> Cetak Rencana Studi (PDF)
                      </button>
                    )}
                    <div style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', textAlign: 'center', fontSize: 12, color: '#475569', fontWeight: 500 }}>
                      ℹ️ Pengajuan sudah diproses di tingkat Ka. Prodi / Asessor / Admin.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
