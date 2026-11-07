// Komponen kecil yang dipakai bersama di modul Pemohon.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Circle, Clock, ExternalLink, FileUp, LoaderCircle, X } from 'lucide-react'
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

export function Tombol({ jenis = 'secondary', sibuk, children, ikon: Ikon, ...rest }) {
  return (
    <button type="button" className={`btn btn-${jenis}`} disabled={sibuk || rest.disabled} {...rest}>
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
