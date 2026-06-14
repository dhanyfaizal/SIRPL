import { useState, useEffect } from 'react'
import { dbPengajuan, dbMK, dbRekognisi, dbPenetapan } from '../../lib/db'
import { BookOpen, FileText, CheckCircle, Percent, DollarSign, Calendar, Edit2, RotateCcw, AlertCircle, Eye, Settings, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [curriculumMK, setCurriculumMK] = useState([])
  
  // Penetapan Akhir State (inherited from Asessor)
  const [totalSksDiakui, setTotalSksDiakui] = useState(0)
  const [totalSksSisa, setTotalSksSisa] = useState(0)
  const [biayaAsessor, setBiayaAsessor] = useState(0) // Biaya awal sebelum diskon

  // Admin Discount inputs
  const [potonganBiaya, setPotonganBiaya] = useState(0)
  const [catatanPotongan, setCatatanPotongan] = useState('')

  // Rencana Studi Mapped state
  // Structure: { mkId, kode, nama, sks, jenis, jalur: 'asinkron' | 'sinkron', semester: 1 | 2 | 3 }
  const [mappedCourses, setMappedCourses] = useState([])

  // New state variables for revision, settings, and tabs
  const [activeTab, setActiveTab] = useState('need_action')
  const [maxLimit, setMaxLimit] = useState('70')
  const [catatanRevisi, setCatatanRevisi] = useState('')
  const [recRows, setRecRows] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: 'Konfirmasi',
    message: '',
    confirmText: 'Ya, Lanjutkan',
    onConfirm: null
  })

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      const allSubmissions = data || []
      
      // Load penetapan data for each submission to display the actual SKS
      const enriched = await Promise.all(
        allSubmissions.map(async (item) => {
          const { data: penData } = await dbPenetapan.getByPengajuanId(item.id)
          return {
            ...item,
            total_sks_diakui: penData ? penData.total_sks_diakui : 0,
            total_sks_sisa: penData ? penData.total_sks_sisa : 0,
            biaya_total: penData ? penData.biaya_total : 0
          }
        })
      )
      
      setSubmissions(enriched)
      setSelectedItem(null)
      setMappedCourses([])
      setPotonganBiaya(0)
      setCatatanPotongan('')
      setCatatanRevisi('')
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat daftar pengajuan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
    // Load max limit settings
    const saved = localStorage.getItem('si_rpl_max_recognition_limit')
    if (saved) {
      setMaxLimit(saved)
    } else {
      localStorage.setItem('si_rpl_max_recognition_limit', '70')
      setMaxLimit('70')
    }
  }, [])

  const handleSaveMaxLimit = () => {
    const parsed = parseFloat(maxLimit)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast.error('Batas maksimal harus berupa angka antara 0 hingga 100!')
      return
    }
    localStorage.setItem('si_rpl_max_recognition_limit', parsed.toString())
    toast.success(`Batas maksimal rekognisi berhasil diatur ke ${parsed}%!`)
  }

  const loadPenetapanInitial = async (pengajuanId, prodiId) => {
    try {
      // 1. Ambil kurikulum prodi terlebih dahulu
      const { data: currData } = await dbMK.getByProdi(prodiId)
      const curriculum = currData || []
      setCurriculumMK(curriculum)

      // 2. Ambil rekognisi matkul diakui
      const { data: recData } = await dbRekognisi.getByPengajuanId(pengajuanId)
      const diakuiIds = (recData?.data_mapping_mk || [])
        .filter(m => m.Status === 'diakui' || m.Status === 'disetujui')
        .map(m => m.MK_Tujuan_ID)

      // 3. Ambil biaya asesmen
      const { data: penData } = await dbPenetapan.getByPengajuanId(pengajuanId)
      if (penData) {
        setTotalSksDiakui(penData.total_sks_diakui)
        setTotalSksSisa(penData.total_sks_sisa)
        setBiayaAsessor(parseFloat(penData.biaya_total) || 0)
        setPotonganBiaya(parseFloat(penData.potongan_biaya) || 0)
        setCatatanPotongan(penData.catatan_potongan || '')
        
        // If rencana_studi is already saved, use it!
        if (penData.rencana_studi && penData.rencana_studi.length > 0) {
          setMappedCourses(penData.rencana_studi)
          return
        }
      } else {
        // Fallback defaults
        setTotalSksDiakui(0)
        setTotalSksSisa(curriculum.reduce((acc, curr) => acc + curr.sks, 0))
        setBiayaAsessor(0)
        setPotonganBiaya(0)
        setCatatanPotongan('')
      }

      // 4. Map sisa mata kuliah ke Jalur (MOOCs/Tatap Muka)
      // Auto mapping rule:
      // - jenis 'umum' -> 'asinkron' (MOOCs)
      // - jenis 'inti' -> 'sinkron' (Tatap Muka)
      const initialMapping = curriculum
        .filter(mk => !diakuiIds.includes(mk.id))
        .map((mk, idx) => ({
          mkId: mk.id,
          kode: mk.kode_mk,
          nama: mk.nama_mk,
          sks: mk.sks,
          jenis: mk.jenis,
          jalur: mk.jenis === 'umum' ? 'asinkron' : 'sinkron', // auto-mapping
          semester: Math.floor(idx / 4) + 1 // distribute across semesters
        }))
      setMappedCourses(initialMapping)
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat rincian penetapan')
    }
  }

  const loadRecognitionDetails = async (pengajuanId) => {
    try {
      const { data } = await dbRekognisi.getByPengajuanId(pengajuanId)
      if (data && data.data_mapping_mk) {
        setRecRows(data.data_mapping_mk)
      } else {
        setRecRows([])
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (selectedItem) {
      const pId = selectedItem.prodi_pilihan_id || selectedItem.prodi?.id
      loadPenetapanInitial(selectedItem.id, pId)
      loadRecognitionDetails(selectedItem.id)
      setCatatanRevisi(selectedItem.catatan_revisi || '')
    }
  }, [selectedItem])

  const updateCourseJalur = (mkId, jalur) => {
    setMappedCourses(mappedCourses.map(c => c.mkId === mkId ? { ...c, jalur } : c))
  }

  const updateCourseSemester = (mkId, semester) => {
    setMappedCourses(mappedCourses.map(c => c.mkId === mkId ? { ...c, semester: parseInt(semester) } : c))
  }

  // Cost calculations with discounts
  const finalBiayaTotal = Math.max(0, biayaAsessor - potonganBiaya)

  const handleFinalize = async () => {
    if (mappedCourses.length > 0) {
      const invalid = mappedCourses.find(c => !c.semester)
      if (invalid) {
        toast.error('Harap tentukan semester studi untuk semua mata kuliah sisa!')
        return
      }
    }

    setSubmitting(true)
    try {
      // 1. Simpan penetapan akhir beserta diskon dan rencana studi
      const finalPayload = {
        total_sks_diakui: totalSksDiakui,
        total_sks_sisa: totalSksSisa,
        biaya_total: finalBiayaTotal,
        potongan_biaya: parseFloat(potonganBiaya) || 0,
        catatan_potongan: catatanPotongan,
        rencana_studi: mappedCourses // Simpan mapping jalur matkul
      }

      await dbPenetapan.upsert(selectedItem.id, finalPayload)

      // 2. Update status pengajuan ke 'mapped_admin' (Fase Final)
      await dbPengajuan.updateStatus(selectedItem.id, 'mapped_admin', '')

      toast.success('Rencana Studi & Biaya berhasil difinalisasi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memfinalisasi dokumen ajuan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturnToAsessor = async () => {
    if (!catatanRevisi.trim()) {
      toast.error('Silakan isi catatan revisi / alasan pengembalian!')
      return
    }

    setSubmitting(true)
    try {
      await dbPengajuan.updateStatus(selectedItem.id, 'returned_admin', catatanRevisi)
      toast.success('Pengajuan dikembalikan ke Asessor untuk direvisi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengembalikan pengajuan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAllowResubmission = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Buka Pengajuan Baru',
      message: 'Apakah Anda yakin ingin membuka kembali pengajuan ini agar calon pendaftar dapat mengunggah berkas baru?',
      confirmText: 'Ya, Buka Akses',
      onConfirm: async () => {
        setSubmitting(true)
        try {
          await dbPengajuan.updateStatus(
            selectedItem.id,
            'returned_baak',
            'Dibuka kembali oleh Admin Akademik agar Anda dapat mengajukan berkas baru atau melakukan revisi.'
          )
          toast.success('Pengajuan berhasil dibuka kembali untuk Calon Pendaftar!')
          loadSubmissions()
        } catch (e) {
          console.error(e)
          toast.error('Gagal membuka kembali pengajuan')
        } finally {
          setSubmitting(false)
        }
      }
    })
  }

  const getStatusInfo = (status) => {
    switch (status) {
      case 'submitted':
        return { label: 'Menunggu Validasi BAAK', className: 'status-submitted' }
      case 'returned_baak':
        return { label: 'Direvisi ke Calon', className: 'badge-red' }
      case 'validated_baak':
        return { label: 'Divalidasi BAAK (Proses Kaprodi)', className: 'status-validated' }
      case 'returned_kaprodi':
        return { label: 'Direvisi ke BAAK', className: 'badge-red' }
      case 'recognized_kaprodi':
        return { label: 'Direkomendasi Kaprodi (Proses Asessor)', className: 'status-recognized' }
      case 'returned_asessor':
        return { label: 'Direvisi ke Kaprodi', className: 'badge-red' }
      case 'assessed_asessor':
        return { label: 'Dinilai Asessor (Menunggu Finalisasi)', className: 'status-assessed' }
      case 'returned_admin':
        return { label: 'Direvisi ke Asessor', className: 'badge-red' }
      case 'mapped_admin':
        return { label: 'Selesai (Rencana Studi Terbit)', className: 'status-mapped' }
      default:
        return { label: status.toUpperCase(), className: 'badge-slate' }
    }
  }

  // Filter lists based on states
  const needActionList = submissions.filter(item => item.status === 'assessed_asessor')
  const inProgressList = submissions.filter(item => ['submitted', 'returned_baak', 'validated_baak', 'returned_kaprodi', 'recognized_kaprodi', 'returned_asessor'].includes(item.status))
  const completedList = submissions.filter(item => item.status === 'mapped_admin')
  const returnedList = submissions.filter(item => item.status === 'returned_admin')

  const activeList = activeTab === 'need_action'
    ? needActionList
    : activeTab === 'in_progress'
    ? inProgressList
    : activeTab === 'completed'
    ? completedList
    : returnedList

  const isReadOnly = selectedItem && selectedItem.status !== 'assessed_asessor'

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
        <h1 className="page-title">Dashboard Admin RPL</h1>
        <p className="page-subtitle">Kelola pengajuan calon mahasiswa, finalisasi rencana studi & biaya, dan atur batasan sistem</p>
      </div>

      {!selectedItem ? (
        /* List submissions with tabs and settings card */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab Control */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8 }}>
            <button
              onClick={() => setActiveTab('need_action')}
              className={`btn btn-sm ${activeTab === 'need_action' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Perlu Finalisasi ({needActionList.length})
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`btn btn-sm ${activeTab === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Sedang Diproses ({inProgressList.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`btn btn-sm ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Selesai / Final ({completedList.length})
            </button>
            <button
              onClick={() => setActiveTab('returned')}
              className={`btn btn-sm ${activeTab === 'returned' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Direvisi ke Asessor ({returnedList.length})
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
            {/* Left Column: Submissions Table */}
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                  {activeTab === 'need_action'
                    ? 'Menunggu Finalisasi Jalur & Biaya'
                    : activeTab === 'in_progress'
                    ? 'Daftar Pengajuan Sedang Diproses'
                    : activeTab === 'completed'
                    ? 'Daftar Pengajuan Selesai'
                    : 'Daftar Pengajuan Dikembalikan ke Asessor'}
                </h3>
                <span className="badge-pill badge-indigo">{activeList.length} Pengajuan</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {activeList.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-text">Tidak ada pengajuan</div>
                    <div className="empty-state-sub">Belum ada pengajuan dalam kategori ini.</div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nama Pendaftar</th>
                          <th>Email</th>
                          <th>Prodi Pilihan</th>
                          <th>SKS Diakui</th>
                          <th>Status</th>
                          <th style={{ width: 120 }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeList.map(item => {
                          const statusInfo = getStatusInfo(item.status);
                          return (
                            <tr key={item.id}>
                              <td>
                                <strong>{item.profile?.nama_lengkap}</strong>
                                {item.status === 'returned_admin' && item.catatan_revisi && (
                                  <span style={{ display: 'block', fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>
                                    Alasan: "{item.catatan_revisi}"
                                  </span>
                                )}
                              </td>
                              <td>{item.profile?.email}</td>
                              <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                              <td><span style={{ fontWeight: 600 }}>{item.total_sks_diakui || 0} SKS</span></td>
                              <td><span className={`badge-pill ${statusInfo.className}`}>{statusInfo.label}</span></td>
                              <td>
                                <button
                                  onClick={() => setSelectedItem(item)}
                                  className="btn btn-primary btn-sm"
                                >
                                  {activeTab === 'need_action' ? 'Finalisasi' : 'Lihat Detail'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Settings Card */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
                  <Settings size={18} />
                  <h3 style={{ fontSize: 13, fontWeight: 700 }}>Konfigurasi Batas Rekognisi</h3>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="input-group">
                  <label className="input-label">Batas Maksimal Rekognisi SKS (%)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={maxLimit}
                      onChange={(e) => setMaxLimit(e.target.value)}
                      placeholder="Contoh: 70"
                      className="input"
                      min="0"
                      max="100"
                    />
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--gray-400)', fontSize: 13 }}>%</span>
                  </div>
                  <span className="input-hint">Pemberitahuan peringatan akan muncul di dashboard Asessor jika persentase SKS diakui melebihi batas ini.</span>
                </div>
                <button
                  onClick={handleSaveMaxLimit}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}
                >
                  Simpan Batas
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Details & Finalization Area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button onClick={() => setSelectedItem(null)} className="btn btn-secondary">
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Status Saat Ini:</span>
              <span className={`badge-pill ${getStatusInfo(selectedItem.status).className}`}>
                {getStatusInfo(selectedItem.status).label}
              </span>
            </div>
          </div>

          {/* Revision Banner if applicable */}
          {selectedItem.catatan_revisi && (
            <div style={{ background: 'var(--indigo-50)', padding: 14, borderRadius: 8, border: '1px solid var(--indigo-100)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertCircle size={18} style={{ color: 'var(--indigo-600)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo-700)', marginBottom: 2 }}>Catatan Revisi / Alasan Pengembalian Aktif:</h4>
                <p style={{ fontSize: 12.5, color: 'var(--gray-600)', whiteSpace: 'pre-wrap' }}>{selectedItem.catatan_revisi}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
            {/* Left Panel: Study Plan & Recognition Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Study Plan Mapping Card */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                    {isReadOnly ? 'Rencana Studi / Jalur Pembelajaran Sisa' : 'Pemetaan Jalur Rencana Studi'}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    Pendaftar: <strong>{selectedItem.profile?.nama_lengkap}</strong> ({selectedItem.prodi?.nama})
                  </span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {!['assessed_asessor', 'mapped_admin', 'returned_admin'].includes(selectedItem.status) ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
                      <BookOpen size={48} style={{ margin: '0 auto 12px', color: 'var(--gray-300)' }} />
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-700)' }}>Rencana Studi Belum Diterbitkan</p>
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                        Rencana studi dan penetapan biaya baru dapat dipetakan setelah pengajuan selesai dinilai oleh Asessor.
                      </p>
                    </div>
                  ) : mappedCourses.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)' }}>
                      Semua mata kuliah kurikulum diakui (0 SKS sisa untuk ditempuh).
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Mata Kuliah Sisa</th>
                            <th style={{ width: 60 }}>SKS</th>
                            <th>Jalur Pembelajaran</th>
                            <th style={{ width: 100 }}>Semester</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mappedCourses.map(course => (
                            <tr key={course.mkId}>
                              <td>
                                <span style={{ fontWeight: 600, display: 'block', fontSize: 12.5 }}>{course.nama}</span>
                                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{course.kode} · {course.jenis.toUpperCase()}</span>
                              </td>
                              <td>{course.sks} SKS</td>
                              <td>
                                {isReadOnly ? (
                                  <span style={{ fontWeight: 500, fontSize: 12.5 }}>
                                    {course.jalur === 'asinkron' ? '🌐 Asinkron (MOOCs)' : '🏫 Sinkron (Tatap Muka)'}
                                  </span>
                                ) : (
                                  <select
                                    value={course.jalur}
                                    onChange={(e) => updateCourseJalur(course.mkId, e.target.value)}
                                    style={{
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--gray-200)',
                                      background: 'var(--surface)',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="asinkron">🌐 Asinkron (MOOCs)</option>
                                    <option value="sinkron">🏫 Sinkron (Tatap Muka)</option>
                                  </select>
                                )}
                              </td>
                              <td>
                                {isReadOnly ? (
                                  <span style={{ fontWeight: 500, fontSize: 12.5 }}>
                                    Semester {course.semester}
                                  </span>
                                ) : (
                                  <select
                                    value={course.semester}
                                    onChange={(e) => updateCourseSemester(course.mkId, e.target.value)}
                                    style={{
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--gray-200)',
                                      background: 'var(--surface)',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                      outline: 'none'
                                    }}
                                  >
                                    <option value="1">Smt 1</option>
                                    <option value="2">Smt 2</option>
                                    <option value="3">Smt 3</option>
                                    <option value="4">Smt 4</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Mapped Recognition Table Results */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Hasil Penilaian Rekognisi Mata Kuliah</h3>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {recRows.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>
                      Belum ada mata kuliah yang dinilai/direkognisi oleh Asessor.
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Mata Kuliah Asal (Pendidikan/Pengalaman)</th>
                            <th style={{ width: 80 }}>SKS Asal</th>
                            <th>Mata Kuliah Kurikulum Tujuan</th>
                            <th style={{ width: 100 }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recRows.map((r, idx) => (
                            <tr key={idx}>
                              <td>
                                <span style={{ fontWeight: 600 }}>{r.MK_Asal}</span>
                                <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-400)' }}>Nilai: {r.Nilai}</span>
                              </td>
                              <td>{r.SKS_Asal} SKS</td>
                              <td>
                                <span style={{ fontWeight: 600 }}>{r.MK_Tujuan_Nama}</span>
                                <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-400)' }}>{r.MK_Tujuan_Kode} · {r.SKS_Tujuan} SKS</span>
                              </td>
                              <td>
                                <span className={`badge-pill ${r.Status === 'diakui' || r.Status === 'disetujui' ? 'badge-green' : 'badge-red'}`}>
                                  {r.Status === 'diakui' || r.Status === 'disetujui' ? 'DIAKUI' : 'DITOLAK'}
                                </span>
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

            {/* Right Panel: Finance / Diskon & Kembalikan ke Asessor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Cost Summary Card */}
              <div className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
                    <DollarSign size={18} />
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Penetapan & Diskon Biaya</h3>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Cost Summary Info */}
                  <div style={{ background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--gray-500)' }}>Biaya Awal Asessor:</span>
                      <strong>Rp{biayaAsessor.toLocaleString('id-ID')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--gray-500)' }}>SKS Diakui / Sisa:</span>
                      <span>{totalSksDiakui} SKS / {totalSksSisa} SKS</span>
                    </div>
                  </div>

                  {/* Discount input Form */}
                  <div className="input-group">
                    <label className="input-label">Diskon / Potongan Biaya (Rp)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--gray-400)', fontSize: 12 }}>Rp</span>
                      <input
                        type="number"
                        value={potonganBiaya || ''}
                        onChange={(e) => setPotonganBiaya(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="Masukkan nominal potongan"
                        className="input"
                        style={{ paddingLeft: 30 }}
                        disabled={isReadOnly || submitting}
                      />
                    </div>
                    <span className="input-hint">Pengurangan biaya kuliah paket (UKP) secara individu</span>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Catatan Alasan Potongan</label>
                    <textarea
                      value={catatanPotongan}
                      onChange={(e) => setCatatanPotongan(e.target.value)}
                      placeholder="Contoh: Beasiswa kemitraan khusus 20%"
                      className="input"
                      rows={2}
                      style={{ resize: 'none', padding: '8px 12px' }}
                      disabled={isReadOnly || submitting}
                    />
                  </div>

                  {/* Final Cost Calculation */}
                  <div style={{ borderTop: '2px solid var(--indigo-100)', paddingTop: 14, marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--gray-700)' }}>Total Biaya Akhir:</span>
                      <strong style={{ fontSize: 16, color: 'var(--success)' }}>Rp{finalBiayaTotal.toLocaleString('id-ID')}</strong>
                    </div>
                  </div>
                </div>

                <div className="card-footer">
                  {isReadOnly ? (
                    selectedItem.status === 'mapped_admin' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--success)', fontWeight: 700, padding: '6px 0', fontSize: 13 }}>
                        <CheckCircle size={16} /> Rencana Studi & Biaya Diterbitkan
                      </div>
                    ) : (
                      <div style={{ padding: '6px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 500 }}>
                        Hanya Baca (Tahapan {getStatusInfo(selectedItem.status).label})
                      </div>
                    )
                  ) : (
                    <button
                      onClick={handleFinalize}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', fontWeight: 700, gap: 6 }}
                      disabled={submitting}
                    >
                      <CheckCircle size={15} /> {submitting ? 'Memproses...' : 'Finalisasi & Terbitkan'}
                    </button>
                  )}
                </div>
              </div>

              {/* Kembalikan ke Asessor Flow (Only if assessed_asessor or mapped_admin or returned_admin) */}
              {['assessed_asessor', 'mapped_admin', 'returned_admin'].includes(selectedItem.status) && (
                <div className="card" style={{ border: '1px solid var(--danger)', background: '#fffafb' }}>
                  <div className="card-header" style={{ borderBottom: '1px solid #ffebeb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
                      <RotateCcw size={16} />
                      <h3 style={{ fontSize: 13, fontWeight: 700 }}>Kembalikan ke Asessor</h3>
                    </div>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      Jika ada penilaian mata kuliah atau rincian SKS yang diakui oleh Asessor perlu direvisi, tulis catatan revisi di bawah ini.
                    </p>
                    <div className="input-group">
                      <label className="input-label" style={{ color: 'var(--gray-700)' }}>Catatan Revisi / Alasan</label>
                      <textarea
                        value={catatanRevisi}
                        onChange={(e) => setCatatanRevisi(e.target.value)}
                        placeholder="Cth: Dokumen sertifikasi belum lengkap atau hitungan SKS diakui keliru..."
                        className="input"
                        rows={3}
                        style={{ resize: 'none', padding: '8px 12px', borderColor: 'var(--danger)', opacity: submitting ? 0.7 : 1 }}
                        disabled={submitting}
                      />
                    </div>
                    <button
                      onClick={handleReturnToAsessor}
                      className="btn btn-danger btn-sm"
                      style={{ justifyContent: 'center', fontWeight: 700 }}
                      disabled={submitting}
                    >
                      {submitting ? 'Memproses...' : 'Kembalikan ke Asessor'}
                    </button>
                  </div>
                </div>
              )}

              {/* Buka Akses Pengajuan Baru Card */}
              <div className="card" style={{ border: '1px solid var(--amber-500)', background: '#fffbeb', marginTop: 12 }}>
                <div className="card-header" style={{ borderBottom: '1px solid #fef3c7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309' }}>
                    <RotateCcw size={16} />
                    <h3 style={{ fontSize: 13, fontWeight: 700 }}>Buka Akses Pengajuan Baru</h3>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.4 }}>
                    Gunakan fitur ini untuk mengembalikan status berkas calon pendaftar ke **Revisi Dokumen (Calon Pendaftar)**. Calon pendaftar akan dapat mengedit formulir, mengunggah ijazah/transkrip baru, serta memperbarui berkas sertifikat dan pengalaman kerja mereka.
                  </p>
                  <button
                    onClick={handleAllowResubmission}
                    className="btn btn-warning btn-sm"
                    style={{ 
                      justifyContent: 'center', 
                      fontWeight: 700, 
                      background: '#d97706', 
                      color: '#fff', 
                      border: 'none',
                      padding: '8px 12px'
                    }}
                    disabled={submitting}
                  >
                    {submitting ? 'Memproses...' : 'Buka Pengajuan Baru (Reset)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{confirmModal.title}</h3>
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--gray-400)' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: 1.5, padding: '20px 24px' }}>
              {confirmModal.message}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 24px' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Batal
              </button>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal(prev => ({ ...prev, isOpen: false }))
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

