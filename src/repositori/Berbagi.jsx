// Halaman publik repositori lewat tautan berbagi (tanpa akun).
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Lock, Printer, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Templat from '../dokumen/Templat'
import Penjelajah from './Penjelajah'
import '../pemohon/pemohon.css'
import '../dokumen/dokumen.css'
import './repositori.css'

async function panggil(body) {
  const { data, error } = await supabase.functions.invoke('repositori', { body })
  if (error) throw new Error('Layanan repositori tidak dapat dihubungi. Coba beberapa saat lagi.')
  if (data?.galat) throw new Error(data.galat)
  return data
}

export default function Berbagi() {
  const { token } = useParams()
  const [sandi, setSandi] = useState('')
  const [sandiAktif, setSandiAktif] = useState(null)
  const [hasil, setHasil] = useState(null)
  const [galat, setGalat] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const [dok, setDok] = useState(null)
  const [sibukId, setSibukId] = useState(null)

  const muat = useCallback(async (s) => {
    setSibuk(true); setGalat(null)
    try { const h = await panggil({ token, sandi: s || undefined, aksi: 'daftar' }); setHasil(h); if (h.valid) setSandiAktif(s || null) } catch (e) { setGalat(e.message) } finally { setSibuk(false) }
  }, [token])
  useEffect(() => { muat(null) }, [muat])

  const buka = async (b) => {
    setSibukId(b.id)
    const w = b.jenis === 'berkas' ? window.open('about:blank', '_blank') : null
    try {
      const h = await panggil({ token, sandi: sandiAktif || undefined, aksi: 'buka', berkas: b.id })
      if (h.url) { if (w) w.location.href = h.url; else window.open(h.url, '_blank', 'noopener') } else if (h.dokumen) { w?.close(); setDok(h.dokumen) }
    } catch (e) { w?.close(); setGalat(e.message) } finally { setSibukId(null) }
  }

  const perluSandi = hasil && !hasil.valid && ['perlu_sandi', 'sandi_salah'].includes(hasil.alasan)
  return (
    <div className="dk-verif-latar">
      <main className="dk-mandiri pm-tumpuk-besar">
        <header className="dk-verif-kop rp-kop">
          <img src="/logo-sys.png" alt="" width="44" height="44" />
          <div className="pm-grow">
            <div className="pm-tebal">Repositori Pelaporan RPL STIKOM Yos Sudarso</div>
            <div className="pm-kecil">{hasil?.nama ? `Dibagikan untuk ${hasil.nama}` : 'Tautan berbagi'}{hasil?.kedaluwarsa_at ? ` · berlaku hingga ${new Date(hasil.kedaluwarsa_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}` : ''}</div>
          </div>
        </header>
        {galat ? <div className="dk-verif-hasil is-galat"><div><b>Terjadi kendala</b><p>{galat}</p></div></div> : null}
        {!hasil && !galat ? <div className="sk" style={{ height: 240, borderRadius: 12 }} /> : null}
        {hasil && !hasil.valid && !perluSandi ? (
          <div className="dk-verif-hasil is-galat"><div><b>Tautan tidak berlaku</b><p>Tautan ini sudah kedaluwarsa, dicabut, atau tidak dikenal. Hubungi Tim Pengelola RPL STIKOM Yos Sudarso.</p></div></div>
        ) : null}
        {perluSandi ? (
          <form className="card rp-sandi" onSubmit={(e) => { e.preventDefault(); if (sandi) muat(sandi) }}>
            <Lock size={22} aria-hidden="true" />
            <div className="pm-grow">
              <div className="pm-tebal">Tautan ini dilindungi kata sandi</div>
              {hasil.alasan === 'sandi_salah' ? <div className="pm-kecil pm-merah">Kata sandi salah.</div> : <div className="pm-kecil">Masukkan kata sandi yang diberikan Tim Pengelola RPL.</div>}
              <div className="pm-baris-aksi" style={{ marginTop: 10 }}>
                <input className="input" type="password" value={sandi} onChange={(e) => setSandi(e.target.value)} autoComplete="current-password" aria-label="Kata sandi" style={{ maxWidth: 280 }} />
                <button type="submit" className="btn btn-primary" disabled={sibuk || !sandi}>Buka</button>
              </div>
            </div>
          </form>
        ) : null}
        {hasil?.valid ? <Penjelajah berkas={hasil.berkas} onBuka={buka} sibukId={sibukId} /> : null}
      </main>
      {dok ? (
        <div className="rp-pratinjau" role="dialog" aria-modal="true" aria-label={dok.judul}>
          <div className="cetak-alat no-print">
            <button type="button" className="btn btn-secondary" onClick={() => setDok(null)}><X size={14} /> Tutup</button>
            <span className="pm-grow" />
            <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Cetak / simpan PDF</button>
          </div>
          <article className="cetak-halaman dk-halaman"><Templat dok={dok} />
            <footer className="dk-kaki">Dokumen ditandatangani secara elektronik. Pindai kode QR untuk memeriksa keabsahan. Sidik isi SHA-256: {dok.sha256?.slice(0, 16)}...</footer>
          </article>
        </div>
      ) : null}
    </div>
  )
}
