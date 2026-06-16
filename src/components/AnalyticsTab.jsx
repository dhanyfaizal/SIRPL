import { useState } from 'react'

export default function AnalyticsTab({ submissions = [] }) {
  const [hoveredProdi, setHoveredProdi] = useState(null)
  const [hoveredStatus, setHoveredStatus] = useState(null)

  // 1. Data Aggregation
  const totalApplicants = submissions.length
  
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

  // Average SKS Diakui
  const mappedSubmissions = submissions.filter(s => s.status === 'mapped_admin' || s.total_sks_diakui > 0)
  const avgSksDiakui = mappedSubmissions.length > 0
    ? (mappedSubmissions.reduce((sum, s) => sum + (s.total_sks_diakui || 0), 0) / mappedSubmissions.length).toFixed(1)
    : 0

  // Total Estimasi Revenue (Biaya Total)
  const totalRevenue = submissions.reduce((sum, s) => sum + (parseFloat(s.biaya_total) || 0), 0)

  // Average Wait Time calculation
  const submittedSubmissions = submissions.filter(s => s.submitted_at)
  let avgWaitDays = '-'
  if (submittedSubmissions.length > 0) {
    let totalWaitMs = 0
    submittedSubmissions.forEach(s => {
      const start = new Date(s.submitted_at)
      const end = s.status === 'mapped_admin' ? new Date(s.updated_at) : new Date()
      totalWaitMs += (end - start)
    })
    avgWaitDays = (totalWaitMs / submittedSubmissions.length / 86400000).toFixed(1)
  }

  // 2. SVG Bar Chart Math
  const maxProdiCount = prodiData.length > 0 ? Math.max(...prodiData.map(d => d.count)) : 0
  const barChartWidth = 500
  const barChartHeight = 260
  const paddingLeft = 140
  const paddingRight = 30
  const paddingTop = 20
  const paddingBottom = 40
  const chartInnerWidth = barChartWidth - paddingLeft - paddingRight
  const chartInnerHeight = barChartHeight - paddingTop - paddingBottom
  const barHeight = prodiData.length > 0 ? Math.floor(chartInnerHeight / prodiData.length) : 0
  const barGap = 6

  // 3. SVG Donut Chart Math
  const donutCX = 110
  const donutCY = 110
  const donutR = 60
  const donutCircumference = 2 * Math.PI * donutR // ~376.99
  const totalStatusCount = statusData.reduce((sum, d) => sum + d.count, 0)

  let accumulatedPercent = 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cards Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {/* Card 1 */}
        <div className="card" style={{ borderLeft: '4px solid var(--indigo-600)', background: 'var(--surface)' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Rerata SKS Diakui</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)', marginTop: 4 }}>{avgSksDiakui} SKS</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Dari total {mappedSubmissions.length} pengajuan dinilai</div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'var(--surface)' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Estimasi Total UKP & Rekognisi</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>Rp{totalRevenue.toLocaleString('id-ID')}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Akumulasi seluruh pengajuan aktif</div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="card" style={{ borderLeft: '4px solid var(--amber-500)', background: 'var(--surface)' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Rerata Waktu Proses</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)', marginTop: 4 }}>{avgWaitDays} Hari</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Waktu tunggu sejak submit hingga final</div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="card" style={{ borderLeft: '4px solid #ec4899', background: 'var(--surface)' }}>
          <div className="card-body" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Rasio Penyelesaian</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-800)', marginTop: 4 }}>
              {totalApplicants > 0 
                ? ((statusGroups.mapped.count / totalApplicants) * 100).toFixed(0)
                : 0}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{statusGroups.mapped.count} dari {totalApplicants} pendaftar selesai</div>
          </div>
        </div>
      </div>

      {/* Graphs Grid */}
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
                {/* Horizontal Gridlines */}
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

                {/* Bars */}
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
                      {/* Prodi Text Label */}
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

                      {/* Bar Background (For smooth hovering target) */}
                      <rect
                        x={paddingLeft}
                        y={y}
                        width={chartInnerWidth}
                        height={currentBarHeight}
                        fill="transparent"
                      />

                      {/* Actual Rounded Bar */}
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

                      {/* Value inside/outside bar */}
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
                {/* Y-Axis border */}
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
                {/* SVG Donut */}
                <div style={{ position: 'relative', width: 220, height: 220 }}>
                  <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
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
                  {/* Center Text */}
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

                {/* Donut Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 150px', minWidth: 150 }}>
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
