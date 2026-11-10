// Halaman publik verifikasi tanda tangan elektronik (dibuka dari kode QR).
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, CircleAlert, Search, ShieldX } from 'lucide-react'
import * as api from '../api'
import '../../pemohon/pemohon.css'
import '../dokumen.css'

const tgl = (d, jam) => (d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', ...(jam ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}) }) : '-')

export default function Verifikasi() {
  const { kode = '' } = useParams()
  const navigate = useNavigate()
  const [isi, setIsi] = useState(kode)
  const [hasil, setHasil] = useState(undefined)
  const [galat, setGalat] = useState(null)

  useEffect(() => {
    setIsi(kode); setGalat(null)
    if (!kode) { setHasil(undefined); return }
    setHasil(undefined)
    api.verifikasi(kode).then((h) => setHasil(h || null)).catch((e) => setGalat(e.message))
  }, [kode])

  const sah = hasil?.status === 'sah'
  return (
    <div className="dk-verif-latar">
      <main className="dk-verif">
        <header className="dk-verif-kop">
          <img src="/logo-sys.png" alt="" width="44" height="44" />
          <div><div className="pm-tebal">STIKOM Yos Sudarso</div><div className="pm-kecil">Verifikasi tanda tangan elektronik dokumen RPL</div></div>
        </header>
        <form className="dk-verif-cari" onSubmit={(e) => { e.preventDefault(); if (isi.trim()) navigate(`/verifikasi/${isi.trim().toUpperCase()}`) }}>
          <input className="input" value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Masukkan kode verifikasi (12 karakter)" aria-label="Kode verifikasi" maxLength={20} />
          <button type="submit" className="btn btn-primary"><Search size={14} /> Periksa</button>
        </form>
        {galat ? <div className="dk-verif-hasil is-galat"><CircleAlert size={28} /><div><b>Pemeriksaan gagal</b><p>{galat}</p></div></div> : null}
        {kode && hasil === undefined && !galat ? <div className="sk" style={{ height: 160, borderRadius: 12 }} /> : null}
        {kode && hasil === null ? (
          <div className="dk-verif-hasil is-galat"><ShieldX size={28} /><div><b>Kode tidak dikenal</b><p>Tidak ada tanda tangan elektronik dengan kode {kode.toUpperCase()}. Dokumen ini tidak dapat diverifikasi.</p></div></div>
        ) : null}
        {hasil ? (
          <>
            <div className={`dk-verif-hasil ${sah ? 'is-sah' : 'is-galat'}`}>
              {sah ? <BadgeCheck size={30} /> : <ShieldX size={30} />}
              <div>
                <b>{sah ? 'Tanda tangan sah' : hasil.status === 'dicabut' ? 'Dokumen sudah dicabut' : 'Dokumen belum final'}</b>
                <p>{sah ? `Ditandatangani secara elektronik oleh ${hasil.penandatangan} (${hasil.jabatan}) pada ${tgl(hasil.ditandatangani_at, true)}.`
                  : hasil.status === 'dicabut' ? `Dicabut ${tgl(hasil.dicabut_at)}. Alasan: ${hasil.alasan_cabut || '-'}.${hasil.diganti ? ' Dokumen ini telah digantikan dengan terbitan baru.' : ''}`
                  : 'Masih ada penanda tangan yang belum menandatangani.'}</p>
              </div>
            </div>
            <dl className="dk-verif-dl">
              <dt>Jenis dokumen</dt><dd>{hasil.jenis_dokumen} {hasil.jenis_kode !== 'SURAT_HASIL' ? ` (${hasil.jenis_kode})` : ''}</dd>
              <dt>Judul</dt><dd>{hasil.judul}</dd>
              {hasil.nomor ? <><dt>Nomor dokumen</dt><dd>{hasil.nomor}</dd></> : null}
              <dt>Tanggal dokumen</dt><dd>{tgl(hasil.tanggal_dokumen)}</dd>
              {hasil.pemilik ? <><dt>Atas nama</dt><dd>{hasil.pemilik}{hasil.nomor_pendaftaran ? ` (${hasil.nomor_pendaftaran})` : ''}</dd></> : null}
              {hasil.program_studi ? <><dt>Program studi</dt><dd>{hasil.program_studi}</dd></> : null}
              {hasil.sha256 ? <><dt>Sidik isi (SHA-256)</dt><dd className="dk-mono">{hasil.sha256}</dd></> : null}
            </dl>
            <h2 className="pm-kartu-judul" style={{ marginTop: 18 }}>Seluruh penanda tangan</h2>
            <ul className="dk-verif-ttd">
              {(hasil.semua_penandatangan || []).map((t, i) => (
                <li key={i}><div><div className="pm-tebal">{t.nama}</div><div className="pm-kecil">{t.jabatan}</div></div>
                  <span className={`badge-pill ${t.status === 'ditandatangani' ? 'badge-green' : 'badge-amber'}`}>{t.status === 'ditandatangani' ? tgl(t.waktu, true) : 'Belum'}</span></li>
              ))}
            </ul>
          </>
        ) : null}
        {!kode ? <p className="pm-kecil">Pindai kode QR pada dokumen, atau ketik kode verifikasi yang tercetak di bawah kode QR.</p> : null}
      </main>
    </div>
  )
}
