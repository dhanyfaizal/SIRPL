import { useState, useEffect } from 'react'
import { dbMK, dbProdi } from '../../lib/db'
import { BookOpen, Upload, Trash2, Plus, Download, Filter, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'

const TEMPLATE_EXAMPLE = `MKU101\tPancasila\t2\tumum
MKU102\tKewarganegaraan\t2\tumum
MKI201\tDasar-Dasar Pemrograman\t4\tinti
MKI202\tStruktur Data & Algoritma\t4\tinti
MKI203\tBasis Data Terdistribusi\t3\tinti`

export default function AdminCurriculumPage() {
  const [prodis, setProdis] = useState([])
  const [allMK, setAllMK] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProdi, setFilterProdi] = useState('')

  // Single Add Form
  const [formKode, setFormKode] = useState('')
  const [formNama, setFormNama] = useState('')
  const [formSKS, setFormSKS] = useState(3)
  const [formJenis, setFormJenis] = useState('inti')
  const [formProdi, setFormProdi] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Batch Import
  const [showImport, setShowImport] = useState(false)
  const [importProdi, setImportProdi] = useState('')
  const [importText, setImportText] = useState('')
  const [importParsed, setImportParsed] = useState([])
  const [importing, setImporting] = useState(false)

  const loadData = async () => {
    setLoading(true)
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
      setLoading(false)
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
        jenis: formJenis
      }
      const { error } = await dbMK.create(payload)
      if (error) throw error

      toast.success(`Mata kuliah ${payload.kode_mk} berhasil ditambahkan!`)
      setFormKode('')
      setFormNama('')
      setFormSKS(3)
      setFormJenis('inti')
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
      // Support tab or semicolon separated
      const parts = line.includes('\t') ? line.split('\t') : line.split(';')
      if (parts.length < 3) {
        return { idx: idx + 1, valid: false, raw: line, error: 'Minimal 3 kolom (Kode, Nama, SKS)' }
      }
      const kode = (parts[0] || '').trim().toUpperCase()
      const nama = (parts[1] || '').trim()
      const sks = parseInt((parts[2] || '').trim())
      const jenis = (parts[3] || 'inti').trim().toLowerCase()

      if (!kode || !nama) return { idx: idx + 1, valid: false, raw: line, error: 'Kode atau Nama kosong' }
      if (isNaN(sks) || sks < 1 || sks > 8) return { idx: idx + 1, valid: false, raw: line, error: 'SKS tidak valid (1-8)' }
      if (!['inti', 'umum'].includes(jenis)) return { idx: idx + 1, valid: false, raw: line, error: `Jenis "${jenis}" tidak valid (inti/umum)` }

      return { idx: idx + 1, valid: true, kode, nama, sks, jenis }
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
        jenis: r.jenis
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
  const handleDelete = async (mk) => {
    if (!window.confirm(`Hapus mata kuliah "${mk.kode_mk} - ${mk.nama_mk}"?`)) return
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

  // ── Download Template ───────────────────────────────────────
  const downloadTemplate = () => {
    const header = 'Kode MK\tNama MK\tSKS\tJenis (inti/umum)\n'
    const rows = 'MKI001\tContoh Mata Kuliah Inti\t3\tinti\nMKU001\tContoh Mata Kuliah Institusi\t2\tumum\n'
    const blob = new Blob([header + rows], { type: 'text/tab-separated-values' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_kurikulum.tsv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filter logic ────────────────────────────────────────────
  const filteredMK = filterProdi
    ? allMK.filter(mk => mk.prodi_id === filterProdi)
    : allMK

  // Group by prodi for display
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
      <div className="page-header">
        <h1 className="page-title">Manajemen Kurikulum</h1>
        <p className="page-subtitle">Kelola mata kuliah kurikulum per Program Studi — input tunggal atau impor masal dari Excel</p>
      </div>

      {/* Top Action Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowImport(!showImport)}
          className="btn btn-primary"
          style={{ gap: 6 }}
        >
          <FileSpreadsheet size={15} />
          {showImport ? 'Tutup Panel Impor' : 'Impor dari Excel / CSV'}
        </button>
        <button onClick={downloadTemplate} className="btn btn-secondary" style={{ gap: 6 }}>
          <Download size={15} /> Unduh Template TSV
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
                <li>Buka file Excel/Google Sheets Anda yang berisi data kurikulum.</li>
                <li>Pastikan kolom berurutan: <code>Kode MK</code> | <code>Nama MK</code> | <code>SKS</code> | <code>Jenis</code> (inti/umum).</li>
                <li>Seleksi semua baris data (tanpa header), kemudian <strong>Copy (Ctrl+C)</strong>.</li>
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
              <label className="input-label">Data Kurikulum (Tab/Semicolon Separated)</label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={TEMPLATE_EXAMPLE}
                className="input"
                rows={8}
                style={{ fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 12, resize: 'vertical', padding: '10px 14px', lineHeight: 1.7 }}
              />
              <span className="input-hint">Tempelkan data dari Excel. Format: Kode MK [Tab] Nama MK [Tab] SKS [Tab] Jenis</span>
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
        {/* Left: Single Add Card */}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              </div>
            </div>
            <div className="card-footer">
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
                <Plus size={14} /> {submitting ? 'Menyimpan...' : 'Tambahkan'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Course Table */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--indigo-600)' }}>
              <BookOpen size={16} />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Daftar Mata Kuliah Kurikulum</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={14} color="var(--gray-400)" />
              <select
                value={filterProdi}
                onChange={(e) => setFilterProdi(e.target.value)}
                style={{
                  padding: '5px 10px', borderRadius: 6, border: '1px solid var(--gray-200)',
                  background: 'var(--surface)', fontSize: 12, fontWeight: 500, outline: 'none'
                }}
              >
                <option value="">Semua Prodi</option>
                {prodis.map(p => (
                  <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
                ))}
              </select>
              <span className="badge-pill badge-indigo">{filteredMK.length} MK</span>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {filteredMK.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <div className="empty-state-text">Belum ada mata kuliah</div>
                <div className="empty-state-sub">Tambahkan mata kuliah secara manual atau impor dari Excel.</div>
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
                      <th style={{ width: 140 }}>Program Studi</th>
                      <th style={{ width: 60 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMK.map(mk => (
                      <tr key={mk.id}>
                        <td><code style={{ fontWeight: 700, fontSize: 12, color: 'var(--indigo-700)' }}>{mk.kode_mk}</code></td>
                        <td style={{ fontWeight: 500 }}>{mk.nama_mk}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{mk.sks}</td>
                        <td>
                          <span className={`badge-pill ${mk.jenis === 'inti' ? 'badge-indigo' : 'badge-slate'}`}>
                            {mk.jenis === 'inti' ? 'MK Prodi' : 'MK Institusi'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                          {mk.prodi?.kode ? `${mk.prodi.kode} - ${mk.prodi.nama}` : getProdiName(mk.prodi_id)}
                        </td>
                        <td>
                          <button
                            onClick={() => handleDelete(mk)}
                            className="btn btn-ghost btn-icon"
                            style={{ color: 'var(--danger)' }}
                            title="Hapus mata kuliah"
                          >
                            <Trash2 size={15} />
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
      </div>
    </div>
  )
}
