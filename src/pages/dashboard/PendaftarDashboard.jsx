import { useState, useEffect } from 'react'
import { dbPengajuan, dbProdi, getDocumentProgress } from '../../lib/db'
import { supabase, isMock } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { FileUp, Clipboard, Award, Shield, CheckCircle, FileText, Trash2, Plus, Eye, ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'

// Helper: Preview component that supports both real PDF (Supabase Storage) and mock HTML
function DocPreview({ fileUrl, previewType, profileName, prodiName }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  const isBlobUrl = fileUrl && fileUrl.startsWith('blob:')
  const isStoragePath = fileUrl && fileUrl.includes('/') && !isBlobUrl

  useEffect(() => {
    setSignedUrl(null)
    if (isBlobUrl) {
      setSignedUrl(fileUrl)
    } else if (!isMock && isStoragePath) {
      setLoadingUrl(true)
      supabase.storage
        .from('rpl-documents')
        .createSignedUrl(fileUrl, 3600) // 1 hour expiry
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) setSignedUrl(data.signedUrl)
          else setSignedUrl(null)
        })
        .finally(() => setLoadingUrl(false))
    }
  }, [fileUrl, isStoragePath, isBlobUrl])

  if (loadingUrl) {
    return (
      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (isBlobUrl || (!isMock && isStoragePath && signedUrl)) {
    const srcUrl = isBlobUrl ? fileUrl : signedUrl
    return (
      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', height: 420, background: '#fff' }}>
        <iframe
          title="Pratinjau Dokumen PDF"
          src={srcUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', height: 420, background: '#fff' }}>
      <iframe
        title="Pratinjau Dokumen Calon"
        srcDoc={generateMockDocSrcDoc(previewType, fileUrl, profileName, prodiName)}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  )
}

export default function PendaftarDashboard() {
  const { user, profile } = useAuth()
  const [prodis, setProdis] = useState([])
  const [pengajuan, setPengajuan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailSaved, setDetailSaved] = useState(false)

  // Form State - Step 1
  const [selectedProdi, setSelectedProdi] = useState('')

  // Form State - Step 2 (SMA - Wajib)
  const [ijazahSmaName, setIjazahSmaName] = useState('')
  const [transkripSmaName, setTranskripSmaName] = useState('')
  const [ijazahSmaFile, setIjazahSmaFile] = useState(null)
  const [transkripSmaFile, setTranskripSmaFile] = useState(null)

  // Form State - Step 2 (D1/D2/D3 - Opsional)
  const [ijazahName, setIjazahName] = useState('')
  const [transkripName, setTranskripName] = useState('')
  const [ijazahFile, setIjazahFile] = useState(null)
  const [transkripFile, setTranskripFile] = useState(null)
  
  // Sertifikat & Pengalaman States
  const [sertifikats, setSertifikats] = useState([])
  const [pengalamans, setPengalamans] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [previewType, setPreviewType] = useState('ijazah_sma')
  const [previewUrl, setPreviewUrl] = useState('')

  const [viewModal, setViewModal] = useState({
    isOpen: false,
    fileUrl: '',
    previewType: '',
    title: ''
  })

  const handleViewFile = (type, index = null) => {
    let fileUrl = ''
    let title = ''
    let previewType = type

    if (type === 'ijazah_sma') {
      title = 'Pratinjau Ijazah SMA/Sederajat'
      if (ijazahSmaFile) {
        fileUrl = URL.createObjectURL(ijazahSmaFile)
      } else {
        fileUrl = ijazahSmaName
      }
    } else if (type === 'transkrip_sma') {
      title = 'Pratinjau Transkrip Nilai SMA/Sederajat'
      if (transkripSmaFile) {
        fileUrl = URL.createObjectURL(transkripSmaFile)
      } else {
        fileUrl = transkripSmaName
      }
    } else if (type === 'ijazah') {
      title = 'Pratinjau Ijazah Pendidikan Tinggi (D1/D2/D3)'
      if (ijazahFile) {
        fileUrl = URL.createObjectURL(ijazahFile)
      } else {
        fileUrl = ijazahName
      }
    } else if (type === 'transkrip') {
      title = 'Pratinjau Transkrip Nilai Tinggi (D1/D2/D3)'
      if (transkripFile) {
        fileUrl = URL.createObjectURL(transkripFile)
      } else {
        fileUrl = transkripName
      }
    } else if (type === 'sertifikat') {
      const cert = sertifikats[index]
      title = `Pratinjau Sertifikat: ${cert.nama || 'Tanpa Nama'}`
      if (cert.fileObj) {
        fileUrl = URL.createObjectURL(cert.fileObj)
      } else {
        fileUrl = cert.fileUrl
      }
    } else if (type === 'pengalaman') {
      const expr = pengalamans[index]
      title = `Pratinjau Pengalaman Kerja: ${expr.perusahaan || 'Tanpa Nama'}`
      if (expr.fileObj) {
        fileUrl = URL.createObjectURL(expr.fileObj)
      } else {
        fileUrl = expr.fileUrl
      }
    }

    if (fileUrl) {
      setViewModal({
        isOpen: true,
        fileUrl,
        previewType,
        title
      })
    } else {
      toast.error('Tidak ada berkas untuk ditampilkan')
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: prodiData } = await dbProdi.getAll()
      // Filter prodi yang aktif (is_active)
      const activeProdis = (prodiData || []).filter(p => p.is_active !== false)
      setProdis(activeProdis)

      const { data: pengajuanData } = await dbPengajuan.getByUserId(user.id)
      if (pengajuanData && pengajuanData.length > 0) {
        const activePengajuan = pengajuanData[0]
        setPengajuan(activePengajuan) // Ambil pengajuan terbaru
        setPreviewUrl(activePengajuan.file_ijazah_sma_url || '')
        setPreviewType('ijazah_sma')
        setSelectedProdi(activePengajuan.prodi_pilihan_id || '')
        setDetailSaved(true)

        if (activePengajuan.status === 'returned_baak' || activePengajuan.status === 'draft') {
          setIjazahSmaName(activePengajuan.file_ijazah_sma_url || '')
          setTranskripSmaName(activePengajuan.file_transkrip_sma_url || '')
          setIjazahName(activePengajuan.file_ijazah_url || '')
          setTranskripName(activePengajuan.file_transkrip_url || '')

          // Pre-fill certificates & experience
          const certs = activePengajuan.sertifikat_kompetensi || []
          setSertifikats(certs.map((c, idx) => ({
            id: 'cert-' + idx + '-' + Date.now(),
            nama: c.nama,
            penerbit: c.penerbit,
            tahun: c.tahun,
            fileUrl: c.file_url,
            fileName: c.file_url ? c.file_url.split('/').pop() : ''
          })))

          const exprs = activePengajuan.pengalaman_kerja || []
          setPengalamans(exprs.map((ex, idx) => ({
            id: 'expr-' + idx + '-' + Date.now(),
            perusahaan: ex.perusahaan,
            posisi: ex.posisi,
            durasi: ex.durasi,
            deskripsi: ex.deskripsi,
            fileUrl: ex.file_url,
            fileName: ex.file_url ? ex.file_url.split('/').pop() : ''
          })))
        }
      } else {
        setPengajuan(null)
        setDetailSaved(false)
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
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB')
        return
      }
      if (type === 'ijazah_sma') { setIjazahSmaName(file.name); setIjazahSmaFile(file) }
      if (type === 'transkrip_sma') { setTranskripSmaName(file.name); setTranskripSmaFile(file) }
      if (type === 'ijazah') { setIjazahName(file.name); setIjazahFile(file) }
      if (type === 'transkrip') { setTranskripName(file.name); setTranskripFile(file) }
    }
  }

  // Sertifikat Handlers
  const addSertifikat = () => {
    setSertifikats([
      ...sertifikats,
      { id: 'cert-' + Date.now() + Math.random().toString(36).slice(2, 5), nama: '', penerbit: '', tahun: '', fileObj: null, fileName: '', fileUrl: '' }
    ])
  }

  const removeSertifikat = (id) => {
    setSertifikats(sertifikats.filter(c => c.id !== id))
  }

  const handleSertifikatChange = (id, field, value) => {
    setSertifikats(sertifikats.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const handleSertifikatFile = (id, file) => {
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Hanya berkas PDF yang diperbolehkan')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB')
        return
      }
      setSertifikats(sertifikats.map(c => c.id === id ? { ...c, fileObj: file, fileName: file.name } : c))
    }
  }

  // Pengalaman Handlers
  const addPengalaman = () => {
    setPengalamans([
      ...pengalamans,
      { id: 'expr-' + Date.now() + Math.random().toString(36).slice(2, 5), perusahaan: '', posisi: '', durasi: '', deskripsi: '', fileObj: null, fileName: '', fileUrl: '' }
    ])
  }

  const removePengalaman = (id) => {
    setPengalamans(pengalamans.filter(ex => ex.id !== id))
  }

  const handlePengalamanChange = (id, field, value) => {
    setPengalamans(pengalamans.map(ex => ex.id === id ? { ...ex, [field]: value } : ex))
  }

  const handlePengalamanFile = (id, file) => {
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Hanya berkas PDF yang diperbolehkan')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB')
        return
      }
      setPengalamans(pengalamans.map(ex => ex.id === id ? { ...ex, fileObj: file, fileName: file.name } : ex))
    }
  }

  // Action Step 1: Save Details
  const handleSaveDetails = async (e) => {
    e.preventDefault()
    if (!selectedProdi) {
      toast.error('Silakan pilih Program Studi Tujuan')
      return
    }

    setSubmitting(true)
    try {
      if (pengajuan) {
        await dbPengajuan.update(pengajuan.id, {
          prodi_pilihan_id: selectedProdi,
          status: 'draft'
        })
      } else {
        await dbPengajuan.create({
          user_id: user.id,
          prodi_pilihan_id: selectedProdi,
          status: 'draft'
        })
      }
      toast.success('Detail Pendaftaran berhasil disimpan! Silakan unggah berkas Anda.')
      setDetailSaved(true)
      loadData()
    } catch (err) {
      console.error(err)
      toast.error('Gagal menyimpan detail pendaftaran')
    } finally {
      setSubmitting(false)
    }
  }

  // Action Step 2: Save Draft / Submit
  const handleSaveSubmit = async (isFinalSubmit) => {
    if (isFinalSubmit) {
      if (!ijazahSmaName || !transkripSmaName) {
        toast.error('Kedua dokumen SMA wajib diunggah untuk dikirim ke BAAK!')
        return
      }

      // Validations
      for (const cert of sertifikats) {
        if (!cert.nama.trim() || !cert.penerbit.trim() || !cert.tahun.trim()) {
          toast.error('Semua data sertifikat kompetensi wajib diisi!')
          return
        }
        if (!cert.fileObj && !cert.fileUrl) {
          toast.error(`Sertifikat "${cert.nama}" wajib melampirkan berkas bukti PDF!`)
          return
        }
      }

      for (const expr of pengalamans) {
        if (!expr.perusahaan.trim() || !expr.posisi.trim() || !expr.durasi.trim()) {
          toast.error('Semua data pengalaman kerja wajib diisi!')
          return
        }
        if (!expr.fileObj && !expr.fileUrl) {
          toast.error(`Pengalaman kerja di "${expr.perusahaan}" wajib melampirkan berkas bukti PDF!`)
          return
        }
      }
    }

    setSubmitting(true)
    try {
      let ijazahSmaUrl = ijazahSmaName
      let transkripSmaUrl = transkripSmaName
      let ijazahUrl = ijazahName
      let transkripUrl = transkripName

      // Upload files if real storage mode
      if (!isMock) {
        if (ijazahSmaFile) {
          const path = `${user.id}/ijazah_sma.pdf`
          const { error } = await supabase.storage.from('rpl-documents').upload(path, ijazahSmaFile, { contentType: 'application/pdf', upsert: true })
          if (error) throw new Error('Gagal unggah ijazah SMA: ' + error.message)
          ijazahSmaUrl = path
        }
        if (transkripSmaFile) {
          const path = `${user.id}/transkrip_sma.pdf`
          const { error } = await supabase.storage.from('rpl-documents').upload(path, transkripSmaFile, { contentType: 'application/pdf', upsert: true })
          if (error) throw new Error('Gagal unggah transkrip SMA: ' + error.message)
          transkripSmaUrl = path
        }
        if (ijazahFile) {
          const path = `${user.id}/ijazah_pt.pdf`
          const { error } = await supabase.storage.from('rpl-documents').upload(path, ijazahFile, { contentType: 'application/pdf', upsert: true })
          if (error) throw new Error('Gagal unggah ijazah PT: ' + error.message)
          ijazahUrl = path
        }
        if (transkripFile) {
          const path = `${user.id}/transkrip_pt.pdf`
          const { error } = await supabase.storage.from('rpl-documents').upload(path, transkripFile, { contentType: 'application/pdf', upsert: true })
          if (error) throw new Error('Gagal unggah transkrip PT: ' + error.message)
          transkripUrl = path
        }
      }

      // Upload Certificates
      const finalCerts = await Promise.all(sertifikats.map(async (cert, idx) => {
        let fileUrl = cert.fileUrl
        if (cert.fileObj) {
          if (!isMock) {
            const path = `${user.id}/cert_${idx}.pdf`
            const { error } = await supabase.storage.from('rpl-documents').upload(path, cert.fileObj, { contentType: 'application/pdf', upsert: true })
            if (error) throw new Error('Gagal unggah berkas sertifikat: ' + error.message)
            fileUrl = path
          } else {
            fileUrl = `mock-storage/cert_${cert.fileName}`
          }
        }
        return {
          nama: cert.nama,
          penerbit: cert.penerbit,
          tahun: cert.tahun,
          file_url: fileUrl
        }
      }))

      // Upload Experience
      const finalExprs = await Promise.all(pengalamans.map(async (expr, idx) => {
        let fileUrl = expr.fileUrl
        if (expr.fileObj) {
          if (!isMock) {
            const path = `${user.id}/expr_${idx}.pdf`
            const { error } = await supabase.storage.from('rpl-documents').upload(path, expr.fileObj, { contentType: 'application/pdf', upsert: true })
            if (error) throw new Error('Gagal unggah berkas bukti kerja: ' + error.message)
            fileUrl = path
          } else {
            fileUrl = `mock-storage/expr_${expr.fileName}`
          }
        }
        return {
          perusahaan: expr.perusahaan,
          posisi: expr.posisi,
          durasi: expr.durasi,
          deskripsi: expr.deskripsi,
          file_url: fileUrl
        }
      }))

      // Cleanup unused storage files in production mode
      if (!isMock) {
        try {
          const usedPaths = [
            ijazahSmaUrl,
            transkripSmaUrl,
            ijazahUrl,
            transkripUrl,
            ...finalCerts.map(c => c.file_url),
            ...finalExprs.map(e => e.file_url)
          ].filter(Boolean)

          const { data: files } = await supabase.storage.from('rpl-documents').list(user.id)
          if (files && files.length > 0) {
            const unusedPaths = files
              .map(f => `${user.id}/${f.name}`)
              .filter(p => !usedPaths.includes(p))

            if (unusedPaths.length > 0) {
              await supabase.storage.from('rpl-documents').remove(unusedPaths)
            }
          }
        } catch (cleanErr) {
          console.error('Error cleaning up unused storage files:', cleanErr)
        }
      }

      const payload = {
        file_ijazah_sma_url: ijazahSmaUrl,
        file_transkrip_sma_url: transkripSmaUrl,
        file_ijazah_url: ijazahUrl,
        file_transkrip_url: transkripUrl,
        sertifikat_kompetensi: finalCerts,
        pengalaman_kerja: finalExprs,
        status: isFinalSubmit ? 'submitted' : 'draft',
        catatan_revisi: null
      }

      if (isFinalSubmit) {
        payload.submitted_at = new Date().toISOString()
      }

      await dbPengajuan.update(pengajuan.id, payload)
      
      if (isFinalSubmit) {
        toast.success('Pengajuan RPL berhasil dikirim ke BAAK!')
      } else {
        toast.success('Draf berkas berhasil disimpan!')
      }
      loadData()
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Gagal menyimpan berkas')
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
  const docProg = getDocumentProgress(pengajuan)

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

      {!pengajuan || pengajuan.status === 'draft' || pengajuan.status === 'returned_baak' ? (
        /* FORM SECTION (Draft / Form Baru) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Banner returned revision */}
          {pengajuan?.status === 'returned_baak' && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)', backgroundColor: '#fff5f5' }}>
              <div className="card-body">
                <h4 style={{ color: '#c53030', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '14px', fontWeight: 700 }}>
                  ⚠️ Pengajuan Dikembalikan untuk Revisi
                </h4>
                <p style={{ color: '#742a2a', fontSize: '13px', marginTop: 8, marginBottom: 0 }}>
                  Catatan Pengembalian/Revisi: <strong>{pengajuan.catatan_revisi || 'Harap perbaiki dokumen Anda.'}</strong>
                </p>
              </div>
            </div>
          )}

          {!detailSaved ? (
            /* STEP 1: DETAIL PENDAFTARAN */
            <div className="card" style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
              <div className="card-header" style={{ borderBottom: '1px solid var(--gray-100)', padding: '16px 20px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-900)' }}>Langkah 1: Isi Detail Pendaftaran</h3>
              </div>
              <form onSubmit={handleSaveDetails}>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="input-group">
                    <label className="input-label">Nama Lengkap</label>
                    <input 
                      type="text" 
                      value={profile?.nama_lengkap || ''} 
                      className="input" 
                      style={{ background: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }}
                      disabled 
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Alamat Email</label>
                    <input 
                      type="text" 
                      value={profile?.email || ''} 
                      className="input" 
                      style={{ background: 'var(--gray-50)', color: 'var(--gray-500)', cursor: 'not-allowed' }}
                      disabled 
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Program Studi Tujuan</label>
                    <select
                      value={selectedProdi}
                      onChange={(e) => setSelectedProdi(e.target.value)}
                      className="input"
                      required
                    >
                      <option value="">-- Pilih Program Studi Tujuan --</option>
                      {prodis.map(p => (
                        <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                      ))}
                    </select>
                    <span className="input-hint">Pilih prodi yang ingin Anda tempuh untuk jalur transfer SKS.</span>
                  </div>
                </div>

                <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--gray-100)' }}>
                  <button type="submit" disabled={submitting} className="btn btn-primary" style={{ gap: 8 }}>
                    Simpan & Lanjut ke Berkas <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* STEP 2: UNGGAH BERKAS */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
              
              {/* Left Column: Upload Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Back Link to Step 1 */}
                <button 
                  onClick={() => setDetailSaved(false)} 
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowLeft size={13} /> Ubah Detail Pendaftaran (Langkah 1)
                </button>

                {/* Progress bar SMA */}
                <div className="card" style={{ borderLeft: '4px solid var(--indigo-600)' }}>
                  <div className="card-body" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: 13.5, display: 'block', color: 'var(--gray-800)' }}>Progress Berkas Wajib (SMA/Sederajat)</strong>
                      <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Wajib unggah Ijazah & Transkrip SMA untuk Submit.</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--indigo-600)' }}>{docProg.percent}%</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Langkah 2: Unggah Dokumen Pendaftaran</h3>
                    <span className="badge-pill badge-slate">Prodi Tujuan: {prodis.find(p => p.id === selectedProdi)?.nama}</span>
                  </div>
                  
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    
                    {/* A. Berkas SMA (Wajib) */}
                    <div>
                      <h4 style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--indigo-600)', marginBottom: 12, borderBottom: '1px solid var(--indigo-100)', paddingBottom: 6 }}>I. Pendidikan Formal Tingkat SMA (Wajib)</h4>
                      <div className="form-grid form-grid-2">
                        {/* Ijazah SMA */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ border: '2px dashed var(--gray-200)', borderRadius: 8, padding: 16, textAlign: 'center', background: 'var(--surface-alt)', position: 'relative' }}>
                            <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, 'ijazah_sma')} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            <FileUp size={24} color="var(--indigo-600)" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontWeight: 600, fontSize: 12 }}>Unggah Ijazah SMA</div>
                            {ijazahSmaName && (
                              <div style={{ marginTop: 8, fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={10} /> {ijazahSmaName.split('/').pop().slice(0, 15)}...
                              </div>
                            )}
                          </div>
                          {ijazahSmaName && (
                            <button type="button" onClick={() => handleViewFile('ijazah_sma')} className="btn btn-secondary btn-sm" style={{ alignSelf: 'center', fontSize: 11, padding: '2px 8px' }}>
                              <Eye size={12} /> Lihat Berkas
                            </button>
                          )}
                        </div>

                        {/* Transkrip SMA */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ border: '2px dashed var(--gray-200)', borderRadius: 8, padding: 16, textAlign: 'center', background: 'var(--surface-alt)', position: 'relative' }}>
                            <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, 'transkrip_sma')} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            <FileUp size={24} color="var(--indigo-600)" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontWeight: 600, fontSize: 12 }}>Unggah Transkrip SMA</div>
                            {transkripSmaName && (
                              <div style={{ marginTop: 8, fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={10} /> {transkripSmaName.split('/').pop().slice(0, 15)}...
                              </div>
                            )}
                          </div>
                          {transkripSmaName && (
                            <button type="button" onClick={() => handleViewFile('transkrip_sma')} className="btn btn-secondary btn-sm" style={{ alignSelf: 'center', fontSize: 11, padding: '2px 8px' }}>
                              <Eye size={12} /> Lihat Berkas
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* B. Berkas Pendidikan Tinggi (D1/D2/D3) (Opsional) */}
                    <div>
                      <h4 style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gray-700)', marginBottom: 12, borderBottom: '1px solid var(--gray-200)', paddingBottom: 6 }}>II. Pendidikan Formal Perguruan Tinggi D1/D2/D3 (Opsional)</h4>
                      <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: -6, marginBottom: 10 }}>PENTING: Transkrip Pendidikan Tinggi ini yang akan diekstraksi menggunakan AI/OCR oleh Kaprodi.</p>
                      <div className="form-grid form-grid-2">
                        {/* Ijazah PT */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ border: '2px dashed var(--gray-200)', borderRadius: 8, padding: 16, textAlign: 'center', background: 'var(--surface-alt)', position: 'relative' }}>
                            <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, 'ijazah')} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            <FileUp size={24} color="var(--gray-600)" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontWeight: 600, fontSize: 12 }}>Ijazah D1/D2/D3</div>
                            {ijazahName && (
                              <div style={{ marginTop: 8, fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={10} /> {ijazahName.split('/').pop().slice(0, 15)}...
                              </div>
                            )}
                          </div>
                          {ijazahName && (
                            <button type="button" onClick={() => handleViewFile('ijazah')} className="btn btn-secondary btn-sm" style={{ alignSelf: 'center', fontSize: 11, padding: '2px 8px' }}>
                              <Eye size={12} /> Lihat Berkas
                            </button>
                          )}
                        </div>

                        {/* Transkrip PT */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ border: '2px dashed var(--gray-200)', borderRadius: 8, padding: 16, textAlign: 'center', background: 'var(--surface-alt)', position: 'relative' }}>
                            <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, 'transkrip')} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                            <FileUp size={24} color="var(--gray-600)" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontWeight: 600, fontSize: 12 }}>Transkrip D1/D2/D3 (OCR)</div>
                            {transkripName && (
                              <div style={{ marginTop: 8, fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle size={10} /> {transkripName.split('/').pop().slice(0, 15)}...
                              </div>
                            )}
                          </div>
                          {transkripName && (
                            <button type="button" onClick={() => handleViewFile('transkrip')} className="btn btn-secondary btn-sm" style={{ alignSelf: 'center', fontSize: 11, padding: '2px 8px' }}>
                              <Eye size={12} /> Lihat Berkas
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* C. Sertifikat Kompetensi (Opsional) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-200)', paddingBottom: 6, marginBottom: 12 }}>
                        <h4 style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gray-700)', margin: 0 }}>III. Pendidikan Nonformal (Sertifikat Kompetensi) (Opsional)</h4>
                        <button type="button" onClick={addSertifikat} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}>
                          + Sertifikat
                        </button>
                      </div>
                      {sertifikats.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic', margin: 0 }}>Belum ada sertifikat kompetensi yang ditambahkan.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {sertifikats.map((cert, idx) => (
                            <div key={cert.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 140px auto 32px', gap: 8, background: 'var(--gray-50)', padding: 10, borderRadius: 6, border: '1px solid var(--gray-200)', alignItems: 'center' }}>
                              <input type="text" value={cert.nama} onChange={(e) => handleSertifikatChange(cert.id, 'nama', e.target.value)} placeholder="Nama Sertifikat" className="input" style={{ padding: '5px 8px', fontSize: 12 }} required />
                              <input type="text" value={cert.penerbit} onChange={(e) => handleSertifikatChange(cert.id, 'penerbit', e.target.value)} placeholder="Lembaga" className="input" style={{ padding: '5px 8px', fontSize: 12 }} required />
                              <input type="number" value={cert.tahun} onChange={(e) => handleSertifikatChange(cert.id, 'tahun', e.target.value)} placeholder="Tahun" className="input" style={{ padding: '5px 8px', fontSize: 12 }} required />
                              <div style={{ position: 'relative', overflow: 'hidden' }}>
                                <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', padding: '5px 8px', fontSize: 11 }}>
                                  {cert.fileName ? `📄 ${cert.fileName.slice(0, 10)}` : '📂 Bukti PDF'}
                                </button>
                                <input type="file" accept=".pdf" onChange={(e) => handleSertifikatFile(cert.id, e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                              </div>
                              {cert.fileName || cert.fileUrl ? (
                                <button type="button" onClick={() => handleViewFile('sertifikat', idx)} className="btn btn-ghost btn-icon" style={{ color: 'var(--indigo-600)' }}><Eye size={14} /></button>
                              ) : <div />}
                              <button type="button" onClick={() => removeSertifikat(cert.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* D. Pengalaman Kerja (Opsional) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-200)', paddingBottom: 6, marginBottom: 12 }}>
                        <h4 style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--gray-700)', margin: 0 }}>IV. Pengalaman Kerja / Portofolio (Opsional)</h4>
                        <button type="button" onClick={addPengalaman} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}>
                          + Pengalaman
                        </button>
                      </div>
                      {pengalamans.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic', margin: 0 }}>Belum ada portofolio pengalaman kerja yang ditambahkan.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {pengalamans.map((expr, idx) => (
                            <div key={expr.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--gray-50)', padding: 10, borderRadius: 6, border: '1px solid var(--gray-200)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: 8 }}>
                                <input type="text" value={expr.perusahaan} onChange={(e) => handlePengalamanChange(expr.id, 'perusahaan', e.target.value)} placeholder="Perusahaan" className="input" style={{ padding: '5px 8px', fontSize: 12 }} required />
                                <input type="text" value={expr.posisi} onChange={(e) => handlePengalamanChange(expr.id, 'posisi', e.target.value)} placeholder="Jabatan" className="input" style={{ padding: '5px 8px', fontSize: 12 }} required />
                                <input type="text" value={expr.durasi} onChange={(e) => handlePengalamanChange(expr.id, 'durasi', e.target.value)} placeholder="Durasi" className="input" style={{ padding: '5px 8px', fontSize: 12 }} required />
                                <button type="button" onClick={() => removePengalaman(expr.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 32px', gap: 8, alignItems: 'center' }}>
                                <textarea value={expr.deskripsi} onChange={(e) => handlePengalamanChange(expr.id, 'deskripsi', e.target.value)} placeholder="Uraian tugas dan kompetensi..." className="input" rows={1} style={{ padding: '5px 8px', fontSize: 12, resize: 'none' }} />
                                <div style={{ position: 'relative', overflow: 'hidden' }}>
                                  <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', padding: '5px 8px', fontSize: 11 }}>
                                    {expr.fileName ? `📄 ${expr.fileName.slice(0, 10)}` : '📂 Bukti PDF'}
                                  </button>
                                  <input type="file" accept=".pdf" onChange={(e) => handlePengalamanFile(expr.id, e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                </div>
                                {expr.fileName || expr.fileUrl ? (
                                  <button type="button" onClick={() => handleViewFile('pengalaman', idx)} className="btn btn-ghost btn-icon" style={{ color: 'var(--indigo-600)' }}><Eye size={14} /></button>
                                ) : <div />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--gray-100)' }}>
                    <button
                      type="button"
                      onClick={() => handleSaveSubmit(false)}
                      disabled={submitting}
                      className="btn btn-secondary"
                    >
                      Simpan Draf Berkas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveSubmit(true)}
                      disabled={submitting || docProg.percent < 100}
                      className="btn btn-primary"
                      style={{ opacity: docProg.percent < 100 ? 0.6 : 1 }}
                    >
                      {submitting ? 'Mengirim...' : 'Kirim Pengajuan ke BAAK'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Persyaratan Guidelines (Rujukan dari Gambar) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Syarat Pendaftaran */}
                <div className="card" style={{ background: '#fffbeb', borderColor: '#fef3c7' }}>
                  <div className="card-header" style={{ borderBottom: '1px solid #fef3c7', padding: '12px 16px' }}>
                    <h4 style={{ fontSize: 12.5, fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                      ✓ Syarat Pendaftaran
                    </h4>
                  </div>
                  <div className="card-body" style={{ padding: 12, fontSize: 11.5, color: '#92400e', lineHeight: 1.5 }}>
                    <ul style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <li>Calon mahasiswa yang melanjutkan formal ke Diploma/Sarjana paling rendah lulusan SMA/SMK/Sederajat.</li>
                      <li>Calon mahasiswa pernah/telah menempuh pendidikan prodi di perguruan tinggi sebelumnya (Opsional).</li>
                      <li>Untuk program Profesi/Magister paling rendah lulusan program Sarjana/Sarjana Terapan bidang sama.</li>
                      <li>Memiliki capaian belajar dari formal, nonformal, informal, dan/atau pengalaman kerja yang relevan.</li>
                    </ul>
                  </div>
                </div>

                {/* Dokumen Pendaftaran */}
                <div className="card" style={{ background: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}>
                  <div className="card-header" style={{ borderBottom: '1px solid var(--indigo-100)', padding: '12px 16px' }}>
                    <h4 style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--indigo-700)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                      ✓ Dokumen Pendaftaran
                    </h4>
                  </div>
                  <div className="card-body" style={{ padding: 12, fontSize: 11.5, color: 'var(--indigo-900)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: 2 }}>Pendidikan Formal:</strong>
                      <ul style={{ paddingLeft: 16, margin: 0 }}>
                        <li>Ijazah SMA/Sederajat (Wajib)</li>
                        <li>Transkrip SMA/Sederajat (Wajib)</li>
                        <li>Ijazah Pendidikan Tinggi (Opsional)</li>
                        <li>Transkrip Pendidikan Tinggi (Opsional)</li>
                      </ul>
                    </div>
                    <div>
                      <strong style={{ display: 'block', marginBottom: 2 }}>Pendidikan Nonformal:</strong>
                      <ul style={{ paddingLeft: 16, margin: 0 }}>
                        <li>Sertifikat LKP / Kompetensi</li>
                        <li>Transkrip Nilai LKP</li>
                      </ul>
                    </div>
                    <div>
                      <strong style={{ display: 'block', marginBottom: 2 }}>Pengalaman Kerja:</strong>
                      <ul style={{ paddingLeft: 16, margin: 0 }}>
                        <li>Surat Keterangan Kerja / Portofolio</li>
                        <li>CV / Riwayat Hidup</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      ) : (
        /* STATUS TRACKER & TIMELINE SCREEN */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          
          {/* Left Column: Timeline Details & Document Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Overall status header */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Status Pelacakan Berkas RPL</h3>
                <span className={`badge-pill status-${pengajuan.status}`}>
                  {pengajuan.status.toUpperCase()}
                </span>
              </div>
              <div className="card-body">
                <div className="stepper-timeline">
                  {/* Step 1 */}
                  <div className={`step-item ${stepIndex >= 1 ? (stepIndex > 1 ? 'completed' : 'active') : ''}`}>
                    <div className="step-node" />
                    <div className="step-title" style={{ fontWeight: 700 }}>Fase 1: Berkas Dikirim</div>
                    <div className="step-desc">Calon mahasiswa berhasil mengirim berkas pendaftaran untuk divalidasi.</div>
                    {stepIndex === 1 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Menunggu validasi oleh petugas BAAK.</div>}
                  </div>

                  {/* Step 2 */}
                  <div className={`step-item ${stepIndex >= 2 ? (stepIndex > 2 ? 'completed' : 'active') : ''}`}>
                    <div className="step-node" />
                    <div className="step-title" style={{ fontWeight: 700 }}>Fase 2: Validasi Dokumen (BAAK)</div>
                    <div className="step-desc">Pemeriksaan keaslian dan kelayakan berkas persyaratan masuk RPL oleh BAAK.</div>
                    {stepIndex === 2 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Berkas valid! Menunggu proses pencocokan mata kuliah oleh Ka. Prodi.</div>}
                  </div>

                  {/* Step 3 */}
                  <div className={`step-item ${stepIndex >= 3 ? (stepIndex > 3 ? 'completed' : 'active') : ''}`}>
                    <div className="step-node" />
                    <div className="step-title" style={{ fontWeight: 700 }}>Fase 3: Smart Recognition (Ka. Prodi)</div>
                    <div className="step-desc">Pencocokan mata kuliah transkrip asal dengan mata kuliah kurikulum menggunakan AI/OCR.</div>
                    {stepIndex === 3 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Rekognisi selesai oleh Ka. Prodi! Menunggu asesmen portofolio dari Asessor.</div>}
                  </div>

                  {/* Step 4 */}
                  <div className={`step-item ${stepIndex >= 4 ? (stepIndex > 4 ? 'completed' : 'active') : ''}`}>
                    <div className="step-node" />
                    <div className="step-title" style={{ fontWeight: 700 }}>Fase 4: Asesmen Akademik & Biaya (Asessor)</div>
                    <div className="step-desc">Verifikasi akademik akhir, asesmen portofolio kompetensi, dan kalkulasi biaya awal.</div>
                    {stepIndex === 4 && <div style={{ fontSize: 11.5, color: 'var(--indigo-600)', marginTop: 4, fontWeight: 600 }}>⏳ Asesmen selesai! Menunggu penetapan rencana studi final dari Admin.</div>}
                  </div>

                  {/* Step 5 */}
                  <div className={`step-item ${stepIndex >= 5 ? 'completed' : ''}`}>
                    <div className="step-node" />
                    <div className="step-title" style={{ fontWeight: 700 }}>Fase 5: Pemetaan Jalur & Finalisasi (Admin)</div>
                    <div className="step-desc">Rencana studi dan biaya total resmi diterbitkan untuk diunduh.</div>
                    {stepIndex === 5 && (
                      <div style={{ marginTop: 12, padding: 12, background: '#d1fae5', color: '#065f46', borderRadius: 8, fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={16} /> Evaluasi RPL selesai! Rencana Studi resmi telah diterbitkan.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document preview tracker */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Pratinjau Berkas Terunggah</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => { setPreviewType('ijazah_sma'); setPreviewUrl(pengajuan.file_ijazah_sma_url) }} 
                    className={`btn btn-sm ${previewType === 'ijazah_sma' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 11 }}
                  >
                    Ijazah SMA
                  </button>
                  <button 
                    onClick={() => { setPreviewType('transkrip_sma'); setPreviewUrl(pengajuan.file_transkrip_sma_url) }} 
                    className={`btn btn-sm ${previewType === 'transkrip_sma' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 11 }}
                  >
                    Transkrip SMA
                  </button>
                  {pengajuan.file_ijazah_url && (
                    <button 
                      onClick={() => { setPreviewType('ijazah'); setPreviewUrl(pengajuan.file_ijazah_url) }} 
                      className={`btn btn-sm ${previewType === 'ijazah' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 11 }}
                    >
                      Ijazah D3
                    </button>
                  )}
                  {pengajuan.file_transkrip_url && (
                    <button 
                      onClick={() => { setPreviewType('transkrip'); setPreviewUrl(pengajuan.file_transkrip_url) }} 
                      className={`btn btn-sm ${previewType === 'transkrip' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: 11 }}
                    >
                      Transkrip D3
                    </button>
                  )}
                </div>
              </div>
              <div className="card-body" style={{ padding: 12 }}>
                <DocPreview
                  fileUrl={previewUrl}
                  previewType={previewType}
                  profileName={profile?.nama_lengkap || 'Calon Mahasiswa'}
                  prodiName={pengajuan.prodi?.nama || '-'}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Summary Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                    <span style={{ color: 'var(--gray-500)' }}>Ijazah SMA:</span><br />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                      <FileText size={12} /> {pengajuan.file_ijazah_sma_url ? pengajuan.file_ijazah_sma_url.split('/').pop() : ''}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--gray-500)' }}>Transkrip SMA:</span><br />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                      <FileText size={12} /> {pengajuan.file_transkrip_sma_url ? pengajuan.file_transkrip_sma_url.split('/').pop() : ''}
                    </span>
                  </div>

                  {pengajuan.file_transkrip_url && (
                    <div>
                      <span style={{ color: 'var(--gray-500)' }}>Transkrip D1/D2/D3:</span><br />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                        <FileText size={12} /> {pengajuan.file_transkrip_url.split('/').pop()}
                      </span>
                    </div>
                  )}

                  {/* Sertifikat List */}
                  {pengajuan.sertifikat_kompetensi && pengajuan.sertifikat_kompetensi.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--indigo-100)', paddingTop: 10, marginTop: 4 }}>
                      <span style={{ color: 'var(--gray-500)' }}>Sertifikat Kompetensi:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        {pengajuan.sertifikat_kompetensi.map((c, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Award size={12} style={{ color: 'var(--indigo-600)' }} />
                            <span style={{ fontSize: 11.5, color: 'var(--indigo-600)', fontWeight: 500 }}>
                              {c.nama} ({c.tahun})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pengalaman List */}
                  {pengajuan.pengalaman_kerja && pengajuan.pengalaman_kerja.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--indigo-100)', paddingTop: 10, marginTop: 4 }}>
                      <span style={{ color: 'var(--gray-500)' }}>Pengalaman Kerja:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        {pengajuan.pengalaman_kerja.map((ex, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={12} style={{ color: 'var(--indigo-600)' }} />
                            <span style={{ fontSize: 11.5, color: 'var(--indigo-600)', fontWeight: 500 }}>
                              {ex.posisi} - {ex.perusahaan}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--indigo-100)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ color: 'var(--gray-500)' }}>Tanggal Kirim:</span><br />
                    <strong>{new Date(pengajuan.submitted_at || pengajuan.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
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

      {/* Modal Pratinjau Dokumen Calon (Revisi/Form Baru) */}
      {viewModal.isOpen && (
        <div className="modal-overlay" onClick={() => setViewModal({ ...viewModal, isOpen: false })}>
          <div className="modal" style={{ width: '800px', maxWidth: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{viewModal.title}</h3>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setViewModal({ ...viewModal, isOpen: false })}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--gray-500)' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: 12 }}>
              <DocPreview
                fileUrl={viewModal.fileUrl}
                previewType={viewModal.previewType}
                profileName={profile?.nama_lengkap || 'Calon Mahasiswa'}
                prodiName={prodis.find(p => p.id === selectedProdi)?.nama || '-'}
              />
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewModal({ ...viewModal, isOpen: false })}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
