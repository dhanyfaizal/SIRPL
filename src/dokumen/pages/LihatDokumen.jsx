// Halaman dokumen (cetak A4) dengan aksi tanda tangan bagi penanda tangan.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, PenLine, Printer, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../api'
import Templat from '../Templat'
import { Bidang, Dialog, Lencana, Pemberitahuan, Tombol } from '../../pemohon/ui'
import '../../pemohon/pemohon.css'
import '../dokumen.css'

export const STATUS_DOK = {
  menunggu_ttd: { label: 'Menunggu tanda tangan', warna: 'amber' },
  final: { label: 'Final', warna: 'green' },
  dicabut: { label: 'Dicabut', warna: 'red' },
  draf: { label: 'Draf', warna: 'slate' },
}

export default function LihatDokumen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [dok, setDok] = useState(null)
  const [galat, setGalat] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [teks, setTeks] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    try { const d = await api.muatDokumen(id); if (!d) setGalat('Dokumen tidak ditemukan atau Anda tidak berhak melihatnya.'); else setDok(d) } catch (e) { setGalat(e.message) }
  }, [id])
  useEffect(() => { muat() }, [muat])

  const milikSaya = dok?.ttd.find((t) => t.penandatangan_id === user?.id && t.status === 'menunggu')
  const bolehCabut = dok && dok.status !== 'dicabut' && ['admin', 'ketua_tim', 'eksekutif'].includes(role)

  const jalankan = async () => {
    setSibuk(true)
    try {
      if (dialog === 'ttd') {
        const h = await api.tandatangani(milikSaya.id)
        toast.success(h?.semua_sudah ? 'Ditandatangani. Dokumen sekarang final.' : 'Dokumen ditandatangani')
      } else if (dialog === 'tolak') {
        if (!teks.trim()) throw new Error('Tuliskan bagian yang tidak sesuai')
        await api.tolak(milikSaya.id, teks.trim()); toast.success('Penolakan dikirim ke Tim Pengelola RPL')
      } else {
        if (!teks.trim()) throw new Error('Tuliskan alasan pencabutan')
        await api.cabut(dok.id, teks.trim()); toast.success('Dokumen dicabut')
      }
      setDialog(null); setTeks(''); await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  if (galat) return <div className="cetak-latar"><div className="cetak-halaman"><Pemberitahuan jenis="red">{galat}</Pemberitahuan></div></div>
  if (!dok) return <div className="cetak-latar"><div className="cetak-halaman"><div className="sk" style={{ height: 400 }} /></div></div>
  const st = STATUS_DOK[dok.status] || STATUS_DOK.draf
  const ditolak = dok.ttd.filter((t) => t.status === 'ditolak')

  return (
    <div className="cetak-latar">
      <div className="cetak-alat dk-alat no-print">
        <button type="button" className="btn btn-secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}><ArrowLeft size={14} /> Kembali</button>
        <Lencana warna={st.warna}>{st.label}</Lencana>
        <span className="pm-kecil pm-grow">{dok.ttd.filter((t) => t.status === 'ditandatangani').length} dari {dok.ttd.length} tanda tangan</span>
        {bolehCabut ? <Tombol ikon={Ban} onClick={() => { setTeks(''); setDialog('cabut') }}>Cabut</Tombol> : null}
        {milikSaya && dok.status === 'menunggu_ttd' ? <>
          <Tombol ikon={X} onClick={() => { setTeks(''); setDialog('tolak') }}>Tolak</Tombol>
          <Tombol jenis="primary" ikon={PenLine} onClick={() => setDialog('ttd')}>Tandatangani</Tombol>
        </> : null}
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Cetak / simpan PDF</button>
      </div>
      {dok.status === 'dicabut' ? <div className="cetak-alat no-print"><Pemberitahuan jenis="red" judul="Dokumen dicabut">{dok.alasan_cabut}</Pemberitahuan></div> : null}
      {ditolak.length ? <div className="cetak-alat no-print"><Pemberitahuan jenis="amber" judul="Penanda tangan menolak">{ditolak.map((t) => `${t.nama_snapshot}: ${t.catatan_tolak}`).join(' · ')}. Perbaiki data lalu terbitkan ulang dokumen.</Pemberitahuan></div> : null}
      <article className={`cetak-halaman dk-halaman${dok.status === 'dicabut' ? ' dk-dicabut' : ''}`}>
        <Templat dok={dok} />
        <footer className="dk-kaki">
          {dok.status === 'final' ? <>Dokumen ini ditandatangani secara elektronik. Pindai kode QR untuk memeriksa keabsahan. Sidik isi SHA-256: {dok.sha256?.slice(0, 16)}...</>
            : dok.status === 'dicabut' ? 'DOKUMEN INI SUDAH DICABUT DAN TIDAK BERLAKU.' : 'Dokumen belum final: masih menunggu tanda tangan.'}
        </footer>
      </article>
      <Dialog buka={!!dialog} judul={dialog === 'ttd' ? 'Tandatangani dokumen' : dialog === 'tolak' ? 'Tolak tanda tangan' : 'Cabut dokumen'} onTutup={() => setDialog(null)}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={jalankan}>{dialog === 'ttd' ? 'Tandatangani' : dialog === 'tolak' ? 'Kirim penolakan' : 'Cabut'}</Tombol></>}>
        {dialog === 'ttd' ? (
          <p>Saya, <b>{milikSaya?.nama_snapshot}</b>, selaku {milikSaya?.jabatan_snapshot}, menyetujui dan menandatangani <b>{dok.judul}</b>{dok.nomor ? ` nomor ${dok.nomor}` : ''}. Tanda tangan elektronik dicatat beserta waktu dan kode verifikasi QR, dan isinya tidak dapat diubah lagi.</p>
        ) : (
          <Bidang label={dialog === 'tolak' ? 'Bagian yang tidak sesuai' : 'Alasan pencabutan'} wajib>
            <textarea className="input" rows={3} value={teks} onChange={(e) => setTeks(e.target.value)} />
          </Bidang>
        )}
      </Dialog>
    </div>
  )
}
