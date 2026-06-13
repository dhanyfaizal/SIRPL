import { useState, useEffect } from 'react'
import { dbPengajuan, dbMK, dbRekognisi, dbPenetapan } from '../../lib/db'
import { GraduationCap, FileText, CheckCircle, Calculator, Info, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AsessorDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [curriculumMK, setCurriculumMK] = useState([])

  // State Table Rows (reviewed from Kaprodi)
  // Structure: { id, mkAsal, sksAsal, nilaiAsal, mkTujuanId, sksTujuan, statusTujuan, isCertified }
  const [rows, setRows] = useState([])

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      // Filter yang statusnya 'recognized_kaprodi'
      setSubmissions((data || []).filter(item => item.status === 'recognized_kaprodi'))
      setSelectedItem(null)
      setRows([])
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
      loadCurriculum(selectedItem.prodi_pilihan_id)
      loadRecognitionTable(selectedItem.id)
    }
  }, [selectedItem])

  const loadRecognitionTable = async (pengajuanId) => {
    try {
      const { data } = await dbRekognisi.getByPengajuanId(pengajuanId)
      if (data && data.data_mapping_mk) {
        // Map ke internal state
        const initialRows = data.data_mapping_mk.map((item, idx) => ({
          id: 'row-rec-' + idx,
          mkAsal: item.MK_Asal,
          sksAsal: item.SKS_Asal,
          nilaiAsal: item.Nilai,
          mkTujuanId: item.MK_Tujuan_ID,
          sksTujuan: item.SKS_Tujuan,
          statusTujuan: 'disetujui' // Asessor default menyetujui, bisa ditolak
        }))
        setRows(initialRows)
      }
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data tabel rekognisi')
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
        isCertified: true
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
            Status: r.statusTujuan === 'disetujui' ? 'diakui' : 'ditolak'
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
        <h1 className="page-title">Asesmen Akademik & Kalkulasi (Asessor)</h1>
        <p className="page-subtitle">Verifikasi pemetaan rekognisi, tambahkan portofolio, dan kalkulasi biaya awal</p>
      </div>

      {!selectedItem ? (
        /* List submissions */
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Menunggu Asesmen Portofolio</h3>
            <span className="badge-pill badge-indigo">{submissions.length} Pengajuan</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {submissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">⚖️</div>
                <div className="empty-state-text">Tidak ada pengajuan masuk</div>
                <div className="empty-state-sub">Belum ada hasil rekognisi Ka. Prodi yang dikirim untuk asesmen.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama Pendaftar</th>
                      <th>Email</th>
                      <th>Prodi Tujuan</th>
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
                        <td>{item.file_transkrip_url}</td>
                        <td>
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="btn btn-primary btn-sm"
                          >
                            Mulai Asesmen
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
        /* Assessment Area */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Main Table Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Evaluasi Transkrip & Justifikasi Portofolio</h3>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Pendaftar: <strong>{selectedItem.profile?.nama_lengkap}</strong> ({selectedItem.prodi?.nama})</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addPortfolioRow} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
                    <Plus size={14} /> Tambah Portofolio/Sertifikasi
                  </button>
                  <button onClick={() => setSelectedItem(null)} className="btn btn-ghost btn-sm">Kembali</button>
                </div>
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
                        <th style={{ width: 60 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={row.id} style={{ background: row.statusTujuan === 'ditolak' ? '#fee2e2' : '' }}>
                          <td>
                            {row.isCertified ? (
                              <input
                                type="text"
                                value={row.mkAsal}
                                onChange={(e) => updateRowField(row.id, 'mkAsal', e.target.value)}
                                className="input"
                                style={{ padding: '6px 10px' }}
                              />
                            ) : (
                              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{row.mkAsal}</span>
                            )}
                          </td>
                          <td>
                            {row.isCertified ? (
                              <input
                                type="text"
                                value={row.nilaiAsal}
                                onChange={(e) => updateRowField(row.id, 'nilaiAsal', e.target.value)}
                                className="input"
                                style={{ padding: '6px 10px' }}
                              />
                            ) : (
                              <span style={{ fontSize: 12.5 }}>{row.nilaiAsal}</span>
                            )}
                          </td>
                          <td>
                            {row.isCertified ? (
                              <select
                                value={row.mkTujuanId}
                                onChange={(e) => updateRowField(row.id, 'mkTujuanId', e.target.value)}
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
                              onChange={(e) => updateRowField(row.id, 'statusTujuan', e.target.value)}
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
                          <td>
                            {row.isCertified ? (
                              <button onClick={() => deleteRow(row.id)} className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }}>
                                <Trash2 size={15} />
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Kaprodi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Calculation Side Panel */}
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
              <div className="card-footer">
                <button
                  onClick={handleSubmitToAdmin}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}
                >
                  Kirim Rekomendasi Biaya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
