import { useState, useEffect } from 'react'
import { dbPengajuan, dbProdi, dbPenetapan, getDocumentProgress } from '../../lib/db'
import { LayoutDashboard, RefreshCw, Filter, ShieldAlert, Eye, Clock, Search, BarChart3, List } from 'lucide-react'
import toast from 'react-hot-toast'
import AnalyticsTab from '../../components/AnalyticsTab'

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
  return `${diffMins > 0 ? diffMins : 1} Menit`
}

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [prodis, setProdis] = useState([])

  // Tab State
  const [activeTab, setActiveTab] = useState('statistics') // 'statistics' or 'applicants'
  const [searchQuery, setSearchQuery] = useState('')

  // Filter States
  const [selectedProdi, setSelectedProdi] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Selected Item for Detail modal
  const [selectedItem, setSelectedItem] = useState(null)

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [submissionsRes, prodisRes] = await Promise.all([
        dbPengajuan.getAll(),
        dbProdi.getAll()
      ])

      const rawSubmissions = (submissionsRes.data || []).filter(s => !s.is_archived)
      
      // Enrich with cost & conversion data from penetapan_akhir
      const enriched = await Promise.all(
        rawSubmissions.map(async (item) => {
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
      setProdis(prodisRes.data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data eksekutif pimpinan')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
        return { label: status ? status.toUpperCase() : '-', color: 'badge-slate' }
    }
  }

  // Filter logic
  const filteredSubmissions = submissions.filter(s => {
    const matchProdi = selectedProdi === 'all' || s.prodi?.nama === selectedProdi
    
    let matchStatus = true
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'draft') {
        matchStatus = s.status === 'draft'
      } else if (selectedStatus === 'baak') {
        matchStatus = ['submitted', 'returned_kaprodi'].includes(s.status)
      } else if (selectedStatus === 'kaprodi') {
        matchStatus = ['validated_baak', 'returned_asessor'].includes(s.status)
      } else if (selectedStatus === 'asessor') {
        matchStatus = ['recognized_kaprodi', 'returned_admin'].includes(s.status)
      } else if (selectedStatus === 'admin') {
        matchStatus = s.status === 'assessed_asessor'
      } else if (selectedStatus === 'mapped') {
        matchStatus = s.status === 'mapped_admin'
      }
    }

    return matchProdi && matchStatus
  })

  // Search logic for list tab
  const finalFilteredSubmissions = filteredSubmissions.filter(s => {
    const nameMatch = s.profile?.nama_lengkap?.toLowerCase().includes(searchQuery.toLowerCase())
    const emailMatch = s.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    return nameMatch || emailMatch
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Memuat Laporan Eksekutif...</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <LayoutDashboard size={24} style={{ color: 'var(--indigo-600)' }} />
            Dashboard Pimpinan (Rektor / Dekan)
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: 13 }}>
            Ringkasan Eksekutif, Analisis SLA Evaluasi, & Statistik Pengajuan RPL STIKOM Yos Sudarso
          </p>
        </div>

        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </button>
      </div>

      {/* Interactive Filters Panel */}
      <div className="card" style={{ marginBottom: 24, border: '1px solid var(--gray-200)', background: 'var(--surface)' }}>
        <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} style={{ color: 'var(--gray-500)' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--gray-700)' }}>Filter Data Eksekutif:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Prodi Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Program Studi:</label>
              <select
                value={selectedProdi}
                onChange={(e) => setSelectedProdi(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-200)',
                  background: 'var(--surface)',
                  color: 'var(--gray-700)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Semua Program Studi</option>
                {prodis.map(p => (
                  <option key={p.id} value={p.nama}>{p.nama}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Tahapan Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-200)',
                  background: 'var(--surface)',
                  color: 'var(--gray-700)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Semua Tahapan</option>
                <option value="draft">Draf</option>
                <option value="baak">Proses Validasi BAAK</option>
                <option value="kaprodi">Proses Evaluasi Kaprodi</option>
                <option value="asessor">Proses Asesmen Asessor</option>
                <option value="admin">Proses Finalisasi Admin</option>
                <option value="mapped">Rencana Studi Terbit</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--gray-200)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`btn ${activeTab === 'statistics' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <BarChart3 size={16} />
          Analisis & Statistik
        </button>
        <button
          onClick={() => setActiveTab('applicants')}
          className={`btn ${activeTab === 'applicants' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <List size={16} />
          Progres Pendaftar ({finalFilteredSubmissions.length})
        </button>
      </div>

      {/* Tab Panels */}
      {filteredSubmissions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', border: '1px solid var(--gray-200)' }}>
          <ShieldAlert size={48} style={{ color: 'var(--gray-400)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-700)' }}>Tidak Ada Data Cocok</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 6, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Tidak ada pengajuan RPL yang cocok dengan kombinasi filter Program Studi dan Tahapan Status terpilih saat ini.
          </p>
        </div>
      ) : activeTab === 'statistics' ? (
        /* Render Analytics Panel */
        <AnalyticsTab submissions={filteredSubmissions} />
      ) : (
        /* Render Applicants list panel */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Search bar inside list tab */}
          <div className="card" style={{ border: '1px solid var(--gray-200)', background: 'var(--surface)' }}>
            <div className="card-body" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--gray-200)' }}>
                <Search size={16} style={{ color: 'var(--gray-400)' }} />
                <input
                  type="text"
                  placeholder="Cari nama calon pendaftar atau email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    width: '100%',
                    fontSize: 13,
                    color: 'var(--gray-800)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Applicants Table */}
          {finalFilteredSubmissions.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', border: '1px solid var(--gray-200)' }}>
              <p style={{ color: 'var(--gray-500)', fontSize: 13, margin: 0 }}>
                Tidak ada nama pendaftar yang cocok dengan pencarian "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="card" style={{ border: '1px solid var(--gray-200)', background: 'var(--surface)' }}>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama Calon</th>
                        <th>Email</th>
                        <th>Prodi Pilihan</th>
                        <th>Status Alur RPL</th>
                        <th style={{ width: 180 }}>Progress Berkas Wajib</th>
                        <th style={{ width: 100, textAlign: 'center' }}>SKS Diakui</th>
                        <th style={{ width: 140 }}>Waktu Tunggu</th>
                        <th style={{ width: 100 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalFilteredSubmissions.map(item => {
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
                                  <span>Progres Berkas</span>
                                  <span>{docProg.percent}%</span>
                                </div>
                                <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                                  <div style={{ width: `${docProg.percent}%`, background: docProg.percent === 100 ? 'var(--success)' : 'var(--amber-500)', height: '100%', borderRadius: 3 }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                              {item.total_sks_diakui > 0 ? `${item.total_sks_diakui} SKS` : '-'}
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
                                <Eye size={12} /> Detail
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal Overlay */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: 640,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--gray-200)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,.15), 0 10px 10px -5px rgba(0,0,0,.04)'
          }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--gray-100)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Detail Pengajuan & Progres RPL</h3>
              <button onClick={() => setSelectedItem(null)} className="btn btn-secondary btn-sm">Tutup</button>
            </div>
            
            <div className="card-body" style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Profil Calon */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', marginTop: 0, marginBottom: 12 }}>Identitas Mahasiswa:</h4>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: 140, padding: '4px 0', color: 'var(--gray-500)' }}>Nama Lengkap</td>
                      <td style={{ padding: '4px 0' }}>: <strong>{selectedItem.profile?.nama_lengkap}</strong></td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Email</td>
                      <td style={{ padding: '4px 0' }}>: {selectedItem.profile?.email}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>WhatsApp</td>
                      <td style={{ padding: '4px 0' }}>: {selectedItem.profile?.no_whatsapp || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Prodi Pilihan</td>
                      <td style={{ padding: '4px 0' }}>: <span className="badge-pill badge-slate">{selectedItem.prodi?.nama}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Status & SLA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 14 }}>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Status Saat Ini</span>
                  <div style={{ marginTop: 6 }}>
                    <span className={`badge-pill ${getStatusLabel(selectedItem.status).color}`} style={{ fontSize: 12, padding: '4px 10px' }}>
                      {getStatusLabel(selectedItem.status).label}
                    </span>
                  </div>
                </div>
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 14 }}>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Waktu Tunggu Alur</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                    <Clock size={14} color="var(--gray-400)" />
                    {formatWaitingTime(selectedItem.submitted_at, selectedItem.status === 'mapped_admin' ? selectedItem.updated_at : null)}
                  </span>
                </div>
              </div>

              {/* Dokumen Kelengkapan */}
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', marginTop: 0, marginBottom: 12 }}>Checklist Dokumen Portofolio:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Ijazah SMA/Sederajat (Wajib)</span>
                    <span style={{ fontWeight: 600, color: selectedItem.file_ijazah_sma_url ? 'var(--success)' : 'var(--danger)' }}>
                      {selectedItem.file_ijazah_sma_url ? '✓ Diunggah' : '✗ Belum Ada'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Transkrip Nilai Perguruan Tinggi Sebelumnya</span>
                    <span style={{ fontWeight: 600, color: selectedItem.file_transkrip_url ? 'var(--success)' : 'var(--gray-400)' }}>
                      {selectedItem.file_transkrip_url ? '✓ Diunggah' : '- Kosong'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Sertifikat Kompetensi / Pelatihan</span>
                    <span style={{ fontWeight: 600, color: (selectedItem.sertifikat_kompetensi || []).length > 0 ? 'var(--success)' : 'var(--gray-400)' }}>
                      {(selectedItem.sertifikat_kompetensi || []).length > 0 ? `✓ ${(selectedItem.sertifikat_kompetensi || []).length} Berkas` : '- Kosong'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Surat Keterangan Pengalaman Kerja</span>
                    <span style={{ fontWeight: 600, color: (selectedItem.pengalaman_kerja || []).length > 0 ? 'var(--success)' : 'var(--gray-400)' }}>
                      {(selectedItem.pengalaman_kerja || []).length > 0 ? `✓ ${(selectedItem.pengalaman_kerja || []).length} Riwayat` : '- Kosong'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hasil Rekognisi SKS & Biaya */}
              <div style={{ background: '#ecfdf5', padding: 16, borderRadius: 8, border: '1px solid #a7f3d0' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginTop: 0, marginBottom: 12 }}>Hasil Penetapan Akhir Akademik:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#047857', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Total SKS Diakui</span>
                    <strong style={{ fontSize: 16, color: '#065f46' }}>{selectedItem.total_sks_diakui || 0} SKS</strong>
                  </div>
                  <div>
                    <span style={{ color: '#047857', display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Biaya Kuliah Hasil Konversi</span>
                    <strong style={{ fontSize: 16, color: '#065f46' }}>
                      {selectedItem.biaya_total > 0 ? `Rp ${new Intl.NumberFormat('id-ID').format(selectedItem.biaya_total)}` : 'Rp 0'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid var(--gray-100)', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
              <button onClick={() => setSelectedItem(null)} className="btn btn-secondary">Tutup Ringkasan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
