import { useState, useEffect } from 'react'
import { dbFeedback } from '../../lib/db'
import { Smile, Star, MessageSquare, Search, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FeedbackPage() {
  const [feedbackList, setFeedbackList] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProdi, setSelectedProdi] = useState('all')
  const [selectedRatingFilter, setSelectedRatingFilter] = useState('all') // 'all' | '5' | '4' | '3' | '2' | '1'

  const loadFeedback = async () => {
    setLoading(true)
    try {
      const { data, error } = await dbFeedback.getAll()
      if (error) throw error
      setFeedbackList(data || [])
    } catch (err) {
      console.error('Failed to load feedback:', err)
      toast.error('Gagal memuat ulasan pendaftar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeedback()
  }, [])

  // ── Metrics & Calculations ─────────────────────────────────────────
  const totalCount = feedbackList.length
  let avgKemudahan = '0.0'
  let avgKejelasan = '0.0'
  let avgKecepatan = '0.0'
  let csatScore = 0

  if (totalCount > 0) {
    const sumKemudahan = feedbackList.reduce((sum, f) => sum + (f.rating_kemudahan || 0), 0)
    const sumKejelasan = feedbackList.reduce((sum, f) => sum + (f.rating_kejelasan || 0), 0)
    const sumKecepatan = feedbackList.reduce((sum, f) => sum + (f.rating_kecepatan || 0), 0)

    avgKemudahan = (sumKemudahan / totalCount).toFixed(1)
    avgKejelasan = (sumKejelasan / totalCount).toFixed(1)
    avgKecepatan = (sumKecepatan / totalCount).toFixed(1)

    const totalStarsPossible = totalCount * 15
    const totalStarsEarned = sumKemudahan + sumKejelasan + sumKecepatan
    csatScore = Math.round((totalStarsEarned / totalStarsPossible) * 100)
  }

  // Get unique program studi names for filter dropdown
  const prodis = Array.from(new Set(feedbackList.map(f => f.prodi?.nama).filter(Boolean)))

  // ── Filtering Logic ────────────────────────────────────────────────
  const filteredFeedback = feedbackList.filter(f => {
    const name = (f.profile?.nama_lengkap || '').toLowerCase()
    const comment = (f.komentar || '').toLowerCase()
    const prodi = (f.prodi?.nama || '').toLowerCase()
    const query = searchQuery.toLowerCase()
    
    const matchesSearch = name.includes(query) || comment.includes(query) || prodi.includes(query)
    const matchesProdi = selectedProdi === 'all' || f.prodi?.nama === selectedProdi
    
    let matchesRating = true
    if (selectedRatingFilter !== 'all') {
      const targetRating = parseInt(selectedRatingFilter)
      matchesRating = f.rating_kemudahan === targetRating || 
                      f.rating_kejelasan === targetRating || 
                      f.rating_kecepatan === targetRating
    }

    return matchesSearch && matchesProdi && matchesRating
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            ⭐ Ulasan & Kepuasan Pelayanan
          </h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
            Rekapitulasi penilaian dan kritik/saran dari calon mahasiswa pendaftar RPL.
          </p>
        </div>
        <button 
          onClick={loadFeedback} 
          className="btn btn-secondary" 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 12.5 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Data
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', flexDirection: 'column', gap: 16 }}>
          <div className="spinner" />
          <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Memuat ulasan pendaftar...</p>
        </div>
      ) : (
        <>
          {/* Card Metrics Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* CSAT Index */}
            <div className="card" style={{ borderLeft: '4px solid var(--amber-500)', background: 'linear-gradient(135deg, #fffbeb, #ffffff)' }}>
              <div className="card-body" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber-700)', textTransform: 'uppercase' }}>CSAT Index (Keseluruhan)</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--amber-600)' }}>{csatScore}%</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber-500)' }}>Sangat Puas</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>Kepuasan pelayanan sistem RPL</div>
              </div>
            </div>

            {/* Total Responden */}
            <div className="card" style={{ borderLeft: '4px solid var(--indigo-600)' }}>
              <div className="card-body" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Total Responden</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-800)', marginTop: 4 }}>{totalCount} Calon</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>Pengirim ulasan kuesioner</div>
              </div>
            </div>

            {/* Kemudahan Portal */}
            <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="card-body" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Kemudahan Portal</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-800)' }}>{avgKemudahan}</span>
                  <span style={{ color: 'var(--amber-500)', fontSize: 18 }}>★</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>Rerata pendaftaran & upload</div>
              </div>
            </div>

            {/* Kejelasan Informasi */}
            <div className="card" style={{ borderLeft: '4px solid var(--indigo-600)' }}>
              <div className="card-body" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Kejelasan Studi</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-800)' }}>{avgKejelasan}</span>
                  <span style={{ color: 'var(--amber-500)', fontSize: 18 }}>★</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>Rerata kurikulum & rincian biaya</div>
              </div>
            </div>

            {/* Kecepatan Layanan */}
            <div className="card" style={{ borderLeft: '4px solid var(--indigo-600)' }}>
              <div className="card-body" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Kecepatan Proses</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-800)' }}>{avgKecepatan}</span>
                  <span style={{ color: 'var(--amber-500)', fontSize: 18 }}>★</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>Rerata verifikasi & penilaian</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
            
            {/* Left Column: Comments List with Filters */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={16} color="var(--indigo-600)" style={{ flexShrink: 0 }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Daftar Ulasan & Kritik / Saran</h3>
                  <span className="badge-pill badge-indigo">{filteredFeedback.length} Data</span>
                </div>

                {/* Filter Toolbar */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Search Bar */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} color="var(--gray-400)" style={{ position: 'absolute', left: 10 }} />
                    <input
                      type="text"
                      placeholder="Cari pendaftar/ulasan..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        padding: '6px 12px 6px 30px',
                        fontSize: 12.5,
                        borderRadius: 6,
                        border: '1px solid var(--gray-200)',
                        width: 180,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Prodi Filter */}
                  <select
                    value={selectedProdi}
                    onChange={e => setSelectedProdi(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid var(--gray-200)',
                      background: '#fff',
                      outline: 'none'
                    }}
                  >
                    <option value="all">Semua Program Studi</option>
                    {prodis.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>

                  {/* Rating Filter */}
                  <select
                    value={selectedRatingFilter}
                    onChange={e => setSelectedRatingFilter(e.target.value)}
                    style={{
                      padding: '6px 8px',
                      fontSize: 12.5,
                      borderRadius: 6,
                      border: '1px solid var(--gray-200)',
                      background: '#fff',
                      outline: 'none'
                    }}
                  >
                    <option value="all">Semua Rating</option>
                    <option value="5">Adanya Bintang 5 ⭐</option>
                    <option value="4">Adanya Bintang 4 ⭐</option>
                    <option value="3">Adanya Bintang 3 ⭐</option>
                    <option value="2">Adanya Bintang 2 ⭐</option>
                    <option value="1">Adanya Bintang 1 ⭐</option>
                  </select>
                </div>
              </div>

              <div className="card-body" style={{ padding: 20 }}>
                {filteredFeedback.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)', fontStyle: 'italic', fontSize: 13 }}>
                    Tidak ada ulasan pendaftar yang cocok dengan filter pencarian.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {filteredFeedback.map((f, idx) => {
                      const name = f.profile?.nama_lengkap || 'Calon Pendaftar'
                      const email = f.profile?.email || ''
                      const wa = f.profile?.no_whatsapp || ''
                      const prodi = f.prodi?.nama || '-'
                      const dateStr = f.created_at 
                        ? new Date(f.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                        : '-'

                      return (
                        <div 
                          key={idx} 
                          style={{
                            background: '#f8fafc',
                            border: '1px solid var(--gray-100)',
                            borderRadius: 10,
                            padding: 16,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <strong style={{ color: 'var(--gray-800)', fontSize: 13 }}>{name}</strong>
                              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                                {email} {wa && `• WA: ${wa}`}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span className="badge-pill badge-indigo" style={{ fontSize: 10 }}>{prodi}</span>
                              <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 4 }}>{dateStr}</div>
                            </div>
                          </div>

                          <div style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 8, padding: 12, fontSize: 12.5, color: 'var(--gray-700)', lineHeight: 1.5, fontStyle: f.komentar ? 'normal' : 'italic' }}>
                            {f.komentar ? `"${f.komentar}"` : '(Pendaftar tidak menyertakan saran tertulis, hanya penilaian bintang)'}
                          </div>

                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--gray-50)' }}>💻 Portal:</span>
                              <span style={{ color: 'var(--amber-500)' }}>
                                {'★'.repeat(f.rating_kemudahan)}{'☆'.repeat(5 - f.rating_kemudahan)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--gray-50)' }}>📚 Kejelasan:</span>
                              <span style={{ color: 'var(--amber-500)' }}>
                                {'★'.repeat(f.rating_kejelasan)}{'☆'.repeat(5 - f.rating_kejelasan)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--gray-50)' }}>⚡ Kecepatan:</span>
                              <span style={{ color: 'var(--amber-500)' }}>
                                {'★'.repeat(f.rating_kecepatan)}{'☆'.repeat(5 - f.rating_kecepatan)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Visual Breakdown summary cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Aspect breakdowns list */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ fontSize: 13.5, fontWeight: 700 }}>Distribusi Rating Aspek</h3>
                </div>
                <div className="card-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Kemudahan */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
                      <span style={{ color: 'var(--gray-600)' }}>Kemudahan Portal & Upload</span>
                      <span style={{ color: 'var(--gray-700)' }}>{avgKemudahan} / 5.0</span>
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

                  {/* Kejelasan */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
                      <span style={{ color: 'var(--gray-600)' }}>Kejelasan Rencana & Biaya</span>
                      <span style={{ color: 'var(--gray-700)' }}>{avgKejelasan} / 5.0</span>
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

                  {/* Kecepatan */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
                      <span style={{ color: 'var(--gray-600)' }}>Kecepatan Validasi & Layanan</span>
                      <span style={{ color: 'var(--gray-700)' }}>{avgKecepatan} / 5.0</span>
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
              </div>

              {/* Informational Guidance box */}
              <div className="card" style={{ background: '#f8fafc' }}>
                <div className="card-body" style={{ padding: 16, fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    💡 Tentang Indeks Kepuasan
                  </div>
                  CSAT (Customer Satisfaction Score) dihitung berdasarkan total bintang yang diperoleh dibagi dengan total potensi bintang (maksimum 15 bintang per responden), dikalikan 100.
                  <br /><br />
                  Saran tertulis membantu tim PMB, BAAK, dan Admin untuk meningkatkan kualitas portal digital serta efisiensi validasi berkas fisik.
                </div>
              </div>

            </div>

          </div>
        </>
      )}
    </div>
  )
}
