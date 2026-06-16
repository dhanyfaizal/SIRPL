import { useState, useEffect, Fragment } from 'react'
import { dbMK, dbProdi } from '../../lib/db'
import { BookOpen, Upload, Trash2, Plus, Download, Filter, FileSpreadsheet, RotateCw, Edit2, Check, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const TEMPLATE_EXAMPLE = `MKU101,Pancasila,2,Institusi,1
MKU102,Kewarganegaraan,2,Institusi,1
MKI201,Dasar-Dasar Pemrograman,4,Program Studi,3
MKI202,Struktur Data & Algoritma,4,Program Studi,3
MKI203,Basis Data Terdistribusi,3,Program Studi,4`

export default function AdminCurriculumPage() {
  const [prodis, setProdis] = useState([])
  const [allMK, setAllMK] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProdi, setFilterProdi] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Single Add Form
  const [formKode, setFormKode] = useState('')
  const [formNama, setFormNama] = useState('')
  const [formSKS, setFormSKS] = useState(3)
  const [formJenis, setFormJenis] = useState('inti')
  const [formSemester, setFormSemester] = useState(1)
  const [formProdi, setFormProdi] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Inline Edit
  const [editingMkId, setEditingMkId] = useState(null)
  const [editForm, setEditForm] = useState({ kode_mk: '', nama_mk: '', sks: 3, jenis: 'inti', semester: 1 })

  // Batch Import
  const [showImport, setShowImport] = useState(false)
  const [importProdi, setImportProdi] = useState('')
  const [importText, setImportText] = useState('')
  const [importParsed, setImportParsed] = useState([])
  const [importing, setImporting] = useState(false)

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: 'Konfirmasi',
    message: '',
    confirmText: 'Ya, Lanjutkan',
    onConfirm: null
  })

  const [refreshing, setRefreshing] = useState(false)

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

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [prodiRes, mkRes] = await Promise.all([
        dbProdi.getAll(),
        dbMK.getAll()
      ])
      setProdis(prodiRes.data || [])
      setAllMK(mkRes.data || [])
    } catch (e) {
      console.error(e)
      toast.error('Gagal memuat data kurikulum')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ── Single Add ──────────────────────────────────────────────
  const handleAddSingle = async (e) => {
    e.preventDefault()
    if (!formKode.trim() || !formNama.trim() || !formProdi) {
      toast.error('Lengkapi semua field wajib (Kode, Nama, SKS, Prodi)')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        prodi_id: formProdi,
        kode_mk: formKode.trim().toUpperCase(),
        nama_mk: formNama.trim(),
        sks: parseInt(formSKS),
        jenis: formJenis,
        semester: parseInt(formSemester) || 1
      }
      const { error } = await dbMK.create(payload)
      if (error) throw error

      toast.success(`Mata kuliah ${payload.kode_mk} berhasil ditambahkan!`)
      setFormKode('')
      setFormNama('')
      setFormSKS(3)
      setFormJenis('inti')
      setFormSemester(1)
      loadData()
    } catch (e) {
      console.error(e)
      toast.error('Gagal menambahkan mata kuliah: ' + (e.message || ''))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Batch Import ────────────────────────────────────────────
  const parseImportText = (text) => {
    if (!text.trim()) {
      setImportParsed([])
      return
    }

    const lines = text.trim().split('\n').filter(l => l.trim())
    const parsed = lines.map((line, idx) => {
      // CSV: comma separated
      const parts = line.split(',')
      if (parts.length < 3) {
        return { idx: idx + 1, valid: false, raw: line, error: 'Minimal 3 kolom (Kode, Nama, SKS)' }
      }
      const kode = (parts[0] || '').trim().toUpperCase()
      const nama = (parts[1] || '').trim()
      const sks = parseInt((parts[2] || '').trim())
      const jenisRaw = (parts[3] || 'Program Studi').trim()
      const semesterRaw = parseInt((parts[4] || '1').trim())

      // Map user-friendly labels to db values
      let jenis = 'inti'
      if (jenisRaw.toLowerCase() === 'institusi' || jenisRaw.toLowerCase() === 'umum') {
        jenis = 'umum'
      } else if (jenisRaw.toLowerCase() === 'program studi' || jenisRaw.toLowerCase() === 'prodi' || jenisRaw.toLowerCase() === 'inti') {
        jenis = 'inti'
      }

      const semester = (!isNaN(semesterRaw) && semesterRaw >= 1 && semesterRaw <= 8) ? semesterRaw : 1

      if (!kode || !nama) return { idx: idx + 1, valid: false, raw: line, error: 'Kode atau Nama kosong' }
      if (isNaN(sks) || sks < 1 || sks > 8) return { idx: idx + 1, valid: false, raw: line, error: 'SKS tidak valid (1-8)' }

      return { idx: idx + 1, valid: true, kode, nama, sks, jenis, semester }
    })
    setImportParsed(parsed)
  }

  useEffect(() => {
    parseImportText(importText)
  }, [importText])

  const handleBatchImport = async () => {
    if (!importProdi) {
      toast.error('Pilih Program Studi tujuan terlebih dahulu')
      return
    }
    const validRows = importParsed.filter(r => r.valid)
    if (validRows.length === 0) {
      toast.error('Tidak ada baris valid untuk diimpor')
      return
    }

    setImporting(true)
    try {
      const items = validRows.map(r => ({
        prodi_id: importProdi,
        kode_mk: r.kode,
        nama_mk: r.nama,
        sks: r.sks,
        jenis: r.jenis,
        semester: r.semester || 1
      }))
      const { error } = await dbMK.createBatch(items)
      if (error) throw error

      toast.success(`${items.length} mata kuliah berhasil diimpor!`)
      setImportText('')
      setImportParsed([])
      setShowImport(false)
      loadData()
    } catch (e) {
      console.error(e)
      toast.error('Gagal mengimpor: ' + (e.message || ''))
    } finally {
      setImporting(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = (mk) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Mata Kuliah',
      message: `Apakah Anda yakin ingin menghapus mata kuliah "${mk.kode_mk} - ${mk.nama_mk}" dari kurikulum? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus',
      onConfirm: async () => {
        try {
          const { error } = await dbMK.delete(mk.id)
          if (error) throw error
          toast.success('Mata kuliah berhasil dihapus')
          loadData()
        } catch (e) {
          console.error(e)
          toast.error('Gagal menghapus: ' + (e.message || ''))
        }
      }
    })
  }

  const handleToggleProdi = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === false ? true : false
      const { error } = await dbProdi.update(id, { is_active: nextStatus })
      if (error) throw error
      
      toast.success(`Program Studi berhasil ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
      
      // Update local state
      setProdis(prev => prev.map(p => p.id === id ? { ...p, is_active: nextStatus } : p))
    } catch (e) {
      console.error(e)
      toast.error('Gagal memperbarui status Program Studi')
    }
  }

  // ── Inline Edit ─────────────────────────────────────────────
  const handleStartEdit = (mk) => {
    setEditingMkId(mk.id)
    setEditForm({
      kode_mk: mk.kode_mk,
      nama_mk: mk.nama_mk,
      sks: mk.sks,
      jenis: mk.jenis,
      semester: mk.semester || 1
    })
  }

  const handleCancelEdit = () => {
    setEditingMkId(null)
    setEditForm({ kode_mk: '', nama_mk: '', sks: 3, jenis: 'inti', semester: 1 })
  }

  const handleSaveEdit = async () => {
    if (!editForm.kode_mk.trim() || !editForm.nama_mk.trim()) {
      toast.error('Kode dan Nama mata kuliah wajib diisi')
      return
    }
    try {
      const { error } = await dbMK.update(editingMkId, {
        kode_mk: editForm.kode_mk.trim().toUpperCase(),
        nama_mk: editForm.nama_mk.trim(),
        sks: parseInt(editForm.sks),
        jenis: editForm.jenis,
        semester: parseInt(editForm.semester) || 1
      })
      if (error) throw error
      toast.success('Mata kuliah berhasil diperbarui!')
      setEditingMkId(null)
      loadData()
    } catch (e) {
      console.error(e)
      toast.error('Gagal menyimpan perubahan: ' + (e.message || ''))
    }
  }

  // ── Download Template CSV ───────────────────────────────────
  const downloadTemplate = () => {
    const header = 'Kode MK,Nama MK,SKS,Jenis,Semester\n'
    const rows = 'MKI001,Contoh Mata Kuliah Prodi,3,Program Studi,3\nMKU001,Contoh Mata Kuliah Institusi,2,Institusi,1\n'
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_kurikulum.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filter & Sort & Group logic ─────────────────────────────
  const sortedMK = (() => {
    const processed = allMK.filter(mk => {
      const matchesProdi = filterProdi ? mk.prodi_id === filterProdi : true
      const matchesSearch = searchQuery
        ? mk.kode_mk.toLowerCase().includes(searchQuery.toLowerCase()) ||
          mk.nama_mk.toLowerCase().includes(searchQuery.toLowerCase())
        : true
      return matchesProdi && matchesSearch
    })

    return [...processed].sort((a, b) => {
      const semA = a.semester || 1
      const semB = b.semester || 1
      if (semA !== semB) return semA - semB
      return a.kode_mk.localeCompare(b.kode_mk)
    })
  })()

  // Group by program studi
  const prodiGroups = (() => {
    const groups = prodis.map(prodi => {
      const courses = sortedMK.filter(mk => mk.prodi_id === prodi.id)
      return { prodi, courses }
    }).filter(g => g.courses.length > 0)

    // Handle courses with unknown prodi (if any)
    const unknownCourses = sortedMK.filter(mk => !prodis.some(p => p.id === mk.prodi_id))
    if (unknownCourses.length > 0) {
      groups.push({
        prodi: { id: 'unknown', nama: 'Program Studi Lainnya', kode: 'LAIN' },
        courses: unknownCourses
      })
    }
    return groups
  })()

  const getProdiName = (prodiId) => {
    const p = prodis.find(pr => pr.id === prodiId)
    return p ? `${p.kode} - ${p.nama}` : prodiId
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 className="page-title">Manajemen Kurikulum</h1>
          <p className="page-subtitle">Kelola mata kuliah kurikulum per Program Studi — input tunggal atau impor masal dari CSV</p>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: 13 }}
        >
          <RotateCw size={14} className={refreshing ? 'spin-anim' : ''} /> 
          {refreshing ? 'Memuat...' : 'Refresh Data'}
        </button>
      </div>

      {/* Top Action Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowImport(!showImport)}
          className="btn btn-primary"
          style={{ gap: 6 }}
        >
          <FileSpreadsheet size={15} />
          {showImport ? 'Tutup Panel Impor' : 'Impor dari CSV'}
        </button>
        <button onClick={downloadTemplate} className="btn btn-secondary" style={{ gap: 6 }}>
          <Download size={15} /> Unduh Template CSV
        </button>
      </div>

      {/* Batch Import Panel */}
      {showImport && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--indigo-200)', borderWidth: 2 }}>
          <div className="card-header" style={{ background: 'var(--indigo-50)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-700)' }}>
              <Upload size={16} />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Impor Masal Mata Kuliah</h3>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--gray-50)', padding: 14, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 12.5, lineHeight: 1.6 }}>
              <strong>Petunjuk:</strong>
              <ol style={{ paddingLeft: 18, margin: '6px 0 0' }}>
                <li>Siapkan file CSV Anda, atau klik <strong>"Unduh Template CSV"</strong> untuk mendapatkan contoh format.</li>
                <li>Format kolom: <code>Kode MK</code>, <code>Nama MK</code>, <code>SKS</code>, <code>Jenis</code> (Program Studi / Institusi), <code>Semester</code> (1-8, opsional).</li>
                <li>Buka file CSV dengan Notepad/teks editor, lalu <strong>Copy (Ctrl+A → Ctrl+C)</strong> seluruh isi.</li>
                <li>Tempelkan <strong>(Ctrl+V)</strong> ke textarea di bawah ini.</li>
              </ol>
            </div>

            <div className="input-group">
              <label className="input-label">Program Studi Tujuan</label>
              <select
                value={importProdi}
                onChange={(e) => setImportProdi(e.target.value)}
                className="input"
                style={{ maxWidth: 360 }}
              >
                <option value="">-- Pilih Program Studi --</option>
                {prodis.map(p => (
                  <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Data Kurikulum (CSV — Koma Separated)</label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={TEMPLATE_EXAMPLE}
                className="input"
                rows={8}
                style={{ fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 12, resize: 'vertical', padding: '10px 14px', lineHeight: 1.7 }}
              />
              <span className="input-hint">Format per baris: Kode MK, Nama MK, SKS, Jenis (Program Studi / Institusi), Semester (1-8)</span>
            </div>

            {/* Preview parsed rows */}
            {importParsed.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: 'var(--gray-700)' }}>
                  Pratinjau Parsing: {importParsed.filter(r => r.valid).length} valid, {importParsed.filter(r => !r.valid).length} error
                </div>
                <div className="table-wrap" style={{ maxHeight: 240, overflow: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Kode MK</th>
                        <th>Nama MK</th>
                        <th style={{ width: 60 }}>SKS</th>
                        <th style={{ width: 80 }}>Jenis</th>
                        <th style={{ width: 60 }}>Smt</th>
                        <th style={{ width: 100 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importParsed.map((row) => (
                        <tr key={row.idx} style={{ background: row.valid ? 'transparent' : '#fff1f2' }}>
                          <td>{row.idx}</td>
                          <td>{row.valid ? row.kode : '-'}</td>
                          <td>{row.valid ? row.nama : <span style={{ color: 'var(--danger)', fontSize: 11.5 }}>{row.error}</span>}</td>
                          <td>{row.valid ? row.sks : '-'}</td>
                          <td>{row.valid ? <span className={`badge-pill ${row.jenis === 'inti' ? 'badge-indigo' : 'badge-slate'}`}>{row.jenis === 'inti' ? 'MK Prodi' : 'MK Institusi'}</span> : '-'}</td>
                          <td>{row.valid ? row.semester : '-'}</td>
                          <td>{row.valid ? <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 12 }}>✓ Valid</span> : <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}>✗ Error</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleBatchImport}
                disabled={importing || !importProdi || importParsed.filter(r => r.valid).length === 0}
                className="btn btn-primary"
                style={{ gap: 6 }}
              >
                <Upload size={14} /> {importing ? 'Mengimpor...' : `Impor ${importParsed.filter(r => r.valid).length} Mata Kuliah`}
              </button>
              <button onClick={() => { setShowImport(false); setImportText(''); setImportParsed([]) }} className="btn btn-secondary">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Add Form + Table in Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Single Add Card & Program Studi Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
                <Plus size={16} />
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Tambah Mata Kuliah</h3>
              </div>
            </div>
            <form onSubmit={handleAddSingle}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="input-group">
                  <label className="input-label">Program Studi</label>
                  <select value={formProdi} onChange={(e) => setFormProdi(e.target.value)} className="input" required>
                    <option value="">-- Pilih Prodi --</option>
                    {prodis.map(p => (
                      <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Kode Mata Kuliah</label>
                  <input
                    type="text"
                    value={formKode}
                    onChange={(e) => setFormKode(e.target.value.toUpperCase())}
                    placeholder="cth: MKI201"
                    className="input"
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Nama Mata Kuliah</label>
                  <input
                    type="text"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="cth: Dasar-Dasar Pemrograman"
                    className="input"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="input-group">
                    <label className="input-label">SKS</label>
                    <select value={formSKS} onChange={(e) => setFormSKS(e.target.value)} className="input">
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n} SKS</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Jenis</label>
                    <select value={formJenis} onChange={(e) => setFormJenis(e.target.value)} className="input">
                      <option value="inti">MK Prodi (Inti)</option>
                      <option value="umum">MK Institusi (Umum)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Semester</label>
                    <select value={formSemester} onChange={(e) => setFormSemester(e.target.value)} className="input">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <option key={n} value={n}>Smt {n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="card-footer">
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
                  <Plus size={14} /> {submitting ? 'Menyimpan...' : 'Tambahkan'}
                </button>
              </div>
            </form>
          </div>

          {/* Program Studi Toggle Card */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
                <BookOpen size={16} />
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Program Studi Pilihan</h3>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', lineHeight: 1.5, margin: 0 }}>
                Aktifkan atau nonaktifkan program studi yang tampil di dropdown pilihan pendaftaran calon.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {prodis.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--gray-100)', borderRadius: 8, background: 'var(--gray-50)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>{p.nama}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>Kode: {p.kode}</div>
                    </div>
                    <button
                      onClick={() => handleToggleProdi(p.id, p.is_active)}
                      className={`btn btn-sm ${p.is_active !== false ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11,
                        borderRadius: 6,
                        minWidth: 90,
                        justifyContent: 'center',
                        background: p.is_active !== false ? '#10b981' : '#94a3b8',
                        borderColor: p.is_active !== false ? '#059669' : '#64748b',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.is_active !== false ? '✓ Aktif' : '✗ Nonaktif'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Course Table */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
              <BookOpen size={16} />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Daftar Mata Kuliah Kurikulum</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Search Input */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} color="var(--gray-400)" style={{ position: 'absolute', left: 10 }} />
                <input
                  type="text"
                  placeholder="Cari Kode atau Nama MK..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '6px 10px 6px 30px',
                    borderRadius: 6,
                    border: '1px solid var(--gray-200)',
                    background: 'var(--surface)',
                    fontSize: 12,
                    outline: 'none',
                    width: '200px',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--indigo-500)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-200)'}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--gray-400)',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Prodi Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={14} color="var(--gray-400)" />
                <select
                  value={filterProdi}
                  onChange={(e) => setFilterProdi(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--gray-200)',
                    background: 'var(--surface)', fontSize: 12, fontWeight: 500, outline: 'none'
                  }}
                >
                  <option value="">Semua Prodi</option>
                  {prodis.map(p => (
                    <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                  ))}
                </select>
              </div>

              <span className="badge-pill badge-indigo">{sortedMK.length} MK</span>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {allMK.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <div className="empty-state-text">Belum ada mata kuliah</div>
                <div className="empty-state-sub">Tambahkan mata kuliah secara manual atau impor dari Excel.</div>
              </div>
            ) : sortedMK.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-text">Mata kuliah tidak ditemukan</div>
                <div className="empty-state-sub">Tidak ada mata kuliah yang cocok dengan kata kunci pencarian Anda.</div>
              </div>
            ) : (
              <div className="table-wrap" style={{ maxHeight: 520, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Kode MK</th>
                      <th>Nama Mata Kuliah</th>
                      <th style={{ width: 60 }}>SKS</th>
                      <th style={{ width: 110 }}>Jenis</th>
                      <th style={{ width: 60 }}>Smt</th>
                      <th style={{ width: 90 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodiGroups.map(group => (
                      <Fragment key={group.prodi.id}>
                        <tr>
                          <td colSpan={6} style={{ background: '#f5f3ff', color: 'var(--indigo-800)', fontWeight: 700, padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--indigo-100)' }}>
                            {group.prodi.kode} - {group.prodi.nama} ({group.courses.length} MK)
                          </td>
                        </tr>
                        {group.courses.map(mk => {
                          const isEditing = editingMkId === mk.id
                          return (
                            <tr key={mk.id} style={{ background: isEditing ? '#f0f4ff' : 'transparent' }}>
                              <td>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.kode_mk}
                                    onChange={(e) => setEditForm({ ...editForm, kode_mk: e.target.value.toUpperCase() })}
                                    className="input"
                                    style={{ padding: '4px 6px', fontSize: 12, minWidth: 70 }}
                                  />
                                ) : (
                                  <code style={{ fontWeight: 700, fontSize: 12, color: 'var(--indigo-700)' }}>{mk.kode_mk}</code>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.nama_mk}
                                    onChange={(e) => setEditForm({ ...editForm, nama_mk: e.target.value })}
                                    className="input"
                                    style={{ padding: '4px 6px', fontSize: 12 }}
                                  />
                                ) : (
                                  <span style={{ fontWeight: 500 }}>{mk.nama_mk}</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isEditing ? (
                                  <select
                                    value={editForm.sks}
                                    onChange={(e) => setEditForm({ ...editForm, sks: parseInt(e.target.value) })}
                                    className="input"
                                    style={{ padding: '4px 4px', fontSize: 12, minWidth: 50 }}
                                  >
                                    {[1, 2, 3, 4, 5, 6].map(n => (
                                      <option key={n} value={n}>{n}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span style={{ fontWeight: 600 }}>{mk.sks}</span>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <select
                                    value={editForm.jenis}
                                    onChange={(e) => setEditForm({ ...editForm, jenis: e.target.value })}
                                    className="input"
                                    style={{ padding: '4px 4px', fontSize: 11, minWidth: 80 }}
                                  >
                                    <option value="inti">MK Prodi</option>
                                    <option value="umum">MK Institusi</option>
                                  </select>
                                ) : (
                                  <span className={`badge-pill ${mk.jenis === 'inti' ? 'badge-indigo' : 'badge-slate'}`}>
                                    {mk.jenis === 'inti' ? 'MK Prodi' : 'MK Institusi'}
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isEditing ? (
                                  <select
                                    value={editForm.semester}
                                    onChange={(e) => setEditForm({ ...editForm, semester: parseInt(e.target.value) })}
                                    className="input"
                                    style={{ padding: '4px 4px', fontSize: 12, minWidth: 50 }}
                                  >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                      <option key={n} value={n}>{n}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span style={{ fontWeight: 500, fontSize: 12 }}>{mk.semester || 1}</span>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={handleSaveEdit}
                                      className="btn btn-ghost btn-icon"
                                      style={{ color: 'var(--success)' }}
                                      title="Simpan"
                                    >
                                      <Check size={15} />
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="btn btn-ghost btn-icon"
                                      style={{ color: 'var(--gray-400)' }}
                                      title="Batal"
                                    >
                                      <X size={15} />
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => handleStartEdit(mk)}
                                      className="btn btn-ghost btn-icon"
                                      style={{ color: 'var(--indigo-600)' }}
                                      title="Edit mata kuliah"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(mk)}
                                      className="btn btn-ghost btn-icon"
                                      style={{ color: 'var(--danger)' }}
                                      title="Hapus mata kuliah"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{confirmModal.title}</h3>
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--gray-400)' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: 1.5, padding: '20px 24px' }}>
              {confirmModal.message}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 24px' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Batal
              </button>
              <button 
                className="btn btn-danger btn-sm" 
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal(prev => ({ ...prev, isOpen: false }))
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
