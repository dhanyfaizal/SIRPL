import { useState, useEffect } from 'react'
import { dbPengajuan, dbProdi, dbPenetapan } from '../../lib/db'
import { LayoutDashboard, RefreshCw, Filter, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import AnalyticsTab from '../../components/AnalyticsTab'

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [prodis, setProdis] = useState([])

  // Filter States
  const [selectedProdi, setSelectedProdi] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [submissionsRes, prodisRes] = await Promise.all([
        dbPengajuan.getAll(),
        dbProdi.getAll()
      ])

      const rawSubmissions = (submissionsRes.data || []).filter(s => !s.is_archived)
      
      // Enrich with cost & conversion data from penetapan_akhir
      const enriched = await Promise.all(
        rawSubmissions.map(async (item) => {
          const { data: penData } = await dbPenetapan.getByPengajuanId(item.id)
          return {
            ...item,
            total_sks_diakui: penData ? penData.total_sks_diakui : 0,
            total_sks_sisa: penData ? penData.total_sks_sisa : 0,
            biaya_total: penData ? penData.biaya_total : 0,
            potongan_biaya: penData ? penData.potongan_biaya : 0
          }
        })
      )

      setSubmissions(enriched)
      setProdis(prodisRes.data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data eksekutif pimpinan')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadData(true)
      toast.success('Data berhasil diperbarui!')
    } catch (e) {
      toast.error('Gagal memperbarui data')
    } finally {
      setRefreshing(false)
    }
  }

  // Filter logic
  const filteredSubmissions = submissions.filter(s => {
    const matchProdi = selectedProdi === 'all' || s.prodi?.nama === selectedProdi
    
    let matchStatus = true
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'draft') {
        matchStatus = s.status === 'draft'
      } else if (selectedStatus === 'baak') {
        matchStatus = ['submitted', 'returned_kaprodi'].includes(s.status)
      } else if (selectedStatus === 'kaprodi') {
        matchStatus = ['validated_baak', 'returned_asessor'].includes(s.status)
      } else if (selectedStatus === 'asessor') {
        matchStatus = ['recognized_kaprodi', 'returned_admin'].includes(s.status)
      } else if (selectedStatus === 'admin') {
        matchStatus = s.status === 'assessed_asessor'
      } else if (selectedStatus === 'mapped') {
        matchStatus = s.status === 'mapped_admin'
      }
    }

    return matchProdi && matchStatus
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Memuat Laporan Eksekutif...</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <LayoutDashboard size={24} style={{ color: 'var(--indigo-600)' }} />
            Dashboard Pimpinan (Rektor / Dekan)
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: 13 }}>
            Ringkasan Eksekutif, Analisis SLA Evaluasi, & Statistik Pengajuan RPL STIKOM Yos Sudarso
          </p>
        </div>

        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Memperbarui...' : 'Perbarui Data'}
        </button>
      </div>

      {/* Interactive Filters Panel */}
      <div className="card" style={{ marginBottom: 24, border: '1px solid var(--gray-200)', background: 'var(--surface)' }}>
        <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} style={{ color: 'var(--gray-500)' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--gray-700)' }}>Filter Data Eksekutif:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Prodi Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Program Studi:</label>
              <select
                value={selectedProdi}
                onChange={(e) => setSelectedProdi(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-200)',
                  background: 'var(--surface)',
                  color: 'var(--gray-700)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Semua Program Studi</option>
                {prodis.map(p => (
                  <option key={p.id} value={p.nama}>{p.nama}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Tahapan Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-200)',
                  background: 'var(--surface)',
                  color: 'var(--gray-700)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Semua Tahapan</option>
                <option value="draft">Draf</option>
                <option value="baak">Proses Validasi BAAK</option>
                <option value="kaprodi">Proses Evaluasi Kaprodi</option>
                <option value="asessor">Proses Asesmen Asessor</option>
                <option value="admin">Proses Finalisasi Admin</option>
                <option value="mapped">Rencana Studi Terbit</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Context */}
      {filteredSubmissions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', border: '1px solid var(--gray-200)' }}>
          <ShieldAlert size={48} style={{ color: 'var(--gray-400)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-700)' }}>Tidak Ada Data Cocok</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginTop: 6, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Tidak ada pengajuan RPL yang cocok dengan kombinasi filter Program Studi dan Tahapan Status terpilih saat ini.
          </p>
        </div>
      ) : (
        /* Render Analytics Panel */
        <AnalyticsTab submissions={filteredSubmissions} />
      )}
    </div>
  )
}
