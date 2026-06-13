import { useState, useEffect } from 'react'
import { dbPengajuan } from '../../lib/db'
import { ClipboardCheck, FileText, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BaakDashboard() {
  const [submissions, setSubmissions] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(true)

  // Verification Checklist State
  const [chkName, setChkName] = useState(false)
  const [chkIjazah, setChkIjazah] = useState(false)
  const [chkTranskrip, setChkTranskrip] = useState(false)
  const [chkResolution, setChkResolution] = useState(false)

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      const { data } = await dbPengajuan.getAll()
      // Filter yang statusnya 'submitted'
      setSubmissions((data || []).filter(item => item.status === 'submitted'))
      setSelectedItem(null)
      // Reset checklist
      setChkName(false)
      setChkIjazah(false)
      setChkTranskrip(false)
      setChkResolution(false)
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

  const handleApprove = async () => {
    if (!chkName || !chkIjazah || !chkTranskrip || !chkResolution) {
      toast.error('Semua kriteria checklist verifikasi wajib disetujui')
      return
    }

    try {
      await dbPengajuan.updateStatus(selectedItem.id, 'validated_baak')
      toast.success('Pengajuan berhasil divalidasi dan diteruskan ke Ka. Prodi!')
      loadSubmissions()
    } catch (e) {
      console.error(e)
      toast.error('Gagal memvalidasi pengajuan')
    }
  }

  const handleReject = () => {
    toast.error('Pengajuan ditolak. Calon mahasiswa akan diberitahu (Simulasi).')
    setSelectedItem(null)
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
        <h1 className="page-title">Validasi Berkas (BAAK)</h1>
        <p className="page-subtitle">Verifikasi keabsahan dokumen persyaratan masuk program RPL</p>
      </div>

      {!selectedItem ? (
        /* List submissions */
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Daftar Pengajuan Masuk</h3>
            <span className="badge-pill badge-indigo">{submissions.length} Pengajuan</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {submissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📥</div>
                <div className="empty-state-text">Tidak ada pengajuan masuk</div>
                <div className="empty-state-sub">Semua dokumen masuk telah diproses atau belum ada pendaftar baru.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama Pendaftar</th>
                      <th>Email</th>
                      <th>Prodi Pilihan</th>
                      <th>Tanggal Masuk</th>
                      <th style={{ width: 100 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.profile?.nama_lengkap}</strong></td>
                        <td>{item.profile?.email}</td>
                        <td><span className="badge-pill badge-slate">{item.prodi?.nama}</span></td>
                        <td>{new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="btn btn-primary btn-sm"
                          >
                            Periksa
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
        /* Detailed inspection screen */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
          {/* Main Inspection Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Informasi Berkas Dokumen</h3>
                <button onClick={() => setSelectedItem(null)} className="btn btn-secondary btn-sm">Kembali</button>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 16, background: 'var(--surface-alt)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <FileText size={20} color="var(--indigo-600)" />
                      <strong style={{ fontSize: 13 }}>Dokumen Ijazah</strong>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>Nama File: {selectedItem.file_ijazah_url}</p>
                    <a href="#" onClick={(e) => { e.preventDefault(); alert(`Membuka PDF ijazah: ${selectedItem.file_ijazah_url}`); }} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>🔍 Lihat Dokumen</a>
                  </div>

                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: 16, background: 'var(--surface-alt)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <FileText size={20} color="var(--indigo-600)" />
                      <strong style={{ fontSize: 13 }}>Transkrip Nilai (Hi-Res)</strong>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 12 }}>Nama File: {selectedItem.file_transkrip_url}</p>
                    <a href="#" onClick={(e) => { e.preventDefault(); alert(`Membuka PDF transkrip: ${selectedItem.file_transkrip_url}`); }} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>🔍 Lihat Dokumen</a>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 13 }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Biodata Pendaftar:</strong>
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
                        <td style={{ padding: '4px 0', color: 'var(--gray-500)' }}>Pilihan Program Studi</td>
                        <td style={{ padding: '4px 0' }}>: {selectedItem.prodi?.nama}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Side Panel */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Checklist Kelayakan Berkas</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>Periksa dokumen di sebelah kiri, kemudian tandai kriteria kelayakan di bawah:</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={chkName} onChange={() => setChkName(!chkName)} style={{ marginTop: 3 }} />
                  <span>Nama di Ijazah & Transkrip sesuai dengan identitas pendaftar.</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={chkIjazah} onChange={() => setChkIjazah(!chkIjazah)} style={{ marginTop: 3 }} />
                  <span>Dokumen Ijazah terbaca jelas dan memiliki tanda tangan/stempel sah.</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={chkTranskrip} onChange={() => setChkTranskrip(!chkTranskrip)} style={{ marginTop: 3 }} />
                  <span>Transkrip nilai menampilkan SKS, kode mata kuliah, dan nilai dengan jelas.</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={chkResolution} onChange={() => setChkResolution(!chkResolution)} style={{ marginTop: 3 }} />
                  <span>Resolusi file PDF cukup tinggi untuk diproses oleh OCR (Smart Recognition).</span>
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={handleApprove}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', gap: 6 }}
                >
                  <CheckCircle size={15} /> Setujui & Kirim ke Ka. Prodi
                </button>
                <button
                  onClick={handleReject}
                  className="btn btn-danger"
                  style={{ width: '100%', justifyContent: 'center', gap: 6 }}
                >
                  <XCircle size={15} /> Tolak Pengajuan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
