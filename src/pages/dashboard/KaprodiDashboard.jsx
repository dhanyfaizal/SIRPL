import { useState, useEffect } from 'react'
import { dbPengajuan, dbMK, dbRekognisi } from '../../lib/db'
import { Award, Brain, RefreshCw, FileText, CheckCircle, Save, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'

export default function KaprodiDashboard() {
  const { role } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [curriculumMK, setCurriculumMK] = useState([])

  // AI OCR Simulation States
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrProgress, setOcrProgress] = useState('')
  const [recognitionMethod, setRecognitionMethod] = useState('') // 'ai' or 'manual'

  // Recognition Table Rows State
  // Row structure: { id, mkAsal, sksAsal, nilaiAsal, mkTujuanId, status }
  const [rows, setRows] = useState([])

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      // Filter yang statusnya 'validated_baak'
      let filtered = (data || []).filter(item => item.status === 'validated_baak')
      
      // Filter berdasarkan program studi Ka. Prodi jika perannya spesifik
      if (role === 'kaprodi_si') {
        filtered = filtered.filter(item => item.prodi?.kode === 'SI')
      } else if (role === 'kaprodi_ti') {
        filtered = filtered.filter(item => item.prodi?.kode === 'IF')
      } else if (role === 'kaprodi_dkv') {
        filtered = filtered.filter(item => item.prodi?.kode === 'DKV')
      } else if (role === 'kaprodi_ka') {
        filtered = filtered.filter(item => item.prodi?.kode === 'KA')
      }
      
      setSubmissions(filtered)
      setSelectedItem(null)
      setRows([])
      setRecognitionMethod('')
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

  // Load Curriculum Courses for Selected Applicant's Prodi
  const loadCurriculum = async (prodiId) => {
    try {
      const { data } = await dbMK.getByProdi(prodiId)
      setCurriculumMK(data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat kurikulum prodi')
    }
  }

  useEffect(() => {
    if (selectedItem?.prodi_pilihan_id) {
      loadCurriculum(selectedItem.prodi_pilihan_id)
    }
  }, [selectedItem?.prodi_pilihan_id])

  // Simulation of Gemini 1.5 Pro Visi AI OCR
  const runAIOCR = () => {
    setOcrRunning(true)
    setOcrProgress('Mengunduh dokumen dari Supabase storage...')

    setTimeout(() => {
      setOcrProgress('Melakukan OCR teks resolusi tinggi...')
      setTimeout(() => {
        setOcrProgress('Mengirim teks ke Gemini 1.5 Pro Visi API...')
        setTimeout(() => {
          setOcrProgress('Mencocokkan nama MK dengan Kurikulum Prodi (OBE)...')
          setTimeout(() => {
            // Generate Mock Extraction Rows secara dinamis berdasarkan Program Studi
            const prodiKode = selectedItem.prodi?.kode
            let mockRows = []
            
            if (prodiKode === 'IF') {
              mockRows = [
                {
                  id: 'row-1',
                  mkAsal: 'Algoritma & Pemrograman I',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI201')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-2',
                  mkAsal: 'Struktur Data & Algoritma',
                  sksAsal: 3,
                  nilaiAsal: 'B',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI202')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-3',
                  mkAsal: 'Sistem Manajemen Basis Data',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI203')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-4',
                  mkAsal: 'Pendidikan Pancasila',
                  sksAsal: 2,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKU101')?.id || '',
                  status: 'diakui'
                }
              ]
            } else if (prodiKode === 'SI') {
              mockRows = [
                {
                  id: 'row-1',
                  mkAsal: 'Pengantar Sistem Informasi',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI301')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-2',
                  mkAsal: 'Analisis & Perancangan Sistem',
                  sksAsal: 3,
                  nilaiAsal: 'B',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI302')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-3',
                  mkAsal: 'Pengantar E-Business',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI303')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-4',
                  mkAsal: 'Pendidikan Pancasila',
                  sksAsal: 2,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKU101')?.id || '',
                  status: 'diakui'
                }
              ]
            } else if (prodiKode === 'DKV') {
              mockRows = [
                {
                  id: 'row-1',
                  mkAsal: 'Dasar Seni Rupa',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI401')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-2',
                  mkAsal: 'Pengantar Tipografi',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI402')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-3',
                  mkAsal: 'Desain Grafis Digital',
                  sksAsal: 4,
                  nilaiAsal: 'B',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI403')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-4',
                  mkAsal: 'Pendidikan Pancasila',
                  sksAsal: 2,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKU101')?.id || '',
                  status: 'diakui'
                }
              ]
            } else if (prodiKode === 'KA') {
              mockRows = [
                {
                  id: 'row-1',
                  mkAsal: 'Pengantar Akuntansi & Keuangan',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI501')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-2',
                  mkAsal: 'Sistem Informasi Keuangan',
                  sksAsal: 3,
                  nilaiAsal: 'B',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI502')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-3',
                  mkAsal: 'Dasar-Dasar Perpajakan',
                  sksAsal: 3,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKI503')?.id || '',
                  status: 'diakui'
                },
                {
                  id: 'row-4',
                  mkAsal: 'Pendidikan Pancasila',
                  sksAsal: 2,
                  nilaiAsal: 'A',
                  mkTujuanId: curriculumMK.find(mk => mk.kode_mk === 'MKU101')?.id || '',
                  status: 'diakui'
                }
              ]
            } else {
              mockRows = [
                {
                  id: 'row-1',
                  mkAsal: 'Mata Kuliah Umum',
                  sksAsal: 3,
                  nilaiAsal: 'B',
                  mkTujuanId: '',
                  status: 'diakui'
                }
              ]
            }
            setRows(mockRows)
            setOcrRunning(false)
            setRecognitionMethod('ai')
            toast.success('AI/OCR Gemini berhasil mengekstrak 4 mata kuliah!')
          }, 1000)
        }, 1000)
      }, 1000)
    }, 1000)
  }

  const handleManualInput = () => {
    setRecognitionMethod('manual')
    setRows([
      { id: 'row-manual-1', mkAsal: '', sksAsal: 0, nilaiAsal: '', mkTujuanId: '', status: 'diakui' }
    ])
  }

  // Row Manipulation Helpers
  const addRow = () => {
    setRows([
      ...rows,
      { id: 'row-add-' + Date.now(), mkAsal: '', sksAsal: 0, nilaiAsal: '', mkTujuanId: '', status: 'diakui' }
    ])
  }

  const deleteRow = (id) => {
    setRows(rows.filter(r => r.id !== id))
  }

  const updateRow = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const handleSubmitToAsessor = async () => {
    if (rows.length === 0) {
      toast.error('Tabel rekognisi minimal harus memiliki 1 baris pemetaan')
      return
    }

    // Validasi baris
    const invalidRow = rows.find(r => !r.mkAsal || !r.mkTujuanId || !r.nilaiAsal)
    if (invalidRow) {
      toast.error('Pastikan semua baris terisi nama mata kuliah asal dan mata kuliah tujuan kurikulum!')
      return
    }

    try {
      // 1. Simpan tabel rekognisi ke DB
      const recognitionPayload = {
        data_ekstraksi_ocr: { method: recognitionMethod, run_at: new Date().toISOString() },
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
            Status: r.status
          }
        }),
        is_manual_edited: recognitionMethod === 'manual' || rows.some(r => r.id.startsWith('row-add') || r.id.startsWith('row-manual'))
      }

      await dbRekognisi.upsert(selectedItem.id, recognitionPayload)
      // 2. Update status pengajuan ke 'recognized_kaprodi'
      await dbPengajuan.updateStatus(selectedItem.id, 'recognized_kaprodi')

      toast.success('Pemetaan rekognisi berhasil disimpan dan diteruskan ke Asessor!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memproses rekognisi mata kuliah')
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
        <h1 className="page-title">Smart Recognition Engine (Ka. Prodi)</h1>
        <p className="page-subtitle">Petakan transkrip mata kuliah asal ke mata kuliah kurikulum program studi</p>
      </div>

      {!selectedItem ? (
        /* List submissions */
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Pengajuan Siap Direkognisi</h3>
            <span className="badge-pill badge-indigo">{submissions.length} Pengajuan</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {submissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎓</div>
                <div className="empty-state-text">Tidak ada pengajuan masuk</div>
                <div className="empty-state-sub">Belum ada pengajuan baru yang divalidasi oleh BAAK.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama Pendaftar</th>
                      <th>Email</th>
                      <th>Prodi Pilihan</th>
                      <th>Transkrip Asal</th>
                      <th style={{ width: 120 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.profile?.nama_lengkap}</strong></td>
                        <td>{item.profile?.email}</td>
                        <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--gray-500)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={12} /> {item.file_transkrip_url}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="btn btn-primary btn-sm"
                          >
                            Mulai Rekognisi
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
        /* Recognition Area */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Info */}
          <div className="card" style={{ background: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--indigo-600)', fontWeight: 700, textTransform: 'uppercase' }}>Pendaftar RPL Aktif</span>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--indigo-700)', margin: '2px 0 0 0' }}>{selectedItem.profile?.nama_lengkap}</h2>
                <p style={{ fontSize: 12.5, color: 'var(--gray-600)', margin: 0 }}>Prodi Tujuan: {selectedItem.prodi?.nama}</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setSelectedItem(null)} className="btn btn-secondary btn-sm">Batal</button>
              </div>
            </div>
          </div>

          {/* AI/Manual Option Selector */}
          {!recognitionMethod && !ocrRunning && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card" style={{ cursor: 'pointer', hover: { borderColor: 'var(--indigo-500)' } }} onClick={runAIOCR}>
                <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
                  <Brain size={42} color="var(--indigo-600)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Gunakan AI / OCR Gemini</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--gray-500)', lineHeight: 1.5 }}>
                    Secara otomatis mengekstrak seluruh daftar mata kuliah transkrip asal, menyandingkan nilai, dan memetakannya ke kurikulum OBE program studi ini menggunakan AI.
                  </p>
                </div>
              </div>

              <div className="card" style={{ cursor: 'pointer' }} onClick={handleManualInput}>
                <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
                  <Plus size={42} color="var(--gray-500)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Input Manual Terstruktur</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--gray-500)', lineHeight: 1.5 }}>
                    Lakukan pemetaan dan pencocokan secara manual satu-persatu. Cocok sebagai metode fallback jika hasil scan transkrip kurang presisi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI OCR Running Loader */}
          {ocrRunning && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <RefreshCw size={36} className="spinner" color="var(--indigo-600)" />
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Proses Analisis Smart Recognition</h3>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', background: 'var(--gray-50)', padding: '8px 16px', borderRadius: 6, border: '1px solid var(--gray-200)' }}>
                  🤖 {ocrProgress}
                </p>
              </div>
            </div>
          )}

          {/* Recognition Working Grid */}
          {recognitionMethod && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Tabel Pemetaan Rekognisi Mata Kuliah</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addRow} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                    <Plus size={14} /> Tambah Pemetaan
                  </button>
                  <button onClick={handleSubmitToAsessor} className="btn btn-primary btn-sm" style={{ gap: 4 }}>
                    <CheckCircle size={14} /> Selesaikan Pemetaan
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '35%' }}>Mata Kuliah Asal (Transkrip)</th>
                        <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '10%' }}>SKS Asal</th>
                        <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '10%' }}>Nilai</th>
                        <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '35%' }}>Disandingkan ke MK Kurikulum</th>
                        <th style={{ background: '#f8fafc', color: 'var(--indigo-700)', fontWeight: 800, borderBottom: '2px solid var(--indigo-100)', width: '10%' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={row.id}>
                          {/* MK Asal */}
                          <td>
                            <input
                              type="text"
                              value={row.mkAsal}
                              onChange={(e) => updateRow(row.id, 'mkAsal', e.target.value)}
                              placeholder="cth: Dasar Pemrograman I"
                              className="input"
                              style={{ padding: '6px 10px' }}
                            />
                          </td>

                          {/* SKS Asal */}
                          <td>
                            <input
                              type="number"
                              value={row.sksAsal || ''}
                              onChange={(e) => updateRow(row.id, 'sksAsal', e.target.value)}
                              placeholder="cth: 3"
                              className="input"
                              style={{ padding: '6px 10px' }}
                            />
                          </td>

                          {/* Nilai Asal */}
                          <td>
                            <input
                              type="text"
                              value={row.nilaiAsal}
                              onChange={(e) => updateRow(row.id, 'nilaiAsal', e.target.value.toUpperCase())}
                              placeholder="cth: A"
                              className="input"
                              style={{ padding: '6px 10px' }}
                            />
                          </td>

                          {/* Target MK Kurikulum */}
                          <td>
                            <select
                              value={row.mkTujuanId}
                              onChange={(e) => updateRow(row.id, 'mkTujuanId', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--gray-200)',
                                background: 'var(--surface)',
                                fontSize: '13px',
                                outline: 'none'
                              }}
                            >
                              <option value="">-- Pilih MK Kurikulum --</option>
                              {curriculumMK.map(mk => (
                                <option key={mk.id} value={mk.id}>
                                  {mk.kode_mk} - {mk.nama_mk} ({mk.sks} SKS, {mk.jenis.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Aksi Hapus */}
                          <td>
                            <button
                              onClick={() => deleteRow(row.id)}
                              className="btn btn-ghost btn-icon"
                              style={{ color: 'var(--danger)' }}
                              title="Hapus baris"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
