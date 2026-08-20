import { useState, useEffect } from 'react'
import { dbPengajuan, dbProdi, dbPenetapan, dbMK, dbRekognisi, dbNotifikasi, getDocumentProgress } from '../../lib/db'
import { supabase, isMock } from '../../lib/supabase'
import { Clipboard, Eye, Search, Filter, ShieldAlert, Award, FileText, CheckCircle, Clock, Users, RotateCw, DollarSign, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'
import { exportToCSV } from '../../utils/exporter'
import AnalyticsTab from '../../components/AnalyticsTab'

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

  if (!fileUrl) {
    return (
      <div style={{ 
        height: 420, 
        background: '#f8fafc', 
        border: '1px solid var(--gray-200)', 
        borderRadius: 8, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        color: 'var(--gray-500)', 
        gap: 8 
      }}>
        <span style={{ fontSize: 32 }}>📂</span>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--gray-600)' }}>Data Tidak Tersedia</div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Berkas belum diunggah oleh calon pendaftar</div>
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

function getWhatsAppUrl(num) {
  if (!num) return ''
  let cleaned = num.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1)
  }
  return `https://wa.me/${cleaned}`
}

function distributeCoursesToStudySemesters(courses) {
  // 1. Group courses by original curriculum semester (ganjil/genap)
  const oddCourses = []
  const evenCourses = []
  
  courses.forEach(c => {
    const origSem = c.semester || 1
    if (origSem % 2 !== 0) {
      oddCourses.push(c)
    } else {
      evenCourses.push(c)
    }
  })

  // Sort by original semester ascending
  oddCourses.sort((a, b) => (a.semester || 1) - (b.semester || 1))
  evenCourses.sort((a, b) => (a.semester || 1) - (b.semester || 1))

  // 2. Distribute:
  // - Ganjil courses go to Smt 1 and Smt 3.
  // - Genap courses go to Smt 2 and Smt 4.
  const smt1 = []
  const smt3 = []
  const smt2 = []
  const smt4 = []

  oddCourses.forEach(c => {
    const origSem = c.semester || 1
    if (origSem <= 3) {
      smt1.push(c)
    } else {
      smt3.push(c)
    }
  })

  evenCourses.forEach(c => {
    const origSem = c.semester || 2
    if (origSem <= 4) {
      smt2.push(c)
    } else {
      smt4.push(c)
    }
  })

  // 3. Map jalur and respect max 24 SKS sinkron per study semester
  const mapJalurForSemester = (list, targetSemester) => {
    let currentSinkronSks = 0
    return list.map(c => {
      const name = c.nama.toLowerCase()
      const isMoocDefault = c.jenis === 'umum' || 
                            name.includes('pengantar') || 
                            name.includes('dasar') || 
                            name.includes('etika') || 
                            name.includes('kewirausahaan') || 
                            name.includes('pancasila') || 
                            name.includes('bahasa')
      
      let jalur = c.jalur || (isMoocDefault ? 'asinkron' : 'sinkron')
      if (jalur === 'sinkron') {
        if (currentSinkronSks + c.sks <= 24) {
          currentSinkronSks += c.sks
        } else {
          jalur = 'asinkron'
        }
      }

      return {
        ...c,
        semester: targetSemester,
        jalur
      }
    })
  }

  return [
    ...mapJalurForSemester(smt1, 1),
    ...mapJalurForSemester(smt2, 2),
    ...mapJalurForSemester(smt3, 3),
    ...mapJalurForSemester(smt4, 4)
  ]
}

export default function PmbDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [prodis, setProdis] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'analytics'
  
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

  // Pricing & Discount States
  const [totalSksDiakui, setTotalSksDiakui] = useState(0)
  const [totalSksSisa, setTotalSksSisa] = useState(0)
  const [potonganBiaya, setPotonganBiaya] = useState(0)
  const [catatanPotongan, setCatatanPotongan] = useState('')
  const [potonganBiayaPendukung, setPotonganBiayaPendukung] = useState(0)
  const [catatanPotonganPendukung, setCatatanPotonganPendukung] = useState('')
  const [monthlyPaymentStatus, setMonthlyPaymentStatus] = useState('none')

  // Configurations for fee components
  const [configUkp, setConfigUkp] = useState(5400000)
  const [configRekognisi, setConfigRekognisi] = useState(50000)
  const [configMoocs, setConfigMoocs] = useState(100000)
  const [configPendukung, setConfigPendukung] = useState(1000000)
  const [maxLimit, setMaxLimit] = useState('70')

  // Mapped courses (for MOOCs count)
  const [mappedCourses, setMappedCourses] = useState([])
  const [submitting, setSubmitting] = useState(false)

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
      
      const rawSubmissions = (submissionsRes.data || []).filter(s => !s.is_archived)
      const enriched = await Promise.all(
        rawSubmissions.map(async (item) => {
          const { data: penData } = await dbPenetapan.getByPengajuanId(item.id)
          return {
            ...item,
            total_sks_diakui: penData ? penData.total_sks_diakui : 0,
            total_sks_sisa: penData ? penData.total_sks_sisa : 0,
            biaya_total: penData ? penData.biaya_total : 0,
            potongan_biaya: penData ? penData.potongan_biaya : 0,
            monthly_payment_status: penData ? (penData.monthly_payment_status || 'none') : 'none'
          }
        })
      )
      setSubmissions(enriched)
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
    
    // Load config settings from localStorage
    const savedLimit = localStorage.getItem('si_rpl_max_recognition_limit')
    if (savedLimit) setMaxLimit(savedLimit)
    else {
      localStorage.setItem('si_rpl_max_recognition_limit', '70')
      setMaxLimit('70')
    }

    const savedUkp = localStorage.getItem('si_rpl_biaya_ukp_semester')
    if (savedUkp) setConfigUkp(parseFloat(savedUkp))
    else {
      localStorage.setItem('si_rpl_biaya_ukp_semester', '5400000')
      setConfigUkp(5400000)
    }

    const savedRekognisi = localStorage.getItem('si_rpl_biaya_rekognisi_sks')
    if (savedRekognisi) setConfigRekognisi(parseFloat(savedRekognisi))
    else {
      localStorage.setItem('si_rpl_biaya_rekognisi_sks', '50000')
      setConfigRekognisi(50000)
    }

    const savedMoocs = localStorage.getItem('si_rpl_biaya_moocs_mk')
    if (savedMoocs) setConfigMoocs(parseFloat(savedMoocs))
    else {
      localStorage.setItem('si_rpl_biaya_moocs_mk', '100000')
      setConfigMoocs(100000)
    }

    const savedPendukung = localStorage.getItem('si_rpl_biaya_pendukung')
    if (savedPendukung) setConfigPendukung(parseFloat(savedPendukung))
    else {
      localStorage.setItem('si_rpl_biaya_pendukung', '1000000')
      setConfigPendukung(1000000)
    }
  }, [])

  const loadPenetapanDetails = async (pengajuanId, prodiId) => {
    try {
      // 1. Ambil kurikulum prodi terlebih dahulu
      const { data: currData } = await dbMK.getByProdi(prodiId)
      const curriculum = currData || []

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
        setPotonganBiaya(parseFloat(penData.potongan_biaya) || 0)
        setCatatanPotongan(penData.catatan_potongan || '')
        setPotonganBiayaPendukung(parseFloat(penData.potongan_biaya_pendukung) || 0)
        setCatatanPotonganPendukung(penData.catatan_potongan_pendukung || '')
        setMonthlyPaymentStatus(penData.monthly_payment_status || 'none')
        
        // If rencana_studi is already saved, use it!
        if (penData.rencana_studi && penData.rencana_studi.length > 0) {
          setMappedCourses(penData.rencana_studi)
          return
        }
      } else {
        // Fallback defaults
        setTotalSksDiakui(0)
        setTotalSksSisa(curriculum.reduce((acc, curr) => acc + curr.sks, 0))
        setPotonganBiaya(0)
        setCatatanPotongan('')
        setPotonganBiayaPendukung(0)
        setCatatanPotonganPendukung('')
        setMonthlyPaymentStatus('none')
      }

      // 4. Map sisa mata kuliah ke Jalur (MOOCs/Tatap Muka)
      const rawMapping = curriculum
        .filter(mk => !diakuiIds.includes(mk.id))
        .map((mk) => ({
          mkId: mk.id,
          kode: mk.kode_mk,
          nama: mk.nama_mk,
          sks: mk.sks,
          jenis: mk.jenis,
          semester: mk.semester || 1
        }))
      
      const initialMapping = distributeCoursesToStudySemesters(rawMapping)
      setMappedCourses(initialMapping)
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat rincian penetapan')
    }
  }

  useEffect(() => {
    if (selectedItem) {
      setPreviewType('ijazah_sma')
      setPreviewUrl(selectedItem.file_ijazah_sma_url || '')
      setPreviewName('Ijazah SMA/Sederajat')
      setPreviewSignedUrl(null)
      
      // Load pricing and discount details
      const pId = selectedItem.prodi_pilihan_id || selectedItem.prodi?.id
      loadPenetapanDetails(selectedItem.id, pId)
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

  // Dynamic cost calculations based on user requirements
  const biayaUkp = 4 * configUkp // UKP 4 semesters
  const biayaRekognisi = totalSksDiakui * configRekognisi
  const totalMoocs = mappedCourses.filter(c => c.jalur === 'asinkron').length
  const biayaMoocs = totalMoocs * configMoocs
  const biayaPendukung = configPendukung
  const biayaTotalSebelumPotongan = biayaUkp + biayaRekognisi + biayaMoocs + biayaPendukung
  const finalBiayaTotal = Math.max(0, biayaTotalSebelumPotongan - (4 * potonganBiaya) - potonganBiayaPendukung)

  const handleSaveDiscount = async () => {
    setSubmitting(true)
    try {
      const finalPayload = {
        total_sks_diakui: totalSksDiakui,
        total_sks_sisa: totalSksSisa,
        biaya_total: finalBiayaTotal,
        potongan_biaya: parseFloat(potonganBiaya) || 0,
        catatan_potongan: catatanPotongan,
        potongan_biaya_pendukung: parseFloat(potonganBiayaPendukung) || 0,
        catatan_potongan_pendukung: catatanPotonganPendukung,
        rencana_studi: mappedCourses
      }

      await dbPenetapan.upsert(selectedItem.id, finalPayload)
      
      // Notify candidate
      await dbNotifikasi.create(
        selectedItem.user_id,
        'Pembaruan Potongan Biaya RPL',
        `Biaya perkuliahan RPL Anda telah diperbarui dengan diskon tambahan oleh PMB Officer. Silakan cek detail biaya baru Anda.`,
        'mapped_admin',
        '/dashboard'
      )

      toast.success('Diskon biaya berhasil diperbarui dan dikirim ke calon!')
      
      // Reload submissions lists and update selectedItem so the list gets updated costs.
      await loadData(true)
      
      // Update selectedItem local properties so UI re-renders with fresh data
      setSelectedItem(prev => ({
        ...prev,
        biaya_total: finalBiayaTotal,
        potongan_biaya: parseFloat(potonganBiaya) || 0
      }))
    } catch (e) {
      console.error(e)
      toast.error('Gagal memperbarui diskon biaya')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMonthlyPaymentApproval = async (isApproved) => {
    setSubmitting(true)
    try {
      const payload = {
        monthly_payment_status: isApproved ? 'approved' : 'rejected',
        is_monthly_payment: isApproved
      }
      const { error: upsertError } = await dbPenetapan.upsert(selectedItem.id, payload)
      if (upsertError) throw upsertError
      
      // Notify candidate
      const { error: notifError } = await dbNotifikasi.create(
        selectedItem.user_id,
        isApproved ? 'Pembiayaan Bulanan Disetujui' : 'Pembiayaan Bulanan Ditolak',
        isApproved 
          ? 'Pengajuan opsi Pembiayaan Bulanan Anda telah disetujui. Rincian biaya studi Anda kini dihitung per bulan.'
          : 'Pengajuan opsi Pembiayaan Bulanan Anda ditolak. Rincian biaya studi tetap dihitung per semester.',
        'monthly_payment',
        '/dashboard'
      )
      if (notifError) throw notifError

      toast.success(isApproved ? 'Pembiayaan bulanan berhasil disetujui!' : 'Pembiayaan bulanan ditolak.')
      
      // Refresh list
      await loadData(true)
      
      // Update selectedItem local properties so UI re-renders with fresh data
      setSelectedItem(prev => ({
        ...prev,
        monthly_payment_status: isApproved ? 'approved' : 'rejected'
      }))
      
      // Update local state
      setMonthlyPaymentStatus(isApproved ? 'approved' : 'rejected')
    } catch (e) {
      console.error(e)
      toast.error('Gagal memproses permohonan pembiayaan')
    } finally {
      setSubmitting(false)
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
          {/* Tab Control */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8, marginBottom: 8 }}>
            <button
              onClick={() => setActiveTab('list')}
              className={`btn btn-sm ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              📋 Daftar Calon Mahasiswa
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
            <>
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

                <button
                  onClick={() => exportToCSV(filteredList, 'laporan-rpl-pmb.csv')}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  📥 Ekspor Data (.CSV)
                </button>
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
                                  <span>Progres Berkas</span>
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
                                <Eye size={12} /> Detail
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
        </>
        )}
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

          {/* Right Column Wrapper */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Right Checklist Monitoring Panel */}
            <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Kelengkapan Berkas Calon</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Wajib Check 1 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: '#fff' }}>
                  <FileText size={20} color={selectedItem.file_ijazah_sma_url ? '#10b981' : '#9ca3af'} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Ijazah SMA/Sederajat</strong>
                    <span style={{ fontSize: 11, color: selectedItem.file_ijazah_sma_url ? '#10b981' : '#9ca3af', fontWeight: 500 }}>
                      {selectedItem.file_ijazah_sma_url ? 'Sudah Diunggah' : 'Belum Ada'}
                    </span>
                  </div>
                </div>

                {/* Wajib Check 2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: '#fff' }}>
                  <FileText size={20} color={selectedItem.file_transkrip_sma_url ? '#10b981' : '#9ca3af'} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Transkrip SMA/Sederajat</strong>
                    <span style={{ fontSize: 11, color: selectedItem.file_transkrip_sma_url ? '#10b981' : '#9ca3af', fontWeight: 500 }}>
                      {selectedItem.file_transkrip_sma_url ? 'Sudah Diunggah' : 'Belum Ada'}
                    </span>
                  </div>
                </div>

                {/* Wajib Check 3 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: '#fff' }}>
                  <FileText size={20} color={selectedItem.file_ijazah_url ? '#10b981' : '#9ca3af'} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Ijazah D1/D2/D3 (Wajib)</strong>
                    <span style={{ fontSize: 11, color: selectedItem.file_ijazah_url ? '#10b981' : '#9ca3af', fontWeight: 500 }}>
                      {selectedItem.file_ijazah_url ? 'Sudah Diunggah' : 'Belum Ada'}
                    </span>
                  </div>
                </div>

                {/* Wajib Check 4 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--gray-200)', borderRadius: 6, background: '#fff' }}>
                  <FileText size={20} color={selectedItem.file_transkrip_url ? '#10b981' : '#9ca3af'} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>Transkrip D1/D2/D3 (Wajib)</strong>
                    <span style={{ fontSize: 11, color: selectedItem.file_transkrip_url ? '#10b981' : '#9ca3af', fontWeight: 500 }}>
                      {selectedItem.file_transkrip_url ? 'Sudah Diunggah' : 'Belum Ada'}
                    </span>
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

          {/* New Card: Cetak Rencana Studi dan Diskon Biaya */}
          {selectedItem.status === 'mapped_admin' && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
                  <DollarSign size={18} />
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Cetak Rencana Studi dan Diskon Biaya</h3>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {/* Cetak Rencana Studi (PDF) Button */}
                 <button
                   onClick={() => window.open(`/report/${selectedItem.id}/print`, '_blank')}
                   className="btn btn-primary"
                   style={{ width: '100%', justifyContent: 'center', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                 >
                   <FileText size={15} /> Cetak Rencana Studi (PDF)
                 </button>

                 {/* Monthly Payment request section */}
                 {selectedItem.monthly_payment_status === 'pending' && (
                   <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                     <span style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                       💳 Pengajuan Pembiayaan Bulanan
                     </span>
                     <p style={{ fontSize: 11.5, color: '#78350f', margin: 0, lineHeight: 1.4 }}>
                       Calon mahasiswa ini mengajukan opsi pembiayaan kuliah dicicil bulanan (biaya tiap semester dibagi 6 bulan).
                     </p>
                     <div style={{ display: 'flex', gap: 8 }}>
                       <button
                         onClick={() => handleMonthlyPaymentApproval(true)}
                         className="btn btn-success"
                         style={{ flex: 1, padding: '8px 12px', fontSize: 11.5, fontWeight: 700 }}
                         disabled={submitting}
                       >
                         Setujui
                       </button>
                       <button
                         onClick={() => handleMonthlyPaymentApproval(false)}
                         className="btn btn-danger"
                         style={{ flex: 1, padding: '8px 12px', fontSize: 11.5, fontWeight: 700, background: 'var(--danger)', color: '#fff', border: 'none' }}
                         disabled={submitting}
                       >
                         Tolak
                       </button>
                     </div>
                   </div>
                 )}

                 {selectedItem.monthly_payment_status === 'approved' && (
                   <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#064e3b' }}>
                     <span>💳 Pembiayaan Bulanan Aktif (Dibagi 6 bulan)</span>
                   </div>
                 )}

                 {/* Cost Summary Info */}
                 <div style={{ background: 'var(--gray-50)', padding: 14, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--gray-100)', paddingBottom: 6, alignItems: 'center' }}>
                      <span style={{ color: 'var(--gray-500)' }}>SKS Diakui / Sisa SKS:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ color: 'var(--indigo-700)' }}>
                          {totalSksDiakui} SKS / {totalSksSisa} SKS
                          {(() => {
                            const total = totalSksDiakui + totalSksSisa
                            const pct = total > 0 ? (totalSksDiakui / total) * 100 : 0
                            return ` (${pct.toFixed(0)}%)`
                          })()}
                        </strong>
                        {(() => {
                          const total = totalSksDiakui + totalSksSisa
                          const pct = total > 0 ? (totalSksDiakui / total) * 100 : 0
                          const limit = parseFloat(maxLimit) || 70
                          return pct > limit ? (
                            <AlertCircle size={14} color="var(--danger)" title={`Melebihi batas maksimal rekognisi (${limit}%)!`} style={{ flexShrink: 0 }} />
                          ) : null
                        })()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)' }}>Biaya UKP (4 Semester):</span>
                        <strong>Rp{biayaUkp.toLocaleString('id-ID')}</strong>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -2 }}>
                        Rp{configUkp.toLocaleString('id-ID')} per semester (Rp{(configUkp / 6).toLocaleString('id-ID', { maximumFractionDigits: 0 })} per bulan) (Total Rp{biayaUkp.toLocaleString('id-ID')})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)' }}>Biaya Rekognisi ({totalSksDiakui} SKS):</span>
                        <strong>Rp{biayaRekognisi.toLocaleString('id-ID')}</strong>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -2 }}>
                        Rp{configRekognisi.toLocaleString('id-ID')} per SKS diakui
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)' }}>Biaya MOOCs ({totalMoocs} MK):</span>
                        <strong>Rp{biayaMoocs.toLocaleString('id-ID')}</strong>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -2 }}>
                        Rp{configMoocs.toLocaleString('id-ID')} per mata kuliah sisa MOOCs (Asinkron)
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)' }}>Biaya Pendukung:</span>
                        <strong>Rp{biayaPendukung.toLocaleString('id-ID')}</strong>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -2 }}>
                        Biaya penunjang perkuliahan
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gray-100)', paddingTop: 8, marginTop: 2, fontWeight: 700 }}>
                      <span style={{ color: 'var(--gray-700)' }}>Total Sebelum Diskon:</span>
                      <strong>Rp{biayaTotalSebelumPotongan.toLocaleString('id-ID')}</strong>
                    </div>
                    {potonganBiaya > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 600, fontSize: 12.5, marginTop: 2 }}>
                        <span>Diskon UKP (4 Semester):</span>
                        <span>- Rp{(4 * potonganBiaya).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {potonganBiayaPendukung > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 600, fontSize: 12.5, marginTop: 2 }}>
                        <span>Diskon Biaya Pendukung:</span>
                        <span>- Rp{potonganBiayaPendukung.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {((4 * potonganBiaya) + potonganBiayaPendukung) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 700, fontSize: 12.5, marginTop: 2, borderTop: '1px dashed var(--gray-200)', paddingTop: 4 }}>
                        <span>Total Diskon:</span>
                        <span>- Rp{((4 * potonganBiaya) + potonganBiayaPendukung).toLocaleString('id-ID')}</span>
                      </div>
                    )}
                 </div>

                 {/* Discount input Form */}
                 <div className="input-group">
                    <label className="input-label">Diskon / Potongan Biaya UKP per Semester (Rp)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--gray-400)', fontSize: 12 }}>Rp</span>
                      <input
                        type="number"
                        value={potonganBiaya || ''}
                        onChange={(e) => setPotonganBiaya(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="Masukkan nominal potongan"
                        className="input"
                        style={{ paddingLeft: 30 }}
                        disabled={submitting}
                      />
                    </div>
                    <span className="input-hint">Pengurangan biaya kuliah paket (UKP) secara individu untuk setiap semester</span>
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
                      disabled={submitting}
                    />
                 </div>

                 <div className="input-group">
                    <label className="input-label">Diskon / Potongan Biaya Pendukung (Rp)</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--gray-400)', fontSize: 12 }}>Rp</span>
                      <input
                        type="number"
                        value={potonganBiayaPendukung || ''}
                        onChange={(e) => setPotonganBiayaPendukung(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="Masukkan nominal potongan biaya pendukung"
                        className="input"
                        style={{ paddingLeft: 30 }}
                        disabled={submitting}
                      />
                    </div>
                    <span className="input-hint">Pengurangan biaya pendukung perkuliahan secara individu</span>
                 </div>

                 <div className="input-group">
                    <label className="input-label">Catatan Alasan Potongan Biaya Pendukung</label>
                    <textarea
                      value={catatanPotonganPendukung}
                      onChange={(e) => setCatatanPotonganPendukung(e.target.value)}
                      placeholder="Contoh: Potongan khusus alumni program short course"
                      className="input"
                      rows={2}
                      style={{ resize: 'none', padding: '8px 12px' }}
                      disabled={submitting}
                    />
                 </div>

                 {/* Final Cost Calculation */}
                 <div style={{ borderTop: '2px solid var(--indigo-100)', paddingTop: 14, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--gray-700)' }}>Total Biaya Akhir:</span>
                      <strong style={{ fontSize: 16, color: 'var(--success)' }}>Rp{finalBiayaTotal.toLocaleString('id-ID')}</strong>
                    </div>
                    {(monthlyPaymentStatus === 'approved' || selectedItem.monthly_payment_status === 'approved') && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', padding: '6px 10px', borderRadius: 6, border: '1px solid #bbf7d0', fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: '#166534' }}>Estimasi per Bulan (24 Bln):</span>
                        <strong style={{ color: '#166534' }}>Rp{Math.round(finalBiayaTotal / 24).toLocaleString('id-ID')} / bln</strong>
                      </div>
                    )}
                 </div>

                 <button
                   onClick={handleSaveDiscount}
                   className="btn btn-primary"
                   style={{ width: '100%', justifyContent: 'center', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                   disabled={submitting}
                 >
                   <CheckCircle size={15} /> {submitting ? 'Mengirim...' : 'Kirim ke Calon'}
                 </button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}
