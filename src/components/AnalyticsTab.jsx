import { useState, useEffect } from 'react'
import { dbRekognisi, dbFeedback } from '../lib/db'
import { Clock, GraduationCap, Building2, ClipboardCheck, Sparkles, AlertTriangle, Star, Smile, MessageSquare } from 'lucide-react'

export default function AnalyticsTab({ submissions = [] }) {
  const [recognitionList, setRecognitionList] = useState([])
  const [feedbackList, setFeedbackList] = useState([])
  const [hoveredProdi, setHoveredProdi] = useState(null)
  const [hoveredStatus, setHoveredStatus] = useState(null)

  useEffect(() => {
    dbRekognisi.getAll().then(({ data }) => {
      setRecognitionList(data || [])
    }).catch(err => console.error('Failed to load recognition details:', err))

    dbFeedback.getAll().then(({ data }) => {
      setFeedbackList(data || [])
    }).catch(err => console.error('Failed to load feedback details:', err))
  }, [])

  // ── 1. Data Aggregation ──────────────────────────────────────────
  const totalApplicants = submissions.length
  const now = new Date()

  // Program Studi Counts
  const prodiCounts = {}
  submissions.forEach(s => {
    const prodiName = s.prodi?.nama || 'Belum Memilih'
    prodiCounts[prodiName] = (prodiCounts[prodiName] || 0) + 1
  })
  
  const prodiData = Object.entries(prodiCounts).map(([name, count]) => ({
    name,
    count
  })).sort((a, b) => b.count - a.count)

  // Status Distribution
  const statusGroups = {
    draft: { label: 'Draf', count: 0, color: '#64748b' }, // slate
    baak: { label: 'Validasi BAAK', count: 0, color: '#f59e0b' }, // amber
    kaprodi: { label: 'Proses Kaprodi', color: '#6366f1', count: 0 }, // indigo
    asessor: { label: 'Proses Asessor', color: '#8b5cf6', count: 0 }, // violet
    admin: { label: 'Proses Admin', color: '#ec4899', count: 0 }, // pink
    mapped: { label: 'Rencana Studi Terbit', color: '#10b981', count: 0 } // emerald
  }

  submissions.forEach(s => {
    if (s.status === 'draft') {
      statusGroups.draft.count++
    } else if (['submitted', 'returned_kaprodi'].includes(s.status)) {
      statusGroups.baak.count++
    } else if (['validated_baak', 'returned_asessor'].includes(s.status)) {
      statusGroups.kaprodi.count++
    } else if (['recognized_kaprodi', 'returned_admin'].includes(s.status)) {
      statusGroups.asessor.count++
    } else if (s.status === 'assessed_asessor') {
      statusGroups.admin.count++
    } else if (s.status === 'mapped_admin') {
      statusGroups.mapped.count++
    } else {
      statusGroups.draft.count++
    }
  })

  const statusData = Object.entries(statusGroups)
    .map(([key, value]) => ({ key, ...value }))
    .filter(item => item.count > 0)

  // Rata-rata SKS Diakui
  const mappedSubmissions = submissions.filter(s => s.status === 'mapped_admin' || s.total_sks_diakui > 0)
  const avgSksDiakui = mappedSubmissions.length > 0
    ? (mappedSubmissions.reduce((sum, s) => sum + (s.total_sks_diakui || 0), 0) / mappedSubmissions.length).toFixed(1)
    : 0

  // Total Estimasi Revenue
  const totalRevenue = submissions.reduce((sum, s) => sum + (parseFloat(s.biaya_total) || 0), 0)

  // ── SLA Wait Time per Stage ──────────────────────────────────────
  let sumBaak = 0, countBaak = 0
  let sumKaprodi = 0, countKaprodi = 0
  let sumAsessor = 0, countAsessor = 0
  let sumAdmin = 0, countAdmin = 0
  let sumTotal = 0, countTotal = 0

  submissions.forEach(s => {
    if (!s.submitted_at) return
    const submittedTime = new Date(s.submitted_at)
    const updatedTime = new Date(s.updated_at || s.created_at)

    if (s.status === 'submitted' || s.status === 'returned_kaprodi') {
      sumBaak += (now - submittedTime)
      countBaak++
    } else if (s.status === 'validated_baak' || s.status === 'returned_asessor') {
      sumKaprodi += (now - updatedTime)
      countKaprodi++
    } else if (s.status === 'recognized_kaprodi' || s.status === 'returned_admin') {
      sumAsessor += (now - updatedTime)
      countAsessor++
    } else if (s.status === 'assessed_asessor') {
      sumAdmin += (now - updatedTime)
      countAdmin++
    } else if (s.status === 'mapped_admin') {
      sumTotal += (updatedTime - submittedTime)
      countTotal++
    }
  })

  const avgBaakDays = countBaak > 0 ? (sumBaak / countBaak / 86400000).toFixed(1) : null
  const avgKaprodiDays = countKaprodi > 0 ? (sumKaprodi / countKaprodi / 86400000).toFixed(1) : null
  const avgAsessorDays = countAsessor > 0 ? (sumAsessor / countAsessor / 86400000).toFixed(1) : null
  const avgAdminDays = countAdmin > 0 ? (sumAdmin / countAdmin / 86400000).toFixed(1) : null
  const avgTotalDays = countTotal > 0 ? (sumTotal / countTotal / 86400000).toFixed(1) : null

  // ── Revision Rate calculations ───────────────────────────────────
  const revisionCount = submissions.filter(s => 
    ['returned_baak', 'returned_kaprodi', 'returned_asessor', 'returned_admin'].includes(s.status) || 
    (s.catatan_revisi && s.catatan_revisi.trim() !== '')
  ).length
  const revisionPercent = totalApplicants > 0 ? Math.round((revisionCount / totalApplicants) * 100) : 0
  const cleanPercent = 100 - revisionPercent

  // ── Curriculum Course Recognition counts ─────────────────────────
  const courseCounts = {}
  recognitionList.forEach(rec => {
    const mappings = rec.data_mapping_mk || []
    mappings.forEach(m => {
      if (m.Status === 'diakui' || m.Status === 'disetujui') {
        const name = m.MK_Tujuan_Nama || '-'
        courseCounts[name] = (courseCounts[name] || 0) + 1
      }
    })
  })

  const topRecognizedCourses = Object.entries(courseCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // ── Portofolio Impact metrics ────────────────────────────────────
  let totalCertificates = 0
  let totalExperiences = 0
  submissions.forEach(s => {
    totalCertificates += (s.sertifikat_kompetensi || []).length
    totalExperiences += (s.pengalaman_kerja || []).length
  })

  // ── B2B Instansi Demographics ────────────────────────────────────
  const companyCounts = {}
  submissions.forEach(s => {
    const experiences = s.pengalaman_kerja || []
    experiences.forEach(ex => {
      let comp = (ex.perusahaan || '').trim()
      if (comp) {
        comp = comp.replace(/^(PT\.\s+|PT\s+|CV\.\s+|CV\s+)/i, '').trim()
        comp = comp.toUpperCase()
        companyCounts[comp] = (companyCounts[comp] || 0) + 1
      }
    })
  })

  const topCompanies = Object.entries(companyCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // ── Top Certificate Publishers ───────────────────────────────────
  const publisherCounts = {}
  submissions.forEach(s => {
    const certs = s.sertifikat_kompetensi || []
    certs.forEach(c => {
      let pub = (c.penerbit || '').trim()
      if (pub) {
        pub = pub.toUpperCase()
        publisherCounts[pub] = (publisherCounts[pub] || 0) + 1
      }
    })
  })

  const topPublishers = Object.entries(publisherCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // ── Feedback / Satisfaction Metrics ────────────────────────────────
  const totalFeedbackCount = feedbackList.length
  let avgKemudahan = '0.0'
  let avgKejelasan = '0.0'
  let avgKecepatan = '0.0'
  let csatScore = 0

  if (totalFeedbackCount > 0) {
    const sumKemudahan = feedbackList.reduce((sum, f) => sum + (f.rating_kemudahan || 0), 0)
    const sumKejelasan = feedbackList.reduce((sum, f) => sum + (f.rating_kejelasan || 0), 0)
    const sumKecepatan = feedbackList.reduce((sum, f) => sum + (f.rating_kecepatan || 0), 0)

    avgKemudahan = (sumKemudahan / totalFeedbackCount).toFixed(1)
    avgKejelasan = (sumKejelasan / totalFeedbackCount).toFixed(1)
    avgKecepatan = (sumKecepatan / totalFeedbackCount).toFixed(1)

    const totalStarsPossible = totalFeedbackCount * 15
    const totalStarsEarned = sumKemudahan + sumKejelasan + sumKecepatan
    csatScore = Math.round((totalStarsEarned / totalStarsPossible) * 100)
  }

  // ── SVG Math & Settings ──────────────────────────────────────────
  const maxProdiCount = prodiData.length > 0 ? Math.max(...prodiData.map(d => d.count)) : 0
  const barChartWidth = 500
  const barChartHeight = 220
  const paddingLeft = 130
  const paddingRight = 30
  const paddingTop = 20
  const paddingBottom = 40
  const chartInnerWidth = barChartWidth - paddingLeft - paddingRight
  const chartInnerHeight = barChartHeight - paddingTop - paddingBottom
  const barHeight = prodiData.length > 0 ? Math.floor(chartInnerHeight / prodiData.length) : 0
  const barGap = 4

  const donutCX = 100
  const donutCY = 100
  const donutR = 55
  const donutCircumference = 2 * Math.PI * donutR // ~345.57
  const totalStatusCount = statusData.reduce((sum, d) => sum + d.count, 0)

  let accumulatedPercent = 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cards Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--indigo-600)' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Rerata SKS Diakui</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)', marginTop: 4 }}>{avgSksDiakui} SKS</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Dari total {mappedSubmissions.length} pengajuan dinilai</div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Estimasi Pendapatan UKP</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>Rp{totalRevenue.toLocaleString('id-ID')}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Akumulasi seluruh pengajuan aktif</div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--amber-500)' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>SLA Rerata Total</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)', marginTop: 4 }}>{avgTotalDays ? `${avgTotalDays} Hari` : '-'}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Waktu tunggu submit hingga final</div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #ec4899' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Rasio Kelolosan Berkas</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)', marginTop: 4 }}>{cleanPercent}%</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Pengajuan lancar tanpa revisi</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: OPERASIONAL & SLA DASHBOARD */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color="var(--indigo-600)" />
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Analitik Operasional & SLA Kecepatan Proses</h3>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, padding: 20, flexWrap: 'wrap' }}>
          
          {/* SLA Timeline Per Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gray-600)', margin: 0 }}>Rata-rata Waktu Tunggu per Tahapan Evaluasi</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* BAAK SLA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Validasi Persyaratan Masuk (BAAK)</span>
                  <span style={{ fontWeight: 700, color: 'var(--amber-600)' }}>{avgBaakDays ? `${avgBaakDays} Hari` : 'Aktif: 0 Hari'}</span>
                </div>
                <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: avgBaakDays ? `${Math.min(100, avgBaakDays * 20)}%` : '5%', background: '#f59e0b', height: '100%', borderRadius: 4 }} />
                </div>
              </div>

              {/* Kaprodi SLA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Evaluasi Transkrip & Portofolio (Kaprodi)</span>
                  <span style={{ fontWeight: 700, color: 'var(--indigo-600)' }}>{avgKaprodiDays ? `${avgKaprodiDays} Hari` : 'Aktif: 0 Hari'}</span>
                </div>
                <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: avgKaprodiDays ? `${Math.min(100, avgKaprodiDays * 20)}%` : '5%', background: '#6366f1', height: '100%', borderRadius: 4 }} />
                </div>
              </div>

              {/* Asessor SLA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Asesmen Akademik Uji Kompetensi (Asessor)</span>
                  <span style={{ fontWeight: 700, color: 'var(--purple-600)' }}>{avgAsessorDays ? `${avgAsessorDays} Hari` : 'Aktif: 0 Hari'}</span>
                </div>
                <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: avgAsessorDays ? `${Math.min(100, avgAsessorDays * 20)}%` : '5%', background: '#8b5cf6', height: '100%', borderRadius: 4 }} />
                </div>
              </div>

              {/* Admin SLA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Pemetaan Studi & Finalisasi Biaya (Admin)</span>
                  <span style={{ fontWeight: 700, color: 'var(--pink-600)' }}>{avgAdminDays ? `${avgAdminDays} Hari` : 'Aktif: 0 Hari'}</span>
                </div>
                <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: avgAdminDays ? `${Math.min(100, avgAdminDays * 20)}%` : '5%', background: '#ec4899', height: '100%', borderRadius: 4 }} />
                </div>
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic', marginTop: 4 }}>
              *Estimasi waktu dihitung sejak berkas dipindahkan ke tahap tersebut sampai dilanjutkan ke tahap berikutnya.
            </span>
          </div>

          {/* Revision Rate Pie Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--gray-200)', paddingLeft: 20 }}>
            <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 16 }}>Rasio Pengembalian / Revisi Berkas</h4>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="30" fill="transparent" stroke="#10b981" strokeWidth="12" />
                  {revisionPercent > 0 && (
                    <circle
                      cx="60"
                      cy="60"
                      r="30"
                      fill="transparent"
                      stroke="#ef4444"
                      strokeWidth="12.5"
                      strokeDasharray={`${(revisionPercent / 100) * 188.5} 188.5`}
                      style={{ transition: 'all 0.4s ease' }}
                    />
                  )}
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-700)' }}>{revisionPercent}%</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }} />
                  <span>Berkas Lancar ({totalApplicants - revisionCount} Mhs)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} />
                  <span>Berkas Direvisi ({revisionCount} Mhs)</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 2: ACADEMIC & CURRICULUM ANALYTICS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, flexWrap: 'wrap' }}>
        
        {/* Top Recognized Courses */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap size={16} color="var(--indigo-600)" />
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Mata Kuliah Paling Banyak Direkognisi</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
            {topRecognizedCourses.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic', textAlign: 'center', padding: 24 }}>
                Belum ada data mata kuliah yang direkognisi/diakui.
              </div>
            ) : (
              topRecognizedCourses.map((c, idx) => {
                const maxVal = topRecognizedCourses[0].count
                const pct = maxVal > 0 ? (c.count / maxVal) * 100 : 0
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        {idx + 1}. {c.name}
                      </span>
                      <strong style={{ color: 'var(--indigo-600)' }}>{c.count} Kali</strong>
                    </div>
                    <div style={{ height: 6, background: 'var(--gray-50)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, background: 'var(--indigo-500)', height: '100%', borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Portfolio Impact Metrics */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardCheck size={16} color="var(--indigo-600)" />
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Dampak Portofolio Pendukung</h3>
          </div>
          <div className="card-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.4 }}>
              Perbandingan total berkas sertifikat kompetensi vs portofolio pengalaman kerja yang diunggah oleh calon mahasiswa:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Sertifikat Kompetensi */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <span>🏆 Sertifikat Kompetensi</span>
                  <span>{totalCertificates} Berkas</span>
                </div>
                <div style={{ height: 12, background: 'var(--gray-100)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ 
                    width: totalCertificates + totalExperiences > 0 ? `${(totalCertificates / (totalCertificates + totalExperiences)) * 100}%` : '50%', 
                    background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)', 
                    height: '100%' 
                  }} />
                </div>
              </div>

              {/* Pengalaman Kerja */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <span>💼 Portofolio Pengalaman Kerja</span>
                  <span>{totalExperiences} Berkas</span>
                </div>
                <div style={{ height: 12, background: 'var(--gray-100)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ 
                    width: totalCertificates + totalExperiences > 0 ? `${(totalExperiences / (totalCertificates + totalExperiences)) * 100}%` : '50%', 
                    background: 'linear-gradient(90deg, #06b6d4, #67e8f9)', 
                    height: '100%' 
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 3: DEMOGRAPHY & B2B MARKETING */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
        
        {/* Top Companies (B2B) */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} color="var(--indigo-600)" />
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Top 5 Asal Perusahaan Calon (Kemitraan B2B)</h3>
          </div>
          <div className="card-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topCompanies.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic', textAlign: 'center', padding: 24 }}>
                Belum ada data instansi asal pendaftar.
              </div>
            ) : (
              topCompanies.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', fontSize: 12.5, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid var(--gray-100)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 800, color: 'var(--indigo-600)', fontSize: 13 }}>#{idx + 1}</span>
                    <span style={{ fontWeight: 700, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                  </div>
                  <strong style={{ color: 'var(--gray-600)', background: '#fff', padding: '2px 8px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                    {c.count} Karyawan
                  </strong>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Certificate Publishers */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="var(--indigo-600)" />
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Top 5 Penerbit Sertifikasi Terbanyak</h3>
          </div>
          <div className="card-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topPublishers.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic', textAlign: 'center', padding: 24 }}>
                Belum ada data penerbit sertifikasi kompetensi.
              </div>
            ) : (
              topPublishers.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', fontSize: 12.5, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid var(--gray-100)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 800, color: 'var(--purple-600)', fontSize: 13 }}>#{idx + 1}</span>
                    <span style={{ fontWeight: 700, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                  </div>
                  <strong style={{ color: 'var(--gray-600)', background: '#fff', padding: '2px 8px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                    {p.count} Berkas
                  </strong>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* SECTION: FEEDBACK & KEPUASAN PELAYANAN */}
      <div className="card" style={{ borderTop: '4px solid var(--amber-500)' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smile size={16} color="var(--amber-500)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Ulasan & Kepuasan Pelayanan Pendaftar</h3>
          </div>
          <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700, background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 12 }}>
            {totalFeedbackCount} Responden
          </span>
        </div>
        
        {totalFeedbackCount === 0 ? (
          <div className="card-body" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontStyle: 'italic' }}>
            Belum ada data ulasan atau penilaian kepuasan dari pendaftar.
          </div>
        ) : (
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, padding: 20 }}>
            {/* Card 1: CSAT Index */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fef3c7, #fffbeb)', padding: 20, borderRadius: 12, border: '1px solid #fde68a' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--amber-700)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>CSAT Index (Keseluruhan)</span>
              
              <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="45" fill="transparent" stroke="#fef3c7" strokeWidth="8" />
                  <circle
                    cx="60"
                    cy="60"
                    r="45"
                    fill="transparent"
                    stroke="var(--amber-500)"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - csatScore / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber-800)' }}>{csatScore}%</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber-600)', marginTop: -2 }}>Sangat Puas</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--amber-800)', textAlign: 'center', margin: '12px 0 0 0', lineHeight: 1.4 }}>
                Persentase ulasan positif pendaftar terhadap kemudahan portal, kejelasan studi, dan kecepatan layanan.
              </p>
            </div>

            {/* Card 2: Question Metrics with Stars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', margin: '0 0 4px 0' }}>Rerata Kepuasan per Aspek</h4>
              
              {/* Aspek 1: Kemudahan Portal */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--gray-600)' }}>1. Kemudahan Portal & Upload</span>
                  <span style={{ fontWeight: 700, color: 'var(--gray-700)' }}>{avgKemudahan} / 5.0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={12}
                        fill={s <= Math.round(parseFloat(avgKemudahan)) ? 'var(--amber-500)' : 'transparent'}
                        stroke={s <= Math.round(parseFloat(avgKemudahan)) ? 'var(--amber-500)' : 'var(--gray-300)'}
                      />
                    ))}
                  </div>
                  <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(parseFloat(avgKemudahan) / 5) * 100}%`, background: 'var(--amber-500)', height: '100%', borderRadius: 3 }} />
                  </div>
                </div>
              </div>

              {/* Aspek 2: Kejelasan Rencana Studi */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--gray-600)' }}>2. Kejelasan Rencana & Biaya</span>
                  <span style={{ fontWeight: 700, color: 'var(--gray-700)' }}>{avgKejelasan} / 5.0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={12}
                        fill={s <= Math.round(parseFloat(avgKejelasan)) ? 'var(--amber-500)' : 'transparent'}
                        stroke={s <= Math.round(parseFloat(avgKejelasan)) ? 'var(--amber-500)' : 'var(--gray-300)'}
                      />
                    ))}
                  </div>
                  <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(parseFloat(avgKejelasan) / 5) * 100}%`, background: 'var(--amber-500)', height: '100%', borderRadius: 3 }} />
                  </div>
                </div>
              </div>

              {/* Aspek 3: Kecepatan Layanan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--gray-600)' }}>3. Kecepatan Validasi & Layanan</span>
                  <span style={{ fontWeight: 700, color: 'var(--gray-700)' }}>{avgKecepatan} / 5.0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 1 }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={12}
                        fill={s <= Math.round(parseFloat(avgKecepatan)) ? 'var(--amber-500)' : 'transparent'}
                        stroke={s <= Math.round(parseFloat(avgKecepatan)) ? 'var(--amber-500)' : 'var(--gray-300)'}
                      />
                    ))}
                  </div>
                  <div style={{ flex: 1, height: 6, background: 'var(--gray-100)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(parseFloat(avgKecepatan) / 5) * 100}%`, background: 'var(--amber-500)', height: '100%', borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Scrollable Comments list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <MessageSquare size={14} color="var(--indigo-600)" />
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', margin: 0 }}>Saran & Masukan Terbaru</h4>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4, scrollbarWidth: 'thin' }}>
                {feedbackList.map((f, idx) => {
                  const applicantName = f.profile?.nama_lengkap || 'Calon Pendaftar'
                  const prodiName = f.prodi?.nama || '-'
                  const comment = f.komentar || '(Hanya memberikan rating bintang)'
                  const dateStr = f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
                  
                  return (
                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid var(--gray-100)', borderRadius: 8, padding: 10, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <strong style={{ color: 'var(--gray-800)', display: 'block' }}>{applicantName}</strong>
                          <span style={{ fontSize: 9.5, color: 'var(--indigo-600)', fontWeight: 600 }}>{prodiName}</span>
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--gray-400)' }}>{dateStr}</span>
                      </div>
                      
                      <div style={{ fontSize: 10.5, fontStyle: f.komentar ? 'normal' : 'italic', color: f.komentar ? 'var(--gray-600)' : 'var(--gray-400)', marginTop: 4 }}>
                        "{comment}"
                      </div>
                      
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 9, color: 'var(--amber-600)', background: '#fff', padding: '2px 6px', borderRadius: 4, width: 'max-content', border: '1px solid var(--gray-100)', fontWeight: 600 }}>
                        <span>💻 Portal: {f.rating_kemudahan}⭐</span>
                        <span>📚 Rencana: {f.rating_kejelasan}⭐</span>
                        <span>⚡ Layanan: {f.rating_kecepatan}⭐</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* SECTION 4: PROGRAM STUDI CHARTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        {/* Bar Chart Card */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Pendaftar per Program Studi</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 20px' }}>
            {prodiData.length === 0 ? (
              <div style={{ color: 'var(--gray-400)', fontSize: 13, padding: 40, textAlign: 'center' }}>Tidak ada data pendaftar prodi</div>
            ) : (
              <svg viewBox={`0 0 ${barChartWidth} ${barChartHeight}`} width="100%" height="auto" style={{ overflow: 'visible' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const x = paddingLeft + ratio * chartInnerWidth
                  const gridVal = Math.round(ratio * maxProdiCount)
                  return (
                    <g key={idx}>
                      <line
                        x1={x}
                        y1={paddingTop}
                        x2={x}
                        y2={barChartHeight - paddingBottom}
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={x}
                        y={barChartHeight - paddingBottom + 16}
                        fill="#94a3b8"
                        fontSize="10"
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        {gridVal}
                      </text>
                    </g>
                  )
                })}

                {prodiData.map((d, idx) => {
                  const y = paddingTop + idx * barHeight + barGap
                  const currentBarHeight = barHeight - barGap * 2
                  const widthRatio = maxProdiCount > 0 ? d.count / maxProdiCount : 0
                  const barWidth = Math.max(8, widthRatio * chartInnerWidth)
                  const isHovered = hoveredProdi === idx

                  return (
                    <g 
                      key={idx}
                      onMouseEnter={() => setHoveredProdi(idx)}
                      onMouseLeave={() => setHoveredProdi(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      <text
                        x={paddingLeft - 10}
                        y={y + currentBarHeight / 2 + 4}
                        fill="#475569"
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="end"
                      >
                        {d.name.length > 20 ? d.name.slice(0, 18) + '...' : d.name}
                      </text>

                      <rect
                        x={paddingLeft}
                        y={y}
                        width={chartInnerWidth}
                        height={currentBarHeight}
                        fill="transparent"
                      />

                      <rect
                        x={paddingLeft}
                        y={y}
                        width={barWidth}
                        height={currentBarHeight}
                        rx="4"
                        fill={isHovered ? 'var(--indigo-500)' : 'var(--indigo-600)'}
                        style={{ 
                          transition: 'all 0.2s ease-in-out',
                          filter: isHovered ? 'drop-shadow(0 4px 6px rgba(99, 102, 241, 0.2))' : 'none'
                        }}
                      />

                      <text
                        x={paddingLeft + barWidth + 8}
                        y={y + currentBarHeight / 2 + 4}
                        fill={isHovered ? 'var(--indigo-700)' : '#475569'}
                        fontSize="11"
                        fontWeight="800"
                      >
                        {d.count} Mhs
                      </text>
                    </g>
                  )
                })}
                <line
                  x1={paddingLeft}
                  y1={paddingTop - 10}
                  x2={paddingLeft}
                  y2={barChartHeight - paddingBottom + 4}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Donut Chart Card */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Distribusi Status Alur RPL</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 20, padding: '16px 20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {totalStatusCount === 0 ? (
              <div style={{ color: 'var(--gray-400)', fontSize: 13, padding: 40, textAlign: 'center' }}>Tidak ada data status</div>
            ) : (
              <>
                <div style={{ position: 'relative', width: 200, height: 200 }}>
                  <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx={donutCX}
                      cy={donutCY}
                      r={donutR}
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="20"
                    />
                    {(() => {
                      accumulatedPercent = 0
                      return statusData.map((d, idx) => {
                        const percent = d.count / totalStatusCount
                        const dashArray = `${percent * donutCircumference} ${donutCircumference}`
                        const dashOffset = -accumulatedPercent * donutCircumference
                        accumulatedPercent += percent

                        const isHovered = hoveredStatus === idx

                        return (
                          <circle
                            key={idx}
                            cx={donutCX}
                            cy={donutCY}
                            r={donutR}
                            fill="transparent"
                            stroke={d.color}
                            strokeWidth={isHovered ? '24' : '20'}
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            style={{ 
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={() => setHoveredStatus(idx)}
                            onMouseLeave={() => setHoveredStatus(null)}
                          />
                        )
                      })
                    })()}
                  </svg>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none'
                  }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-700)', display: 'block' }}>{totalStatusCount}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Total</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 150px', minWidth: 150 }}>
                  {statusData.map((d, idx) => {
                    const isHovered = hoveredStatus === idx
                    return (
                      <div 
                        key={idx}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 10,
                          fontSize: 12,
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: isHovered ? 'var(--gray-50)' : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={() => setHoveredStatus(idx)}
                        onMouseLeave={() => setHoveredStatus(null)}
                      >
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--gray-600)', fontWeight: isHovered ? 700 : 500, flex: 1 }}>{d.label}</span>
                        <strong style={{ color: 'var(--gray-700)', minWidth: 20, textAlign: 'right' }}>{d.count}</strong>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
