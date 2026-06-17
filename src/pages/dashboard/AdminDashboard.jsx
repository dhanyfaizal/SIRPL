import { useState, useEffect } from 'react'
import { dbPengajuan, dbMK, dbRekognisi, dbPenetapan, getDocumentProgress } from '../../lib/db'
import { BookOpen, FileText, CheckCircle, Percent, DollarSign, Calendar, Edit2, RotateCcw, AlertCircle, Eye, Settings, ArrowLeft, RotateCw, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportToCSV } from '../../utils/exporter'
import AnalyticsTab from '../../components/AnalyticsTab'

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
      
      let jalur = 'sinkron'
      if (isMoocDefault) {
        jalur = 'asinkron'
      } else {
        if (currentSinkronSks + c.sks <= 24) {
          jalur = 'sinkron'
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
  const [activeSemTab, setActiveSemTab] = useState(1) // 1 | 2 | 3 | 4
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

  const [refreshing, setRefreshing] = useState(false)
  const [aiMappingLoading, setAiMappingLoading] = useState(false)

  const handleAiJalurMapping = async () => {
    if (mappedCourses.length === 0) return

    setAiMappingLoading(true)
    const toastId = toast.loading('AI sedang menganalisis sisa mata kuliah...')
    try {
      const apiKey = import.meta.env.VITE_SUMOPOD_API_KEY
      const apiUrl = import.meta.env.VITE_SUMOPOD_API_URL || 'https://ai.sumopod.com/v1'

      let mappings = []

      if (!apiKey || apiKey.includes('placeholder')) {
        // Fallback: Local rule-based mapping with 1.2s simulation delay
        await new Promise(resolve => setTimeout(resolve, 1200))
        
        // Restore original curriculum semesters for distribution helper
        const rawMapping = mappedCourses.map(c => {
          const originalMk = curriculumMK.find(m => m.id === c.mkId)
          return {
            ...c,
            semester: originalMk ? (originalMk.semester || 1) : 1
          }
        })

        const fallbackMappings = distributeCoursesToStudySemesters(rawMapping)
        mappings = fallbackMappings.map(c => ({
          mkId: c.mkId,
          semester: c.semester,
          jalur: c.jalur
        }))
        
        toast.success('Menggunakan pemrosesan pintar lokal (AI Key belum diset)', { id: toastId })
      } else {
        // Real API call to Sumopod API using deepseek-v4-flash
        const systemPrompt = 'Anda adalah asisten akademik RPL STIKOM Yos Sudarso. Bantu memetakan jalur pembelajaran dan semester studi untuk mata kuliah sisa.'
        const userPrompt = `Diberikan daftar mata kuliah sisa yang harus ditempuh oleh calon mahasiswa:
        ${JSON.stringify(mappedCourses.map(c => {
          const originalMk = curriculumMK.find(m => m.id === c.mkId)
          return {
            id: c.mkId,
            kode: c.kode,
            nama: c.nama,
            sks: c.sks,
            jenis: c.jenis,
            original_semester: originalMk ? (originalMk.semester || 1) : 1
          }
        }))}
        
        Bantu petakan jalur pembelajaran ('sinkron' atau 'asinkron') dan semester studi (1, 2, 3, atau 4) untuk setiap mata kuliah sisa di atas dengan mengikuti instruksi ini:
        
        Instruksi Pemetaan:
        1. Kelompokkan seluruh mata kuliah berdasarkan semester kurikulum aslinya (original_semester) menjadi Semester Ganjil (1, 3, 5, 7) dan Semester Genap (2, 4, 6, 8).
        2. Buat urutan Mata Kuliah Ganjil dengan urutan semester 1, 3, 5, 7 dan urutan Mata Kuliah Genap dengan urutan semester 2, 4, 6, 8.
        3. Lakukan Mapping Mata Kuliah untuk setiap Semester Studi mulai dari Semester 1:
           - Semester 1 & 3 Studi: Hanya diisi sisa Mata Kuliah Semester Ganjil (original_semester 1, 3, 5, 7). Distribusikan mata kuliah semester ganjil kurikulum asli yang lebih rendah ke Semester 1 Studi, dan sisanya ke Semester 3 Studi.
           - Semester 2 & 4 Studi: Hanya diisi sisa Mata Kuliah Semester Genap (original_semester 2, 4, 6, 8). Distribusikan mata kuliah semester genap kurikulum asli yang lebih rendah ke Semester 2 Studi, dan sisanya ke Semester 4 Studi.
           - Pada setiap semester studi (1, 2, 3, dan 4), total SKS dari mata kuliah yang berjalur 'sinkron' (Tatap Muka) MAKSIMAL adalah 24 SKS. Jika melebihi 24 SKS, maka mata kuliah sisanya dalam semester tersebut otomatis diubah jalurnya menjadi 'asinkron' (MOOCs).
        
        Tanggapan Anda HARUS berupa objek JSON dengan struktur berikut dan tidak boleh ada teks penjelasan tambahan di luar JSON:
        {
          "mappings": [
            {
              "mkId": "ID_Mata_Kuliah",
              "semester": 1 | 2 | 3 | 4,
              "jalur": "asinkron" | "sinkron"
            }
          ]
        }`

        const response = await fetch(`${apiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-v4-flash',
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          })
        })

        if (!response.ok) {
          throw new Error(`AI API error: ${response.statusText}`)
        }

        const resJson = await response.json()
        const content = resJson.choices?.[0]?.message?.content
        if (!content) {
          throw new Error('Tanggapan AI kosong')
        }

        const parsed = JSON.parse(content)
        mappings = parsed.mappings || []
        toast.success('AI berhasil memetakan jalur pembelajaran sisa mata kuliah!', { id: toastId })
      }

      // Apply mappings to state
      if (mappings && mappings.length > 0) {
        setMappedCourses(prevCourses => 
          prevCourses.map(c => {
            const found = mappings.find(m => m.mkId === c.mkId)
            return found ? { ...c, jalur: found.jalur, semester: found.semester } : c
          })
        )
      }
    } catch (err) {
      console.error(err)
      toast.error(`Gagal melakukan pemetaan AI: ${err.message}`, { id: toastId })
    } finally {
      setAiMappingLoading(false)
    }
  }

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
      
      // Load penetapan data for each submission to display the actual SKS
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
      setMappedCourses([])
      setPotonganBiaya(0)
      setCatatanPotongan('')
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

  const getSemesterStats = (semNum) => {
    const list = mappedCourses.filter(c => (c.semester || 1) === semNum)
    const totalSks = list.reduce((sum, c) => sum + c.sks, 0)
    const sinkronSks = list.filter(c => c.jalur === 'sinkron').reduce((sum, c) => sum + c.sks, 0)
    return { totalSks, sinkronSks }
  }

  // Dynamic cost calculations based on user requirements
  const biayaUkp = 4 * 5400000 // UKP 4 semesters (Rp5.400.000 per semester)
  const biayaRekognisi = totalSksDiakui * 50000
  const totalMoocs = mappedCourses.filter(c => c.jalur === 'asinkron').length
  const biayaMoocs = totalMoocs * 100000
  const biayaTotalSebelumPotongan = biayaUkp + biayaRekognisi + biayaMoocs
  const finalBiayaTotal = Math.max(0, biayaTotalSebelumPotongan - (4 * potonganBiaya))

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

  const handleArchive = async (id) => {
    try {
      await dbPengajuan.archive(id)
      toast.success('Pengajuan berhasil diarsipkan!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengarsipkan pengajuan')
    }
  }

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Permanen Pengajuan',
      message: 'Apakah Anda yakin ingin menghapus pengajuan ini secara permanen dari sistem? Semua data rekognisi, penetapan biaya, dan berkas akan dihapus secara permanen.',
      confirmText: 'Ya, Hapus Permanen',
      onConfirm: async () => {
        try {
          await dbPengajuan.delete(id)
          toast.success('Pengajuan berhasil dihapus secara permanen!')
          loadSubmissions()
        } catch (e) {
          console.error(e)
          toast.error('Gagal menghapus pengajuan')
        }
      }
    })
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
  const needActionList = submissions.filter(item => item.status === 'assessed_asessor' && !item.is_archived)
  const inProgressList = submissions.filter(item => ['submitted', 'returned_baak', 'validated_baak', 'returned_kaprodi', 'recognized_kaprodi', 'returned_asessor'].includes(item.status) && !item.is_archived)
  const completedList = submissions.filter(item => item.status === 'mapped_admin' && !item.is_archived)
  const returnedList = submissions.filter(item => item.status === 'returned_admin' && !item.is_archived)
  const archivedList = submissions.filter(item => item.is_archived)

  const activeList = activeTab === 'need_action'
    ? needActionList
    : activeTab === 'in_progress'
    ? inProgressList
    : activeTab === 'completed'
    ? completedList
    : activeTab === 'archived'
    ? archivedList
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 className="page-title">Dashboard Admin RPL</h1>
          <p className="page-subtitle">Kelola pengajuan calon mahasiswa, finalisasi rencana studi & biaya, dan atur batasan sistem</p>
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

      {/* Visual Analytics Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--indigo-50), var(--indigo-100))', borderColor: 'var(--indigo-200)' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, color: 'var(--indigo-600)', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>👥</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Pendaftar Aktif</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--indigo-900)', marginTop: 2 }}>{submissions.filter(s => !s.is_archived).length}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderColor: '#a7f3d0' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, color: '#059669', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>✓</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>RPL Selesai (Final)</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#064e3b', marginTop: 2 }}>{submissions.filter(s => s.status === 'mapped_admin' && !s.is_archived).length}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderColor: '#fde68a' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, color: '#d97706', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>⏳</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Rerata Waktu Tunggu</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#78350f', marginTop: 2 }}>
                {(() => {
                  const subCount = submissions.filter(s => s.submitted_at).length
                  if (subCount === 0) return '-'
                  let totalMs = 0
                  submissions.filter(s => s.submitted_at).forEach(s => {
                    const sub = new Date(s.submitted_at)
                    const end = s.status === 'mapped_admin' ? new Date(s.updated_at) : new Date()
                    totalMs += (end - sub)
                  })
                  const avgDays = (totalMs / subCount / 86400000).toFixed(1)
                  return `${avgDays} Hari`
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', borderColor: '#cbd5e1' }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, color: '#475569', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>📂</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Berkas Diarsipkan</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{submissions.filter(s => s.is_archived).length}</div>
            </div>
          </div>
        </div>
      </div>

      {!selectedItem ? (
        /* List submissions with tabs and settings card */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tab Control */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--gray-200)', paddingBottom: 8, flexWrap: 'wrap' }}>
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
              onClick={() => setActiveTab('archived')}
              className={`btn btn-sm ${activeTab === 'archived' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Arsip ({archivedList.length})
            </button>
            <button
              onClick={() => setActiveTab('returned')}
              className={`btn btn-sm ${activeTab === 'returned' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              Direvisi ke Asessor ({returnedList.length})
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
              {/* Left Column: Submissions Table */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                      {activeTab === 'need_action'
                        ? 'Menunggu Finalisasi Jalur & Biaya'
                        : activeTab === 'in_progress'
                        ? 'Daftar Pengajuan Sedang Diproses'
                        : activeTab === 'completed'
                        ? 'Daftar Pengajuan Selesai'
                        : activeTab === 'archived'
                        ? 'Daftar Pengajuan Diarsipkan'
                        : 'Daftar Pengajuan Dikembalikan ke Asessor'}
                    </h3>
                    <span className="badge-pill badge-indigo">{activeList.length} Pengajuan</span>
                  </div>
                  <button
                    onClick={() => exportToCSV(activeList, `laporan-rpl-admin-${activeTab}.csv`)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    📥 Ekspor Data (.CSV)
                  </button>
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
                           <th style={{ width: 140 }}>Progress Berkas</th>
                           <th>SKS Diakui</th>
                           <th>Status</th>
                           <th>Waktu Tunggu</th>
                           <th style={{ width: 140 }}>Aksi</th>
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
                               <td>
                                 {(() => {
                                   const diakui = item.total_sks_diakui || 0
                                   const sisa = item.total_sks_sisa || 0
                                   const total = diakui + sisa
                                   const pct = total > 0 ? (diakui / total) * 100 : 0
                                   const limit = parseFloat(maxLimit) || 70
                                   const isExceeded = pct > limit
                                   return (
                                     <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                       <span style={{ fontWeight: 600 }}>{diakui} SKS</span>
                                       <span style={{ fontSize: 11, color: isExceeded ? 'var(--danger)' : 'var(--gray-500)', fontWeight: isExceeded ? 700 : 500 }}>
                                         ({pct.toFixed(0)}%)
                                       </span>
                                       {isExceeded && (
                                         <AlertCircle size={14} color="var(--danger)" title={`Melebihi batas maksimal rekognisi (${limit}%)!`} style={{ flexShrink: 0 }} />
                                       )}
                                     </div>
                                   )
                                 })()}
                               </td>
                               <td><span className={`badge-pill ${statusInfo.className}`}>{statusInfo.label}</span></td>
                               <td style={{ fontSize: 12 }}>
                                 {formatWaitingTime(item.submitted_at, item.status === 'mapped_admin' ? item.updated_at : null)}
                                </td>
                               <td>
                                 <div style={{ display: 'flex', gap: 6 }}>
                                   <button
                                     onClick={() => setSelectedItem(item)}
                                     className="btn btn-primary btn-sm"
                                   >
                                     {activeTab === 'need_action' ? 'Finalisasi' : 'Lihat'}
                                   </button>
                                   {activeTab === 'completed' && (
                                     <button
                                       onClick={() => handleArchive(item.id)}
                                       className="btn btn-secondary btn-sm"
                                       style={{ fontSize: 11, padding: '4px 8px' }}
                                     >
                                       Arsipkan
                                     </button>
                                   )}
                                   {activeTab === 'archived' && (
                                     <button
                                       onClick={() => handleDelete(item.id)}
                                       className="btn btn-danger btn-sm"
                                       style={{ background: 'var(--danger)', color: '#fff', fontSize: 11, padding: '4px 8px' }}
                                     >
                                       Hapus
                                     </button>
                                   )}
                                 </div>
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
        )}
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
            <div style={{ 
              background: selectedItem.status === 'assessed_asessor' ? '#fffdf5' : 'var(--indigo-50)', 
              padding: 14, 
              borderRadius: 8, 
              border: selectedItem.status === 'assessed_asessor' ? '1px solid var(--warning)' : '1px solid var(--indigo-100)', 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 10 
            }}>
              <AlertCircle size={18} style={{ color: selectedItem.status === 'assessed_asessor' ? 'var(--warning)' : 'var(--indigo-600)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: selectedItem.status === 'assessed_asessor' ? '#d97706' : 'var(--indigo-700)', marginBottom: 2 }}>
                  {selectedItem.status === 'assessed_asessor' ? '⚠️ Sanggahan Hasil Rencana Studi dari Calon Mahasiswa:' : 'Catatan Revisi / Alasan Pengembalian Aktif:'}
                </h4>
                <p style={{ fontSize: 12.5, color: 'var(--gray-600)', whiteSpace: 'pre-wrap' }}>{selectedItem.catatan_revisi}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
            {/* Left Panel: Study Plan & Recognition Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Study Plan Mapping Card */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                      {isReadOnly ? 'Rencana Studi / Jalur Pembelajaran Sisa' : 'Pemetaan Jalur Rencana Studi'}
                    </h3>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      Pendaftar: <strong>{selectedItem.profile?.nama_lengkap}</strong> ({selectedItem.prodi?.nama})
                    </span>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={handleAiJalurMapping}
                      disabled={aiMappingLoading}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--indigo-600)', borderColor: 'var(--indigo-200)', background: 'var(--indigo-50)' }}
                    >
                      <Sparkles size={13} className={aiMappingLoading ? 'spin-anim' : ''} />
                      {aiMappingLoading ? 'Memetakan...' : 'Petakan via AI'}
                    </button>
                  )}
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
                    <div>
                      {/* Semester Tabs */}
                      <div style={{ display: 'flex', gap: 6, padding: '12px 16px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)', flexWrap: 'wrap' }}>
                        {[1, 2, 3, 4].map(semNum => {
                          const stats = getSemesterStats(semNum)
                          const isOverLimit = stats.sinkronSks > 24
                          const isActive = activeSemTab === semNum
                          return (
                            <button
                              key={semNum}
                              onClick={() => setActiveSemTab(semNum)}
                              className="btn btn-sm"
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                borderColor: isOverLimit ? 'var(--danger)' : isActive ? 'var(--indigo-600)' : 'var(--gray-200)',
                                color: isOverLimit ? 'var(--danger)' : isActive ? '#fff' : 'var(--gray-700)',
                                background: isActive ? (isOverLimit ? 'var(--danger)' : 'var(--indigo-600)') : 'var(--surface)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Semester {semNum}
                              <span style={{
                                fontSize: 10.5,
                                background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--gray-100)',
                                color: isActive ? '#fff' : 'var(--gray-600)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontWeight: 600
                              }}>
                                {stats.totalSks} SKS ({stats.sinkronSks} SKS Sinkron)
                              </span>
                              {isOverLimit && (
                                <AlertCircle size={13} color={isActive ? '#fff' : 'var(--danger)'} title="Sinkron melebihi batas 24 SKS!" />
                              )}
                            </button>
                          )
                        })}
                      </div>

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
                            {mappedCourses.filter(c => (c.semester || 1) === activeSemTab).length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)', fontStyle: 'italic' }}>
                                  Tidak ada mata kuliah sisa pada Semester {activeSemTab}
                                </td>
                              </tr>
                            ) : (
                              mappedCourses.filter(c => (c.semester || 1) === activeSemTab).map(course => (
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
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
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
                        Rp5.400.000,00 per semester (Total Rp21.600.000,00)
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)' }}>Biaya Rekognisi ({totalSksDiakui} SKS):</span>
                        <strong>Rp{biayaRekognisi.toLocaleString('id-ID')}</strong>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -2 }}>
                        Rp50.000,00 per SKS diakui
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--gray-500)' }}>Biaya MOOCs ({totalMoocs} MK):</span>
                        <strong>Rp{biayaMoocs.toLocaleString('id-ID')}</strong>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -2 }}>
                        Rp100.000,00 per mata kuliah sisa MOOCs (Asinkron)
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gray-100)', paddingTop: 8, marginTop: 2, fontWeight: 700 }}>
                      <span style={{ color: 'var(--gray-700)' }}>Total Sebelum Diskon:</span>
                      <strong>Rp{biayaTotalSebelumPotongan.toLocaleString('id-ID')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: potonganBiaya > 0 ? 'var(--danger)' : 'var(--gray-500)', fontWeight: potonganBiaya > 0 ? 600 : 500, fontSize: 12.5, marginTop: 2 }}>
                      <span>Total Diskon (4 Semester):</span>
                      <span>{potonganBiaya > 0 ? `- Rp${(4 * potonganBiaya).toLocaleString('id-ID')}` : 'Rp0'}</span>
                    </div>
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
                        disabled={isReadOnly || submitting}
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
                    selectedItem.is_archived ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--gray-500)', fontWeight: 700, padding: '6px 0', fontSize: 13 }}>
                          📂 Berkas di dalam Arsip
                        </div>
                        <button
                          onClick={() => window.open(`/report/${selectedItem.id}/print`, '_blank')}
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <FileText size={15} /> Cetak Rencana Studi (PDF)
                        </button>
                        <button
                          onClick={() => handleDelete(selectedItem.id)}
                          className="btn btn-danger"
                          style={{ width: '100%', justifyContent: 'center', background: 'var(--danger)', color: '#fff', fontWeight: 600 }}
                        >
                          Hapus Permanen
                        </button>
                      </div>
                    ) : selectedItem.status === 'mapped_admin' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--success)', fontWeight: 700, padding: '6px 0', fontSize: 13 }}>
                          <CheckCircle size={16} /> Rencana Studi & Biaya Diterbitkan
                        </div>
                        <button
                          onClick={() => window.open(`/report/${selectedItem.id}/print`, '_blank')}
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <FileText size={15} /> Cetak Rencana Studi (PDF)
                        </button>
                        <button
                          onClick={() => handleArchive(selectedItem.id)}
                          className="btn btn-secondary"
                          style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}
                        >
                          Arsipkan Berkas Ini
                        </button>
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

