import { useState, useEffect } from 'react'
import { dbPengajuan, dbProdi, getDocumentProgress } from '../../lib/db'
import { supabase, isMock } from '../../lib/supabase'
import { Clipboard, Eye, Search, Filter, ShieldAlert, Award, FileText, CheckCircle, Clock, Users, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'

// Helper: Preview component for PMB
function PmbDocPreview({ selectedItem, fileUrl, previewType, previewSignedUrl, setPreviewSignedUrl }) {
  const [loading, setLoading] = useState(false)
  const isStoragePath = fileUrl && fileUrl.includes('/')

  useEffect(() => {
    setPreviewSignedUrl(null)
  }, [fileUrl])

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
      <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!isMock && isStoragePath && previewSignedUrl) {
    return (
      <div style={{ height: 420, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
        <iframe title="Pratinjau Dokumen PDF PMB" src={previewSignedUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    )
  }

  return (
    <div style={{ height: 420, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
      <iframe
        title="Pratinjau Dokumen PMB"
        srcDoc={generateMockDocSrcDoc(
          previewType,
          fileUrl,
          selectedItem?.profile?.nama_lengkap || 'Calon Mahasiswa',
          selectedItem?.prodi?.nama || '-'
        )}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}

// Helper to format duration to human readable format
function formatWaitingTime(submittedAtStr, finishedAtStr = null) {
  if (!submittedAtStr) return '-'
  const submittedAt = new Date(submittedAtStr)
  const end = finishedAtStr ? new Date(finishedAtStr) : new Date()
  const diffMs = end - submittedAt

  if (diffMs < 0) return 'Baru saja'

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays > 0) {
    const hoursPart = diffHours % 24
    return `${diffDays} Hari ${hoursPart > 0 ? `${hoursPart} Jam` : ''}`
  }
  if (diffHours > 0) {
    const minsPart = diffMins % 60
    return `${diffHours} Jam ${minsPart > 0 ? `${minsPart} Menit` : ''}`
  }
  if (diffMins > 0) {
    return `${diffMins} Menit`
  }
  return '1 Menit'
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

export default function PmbDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [prodis, setProdis] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProdi, setFilterProdi] = useState('')

  // Document preview states
  const [previewType, setPreviewType] = useState('ijazah_sma')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewName, setPreviewName] = useState('Ijazah SMA/Sederajat')
  const [previewSignedUrl, setPreviewSignedUrl] = useState(null)

  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadData(true)
      toast.success('Data berhasil diperbarui!')
    } catch (e) {
      toast.error('Gagal memperbarui data')
    } finally {
      setRefreshing(false)
    }
  }

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [submissionsRes, prodisRes] = await Promise.all([
        dbPengajuan.getAll(),
        dbProdi.getAll()
      ])
      
      // Filter out archived submissions for active monitoring
      const activeSubmissions = (submissionsRes.data || []).filter(s => !s.is_archived)
      setSubmissions(activeSubmissions)
      setProdis(prodisRes.data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data monitoring PMB')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedItem) {
      setPreviewType('ijazah_sma')
      setPreviewUrl(selectedItem.file_ijazah_sma_url || '')
      setPreviewName('Ijazah SMA/Sederajat')
      setPreviewSignedUrl(null)
    }
  }, [selectedItem])

  const getStatusLabel = (status) => {
    switch (status) {
      case 'draft':
        return { label: 'Draf Calon', color: 'badge-slate' }
      case 'submitted':
        return { label: 'Menunggu BAAK', color: 'badge-amber' }
      case 'returned_baak':
        return { label: 'Revisi ke Calon', color: 'badge-red' }
      case 'validated_baak':
        return { label: 'Proses Kaprodi', color: 'badge-indigo' }
      case 'returned_kaprodi':
        return { label: 'Revisi ke BAAK', color: 'badge-red' }
      case 'recognized_kaprodi':
        return { label: 'Proses Asessor', color: 'badge-indigo' }
      case 'returned_asessor':
        return { label: 'Revisi ke Kaprodi', color: 'badge-red' }
      case 'assessed_asessor':
        return { label: 'Proses Admin', color: 'badge-indigo' }
      case 'returned_admin':
        return { label: 'Revisi ke Asessor', color: 'badge-red' }
      case 'mapped_admin':
        return { label: 'Selesai / Final', color: 'badge-emerald' }
      default:
        return { label: status.toUpperCase(), color: 'badge-slate' }
    }
  }

  // ── Calculate Analytics ──────────────────────────────────────────
  const activeSubmissions = submissions.filter(s => s.status !== 'draft')
  const totalApplicants = submissions.length
  
  // Progress distribution
  const countDraft = submissions.filter(s => s.status === 'draft').length
  const countBaak = submissions.filter(s => s.status === 'submitted' || s.status === 'returned_kaprodi').length
  const countKaprodi = submissions.filter(s => s.status === 'validated_baak' || s.status === 'returned_asessor').length
  const countAsessor = submissions.filter(s => s.status === 'recognized_kaprodi' || s.status === 'returned_admin').length
  const countAdmin = submissions.filter(s => s.status === 'assessed_asessor').length
  const countFinal = submissions.filter(s => s.status === 'mapped_admin').length

  // Wait time calculation
  const submittedSubmissions = submissions.filter(s => s.submitted_at)
  let avgWaitTimeText = '-'
  if (submittedSubmissions.length > 0) {
    let totalWaitMs = 0
    let completedCount = 0
    submittedSubmissions.forEach((s) => {
      const submitted = new Date(s.submitted_at)
      const end = s.status === 'mapped_admin' ? new Date(s.updated_at) : new Date()
      totalWaitMs += (end - submitted)
      if (s.status === 'mapped_admin') completedCount++
    })
    const avgWaitMs = totalWaitMs / submittedSubmissions.length
    const avgDays = (avgWaitMs / 86400000).toFixed(1)
    avgWaitTimeText = `${avgDays} Hari`
  }

  // Filter list
  const filteredList = submissions.filter(item => {
    const matchesSearch = 
      item.profile?.nama_lengkap?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus ? item.status === filterStatus : true
    const matchesProdi = filterProdi ? item.prodi_pilihan_id === filterProdi : true

    return matchesSearch && matchesStatus && matchesProdi
  })

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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 className="page-title">Monitoring Berkas Pendaftaran (PMB)</h1>
          <p className="page-subtitle">Pantau progres pengunggahan dokumen calon pendaftar dan statistik waktu tunggu sistem</p>
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

      {/* Analytics Metric Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--indigo-50), var(--indigo-100))', borderColor: 'var(--indigo-200)' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, color: 'var(--indigo-600)' }}><Users size={20} /></div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Calon Terdaftar</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--indigo-900)', marginTop: 2 }}>{totalApplicants}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderColor: '#a7f3d0' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, color: '#059669' }}><CheckCircle size={20} /></div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Pendaftaran Selesai (Final)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', marginTop: 2 }}>{countFinal}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderColor: '#fde68a' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, color: '#d97706' }}><Clock size={20} /></div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Rata-rata Waktu Tunggu</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#78350f', marginTop: 2 }}>{avgWaitTimeText}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', borderBottom: '1px solid var(--gray-100)', paddingBottom: 4 }}>Penyebaran Progress</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11.5 }}>
              <div>Draf: <strong>{countDraft}</strong></div>
              <div>BAAK: <strong>{countBaak}</strong></div>
              <div>Prodi: <strong>{countKaprodi}</strong></div>
              <div>Asessor: <strong>{countAsessor}</strong></div>
              <div>Admin: <strong>{countAdmin}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {!selectedItem ? (
        /* Table monitoring list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters and search */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-alt)', border: '1px solid var(--gray-200)', padding: '6px 12px', borderRadius: 8, width: '100%', maxWidth: 300 }}>
                <Search size={15} color="var(--gray-400)" />
                <input 
                  type="text" 
                  placeholder="Cari nama atau email..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, width: '100%' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={13} color="var(--gray-400)" />
                  <select
                    value={filterProdi}
                    onChange={e => setFilterProdi(e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--gray-200)', fontSize: 12, background: 'var(--surface)', outline: 'none' }}
                  >
                    <option value="">Semua Prodi</option>
                    {prodis.map(p => (
                      <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                    ))}
                  </select>
                </div>

                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--gray-200)', fontSize: 12, background: 'var(--surface)', outline: 'none' }}
                >
                  <option value="">Semua Status</option>
                  <option value="draft">Draf Calon</option>
                  <option value="submitted">Menunggu BAAK</option>
                  <option value="validated_baak">Proses Kaprodi</option>
                  <option value="recognized_kaprodi">Proses Asessor</option>
                  <option value="assessed_asessor">Proses Admin</option>
                  <option value="mapped_admin">Selesai / Final</option>
                  <option value="returned_baak">Revisi BAAK</option>
                </select>
              </div>
            </div>

            <div className="card-body" style={{ padding: 0 }}>
              {filteredList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📂</div>
                  <div className="empty-state-text">Tidak ada calon pendaftar ditemukan</div>
                  <div className="empty-state-sub">Ubah filter atau masukkan pencarian lain.</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama Calon</th>
                        <th>Email</th>
                        <th>Prodi Pilihan</th>
                        <th>Status Alur RPL</th>
                        <th style={{ width: 180 }}>Progress Berkas Wajib</th>
                        <th style={{ width: 140 }}>Waktu Tunggu</th>
                        <th style={{ width: 100 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map(item => {
                        const statusMeta = getStatusLabel(item.status)
                        const docProg = getDocumentProgress(item)
                        
                        return (
                          <tr key={item.id}>
                            <td><strong>{item.profile?.nama_lengkap}</strong></td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.profile?.email}</td>
                            <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                            <td><span className={`badge-pill ${statusMeta.color}`}>{statusMeta.label}</span></td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700 }}>
                                  <span>Kelengkapan SMA</span>
                                  <span>{docProg.percent}%</span>
                                </div>
                                <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                                  <div style={{ width: `${docProg.percent}%`, background: docProg.percent === 100 ? 'var(--success)' : 'var(--amber-500)', height: '100%', borderRadius: 3 }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {item.status === 'draft' ? (
                                <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Belum Dikirim</span>
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Clock size={12} color="var(--gray-400)" />
                                  {formatWaitingTime(item.submitted_at, item.status === 'mapped_admin' ? item.updated_at : null)}
                                </span>
                              )}
                            </td>
                            <td>
                              <button onClick={() => setSelectedItem(item)} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                                <Eye size={12} /> Periksa
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Detail document preview and monitoring screen */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
          {/* Main Document Inspection Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Pemantauan Dokumen Calon</h3>
                <button onClick={() => setSelectedItem(null)} className="btn btn-secondary btn-sm">Kembali</button>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Biodata info */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 13 }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Informasi Pendaftaran:</strong>
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
                        <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Program Studi Tujuan</td>
                        <td style={{ padding: '4px 0' }}>: {selectedItem.prodi?.nama}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Status Saat Ini</td>
                        <td style={{ padding: '4px 0' }}>: <span className={`badge-pill ${getStatusLabel(selectedItem.status).color}`}>{getStatusLabel(selectedItem.status).label}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Document selector & preview iframe */}
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)', padding: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', paddingLeft: 8 }}>
                      Pratinjau: {previewName}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => { setPreviewType('ijazah_sma'); setPreviewUrl(selectedItem.file_ijazah_sma_url); setPreviewName('Ijazah SMA/Sederajat') }} 
                        className={`btn btn-sm ${previewType === 'ijazah_sma' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11 }}
                      >
                        Ijazah SMA
                      </button>
                      <button 
                        onClick={() => { setPreviewType('transkrip_sma'); setPreviewUrl(selectedItem.file_transkrip_sma_url); setPreviewName('Transkrip SMA/Sederajat') }} 
                        className={`btn btn-sm ${previewType === 'transkrip_sma' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: 11 }}
                      >
                        Transkrip SMA
                      </button>
                      {selectedItem.file_ijazah_url && (
                        <button 
                          onClick={() => { setPreviewType('ijazah'); setPreviewUrl(selectedItem.file_ijazah_url); setPreviewName('Ijazah Pendidikan Tinggi') }} 
                          className={`btn btn-sm ${previewType === 'ijazah' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 11 }}
                        >
                          Ijazah D3
                        </button>
                      )}
                      {selectedItem.file_transkrip_url && (
                        <button 
                          onClick={() => { setPreviewType('transkrip'); setPreviewUrl(selectedItem.file_transkrip_url); setPreviewName('Transkrip D1/D2/D3') }} 
                          className={`btn btn-sm ${previewType === 'transkrip' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: 11 }}
                        >
                          Transkrip D3
                        </button>
                      )}
                    </div>
                  </div>
                  <PmbDocPreview
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

          {/* Right Checklist Monitoring Panel */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Kelengkapan Berkas Calon</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Wajib Check 1 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: selectedItem.file_ijazah_sma_url ? '#f0fdf4' : '#fffbeb' }}>
                  <span style={{ fontSize: 16 }}>{selectedItem.file_ijazah_sma_url ? '✓' : '⏳'}</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Ijazah SMA/Sederajat</strong>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{selectedItem.file_ijazah_sma_url ? 'Sudah Diunggah' : 'Belum Ada'}</span>
                  </div>
                </div>

                {/* Wajib Check 2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: selectedItem.file_transkrip_sma_url ? '#f0fdf4' : '#fffbeb' }}>
                  <span style={{ fontSize: 16 }}>{selectedItem.file_transkrip_sma_url ? '✓' : '⏳'}</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Transkrip SMA/Sederajat</strong>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{selectedItem.file_transkrip_sma_url ? 'Sudah Diunggah' : 'Belum Ada'}</span>
                  </div>
                </div>

                {/* Opsional Check 1 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: selectedItem.file_ijazah_url ? '#f0fdf4' : 'var(--surface)' }}>
                  <span style={{ fontSize: 16 }}>{selectedItem.file_ijazah_url ? '✓' : '○'}</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Ijazah D1/D2/D3 (Opsional)</strong>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{selectedItem.file_ijazah_url ? 'Diunggah' : 'Tidak Ada'}</span>
                  </div>
                </div>

                {/* Opsional Check 2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: selectedItem.file_transkrip_url ? '#f0fdf4' : 'var(--surface)' }}>
                  <span style={{ fontSize: 16 }}>{selectedItem.file_transkrip_url ? '✓' : '○'}</span>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Transkrip D1/D2/D3 (Opsional)</strong>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{selectedItem.file_transkrip_url ? 'Diunggah' : 'Tidak Ada'}</span>
                  </div>
                </div>
              </div>

              {/* Sertifikat Kompetensi */}
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginTop: 4 }}>
                <strong style={{ display: 'block', fontSize: 12.5, marginBottom: 8 }}>Sertifikat Kompetensi:</strong>
                {(!selectedItem.sertifikat_kompetensi || selectedItem.sertifikat_kompetensi.length === 0) ? (
                  <span style={{ fontSize: 11.5, color: 'var(--gray-400)', fontStyle: 'italic' }}>Tidak ada sertifikat kompetensi yang dilampirkan.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedItem.sertifikat_kompetensi.map((c, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid var(--gray-200)' }}>
                        <Award size={13} style={{ color: 'var(--indigo-600)' }} />
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setPreviewType('sertifikat'); setPreviewUrl(c.file_url); setPreviewName(`Sertifikat: ${c.nama}`) }}
                          style={{ fontSize: 11.5, color: 'var(--indigo-600)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {c.nama} ({c.tahun})
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pengalaman Kerja */}
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginTop: 4 }}>
                <strong style={{ display: 'block', fontSize: 12.5, marginBottom: 8 }}>Pengalaman Kerja:</strong>
                {(!selectedItem.pengalaman_kerja || selectedItem.pengalaman_kerja.length === 0) ? (
                  <span style={{ fontSize: 11.5, color: 'var(--gray-400)', fontStyle: 'italic' }}>Tidak ada portofolio pengalaman kerja yang dilampirkan.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedItem.pengalaman_kerja.map((ex, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid var(--gray-200)' }}>
                        <FileText size={13} style={{ color: 'var(--indigo-600)' }} />
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setPreviewType('pengalaman'); setPreviewUrl(ex.file_url); setPreviewName(`Pengalaman: ${ex.posisi} di ${ex.perusahaan}`) }}
                          style={{ fontSize: 11.5, color: 'var(--indigo-600)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {ex.posisi} - {ex.perusahaan}
                        </a>
                      </div>
                    ))}
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
