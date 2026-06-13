import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { dbPengajuan, dbRekognisi, dbPenetapan } from '../../lib/db'
import { Printer, ChevronLeft } from 'lucide-react'

export default function ReportPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pengajuan, setPengajuan] = useState(null)
  const [rekognisi, setRekognisi] = useState(null)
  const [penetapan, setPenetapan] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadReportData = async () => {
      setLoading(true)
      try {
        const { data: pData } = await dbPengajuan.getById(id)
        setPengajuan(pData)

        const { data: rData } = await dbRekognisi.getByPengajuanId(id)
        setRekognisi(rData)

        const { data: peData } = await dbPenetapan.getByPengajuanId(id)
        setPenetapan(peData)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    if (id) loadReportData()
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ fontSize: 13 }}>Memuat dokumen laporan...</p>
      </div>
    )
  }

  if (!pengajuan || !penetapan) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h3>Dokumen Tidak Ditemukan</h3>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
          Kembali ke Dashboard
        </button>
      </div>
    )
  }

  // Group remaining courses by pathway
  const rStudi = penetapan.rencana_studi || []
  const moocsCourses = rStudi.filter(c => c.jalur === 'asinkron')
  const syncCourses = rStudi.filter(c => c.jalur === 'sinkron')

  // recognized courses
  const recognizedCourses = (rekognisi?.data_mapping_mk || []).filter(c => c.Status === 'diakui')

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      background: '#fff',
      padding: '40px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#1e293b',
      lineHeight: 1.5
    }}>
      {/* Action Header for Screen View */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        marginBottom: '30px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary btn-sm" style={{ gap: 4 }}>
          <ChevronLeft size={14} /> Kembali ke Dashboard
        </button>
        <button onClick={() => window.print()} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
          <Printer size={14} /> Cetak Lembar Rencana Studi (PDF)
        </button>
      </div>

      {/* Official Letter Head */}
      <div style={{ textAlign: 'center', borderBottom: '3px double #1e293b', paddingBottom: '16px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          STIKOM Yos Sudarso Purwokerto
        </h2>
        <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 6px 0' }}>
          Jl. Jend. Sudirman No. 507 Purwokerto Barat, Banyumas · Telp: (0281) 641505
        </p>
        <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>
          Email: info@stikomyos.ac.id · Website: www.stikomyos.ac.id
        </p>
      </div>

      {/* Document Title */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', textDecoration: 'underline', margin: '0 0 4px 0' }}>
          Rencana Studi Mahasiswa Rekognisi Pembelajaran Lampau (RPL)
        </h3>
        <span style={{ fontSize: '11.5px', color: '#64748b' }}>Nomor Dokumen: RPL-{pengajuan.id.slice(0, 8).toUpperCase()}-{new Date(pengajuan.created_at).getFullYear()}</span>
      </div>

      {/* Applicant Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: '24px', fontSize: '12.5px', background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
        <div>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: 110, color: '#64748b', padding: '2px 0' }}>Nama Mahasiswa</td>
                <td style={{ padding: '2px 0' }}>: <strong>{pengajuan.profile?.nama_lengkap}</strong></td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Email Pendaftar</td>
                <td style={{ padding: '2px 0' }}>: {pengajuan.profile?.email}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ width: 110, color: '#64748b', padding: '2px 0' }}>Program Studi</td>
                <td style={{ padding: '2px 0' }}>: {pengajuan.prodi?.nama}</td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Tanggal Penetapan</td>
                <td style={{ padding: '2px 0' }}>: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 1: Recognized Courses */}
      <div style={{ marginBottom: '28px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', color: '#4f46e5' }}>
          I. Daftar Mata Kuliah yang Direkognisi / Diakui
        </h4>
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', width: '35%' }}>Mata Kuliah Asal (Transkrip)</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', width: '10%' }}>Nilai Asal</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', width: '45%' }}>Disetarakan ke MK Kurikulum</th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', width: '10%' }}>SKS</th>
            </tr>
          </thead>
          <tbody>
            {recognizedCourses.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ border: '1px solid #cbd5e1', padding: '12px', textAlign: 'center', color: '#64748b' }}>Tidak ada mata kuliah yang diakui.</td>
              </tr>
            ) : (
              recognizedCourses.map((c, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{c.MK_Asal}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>{c.Nilai}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{c.MK_Tujuan_Kode} - {c.MK_Tujuan_Nama}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>{c.SKS_Tujuan}</td>
                </tr>
              ))
            )}
          </tbody>
          {recognizedCourses.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td colSpan="3" style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right' }}>Total Kredit Diakui:</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>{penetapan.total_sks_diakui} SKS</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Section 2: Remaining Courses Path Mapping */}
      <div style={{ marginBottom: '28px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', color: '#4f46e5' }}>
          II. Rencana Jalur Kelas Studi Sisa
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* MOOCs Column */}
          <div>
            <h5 style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: '#0369a1' }}>
              🌐 Jalur Asinkron (MOOCs)
            </h5>
            <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f0f9ff' }}>
                  <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'left' }}>Nama Mata Kuliah</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', width: '60px' }}>SKS</th>
                </tr>
              </thead>
              <tbody>
                {moocsCourses.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', color: '#94a3b8' }}>Tidak ada.</td>
                  </tr>
                ) : (
                  moocsCourses.map((c, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.nama} <span style={{ fontSize: '9.5px', color: '#64748b' }}>({c.kode})</span></td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>{c.sks}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Synchronous/Tatap Muka Column */}
          <div>
            <h5 style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', color: '#86198f' }}>
              🏫 Jalur Sinkron (Tatap Muka)
            </h5>
            <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fdf4ff' }}>
                  <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'left' }}>Nama Mata Kuliah</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', width: '60px' }}>SKS</th>
                </tr>
              </thead>
              <tbody>
                {syncCourses.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center', color: '#94a3b8' }}>Tidak ada.</td>
                  </tr>
                ) : (
                  syncCourses.map((c, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{c.nama} <span style={{ fontSize: '9.5px', color: '#64748b' }}>({c.kode})</span></td>
                      <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>{c.sks}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ fontSize: '11.5px', marginTop: '10px', textAlign: 'right', fontWeight: 700 }}>
          Total SKS Sisa yang Harus Ditempuh: {penetapan.total_sks_sisa} SKS
        </div>
      </div>

      {/* Section 3: Financial Summary */}
      <div style={{ marginBottom: '40px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '10px', color: '#4f46e5' }}>
          III. Rincian Biaya Perkuliahan Semester
        </h4>
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', fontSize: '12.5px' }}>
          <table style={{ width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Uang Kuliah Paket (UKP) Semester fasa 1-6</td>
                <td style={{ padding: '4px 0', textAlign: 'right', width: '160px' }}>Rp5.400.000,00</td>
              </tr>
              <tr>
                <td style={{ padding: '4px 0', color: '#64748b' }}>Biaya Pengakuan Kredit SKS RPL ({penetapan.total_sks_diakui} SKS x Rp50.000,00)</td>
                <td style={{ padding: '4px 0', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                  Rp{(penetapan.total_sks_diakui * 50000).toLocaleString('id-ID')},00
                </td>
              </tr>
              {penetapan.potongan_biaya > 0 && (
                <>
                  <tr style={{ color: '#ef4444' }}>
                    <td style={{ padding: '6px 0 2px' }}>
                      <strong>Potongan Biaya Khusus (Diskon Individu)</strong><br />
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Catatan: {penetapan.catatan_potongan || '-'}</span>
                    </td>
                    <td style={{ padding: '6px 0 2px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                      - Rp{parseFloat(penetapan.potongan_biaya).toLocaleString('id-ID')},00
                    </td>
                  </tr>
                </>
              )}
              <tr style={{ fontSize: '14px', fontWeight: 800 }}>
                <td style={{ padding: '10px 0 0' }}>Total Biaya yang Harus Dibayar (Net):</td>
                <td style={{ padding: '10px 0 0', textAlign: 'right', color: '#065f46' }}>
                  Rp{parseFloat(penetapan.biaya_total).toLocaleString('id-ID')},00
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', textAlign: 'center', fontSize: '12px', marginTop: '30px' }}>
        <div>
          <p style={{ margin: '0 0 60px 0' }}>Menyetujui,<br /><strong>Kepala Program Studi</strong></p>
          <p style={{ margin: 0, textDecoration: 'underline', fontWeight: 700 }}>Hendra Wijaya, M.T.</p>
          <p style={{ margin: 0, color: '#64748b' }}>NIDN. 0620088901</p>
        </div>
        <div>
          <p style={{ margin: '0 0 60px 0' }}>Purwokerto, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><strong>Admin Akademik</strong></p>
          <p style={{ margin: 0, textDecoration: 'underline', fontWeight: 700 }}>Ignatius Adi</p>
          <p style={{ margin: 0, color: '#64748b' }}>NIP. 20128910</p>
        </div>
      </div>
    </div>
  )
}
