// Pengaturan status RPL mata kuliah (Admin dan Koordinator Prodi).
// Status melekat permanen di mata kuliah. MK yang ditutup setelah dipilih
// pemohon tetap tampil bertanda di pengajuan draf dan harus diganti sebelum
// dikirim; pengajuan yang sudah dikirim tidak terpengaruh.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Bidang, Dialog, Kerangka, Lencana, Pemberitahuan, Tombol } from '../pemohon/ui'
import '../pemohon/pemohon.css'
import './kurikulum.css'

const KODE_PRODI = { kaprodi_ti: 'IF', kaprodi_si: 'SI', kaprodi_dkv: 'DKV', kaprodi_ka: 'KA' }
const STATUS = {
  dibuka: { label: 'Dibuka', warna: 'green', nilai: { dapat_rpl: true, is_tugas_akhir: false, rangkaian_ta: false } },
  tutup: { label: 'Tidak dibuka', warna: 'slate', nilai: { dapat_rpl: false, is_tugas_akhir: false, rangkaian_ta: false } },
  ta: { label: 'Tugas akhir', warna: 'amber', nilai: { dapat_rpl: false, is_tugas_akhir: true, rangkaian_ta: false } },
  rangkaian: { label: 'Rangkaian tugas akhir', warna: 'amber', nilai: { dapat_rpl: false, is_tugas_akhir: false, rangkaian_ta: true } },
}
const statusMk = (mk) => (mk.is_tugas_akhir ? 'ta' : mk.rangkaian_ta ? 'rangkaian' : mk.dapat_rpl === false ? 'tutup' : 'dibuka')
const DRAF = ['draft', 'dikembalikan_sekretariat']

function cek({ data, error }) { if (error) throw new Error(error.message); return data }

function DialogStatus({ buka, target, onTutup, onSimpan }) {
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => { if (buka) setAlasan(target?.alasanAwal || '') }, [buka, target])
  if (!target) return null
  const s = STATUS[target.status]
  return (
    <Dialog buka={buka} judul={`Ubah status menjadi "${s.label}"`} onTutup={onTutup}
      kaki={<><Tombol onClick={onTutup}>Batal</Tombol>
        <Tombol jenis="primary" sibuk={sibuk} onClick={async () => { setSibuk(true); try { await onSimpan(alasan.trim()) } finally { setSibuk(false) } }}>Simpan status</Tombol></>}>
      <p>{target.jumlah === 1 ? <>Mata kuliah <b>{target.nama}</b></> : <><b>{target.jumlah} mata kuliah</b> terpilih</>} akan diubah menjadi <b>{s.label}</b>.</p>
      {target.status === 'tutup' ? (
        <Bidang label="Alasan (ditampilkan ke pemohon)" hint="Contoh: praktikum wajib di kampus, atau mata kuliah baru di kurikulum 2026.">
          <textarea className="input" rows={2} value={alasan} onChange={(e) => setAlasan(e.target.value)} maxLength={200} />
        </Bidang>
      ) : null}
      {target.status === 'ta' || target.status === 'rangkaian' ? (
        <Pemberitahuan jenis="amber">Sesuai Juknis Bab II.A angka 3, tugas akhir dan rangkaiannya tidak dapat direkognisi. Asesor juga tidak dapat mengakui mata kuliah ini.</Pemberitahuan>
      ) : null}
      {target.status !== 'dibuka' && target.draf > 0 ? (
        <Pemberitahuan jenis="amber" judul={`Sudah dipilih di ${target.draf} pengajuan draf`}>
          Mata kuliah tetap tampil di pengajuan tersebut dengan tanda, dan pemohon harus menggantinya sebelum bisa mengirim. Pengajuan yang sudah dikirim tidak terpengaruh.
        </Pemberitahuan>
      ) : null}
    </Dialog>
  )
}

function DialogDetail({ mk, onTutup, onTersimpan, dipakaiF03 }) {
  const [f, setF] = useState(() => ({
    deskripsi: mk.deskripsi || '', cpmk: mk.cpmk || '', nomor_fed: mk.nomor_fed || '',
    sub: (Array.isArray(mk.sub_cpmk) ? mk.sub_cpmk : []).map((s, i) => ({ kode: s.kode || `Sub-CPMK ${i + 1}`, deskripsi: s.deskripsi || s.teks || '' })),
  }))
  const [sibuk, setSibuk] = useState(false)
  const ubahSub = (i, v) => setF((s) => ({ ...s, sub: s.sub.map((x, j) => (j === i ? { ...x, deskripsi: v } : x)) }))
  const geser = (i, d) => setF((s) => {
    const sub = [...s.sub]; const j = i + d
    if (j < 0 || j >= sub.length) return s
    ;[sub[i], sub[j]] = [sub[j], sub[i]]
    return { ...s, sub }
  })
  const simpan = async () => {
    const sub = f.sub.filter((x) => x.deskripsi.trim()).map((x, i) => ({ kode: `Sub-CPMK ${i + 1}`, deskripsi: x.deskripsi.trim() }))
    setSibuk(true)
    try {
      const hasil = cek(await supabase.from('mata_kuliah_kurikulum')
        .update({ deskripsi: f.deskripsi.trim() || null, cpmk: f.cpmk.trim() || null, nomor_fed: f.nomor_fed.trim() || null, sub_cpmk: sub })
        .eq('id', mk.id).select().single())
      onTersimpan(hasil)
      toast.success('Rincian mata kuliah disimpan')
      onTutup()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  return (
    <Dialog buka judul={`${mk.kode_mk} · ${mk.nama_mk}`} onTutup={onTutup} lebar={760}
      kaki={<><Tombol onClick={onTutup}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={simpan}>Simpan rincian</Tombol></>}>
      <div className="pm-form-2">
        <Bidang label="Nomor FED" hint="Nomor formulir evaluasi diri di F01, mis. FED-SI-05">
          <input className="input" value={f.nomor_fed} onChange={(e) => setF((s) => ({ ...s, nomor_fed: e.target.value }))} maxLength={20} />
        </Bidang>
        <div />
        <Bidang label="Deskripsi mata kuliah" lebar hint="Tampil di kepala Formulir Evaluasi Diri (F03).">
          <textarea className="input" rows={3} value={f.deskripsi} onChange={(e) => setF((s) => ({ ...s, deskripsi: e.target.value }))} />
        </Bidang>
        <Bidang label="Capaian pembelajaran mata kuliah (CPMK)" lebar>
          <textarea className="input" rows={2} value={f.cpmk} onChange={(e) => setF((s) => ({ ...s, cpmk: e.target.value }))} />
        </Bidang>
      </div>
      <div className="km-sub-kepala">
        <div>
          <div className="input-label">Sub-CPMK / kemampuan akhir yang diharapkan</div>
          <div className="pm-hint">Setiap butir menjadi satu baris di F03 yang dinilai pemohon dan asesor (V-A-T-M).</div>
        </div>
        <Tombol ikon={Plus} onClick={() => setF((s) => ({ ...s, sub: [...s.sub, { kode: '', deskripsi: '' }] }))}>Tambah butir</Tombol>
      </div>
      {dipakaiF03 ? <Pemberitahuan jenis="amber">Sub-CPMK mata kuliah ini sudah dipakai di {dipakaiF03} Formulir Evaluasi Diri. Mengubah urutan atau isi butir memengaruhi isian pemohon tersebut.</Pemberitahuan> : null}
      {f.sub.length ? (
        <ol className="km-sub-daftar">
          {f.sub.map((x, i) => (
            <li key={i}>
              <span className="pm-chip">Sub-CPMK {i + 1}</span>
              <textarea className="input" rows={2} value={x.deskripsi} aria-label={`Sub-CPMK ${i + 1}`} onChange={(e) => ubahSub(i, e.target.value)} />
              <div className="km-sub-aksi">
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Naikkan" disabled={i === 0} onClick={() => geser(i, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Turunkan" disabled={i === f.sub.length - 1} onClick={() => geser(i, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Hapus butir" onClick={() => setF((s) => ({ ...s, sub: s.sub.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="pm-kecil">Belum ada sub-CPMK. Tanpa sub-CPMK, F03 hanya menampilkan satu butir CPMK.</p>}
    </Dialog>
  )
}

export default function PengaturanMkRpl() {
  const { role } = useAuth()
  const kodeTerkunci = KODE_PRODI[role] || null
  const [prodiList, setProdiList] = useState(null)
  const [prodiId, setProdiId] = useState('')
  const [mk, setMk] = useState(null)
  const [pakai, setPakai] = useState({ draf: {}, f03: {} })
  const [sinkron, setSinkron] = useState(false)
  const [tab, setTab] = useState('semua')
  const [filter, setFilter] = useState('')
  const [cari, setCari] = useState('')
  const [pilih, setPilih] = useState(new Set())
  const [dialog, setDialog] = useState(null)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    supabase.from('program_studi').select('*').order('nama').then(({ data }) => {
      const daftar = (data || []).filter((p) => !kodeTerkunci || p.kode === kodeTerkunci)
      setProdiList(daftar)
      setProdiId((daftar.find((p) => p.is_penyelenggara_rpl) || daftar[0])?.id || '')
    })
  }, [kodeTerkunci])

  const muat = useCallback(async () => {
    if (!prodiId) return
    setSinkron(true)
    try {
      const daftar = cek(await supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', prodiId).order('semester').order('kode_mk'))
      setMk(daftar)
      const ids = daftar.map((m) => m.id)
      if (ids.length) {
        const [md, ev] = await Promise.all([
          supabase.from('mk_diajukan').select('mk_id, pengajuan_rpl(status)').in('mk_id', ids),
          supabase.from('evaluasi_diri').select('mk_id').in('mk_id', ids),
        ])
        const draf = {}; const f03 = {}
        for (const r of md.data || []) if (DRAF.includes(r.pengajuan_rpl?.status)) draf[r.mk_id] = (draf[r.mk_id] || 0) + 1
        for (const r of ev.data || []) f03[r.mk_id] = (f03[r.mk_id] || 0) + 1
        setPakai({ draf, f03 })
      }
    } catch (e) { toast.error(e.message) } finally { setSinkron(false) }
  }, [prodiId])
  useEffect(() => { setMk(null); setPilih(new Set()); muat() }, [muat])

  const prodi = prodiList?.find((p) => p.id === prodiId)
  const semester = useMemo(() => [...new Set((mk || []).map((m) => m.semester || 1))].sort((a, b) => a - b), [mk])
  const q = cari.trim().toLowerCase()
  const tampil = (mk || []).filter((m) => (tab === 'semua' || (m.semester || 1) === tab)
    && (!filter || (filter === 'tanpa_sub' ? !(m.sub_cpmk || []).length && statusMk(m) === 'dibuka' : statusMk(m) === filter))
    && (!q || m.nama_mk.toLowerCase().includes(q) || m.kode_mk.toLowerCase().includes(q)))

  const stat = useMemo(() => {
    const d = mk || []
    const dibuka = d.filter((m) => statusMk(m) === 'dibuka')
    return {
      dibuka: dibuka.length, sksDibuka: dibuka.reduce((n, m) => n + m.sks, 0),
      tutup: d.filter((m) => statusMk(m) === 'tutup').length,
      ta: d.filter((m) => ['ta', 'rangkaian'].includes(statusMk(m))).length,
      tanpaSub: dibuka.filter((m) => !(m.sub_cpmk || []).length).length,
      total: d.reduce((n, m) => n + m.sks, 0),
    }
  }, [mk])

  const terapkan = async (ids, status, alasan) => {
    const nilai = { ...STATUS[status].nilai, alasan_tidak_rpl: status === 'tutup' ? (alasan || null) : null }
    const hasil = cek(await supabase.from('mata_kuliah_kurikulum').update(nilai).in('id', ids).select())
    if (hasil.length < ids.length) throw new Error('Sebagian mata kuliah tidak dapat diubah. Periksa hak akses Anda untuk program studi ini.')
    setMk((d) => d.map((m) => hasil.find((h) => h.id === m.id) || m))
    setPilih(new Set()); setDialog(null)
    toast.success(`${hasil.length} mata kuliah diubah menjadi ${STATUS[status].label.toLowerCase()}`)
  }

  const mintaUbah = (ids, status) => {
    if (!ids.length) return
    const satu = ids.length === 1 ? mk.find((m) => m.id === ids[0]) : null
    const draf = ids.reduce((n, id) => n + (pakai.draf[id] || 0), 0)
    if (status === 'dibuka') { terapkan(ids, status).catch((e) => toast.error(e.message)); return }
    setDialog({ ids, status, jumlah: ids.length, nama: satu?.nama_mk, alasanAwal: satu?.alasan_tidak_rpl, draf })
  }

  const semuaTerpilih = tampil.length > 0 && tampil.every((m) => pilih.has(m.id))
  const togglePilih = (id) => setPilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  if (!prodiList) return <Kerangka />
  return (
    <div className="pm-halaman km-halaman">
      <div className="pm-kepala">
        <div>
          <h1 className="page-title">Status RPL mata kuliah</h1>
          <p className="page-subtitle">Atur mata kuliah yang dibuka untuk diajukan pemohon RPL, beserta sub-CPMK untuk Formulir Evaluasi Diri (F03).</p>
        </div>
        <div className="pm-kepala-aksi">
          {kodeTerkunci ? <Lencana warna="indigo">{prodi?.nama}</Lencana> : (
            <select className="input" value={prodiId} onChange={(e) => setProdiId(e.target.value)} aria-label="Program studi" style={{ width: 'auto', minWidth: 240 }}>
              {prodiList.map((p) => <option key={p.id} value={p.id}>{p.nama}{p.is_penyelenggara_rpl ? '' : ' (bukan penyelenggara RPL)'}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-secondary" onClick={muat} disabled={sinkron}><RefreshCw size={14} className={sinkron ? 'pm-putar' : ''} /> Muat ulang</button>
        </div>
      </div>

      {!mk ? <Kerangka baris={2} /> : <>
        <div className="km-stat">
          <div className="stat-card"><div className="stat-card-label">Dibuka untuk RPL</div><div className="stat-card-value">{stat.dibuka}</div><div className="stat-card-sub">{stat.sksDibuka} dari {stat.total} SKS</div></div>
          <div className="stat-card"><div className="stat-card-label">Tidak dibuka</div><div className="stat-card-value">{stat.tutup}</div><div className="stat-card-sub">kebijakan prodi</div></div>
          <div className="stat-card"><div className="stat-card-label">Tugas akhir dan rangkaian</div><div className="stat-card-value">{stat.ta}</div><div className="stat-card-sub">dikunci sesuai Juknis</div></div>
          <button type="button" className={`stat-card km-stat-klik${filter === 'tanpa_sub' ? ' is-on' : ''}`} onClick={() => setFilter((f) => (f === 'tanpa_sub' ? '' : 'tanpa_sub'))}>
            <div className="stat-card-label">Belum ada sub-CPMK</div><div className={`stat-card-value${stat.tanpaSub ? ' pm-wait' : ''}`}>{stat.tanpaSub}</div><div className="stat-card-sub">mata kuliah yang dibuka</div>
          </button>
        </div>

        <section className="card">
          <div className="pm-tabs" role="tablist" aria-label="Semester">
            <button type="button" role="tab" aria-selected={tab === 'semua'} className={tab === 'semua' ? 'is-on' : ''} onClick={() => setTab('semua')}>Semua<span className="pm-hit">{mk.length}</span></button>
            {semester.map((s) => (
              <button key={s} type="button" role="tab" aria-selected={tab === s} className={tab === s ? 'is-on' : ''} onClick={() => setTab(s)}>
                Smt {s}<span className="pm-hit">{mk.filter((m) => (m.semester || 1) === s && statusMk(m) === 'dibuka').length}/{mk.filter((m) => (m.semester || 1) === s).length}</span>
              </button>
            ))}
          </div>
          <div className="pm-mk-alat">
            {pilih.size ? (
              <div className="km-massal" role="toolbar" aria-label="Aksi untuk mata kuliah terpilih">
                <b>{pilih.size} dipilih</b>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => mintaUbah([...pilih], 'dibuka')}>Buka untuk RPL</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => mintaUbah([...pilih], 'tutup')}>Tutup</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => mintaUbah([...pilih], 'rangkaian')}>Tandai rangkaian TA</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPilih(new Set())}>Batal</button>
              </div>
            ) : (
              <div className="pm-baris-aksi">
                <div className="pm-input-ikon pm-cari">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input className="input" type="search" placeholder="Cari nama atau kode mata kuliah" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari mata kuliah" />
                </div>
                <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Saring status" style={{ width: 210 }}>
                  <option value="">Semua status</option>
                  {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                  <option value="tanpa_sub">Dibuka, belum ada sub-CPMK</option>
                </select>
              </div>
            )}
            <span className="pm-kecil">{tampil.length} mata kuliah</span>
          </div>
          <div className="table-wrap">
            <table className="pm-tabel km-tabel">
              <thead><tr>
                <th style={{ width: 40 }}><input type="checkbox" aria-label="Pilih semua" checked={semuaTerpilih}
                  onChange={() => setPilih(semuaTerpilih ? new Set() : new Set(tampil.map((m) => m.id)))} /></th>
                <th style={{ width: 120 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 56 }}>SKS</th><th style={{ width: 56 }}>Smt</th>
                <th style={{ width: 210 }}>Status RPL</th><th style={{ width: 130 }}>Sub-CPMK</th><th style={{ width: 120 }}>Dipilih pemohon</th><th style={{ width: 90 }}><span className="pm-sr">Aksi</span></th>
              </tr></thead>
              <tbody>
                {tampil.map((m) => {
                  const st = statusMk(m)
                  const nSub = (m.sub_cpmk || []).length
                  return (
                    <tr key={m.id} className={pilih.has(m.id) ? 'km-terpilih' : ''}>
                      <td className="km-c-pilih"><input type="checkbox" aria-label={`Pilih ${m.nama_mk}`} checked={pilih.has(m.id)} onChange={() => togglePilih(m.id)} /></td>
                      <td className="pm-kecil km-c-desktop">{m.kode_mk}</td>
                      <td className="km-c-nama"><div className="pm-tebal">{m.nama_mk}</div><div className="pm-kecil km-meta">{m.kode_mk} · {m.sks} SKS · Smt {m.semester}</div>{st === 'tutup' && m.alasan_tidak_rpl ? <div className="pm-kecil">{m.alasan_tidak_rpl}</div> : null}</td>
                      <td className="km-c-desktop">{m.sks}</td>
                      <td className="km-c-desktop">{m.semester}</td>
                      <td className="km-c-status">
                        <select className={`input km-status km-status-${st}`} value={st} aria-label={`Status RPL ${m.nama_mk}`} onChange={(e) => mintaUbah([m.id], e.target.value)}>
                          {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="km-c-sub">{st !== 'dibuka' ? <span className="pm-kecil">-</span> : nSub ? <Lencana warna="green">{nSub} butir</Lencana> : <Lencana warna="amber">Belum ada</Lencana>}</td>
                      <td className="km-c-draf">{pakai.draf[m.id] ? <span className={st !== 'dibuka' ? 'pm-merah pm-kecil' : 'pm-kecil'}>{pakai.draf[m.id]} draf<span className="km-meta"> pemohon</span></span> : <span className="pm-kecil km-c-desktop-i">-</span>}</td>
                      <td className="km-c-aksi"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(m)}><Pencil size={13} /> Rincian</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!tampil.length ? <p className="pm-kosong">Tidak ada mata kuliah yang cocok.</p> : null}
          </div>
        </section>
        <p className="pm-kecil">Batas pengakuan {prodi?.maks_sks_rpl || 100} SKS tetap berlaku berapa pun mata kuliah yang dibuka. Perubahan status langsung berlaku untuk pemohon dan tercatat siapa yang mengubahnya.</p>
      </>}

      <DialogStatus buka={!!dialog} target={dialog} onTutup={() => setDialog(null)}
        onSimpan={(alasan) => terapkan(dialog.ids, dialog.status, alasan).catch((e) => toast.error(e.message))} />
      {detail ? <DialogDetail mk={detail} dipakaiF03={pakai.f03[detail.id] || 0} onTutup={() => setDetail(null)}
        onTersimpan={(h) => setMk((d) => d.map((m) => (m.id === h.id ? h : m)))} /> : null}
    </div>
  )
}
