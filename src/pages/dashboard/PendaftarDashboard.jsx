import { useState, useEffect } from 'react'
import { dbPengajuan, dbProdi } from '../../lib/db'
import { supabase, isMock } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { FileUp, Clipboard, Award, Shield, CheckCircle, FileText, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateMockDocSrcDoc } from '../../lib/mockDoc'

// Helper: Preview component that supports both real PDF (Supabase Storage) and mock HTML
function DocPreview({ fileUrl, previewType, profileName, prodiName }) {
  const [signedUrl, setSignedUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  const isStoragePath = fileUrl && fileUrl.includes('/')

  useEffect(() => {
    setSignedUrl(null)
    if (!isMock && isStoragePath) {
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
  }, [fileUrl, isStoragePath])

  if (loadingUrl) {
    return (
      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!isMock && isStoragePath && signedUrl) {
    return (
      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', height: 420, background: '#fff' }}>
        <iframe
          title="Pratinjau Dokumen PDF"
          src={signedUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    )
  }

  // Fallback: mock document preview
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

  // Form State
  const [selectedProdi, setSelectedProdi] = useState('')
  const [ijazahName, setIjazahName] = useState('')
  const [transkripName, setTranskripName] = useState('')
  const [ijazahFile, setIjazahFile] = useState(null)
  const [transkripFile, setTranskripFile] = useState(null)
  
  // Sertifikat & Pengalaman States
  const [sertifikats, setSertifikats] = useState([])
  const [pengalamans, setPengalamans] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [previewType, setPreviewType] = useState('ijazah')
  const [previewUrl, setPreviewUrl] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: prodiData } = await dbProdi.getAll()
      setProdis(prodiData || [])

      const { data: pengajuanData } = await dbPengajuan.getByUserId(user.id)
      if (pengajuanData && pengajuanData.length > 0) {
        const activePengajuan = pengajuanData[0]
        setPengajuan(activePengajuan) // Ambil pengajuan terbaru
        setPreviewUrl(activePengajuan.file_ijazah_url || '')
        setPreviewType('ijazah')

        if (activePengajuan.status === 'returned_baak') {
          setSelectedProdi(activePengajuan.prodi_pilihan_id || '')
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

    setSubmitting(true)
    try {
      let ijazahUrl = ijazahName
      let transkripUrl = transkripName

      const ts = Date.now()
      // Upload file riil ke Supabase Storage jika bukan mode mock
      if (!isMock) {
        if (ijazahFile) {
          const ijazahPath = `${user.id}/ijazah_${ts}.pdf`
          const { error: errIjazah } = await supabase.storage
            .from('rpl-documents')
            .upload(ijazahPath, ijazahFile, { contentType: 'application/pdf', upsert: true })
          if (errIjazah) throw new Error('Gagal mengunggah ijazah: ' + errIjazah.message)
          ijazahUrl = ijazahPath
        }

        if (transkripFile) {
          const transkripPath = `${user.id}/transkrip_${ts}.pdf`
          const { error: errTranskrip } = await supabase.storage
            .from('rpl-documents')
            .upload(transkripPath, transkripFile, { contentType: 'application/pdf', upsert: true })
          if (errTranskrip) throw new Error('Gagal mengunggah transkrip: ' + errTranskrip.message)
          transkripUrl = transkripPath
        }
      }

      // Upload Certificates files
      const finalCerts = await Promise.all(sertifikats.map(async (cert, idx) => {
        let fileUrl = cert.fileUrl
        if (cert.fileObj) {
          if (!isMock) {
            const certPath = `${user.id}/cert_${idx}_${ts}.pdf`
            const { error: errCert } = await supabase.storage
              .from('rpl-documents')
              .upload(certPath, cert.fileObj, { contentType: 'application/pdf', upsert: true })
            if (errCert) throw new Error('Gagal mengunggah berkas sertifikat: ' + errCert.message)
            fileUrl = certPath
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

      // Upload Work Experience files
      const finalExprs = await Promise.all(pengalamans.map(async (expr, idx) => {
        let fileUrl = expr.fileUrl
        if (expr.fileObj) {
          if (!isMock) {
            const exprPath = `${user.id}/expr_${idx}_${ts}.pdf`
            const { error: errExpr } = await supabase.storage
              .from('rpl-documents')
              .upload(exprPath, expr.fileObj, { contentType: 'application/pdf', upsert: true })
            if (errExpr) throw new Error('Gagal mengunggah berkas bukti kerja: ' + errExpr.message)
            fileUrl = exprPath
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

      const payload = {
        prodi_pilihan_id: selectedProdi,
        file_ijazah_url: ijazahUrl,
        file_transkrip_url: transkripUrl,
        sertifikat_kompetensi: finalCerts,
        pengalaman_kerja: finalExprs,
        status: 'submitted',
        catatan_revisi: null // reset catatan revisi setelah dikirim ulang
      }

      if (pengajuan) {
        await dbPengajuan.update(pengajuan.id, payload)
        toast.success('Pengajuan RPL berhasil dikirim ulang!')
      } else {
        await dbPengajuan.create({ user_id: user.id, ...payload })
        toast.success('Pengajuan RPL berhasil dikirim!')
      }
      loadData()
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Gagal mengirimkan pengajuan')
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

      {!pengajuan || pengajuan.status === 'returned_baak' ? (
        /* Form Pengajuan */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                {pengajuan?.status === 'returned_baak' ? 'Revisi Formulir Pengajuan RPL' : 'Formulir Pengajuan RPL'}
              </h3>
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
                        <CheckCircle size={12} /> {ijazahName.split('/').pop()}
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
                        <CheckCircle size={12} /> {transkripName.split('/').pop()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--gray-200)', margin: '16px 0' }} />

                {/* Section 1: Sertifikat Kompetensi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gray-800)' }}>Sertifikat Kompetensi (Opsional)</h4>
                    <button type="button" onClick={addSertifikat} className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
                      + Tambah Sertifikat
                    </button>
                  </div>
                  
                  {sertifikats.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>Belum ada sertifikat kompetensi yang ditambahkan.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {sertifikats.map((cert) => (
                        <div key={cert.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 180px auto', gap: 10, background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--gray-200)', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={cert.nama}
                            onChange={(e) => handleSertifikatChange(cert.id, 'nama', e.target.value)}
                            placeholder="Nama Sertifikat"
                            className="input"
                            style={{ padding: '6px 10px' }}
                            required
                          />
                          <input
                            type="text"
                            value={cert.penerbit}
                            onChange={(e) => handleSertifikatChange(cert.id, 'penerbit', e.target.value)}
                            placeholder="Penerbit / Lembaga"
                            className="input"
                            style={{ padding: '6px 10px' }}
                            required
                          />
                          <input
                            type="number"
                            value={cert.tahun}
                            onChange={(e) => handleSertifikatChange(cert.id, 'tahun', e.target.value)}
                            placeholder="Tahun"
                            className="input"
                            style={{ padding: '6px 10px' }}
                            required
                          />
                          <div style={{ position: 'relative', overflow: 'hidden' }}>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                              {cert.fileName ? `📄 ${cert.fileName.slice(0, 15)}...` : '📂 Pilih PDF'}
                            </button>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => handleSertifikatFile(cert.id, e.target.files[0])}
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                            />
                          </div>
                          <button type="button" onClick={() => removeSertifikat(cert.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--gray-200)', margin: '16px 0' }} />

                {/* Section 2: Pengalaman Kerja */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--gray-800)' }}>Pengalaman Kerja / Praktek Industri (Opsional)</h4>
                    <button type="button" onClick={addPengalaman} className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
                      + Tambah Pengalaman Kerja
                    </button>
                  </div>

                  {pengalamans.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>Belum ada pengalaman kerja yang ditambahkan.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {pengalamans.map((expr) => (
                        <div key={expr.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: 10, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={expr.perusahaan}
                              onChange={(e) => handlePengalamanChange(expr.id, 'perusahaan', e.target.value)}
                              placeholder="Nama Perusahaan / Instansi"
                              className="input"
                              style={{ padding: '6px 10px' }}
                              required
                            />
                            <input
                              type="text"
                              value={expr.posisi}
                              onChange={(e) => handlePengalamanChange(expr.id, 'posisi', e.target.value)}
                              placeholder="Jabatan / Posisi"
                              className="input"
                              style={{ padding: '6px 10px' }}
                              required
                            />
                            <input
                              type="text"
                              value={expr.durasi}
                              onChange={(e) => handlePengalamanChange(expr.id, 'durasi', e.target.value)}
                              placeholder="Durasi (Cth: 1.5 Tahun)"
                              className="input"
                              style={{ padding: '6px 10px' }}
                              required
                            />
                            <button type="button" onClick={() => removePengalaman(expr.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10, alignItems: 'center' }}>
                            <textarea
                              value={expr.deskripsi}
                              onChange={(e) => handlePengalamanChange(expr.id, 'deskripsi', e.target.value)}
                              placeholder="Tulis ringkasan tugas, tanggung jawab, dan kompetensi yang digunakan..."
                              className="input"
                              rows={2}
                              style={{ resize: 'none', padding: '6px 10px' }}
                            />
                            <div style={{ position: 'relative', overflow: 'hidden' }}>
                              <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', height: '100%', padding: '8px' }}>
                                {expr.fileName ? `📄 ${expr.fileName.slice(0, 15)}...` : '📂 Pilih Surat Bukti PDF'}
                              </button>
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handlePengalamanFile(expr.id, e.target.files[0])}
                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
        </div>
      ) : (
        /* Status Tracker & Timeline */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Timeline Details & Document Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

            {/* Pratinjau Berkas */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Pratinjau Berkas yang Diunggah</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => { setPreviewType('ijazah'); setPreviewUrl(pengajuan.file_ijazah_url) }} 
                    className={`btn btn-sm ${previewType === 'ijazah' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Ijazah
                  </button>
                  <button 
                    onClick={() => { setPreviewType('transkrip'); setPreviewUrl(pengajuan.file_transkrip_url) }} 
                    className={`btn btn-sm ${previewType === 'transkrip' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Transkrip
                  </button>
                  {pengajuan.sertifikat_kompetensi?.map((c, idx) => (
                    <button
                      key={`c-${idx}`}
                      onClick={() => { setPreviewType('sertifikat'); setPreviewUrl(c.file_url) }}
                      className={`btn btn-sm ${previewType === 'sertifikat' && previewUrl === c.file_url ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Sertifikat {idx + 1}
                    </button>
                  ))}
                  {pengajuan.pengalaman_kerja?.map((ex, idx) => (
                    <button
                      key={`ex-${idx}`}
                      onClick={() => { setPreviewType('pengalaman'); setPreviewUrl(ex.file_url) }}
                      className={`btn btn-sm ${previewType === 'pengalaman' && previewUrl === ex.file_url ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Pengalaman {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body" style={{ padding: 12 }}>
                <DocPreview
                  fileUrl={previewUrl}
                  previewType={previewType}
                  profileName={profile?.nama_lengkap || user?.email?.split('@')[0] || 'Calon Mahasiswa'}
                  prodiName={pengajuan.prodi?.nama || '-'}
                />
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
                      <FileText size={12} /> {pengajuan.file_ijazah_url ? pengajuan.file_ijazah_url.split('/').pop() : ''}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--gray-500)' }}>Berkas Transkrip:</span><br />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                      <FileText size={12} /> {pengajuan.file_transkrip_url ? pengajuan.file_transkrip_url.split('/').pop() : ''}
                    </span>
                  </div>

                  {/* Sertifikat List */}
                  {pengajuan.sertifikat_kompetensi && pengajuan.sertifikat_kompetensi.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--indigo-100)', paddingTop: 10, marginTop: 4 }}>
                      <span style={{ color: 'var(--gray-500)' }}>Sertifikat Kompetensi:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        {pengajuan.sertifikat_kompetensi.map((c, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Award size={12} style={{ color: 'var(--indigo-600)' }} />
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPreviewType('sertifikat');
                                setPreviewUrl(c.file_url);
                              }}
                              style={{ fontSize: 11.5, color: 'var(--indigo-600)', textDecoration: 'underline', fontWeight: 500 }}
                            >
                              {c.nama} ({c.tahun})
                            </a>
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
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPreviewType('pengalaman');
                                setPreviewUrl(ex.file_url);
                              }}
                              style={{ fontSize: 11.5, color: 'var(--indigo-600)', textDecoration: 'underline', fontWeight: 500 }}
                            >
                              {ex.posisi} - {ex.perusahaan}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
