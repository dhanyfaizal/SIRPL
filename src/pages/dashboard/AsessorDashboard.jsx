import { useState, useEffect } from 'react'
import { dbPengajuan, dbMK, dbRekognisi, dbPenetapan, getDocumentProgress } from '../../lib/db'
import { GraduationCap, FileText, CheckCircle, Calculator, Info, Plus, Trash2, Award, Briefcase, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'
import { supabase, isMock } from '../../lib/supabase'

// Component: Preview component for Asessor with signed URL support
function AsessorDocPreview({ selectedItem, fileUrl, previewType, previewSignedUrl, setPreviewSignedUrl }) {
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
      <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!isMock && isStoragePath && previewSignedUrl) {
    return (
      <div style={{ height: 420, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
        <iframe title="Pratinjau Dokumen PDF Asessor" src={previewSignedUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    )
  }

  return (
    <div style={{ height: 420, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
      <iframe
        title="Pratinjau Dokumen Asessor"
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


export default function AsessorDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [curriculumMK, setCurriculumMK] = useState([])

  // State Table Rows (reviewed from Kaprodi)
  // Structure: { id, mkAsal, sksAsal, nilaiAsal, mkTujuanId, sksTujuan, statusTujuan, isCertified, kategoriAsal }
  const [rows, setRows] = useState([])

  const [activeTab, setActiveTab] = useState('pending')
  const [catatanRevisi, setCatatanRevisi] = useState('')
  const [showReturnInput, setShowReturnInput] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Document preview states
  const [previewType, setPreviewType] = useState('transkrip')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewName, setPreviewName] = useState('Transkrip Nilai')
  const [previewSignedUrl, setPreviewSignedUrl] = useState(null)
  const [activeRowId, setActiveRowId] = useState(null)

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
      setSubmissions(data || [])
      setSelectedItem(null)
      setRows([])
      setCatatanRevisi('')
      setShowReturnInput(false)
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

  const loadCurriculum = async (prodiId) => {
    try {
      const { data } = await dbMK.getByProdi(prodiId)
      setCurriculumMK(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (selectedItem) {
      const pId = selectedItem.prodi_pilihan_id || selectedItem.prodi?.id
      loadCurriculum(pId)
      loadRecognitionTable(selectedItem.id)
      setCatatanRevisi(selectedItem.catatan_revisi || '')
      setPreviewType('transkrip')
      setPreviewUrl(selectedItem.file_transkrip_url || '')
      setPreviewName('Transkrip Nilai')
      setPreviewSignedUrl(null)
      setActiveRowId(null)
    }
  }, [selectedItem])

  const loadRecognitionTable = async (pengajuanId) => {
    try {
      const { data } = await dbRekognisi.getByPengajuanId(pengajuanId)
      if (data && data.data_mapping_mk) {
        // Map ke internal state
        const initialRows = data.data_mapping_mk.map((item, idx) => ({
          id: 'row-rec-' + idx + '-' + Date.now(),
          mkAsal: item.MK_Asal,
          sksAsal: item.SKS_Asal,
          nilaiAsal: item.Nilai,
          mkTujuanId: item.MK_Tujuan_ID,
          sksTujuan: item.SKS_Tujuan,
          statusTujuan: item.Status === 'diakui' || item.Status === 'disetujui' ? 'disetujui' : 'ditolak',
          kategoriAsal: item.Kategori_Asal || 'transkrip'
        }))
        setRows(initialRows)
      }
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data tabel rekognisi')
    }
  }

  // Row Click Handler to update preview panel PDF
  const handleRowClick = (row) => {
    setActiveRowId(row.id)
    if (row.kategoriAsal === 'transkrip' || !row.kategoriAsal) {
      setPreviewType('transkrip')
      setPreviewUrl(selectedItem?.file_transkrip_url || '')
      setPreviewName('Transkrip Nilai')
      setPreviewSignedUrl(null)
    } else if (row.kategoriAsal === 'sertifikat') {
      const certs = selectedItem?.sertifikat_kompetensi || []
      const matched = certs.find(c => c.nama === row.mkAsal) || certs[0]
      if (matched) {
        setPreviewType('sertifikat')
        setPreviewUrl(matched.file_url || '')
        setPreviewName(matched.nama || 'Sertifikat Kompetensi')
        setPreviewSignedUrl(null)
      } else {
        setPreviewType('sertifikat')
        setPreviewUrl('')
        setPreviewName('Sertifikat Kompetensi')
        setPreviewSignedUrl(null)
      }
    } else if (row.kategoriAsal === 'pengalaman') {
      const exprs = selectedItem?.pengalaman_kerja || []
      const matched = exprs.find(ex => `${ex.posisi} di ${ex.perusahaan}` === row.mkAsal) || exprs[0]
      if (matched) {
        setPreviewType('pengalaman')
        setPreviewUrl(matched.file_url || '')
        setPreviewName(`${matched.posisi} - ${matched.perusahaan}`)
        setPreviewSignedUrl(null)
      } else {
        setPreviewType('pengalaman')
        setPreviewUrl('')
        setPreviewName('Pengalaman Kerja')
        setPreviewSignedUrl(null)
      }
    }
  }

  // Row Manipulation (Justifikasi Portofolio Baru)
  const addPortfolioRow = () => {
    setRows([
      ...rows,
      {
        id: 'row-port-' + Date.now(),
        mkAsal: 'Sertifikasi / Portofolio Pengalaman',
        sksAsal: 0,
        nilaiAsal: 'A',
        mkTujuanId: '',
        sksTujuan: 0,
        statusTujuan: 'disetujui',
        isCertified: true,
        kategoriAsal: 'sertifikat'
      }
    ])
  }

  const deleteRow = (id) => {
    setRows(rows.filter(r => r.id !== id))
  }

  const updateRowField = (id, field, value) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        let extra = {}
        if (field === 'mkTujuanId') {
          const matchedMK = curriculumMK.find(mk => mk.id === value)
          extra = { sksTujuan: matchedMK ? matchedMK.sks : 0 }
        }
        return { ...r, [field]: value, ...extra }
      }
      return r
    }))
  }

  // Financial Calculators
  const BIAYA_UKP = 5400000 // Uang Kuliah Paket Semester
  const BIAYA_PER_SKS_REKOGNISI = 50000

  // Filter rows that are approved ('disetujui')
  const approvedRows = rows.filter(r => r.statusTujuan === 'disetujui' && r.mkTujuanId)
  
  // Total SKS diakui
  const totalSksDiakui = approvedRows.reduce((acc, curr) => acc + (parseInt(curr.sksTujuan) || 0), 0)

  // Total SKS Kurikulum (seluruh MK prodi)
  const totalSksKurikulum = curriculumMK.reduce((acc, curr) => acc + curr.sks, 0)
  const totalSksSisa = Math.max(0, totalSksKurikulum - totalSksDiakui)

  // Financial calculation
  const biayaPengakuan = totalSksDiakui * BIAYA_PER_SKS_REKOGNISI
  const biayaTotalAwal = BIAYA_UKP + biayaPengakuan

  const maxRecognitionLimit = parseFloat(localStorage.getItem('si_rpl_max_recognition_limit') || '70')
  const recognitionPercentage = totalSksKurikulum > 0 ? (totalSksDiakui / totalSksKurikulum) * 100 : 0
  const isLimitExceeded = recognitionPercentage > maxRecognitionLimit

  const handleSubmitToAdmin = async () => {
    if (rows.length === 0) {
      toast.error('Minimal harus ada 1 entri rekognisi untuk dinilai')
      return
    }

    const invalidRow = rows.find(r => r.statusTujuan === 'disetujui' && (!r.mkAsal || !r.mkTujuanId))
    if (invalidRow) {
      toast.error('Harap lengkapi mata kuliah asal dan tujuan untuk semua baris yang disetujui!')
      return
    }

    setSubmitting(true)
    try {
      // 1. Simpan perubahan review ke tabel rekognisi
      const recognitionPayload = {
        data_mapping_mk: rows.map(r => {
          const matchMK = curriculumMK.find(mk => mk.id === r.mkTujuanId)
          return {
            MK_Asal: r.mkAsal,
            SKS_Asal: parseInt(r.sksAsal) || 0,
            Nilai: r.nilaiAsal,
            MK_Tujuan_ID: r.mkTujuanId,
            MK_Tujuan_Kode: matchMK?.kode_mk || '',
            MK_Tujuan_Nama: matchMK?.nama_mk || '',
            SKS_Tujuan: matchMK?.sks || 0,
            Status: r.statusTujuan === 'disetujui' ? 'diakui' : 'ditolak',
            Kategori_Asal: r.kategoriAsal || 'transkrip'
          }
        }),
        is_manual_edited: true
      }
      await dbRekognisi.upsert(selectedItem.id, recognitionPayload)

      // 2. Simpan kalkulasi biaya ke tabel penetapan_akhir
      const penetapanPayload = {
        total_sks_diakui: totalSksDiakui,
        total_sks_sisa: totalSksSisa,
        biaya_total: biayaTotalAwal,
        potongan_biaya: 0, // Admin yang akan memasukkan jika ada potongan
        catatan_potongan: '',
        rencana_studi: [] // Admin yang akan memetakan semester
      }
      await dbPenetapan.upsert(selectedItem.id, penetapanPayload)

      // 3. Update status pengajuan ke 'recognized_kaprodi' -> 'assessed_asessor'
      await dbPengajuan.updateStatus(selectedItem.id, 'assessed_asessor')

      toast.success('Asesmen & kalkulasi biaya berhasil dikirim ke Admin!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memproses penilaian asesmen')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturnToKaprodi = async () => {
    if (!catatanRevisi.trim()) {
      toast.error('Silakan isi catatan revisi / alasan pengembalian!')
      return
    }

    setSubmitting(true)
    try {
      await dbPengajuan.updateStatus(selectedItem.id, 'returned_asessor', catatanRevisi)
      toast.success('Pengajuan berhasil dikembalikan ke Ka. Prodi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengembalikan pengajuan')
    } finally {
      setSubmitting(false)
    }
  }

  const pendingList = submissions.filter(item => item.status === 'recognized_kaprodi' || item.status === 'returned_admin')
  const completedList = submissions.filter(item => ['assessed_asessor', 'mapped_admin'].includes(item.status))
  const returnedList = submissions.filter(item => item.status === 'returned_asessor')

  const activeList = activeTab === 'pending' ? pendingList : activeTab === 'completed' ? completedList : returnedList

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 className="page-title">Asesmen Akademik & Kalkulasi (Asessor)</h1>
          <p className="page-subtitle">Verifikasi pemetaan rekognisi, tambahkan portofolio, dan kalkulasi biaya awal</p>
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
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8 }}>
            <button
              onClick={() => setActiveTab('pending')}
              className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Menunggu Penilaian ({pendingList.length})
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
              Direvisi Ka. Prodi ({returnedList.length})
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                {activeTab === 'pending' ? 'Menunggu Asesmen Portofolio' : activeTab === 'completed' ? 'Asesmen Selesai' : 'Pengajuan Dikembalikan ke Ka. Prodi'}
              </h3>
              <span className="badge-pill badge-indigo">{activeList.length} Pengajuan</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {activeList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">⚖️</div>
                  <div className="empty-state-text">Tidak ada pengajuan</div>
                  <div className="empty-state-sub">Belum ada pengajuan masuk untuk kategori ini.</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama Pendaftar</th>
                        <th>Email</th>
                        <th>Prodi Tujuan</th>
                        <th style={{ width: 130 }}>Progress Berkas</th>
                        <th>Status Internal</th>
                        <th style={{ width: 120 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeList.map(item => (
                        <tr key={item.id} style={{ borderLeft: item.status === 'returned_admin' ? '4px solid var(--danger)' : '' }}>
                          <td>
                            <strong>{item.profile?.nama_lengkap}</strong>
                            {item.status === 'returned_admin' && (
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>
                                ⚠️ Dikembalikan oleh Admin: "{item.catatan_revisi}"
                              </span>
                            )}
                          </td>
                          <td>{item.profile?.email}</td>
                          <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                          <td>
                            {(() => {
                              const prog = getDocumentProgress(item);
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: 'var(--gray-500)' }}>
                                    <span>Berkas: {prog.percent}%</span>
                                  </div>
                                  <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 2, overflow: 'hidden', display: 'flex', width: 100 }}>
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
                              {activeTab === 'pending' ? 'Mulai Asesmen' : 'Lihat'}
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
        </div>
      ) : (
        /* Assessment Area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Warning Banner if returned from Admin */}
          {selectedItem.status === 'returned_admin' && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: '#fff5f5' }}>
              <div className="card-body">
                <h4 style={{ color: '#c53030', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '14px', fontWeight: 700 }}>
                  ⚠️ Pengajuan Dikembalikan oleh Admin untuk Revisi
                </h4>
                <p style={{ color: '#742a2a', fontSize: '13px', marginTop: 8, marginBottom: 0 }}>
                  Catatan Admin: <strong>{selectedItem.catatan_revisi || 'Harap perbaiki penilaian Anda.'}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Header Card */}
          <div className="card" style={{ background: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--indigo-600)', fontWeight: 700, textTransform: 'uppercase' }}>Asesmen RPL Aktif</span>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--indigo-700)', margin: '2px 0 0 0' }}>{selectedItem.profile?.nama_lengkap}</h2>
                <p style={{ fontSize: 12.5, color: 'var(--gray-600)', margin: 0 }}>Prodi Tujuan: {selectedItem.prodi?.nama}</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {(selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin') && (
                  <button onClick={() => setShowReturnInput(v => !v)} className="btn btn-danger btn-sm">
                    Kembalikan ke Ka. Prodi
                  </button>
                )}
                <button onClick={() => setSelectedItem(null)} className="btn btn-secondary btn-sm">Batal</button>
              </div>
            </div>
          </div>

          {/* Return to Kaprodi Input Card */}
          {showReturnInput && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#c53030' }}>Kembalikan Pengajuan ke Ka. Prodi</h4>
                <textarea
                  value={catatanRevisi}
                  onChange={(e) => setCatatanRevisi(e.target.value)}
                  placeholder="Masukkan alasan pengembalian untuk diperbaiki Ka. Prodi..."
                  className="input"
                  rows={2}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleReturnToKaprodi} disabled={submitting} className="btn btn-danger btn-sm">Kirim Pengembalian</button>
                  <button onClick={() => setShowReturnInput(false)} className="btn btn-secondary btn-sm">Batal</button>
                </div>
              </div>
            </div>
          )}

          {/* SKS Recognition Limit warning alert */}
          {isLimitExceeded && (
            <div className="card" style={{ borderLeft: '4px solid var(--amber-500)', backgroundColor: '#fffbeb' }}>
              <div className="card-body">
                <h4 style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '13.5px', fontWeight: 700 }}>
                  ⚠️ Peringatan: Batas Rekognisi Terlampaui
                </h4>
                <p style={{ color: '#92400e', fontSize: '12.5px', marginTop: 6, marginBottom: 0 }}>
                  Persentase perolehan rekognisi SKS calon mahasiswa ini saat ini adalah <strong>{recognitionPercentage.toFixed(1)}%</strong> ({totalSksDiakui} dari {totalSksKurikulum} SKS), yang mana telah melampaui batas maksimal yang dikonfigurasi yaitu <strong>{maxRecognitionLimit}%</strong>. Harap tinjau kembali kelayakan pemetaan mata kuliah.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr 320px', gap: 20, alignItems: 'start' }}>
            {/* Column 1: PDF Preview Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
              <div className="card">
                <div className="card-header" style={{ display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--gray-200)', padding: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Dokumen Pendukung</h3>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>
                    Pratinjau: {previewName} ({previewType.toUpperCase()})
                  </div>
                </div>
                <div style={{ display: 'flex', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)', padding: 8, gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setPreviewType('transkrip')
                      setPreviewUrl(selectedItem?.file_transkrip_url || '')
                      setPreviewName('Transkrip Nilai')
                      setPreviewSignedUrl(null)
                    }}
                    className={`btn btn-sm ${previewType === 'transkrip' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    📄 Transkrip
                  </button>
                  <button
                    onClick={() => {
                      setPreviewType('ijazah')
                      setPreviewUrl(selectedItem?.file_ijazah_url || '')
                      setPreviewName('Ijazah')
                      setPreviewSignedUrl(null)
                    }}
                    className={`btn btn-sm ${previewType === 'ijazah' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                  >
                    🎓 Ijazah
                  </button>
                  {selectedItem?.sertifikat_kompetensi?.map((c, idx) => (
                    <button
                      key={`cert-preview-${idx}`}
                      onClick={() => {
                        setPreviewType('sertifikat')
                        setPreviewUrl(c.file_url)
                        setPreviewName(c.nama)
                        setPreviewSignedUrl(null)
                      }}
                      className={`btn btn-sm ${previewType === 'sertifikat' && previewUrl === c.file_url ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      🏆 Sertifikat {idx + 1}
                    </button>
                  ))}
                  {selectedItem?.pengalaman_kerja?.map((ex, idx) => (
                    <button
                      key={`expr-preview-${idx}`}
                      onClick={() => {
                        setPreviewType('pengalaman')
                        setPreviewUrl(ex.file_url)
                        setPreviewName(`${ex.posisi} di ${ex.perusahaan}`)
                        setPreviewSignedUrl(null)
                      }}
                      className={`btn btn-sm ${previewType === 'pengalaman' && previewUrl === ex.file_url ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      💼 Kerja {idx + 1}
                    </button>
                  ))}
                </div>
                <div className="card-body" style={{ padding: 12 }}>
                  <AsessorDocPreview
                    selectedItem={selectedItem}
                    fileUrl={previewUrl}
                    previewType={previewType}
                    previewSignedUrl={previewSignedUrl}
                    setPreviewSignedUrl={setPreviewSignedUrl}
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Main Table Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card">
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Evaluasi Transkrip & Justifikasi Portofolio</h3>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Pendaftar: <strong>{selectedItem.profile?.nama_lengkap}</strong> ({selectedItem.prodi?.nama})</span>
                  </div>
                  {(selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin') ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addPortfolioRow} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                        <Plus size={14} /> Tambah Portofolio/Sertifikasi
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', background: 'var(--gray-100)', padding: '6px 12px', borderRadius: 6 }}>
                      Modus Lihat (Read-Only)
                    </span>
                  )}
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Mata Kuliah / Portofolio Asal</th>
                          <th style={{ width: 60 }}>Nilai</th>
                          <th>Mata Kuliah Kurikulum</th>
                          <th style={{ width: 120 }}>Keputusan</th>
                          {selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin' ? <th style={{ width: 60 }}>Aksi</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => {
                          const isActive = activeRowId === row.id
                          return (
                            <tr 
                              key={row.id} 
                              onClick={() => handleRowClick(row)}
                              style={{ 
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                background: isActive 
                                  ? 'var(--indigo-50)' 
                                  : row.statusTujuan === 'ditolak' 
                                    ? '#fee2e2' 
                                    : '',
                                outline: isActive ? '2px solid var(--indigo-400)' : '',
                                outlineOffset: '-2px'
                              }}
                            >
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {row.isCertified && (selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin') ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onClick={e => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        value={row.mkAsal}
                                        onChange={(e) => updateRowField(row.id, 'mkAsal', e.target.value)}
                                        className="input"
                                        style={{ padding: '6px 10px' }}
                                      />
                                      <select
                                        value={row.kategoriAsal || 'sertifikat'}
                                        onChange={(e) => updateRowField(row.id, 'kategoriAsal', e.target.value)}
                                        style={{
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          border: '1px solid var(--gray-200)',
                                          background: 'var(--surface)',
                                          fontSize: '11px',
                                          outline: 'none'
                                        }}
                                      >
                                        <option value="sertifikat">🏆 Sertifikat</option>
                                        <option value="pengalaman">💼 Kerja</option>
                                        <option value="transkrip">📄 Transkrip</option>
                                      </select>
                                    </div>
                                  ) : (
                                    <>
                                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{row.mkAsal}</span>
                                      <div>
                                        <span className={`badge-pill ${
                                          row.kategoriAsal === 'sertifikat' ? 'badge-green' :
                                          row.kategoriAsal === 'pengalaman' ? 'badge-amber' :
                                          'badge-indigo'
                                        }`} style={{ fontSize: '10px' }}>
                                          {row.kategoriAsal === 'sertifikat' ? '🏆 Sertifikat' :
                                           row.kategoriAsal === 'pengalaman' ? '💼 Kerja' :
                                           '📄 Transkrip'}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td>
                                {row.isCertified && (selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin') ? (
                                  <input
                                    type="text"
                                    value={row.nilaiAsal}
                                    onChange={(e) => updateRowField(row.id, 'nilaiAsal', e.target.value)}
                                    className="input"
                                    style={{ padding: '6px 10px' }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span style={{ fontSize: 12.5 }}>{row.nilaiAsal}</span>
                                )}
                              </td>
                              <td>
                                {row.isCertified && (selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin') ? (
                                  <select
                                    value={row.mkTujuanId}
                                    onChange={(e) => updateRowField(row.id, 'mkTujuanId', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      width: '100%',
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--gray-200)',
                                      background: 'var(--surface)',
                                      fontSize: '12.5px',
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="">-- Pilih MK Kurikulum --</option>
                                    {curriculumMK.map(mk => (
                                      <option key={mk.id} value={mk.id}>{mk.kode_mk} - {mk.nama_mk} ({mk.sks} SKS)</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>
                                    {curriculumMK.find(mk => mk.id === row.mkTujuanId)?.nama_mk || 'Belum Dipetakan'}
                                  </span>
                                )}
                              </td>
                              <td>
                                <select
                                  value={row.statusTujuan}
                                  disabled={!(selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin')}
                                  onChange={(e) => updateRowField(row.id, 'statusTujuan', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--gray-200)',
                                    background: 'var(--surface)',
                                    fontSize: '12.5px',
                                    fontWeight: 600,
                                    color: row.statusTujuan === 'disetujui' ? '#065f46' : '#991b1b'
                                  }}
                                >
                                  <option value="disetujui">✅ Diakui</option>
                                  <option value="ditolak">❌ Ditolak</option>
                                </select>
                              </td>
                              {(selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin') && (
                                <td>
                                  {row.isCertified ? (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteRow(row.id)
                                      }} 
                                      className="btn btn-ghost btn-icon" 
                                      style={{ color: 'var(--danger)' }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Kaprodi</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Financial Calculation Side Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Calculation Card */}
              <div className="card">
                <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
                    <Calculator size={18} />
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Rincian Biaya Kuliah</h3>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 12.5 }}>
                    
                    {/* SKS Limit Gauge */}
                    <div style={{ background: isLimitExceeded ? '#fff1f2' : '#f0fdf4', border: isLimitExceeded ? '1px solid #fecaca' : '1px solid #bbf7d0', padding: 12, borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: isLimitExceeded ? '#991b1b' : '#166534', marginBottom: 4 }}>
                        <span>Persentase Rekognisi:</span>
                        <span>{recognitionPercentage.toFixed(1)}%</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>Batas Maksimal: {maxRecognitionLimit}% ({totalSksDiakui} / {totalSksKurikulum} SKS)</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--gray-500)' }}>Total SKS Diakui:</span>
                      <strong>{totalSksDiakui} SKS</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--gray-500)' }}>SKS Harus Ditempuh:</span>
                      <strong>{totalSksSisa} SKS</strong>
                    </div>

                    <div style={{ borderTop: '1px solid var(--gray-100)', padding: '10px 0 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--gray-600)', fontWeight: 500 }}>Uang Kuliah Paket (UKP)</span>
                        <span>Rp5.400.000</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Flat per semester (Rp900.000/bln x 6)</span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--gray-600)', fontWeight: 500 }}>Biaya Pengakuan RPL</span>
                        <span>Rp{biayaPengakuan.toLocaleString('id-ID')}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{totalSksDiakui} SKS x Rp50.000/SKS</span>
                    </div>

                    <div style={{ borderTop: '2px solid var(--indigo-100)', padding: '12px 0 0', marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                        <strong style={{ color: 'var(--gray-800)' }}>Total Biaya Awal:</strong>
                        <strong style={{ color: 'var(--indigo-700)', fontSize: 15 }}>Rp{biayaTotalAwal.toLocaleString('id-ID')}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, padding: 10, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, marginTop: 16 }}>
                    <Info size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 11, color: '#0369a1', margin: 0, lineHeight: 1.4 }}>
                      Admin Akademik berhak memberikan diskon / pengurangan biaya individu di tahap berikutnya.
                    </p>
                  </div>
                </div>
                {(selectedItem.status === 'recognized_kaprodi' || selectedItem.status === 'returned_admin') && (
                  <div className="card-footer">
                    <button
                      onClick={handleSubmitToAdmin}
                      disabled={submitting}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}
                    >
                      Kirim Rekomendasi Biaya
                    </button>
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
