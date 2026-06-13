import { useState, useEffect } from 'react'
import { dbPengajuan, dbMK, dbRekognisi, dbPenetapan } from '../../lib/db'
import { BookOpen, FileText, CheckCircle, Percent, DollarSign, Calendar, Edit2 } from 'lucide-react'
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

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      // Filter status 'assessed_asessor'
      setSubmissions((data || []).filter(item => item.status === 'assessed_asessor'))
      setSelectedItem(null)
      setMappedCourses([])
      setPotonganBiaya(0)
      setCatatanPotongan('')
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

  const loadPenetapanInitial = async (pengajuanId, prodiId) => {
    try {
      // 1. Ambil kurikulum prodi terlebih dahulu
      const { data: currData } = await dbMK.getByProdi(prodiId)
      const curriculum = currData || []
      setCurriculumMK(curriculum)

      // 2. Ambil rekognisi matkul diakui
      const { data: recData } = await dbRekognisi.getByPengajuanId(pengajuanId)
      const diakuiIds = (recData?.data_mapping_mk || [])
        .filter(m => m.Status === 'diakui')
        .map(m => m.MK_Tujuan_ID)

      // 3. Ambil biaya asesmen
      const { data: penData } = await dbPenetapan.getByPengajuanId(pengajuanId)
      if (penData) {
        setTotalSksDiakui(penData.total_sks_diakui)
        setTotalSksSisa(penData.total_sks_sisa)
        setBiayaAsessor(parseFloat(penData.biaya_total) || 0)
        setPotonganBiaya(parseFloat(penData.potongan_biaya) || 0)
        setCatatanPotongan(penData.catatan_potongan || '')
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

  useEffect(() => {
    if (selectedItem) {
      loadPenetapanInitial(selectedItem.id, selectedItem.prodi_pilihan_id)
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
      await dbPengajuan.updateStatus(selectedItem.id, 'mapped_admin')

      toast.success('Rencana Studi & Biaya berhasil difinalisasi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memfinalisasi dokumen ajuan')
    }
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
        <h1 className="page-title">Rencana Studi & Biaya (Admin)</h1>
        <p className="page-subtitle">Petakan jalur kuliah sisa (MOOCs vs Kelas) dan finalisasi diskon biaya kuliah</p>
      </div>

      {!selectedItem ? (
        /* List submissions */
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Menunggu Finalisasi Jalur & Biaya</h3>
            <span className="badge-pill badge-indigo">{submissions.length} Pengajuan</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {submissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-text">Tidak ada pengajuan masuk</div>
                <div className="empty-state-sub">Belum ada hasil asesmen dari Asessor yang masuk untuk tahap finalisasi.</div>
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
                      <th style={{ width: 120 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.profile?.nama_lengkap}</strong></td>
                        <td>{item.profile?.email}</td>
                        <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                        <td><span style={{ fontWeight: 600 }}>{totalSksDiakui} SKS</span> (Simulasi)</td>
                        <td>
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="btn btn-primary btn-sm"
                          >
                            Finalisasi
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
        /* Finalization Area */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
          {/* Left Panel: Course Pathway Mapping */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justify: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Pemetaan Jalur Rencana Studi</h3>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Pendaftar: <strong>{selectedItem.profile?.nama_lengkap}</strong> ({selectedItem.prodi?.nama})</span>
                </div>
                <button onClick={() => setSelectedItem(null)} className="btn btn-secondary btn-sm">Batal</button>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {mappedCourses.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)' }}>
                    Semua mata kuliah kurikulum berhasil diakui (0 SKS sisa).
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
                            </td>
                            <td>
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

          {/* Right Panel: Finance & Discounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                      placeholder="Masukkan nominal potongan, cth: 1000000"
                      className="input"
                      style={{ paddingLeft: 30 }}
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
                <button
                  onClick={handleFinalize}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontWeight: 700, gap: 6 }}
                >
                  <CheckCircle size={15} /> Finalisasi & Terbitkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
