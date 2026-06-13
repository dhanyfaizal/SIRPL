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
    <div className="report-page-container">
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .report-page-container {
            background-color: #f1f5f9;
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: 'Inter', system-ui, sans-serif;
            overflow: hidden;
          }
          .report-header-sticky {
            position: sticky;
            top: 0;
            z-index: 100;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .report-scroll-area {
            flex: 1;
            overflow-y: auto;
            padding: 24px 16px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          .report-sheet {
            width: 100%;
            max-width: 800px;
            background: #ffffff;
            padding: 40px 48px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border-radius: 8px;
            box-sizing: border-box;
          }
        }

        @media print {
          .no-print {
            display: none !important;
          }
          .report-page-container {
            background: none !important;
            min-height: auto !important;
            display: block !important;
          }
          .report-header-sticky {
            display: none !important;
          }
          .report-scroll-area {
            padding: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          .report-sheet {
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            border-radius: 0 !important;
          }
          
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          table {
            page-break-inside: auto !important;
          }
          .section-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          @page {
            margin: 15mm 20mm 15mm 20mm;
          }
        }
      `}} />

      {/* Action Header for Screen View */}
      <div className="report-header-sticky no-print">
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: '13px' }}>
          <ChevronLeft size={16} /> Kembali ke Dashboard
        </button>
        <button onClick={() => window.print()} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: '13px' }}>
          <Printer size={16} /> Cetak Lembar Rencana Studi (PDF)
        </button>
      </div>

      {/* Main Print Container with Scroll Area */}
      <div className="report-scroll-area">
        <div className="report-sheet">
          {/* Official Letter Head */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
            borderBottom: '3px double #1e293b', 
            paddingBottom: '16px', 
            marginBottom: '24px' 
          }}>
            <img 
              src="/logo-sys.png" 
              alt="STIKOM Yos Sudarso Logo" 
              style={{ width: '75px', height: 'auto', flexShrink: 0 }} 
              onError={e => e.target.style.display='none'}
            />
            <div style={{ flexGrow: 1, textAlign: 'center', marginRight: '95px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                STIKOM Yos Sudarso Purwokerto
              </h2>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 4px 0' }}>
                Jl. Jend. Sudirman No. 507 Purwokerto Barat, Banyumas · Telp: (0281) 641505
              </p>
              <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>
                Email: info@stikomyos.ac.id · Website: www.stikomyos.ac.id
              </p>
            </div>
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
          <div className="section-page-break" style={{ marginBottom: '28px' }}>
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
          <div className="section-page-break" style={{ marginBottom: '40px' }}>
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

          {/* Date Line (above the columns) */}
          <div style={{ textAlign: 'right', fontSize: '12px', marginBottom: '16px', paddingRight: '50px' }}>
            Purwokerto, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {/* Signature Area */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', textAlign: 'center', fontSize: '12px', pageBreakInside: 'avoid' }}>
            <div>
              <p style={{ margin: '0 0 70px 0', lineHeight: 1.6 }}>Mengetahui,<br /><strong>Wakil Ketua Bidang Akademik</strong></p>
              <p style={{ margin: 0, textDecoration: 'underline', fontWeight: 700 }}>Dr. Adhi Wibowo, S.Kom., M.M., M.T.I.</p>
            </div>
            <div>
              <p style={{ margin: '0 0 70px 0', lineHeight: 1.6 }}>Menyetujui,<br /><strong>Ketua Sekolah Tinggi</strong></p>
              <p style={{ margin: 0, textDecoration: 'underline', fontWeight: 700 }}>Romanus Edy Prabowo, S.Si., M.Sc., Ph.D.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
