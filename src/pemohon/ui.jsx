// Komponen kecil yang dipakai bersama di modul Pemohon.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, ChevronDown, Circle, Clock, ExternalLink, Eye, FileUp, LoaderCircle, Lock, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { STATUS } from './konstanta'
import { urlBerkas } from './api'

export function Halaman({ judul, sub, aksi, children }) {
  return (
    <div className="pm-halaman">
      <div className="pm-kepala">
        <div>
          <h1 className="page-title">{judul}</h1>
          {sub ? <p className="page-subtitle">{sub}</p> : null}
        </div>
        {aksi ? <div className="pm-kepala-aksi">{aksi}</div> : null}
      </div>
      {children}
    </div>
  )
}

export function Kartu({ judul, sub, aksi, children, kaki, padat, id }) {
  return (
    <section className="card pm-kartu" id={id}>
      {judul ? (
        <div className="card-header">
          <div>
            <h2 className="pm-kartu-judul">{judul}</h2>
            {sub ? <div className="pm-kartu-sub">{sub}</div> : null}
          </div>
          {aksi}
        </div>
      ) : null}
      <div className={padat ? '' : 'card-body'}>{children}</div>
      {kaki ? <div className="card-footer">{kaki}</div> : null}
    </section>
  )
}

export function Lencana({ warna = 'slate', children }) {
  return <span className={`badge-pill badge-${warna}`}>{children}</span>
}

export function LencanaStatus({ status }) {
  const s = STATUS[status] || { label: status, warna: 'slate' }
  return <Lencana warna={s.warna}>{s.label}</Lencana>
}

export function Pemberitahuan({ jenis = 'indigo', judul, children, aksi }) {
  return (
    <div className={`pm-notice pm-notice-${jenis}`} role={jenis === 'red' ? 'alert' : undefined}>
      <div className="pm-notice-isi">
        {judul ? <div className="pm-notice-judul">{judul}</div> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {aksi}
    </div>
  )
}

export function Kerangka({ baris = 4 }) {
  return (
    <div className="pm-halaman" aria-busy="true" aria-label="Memuat">
      <div className="sk" style={{ width: 240, height: 22 }} />
      <div className="sk" style={{ width: 360, height: 14 }} />
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 20 }}>
          <div className="sk" style={{ width: '40%', height: 14, marginBottom: 12 }} />
          <div className="sk" style={{ width: '100%', height: 12, marginBottom: 8 }} />
          <div className="sk" style={{ width: '85%', height: 12 }} />
        </div>
      ))}
    </div>
  )
}

export function IkonStatusLangkah({ status }) {
  if (status === 'selesai') return <Check size={16} className="pm-ok" aria-label="Selesai" />
  if (status === 'proses') return <Clock size={16} className="pm-wait" aria-label="Belum lengkap" />
  if (status === 'kunci') return <Lock size={15} className="pm-none" aria-label="Terkunci" />
  return <Circle size={16} className="pm-none" aria-label="Belum dimulai" />
}

// Dialog aplikasi (pengganti confirm/alert bawaan browser).
export function Dialog({ buka, judul, onTutup, children, kaki, lebar = 480 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!buka) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onTutup?.() }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => ref.current?.querySelector('input, textarea, select, button')?.focus(), 30)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t) }
  }, [buka, onTutup])
  if (!buka) return null
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onTutup?.() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={judul} style={{ maxWidth: lebar }} ref={ref}>
        <div className="modal-header">
          <h2 className="modal-title">{judul}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onTutup} aria-label="Tutup"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {kaki ? <div className="modal-footer">{kaki}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function Tombol({ jenis = 'secondary', sibuk, children, ikon: Ikon, disabled, ...rest }) {
  return (
    <button type="button" className={`btn btn-${jenis}`} {...rest} disabled={sibuk || disabled}>
      {sibuk ? <LoaderCircle size={14} className="pm-putar" aria-hidden="true" /> : Ikon ? <Ikon size={14} aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function Bidang({ label, hint, wajib, children, lebar }) {
  return (
    <label className="input-group" style={lebar ? { gridColumn: '1 / -1' } : undefined}>
      <span className="input-label">{label}{wajib ? <span className="pm-wajib" aria-hidden="true"> *</span> : null}</span>
      {children}
      {hint ? <span className="pm-hint">{hint}</span> : null}
    </label>
  )
}

// Tombol pilih berkas. Mengunggah lewat fungsi onPilih(file).
export function PilihBerkas({ label = 'Pilih berkas', terima = '.pdf,.jpg,.jpeg,.png', onPilih, nonaktif, sibuk }) {
  const ref = useRef(null)
  return (
    <>
      <input ref={ref} type="file" accept={terima} hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPilih(f) }} />
      <Tombol ikon={FileUp} sibuk={sibuk} disabled={nonaktif} onClick={() => ref.current?.click()}>{label}</Tombol>
    </>
  )
}

export function BukaBerkas({ path, label = 'Lihat' }) {
  const [sibuk, setSibuk] = useState(false)
  if (!path) return null
  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={sibuk}
      onClick={async () => {
        setSibuk(true)
        // Buka jendela lebih dulu agar tidak diblokir browser, lalu isi alamatnya.
        const w = window.open('about:blank', '_blank')
        try {
          const url = await urlBerkas(path)
          if (w) w.location.href = url; else window.location.href = url
        } catch (e) {
          w?.close()
          toast.error(e.message)
        } finally { setSibuk(false) }
      }}>
      <ExternalLink size={13} aria-hidden="true" /> {label}
    </button>
  )
}

export function Segmen({ pilihan, nilai, onUbah, label, nonaktif }) {
  return (
    <div className="pm-segmen" role="radiogroup" aria-label={label}>
      {pilihan.map((p) => (
        <button key={p.v} type="button" role="radio" aria-checked={nilai === p.v} disabled={nonaktif}
          className={nilai === p.v ? 'is-on' : ''} onClick={() => onUbah(p.v)}>{p.l}</button>
      ))}
    </div>
  )
}


// ── Ukuran layar ────────────────────────────────────────────────
export function useLayarKecil(query = '(max-width: 767px)') {
  const ambil = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [cocok, setCocok] = useState(ambil)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const ubah = () => setCocok(mql.matches)
    ubah(); mql.addEventListener('change', ubah)
    return () => mql.removeEventListener('change', ubah)
  }, [query])
  return cocok
}

// ── Isian pilihan ───────────────────────────────────────────────
export function PilihTahun({ nilai, onUbah, nonaktif, dari = 1960, label, kosong = 'Pilih tahun' }) {
  const sekarang = new Date().getFullYear()
  const tahun = []
  for (let t = sekarang; t >= dari; t--) tahun.push(t)
  return (
    <select className="input" value={nilai || ''} disabled={nonaktif} aria-label={label} onChange={(e) => onUbah(e.target.value)}>
      <option value="">{kosong}</option>
      {tahun.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

export function InputAngka({ nilai, onUbah, panjang, nonaktif, ...rest }) {
  return (
    <input className="input" inputMode="numeric" value={nilai || ''} readOnly={nonaktif} maxLength={panjang}
      onChange={(e) => onUbah(e.target.value.replace(/[^0-9]/g, '').slice(0, panjang || 20))} {...rest} />
  )
}

export function PilihSegmen({ pilihan, nilai, onUbah, nonaktif, label, penuh }) {
  return (
    <div className={`pm-segmen${penuh ? ' pm-segmen-penuh' : ''}`} role="radiogroup" aria-label={label}>
      {pilihan.map((p) => (
        <button key={p.v} type="button" role="radio" aria-checked={nilai === p.v} disabled={nonaktif}
          className={nilai === p.v ? 'is-on' : ''} onClick={() => onUbah(p.v)}>{p.l}</button>
      ))}
    </div>
  )
}

// Kotak cari dengan daftar pilihan. opsi: [{ nilai, label, grup? }]
export function Combobox({ nilai, onUbah, opsi, placeholder = 'Ketik untuk mencari', bolehKetik, nonaktif, label, id }) {
  const [buka, setBuka] = useState(false)
  const [q, setQ] = useState('')
  const [aktif, setAktif] = useState(0)
  const ref = useRef(null)
  const hasil = useMemo(() => {
    const k = q.trim().toLowerCase()
    const cocok = k ? opsi.filter((o) => o.label.toLowerCase().includes(k)) : opsi
    return cocok.slice(0, 60)
  }, [q, opsi])
  const tampilKetik = bolehKetik && q.trim() && !opsi.some((o) => o.label.toLowerCase() === q.trim().toLowerCase())
  const total = hasil.length + (tampilKetik ? 1 : 0)

  useEffect(() => {
    if (!buka) return undefined
    const tutup = (e) => { if (!ref.current?.contains(e.target)) setBuka(false) }
    document.addEventListener('mousedown', tutup)
    return () => document.removeEventListener('mousedown', tutup)
  }, [buka])

  const pilih = (v) => { onUbah(v); setBuka(false); setQ('') }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setBuka(true); setAktif((a) => Math.min(a + 1, total - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAktif((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && buka) {
      e.preventDefault()
      if (aktif < hasil.length && hasil[aktif]) pilih(hasil[aktif].nilai)
      else if (tampilKetik) pilih(q.trim())
    } else if (e.key === 'Escape') setBuka(false)
  }
  let grupTerakhir = null
  return (
    <div className="pm-combo" ref={ref}>
      <div className="pm-input-ikon">
        <Search size={15} aria-hidden="true" />
        <input id={id} className="input" role="combobox" aria-expanded={buka} aria-autocomplete="list" aria-label={label}
          value={buka ? q : (nilai || '')} placeholder={nilai || placeholder} readOnly={nonaktif}
          onFocus={() => { if (!nonaktif) { setBuka(true); setQ(''); setAktif(0) } }}
          onChange={(e) => { setQ(e.target.value); setBuka(true); setAktif(0) }} onKeyDown={onKey} />
        <ChevronDown size={14} className="pm-combo-panah" aria-hidden="true" />
      </div>
      {buka && !nonaktif ? (
        <div className="pm-combo-list" role="listbox">
          {hasil.map((o, i) => {
            const kepala = o.grup && o.grup !== grupTerakhir ? o.grup : null
            grupTerakhir = o.grup
            return (
              <div key={`${o.grup}-${o.nilai}`}>
                {kepala ? <div className="pm-combo-grup">{kepala}</div> : null}
                <button type="button" role="option" aria-selected={o.nilai === nilai}
                  className={`${i === aktif ? 'is-aktif' : ''}${o.nilai === nilai ? ' is-on' : ''}`}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => pilih(o.nilai)}>{o.label}</button>
              </div>
            )
          })}
          {tampilKetik ? (
            <button type="button" className={`pm-combo-ketik${aktif === hasil.length ? ' is-aktif' : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pilih(q.trim())}>Gunakan "{q.trim()}"</button>
          ) : null}
          {!total ? <div className="pm-combo-kosong">Tidak ditemukan{bolehKetik ? '. Ketik nama lengkapnya untuk memakai isian sendiri.' : '.'}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

// ── Tahapan ─────────────────────────────────────────────────────
// Bar "Simpan dan lanjutkan" yang menempel di bawah halaman.
export function BarTahap({ info, children }) {
  return (
    <div className="pm-bar-tahap">
      <div className="pm-bar-info">{info}</div>
      <div className="pm-bar-aksi">{children}</div>
    </div>
  )
}

export function TombolLanjut({ sibuk, children = 'Simpan dan lanjutkan', disabled, ...rest }) {
  return (
    <button type="button" className="btn btn-primary" {...rest} disabled={sibuk || disabled}>
      {sibuk ? <LoaderCircle size={14} className="pm-putar" aria-hidden="true" /> : null}
      {children} {!sibuk ? <ArrowRight size={14} aria-hidden="true" /> : null}
    </button>
  )
}

// Tahap yang belum terbuka tampil dalam mode baca.
export function GerbangTahap({ tahap, sebelum, children }) {
  if (!tahap || tahap.terbuka) return children
  return (
    <>
      <div className="pm-banner-kunci" role="status">
        <Lock size={18} aria-hidden="true" />
        <div className="pm-grow">
          <div className="pm-tebal">Tahap ini masih terkunci</div>
          <div>Selesaikan tahap {sebelum?.no}, {sebelum?.label}, lalu tekan "Simpan dan lanjutkan". Isian di bawah hanya untuk dilihat agar Anda tahu apa yang perlu disiapkan.</div>
        </div>
        {sebelum ? <Link className="btn btn-primary btn-sm" to={sebelum.to}>Ke {sebelum.label}</Link> : null}
      </div>
      <div className="pm-mode-baca" aria-hidden="true" inert>{children}</div>
    </>
  )
}

export function LencanaModeBaca() {
  return <span className="badge-pill badge-slate"><Eye size={12} aria-hidden="true" /> Mode baca</span>
}

// Pendaftaran fungsi simpan dari beberapa kartu dalam satu halaman.
const SimpanCtx = createContext(null)
export function useRegistriSimpan() {
  const daftar = useRef(new Map())
  const api = useMemo(() => ({
    daftar: (kunci, fn) => { daftar.current.set(kunci, fn); return () => daftar.current.delete(kunci) },
    jalankan: async () => { for (const fn of daftar.current.values()) await fn() },
  }), [])
  return api
}
export const PenyediaSimpan = SimpanCtx.Provider
export function useDaftarSimpan(kunci, fn) {
  const reg = useContext(SimpanCtx)
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => reg?.daftar(kunci, () => ref.current?.()), [reg, kunci])
}
