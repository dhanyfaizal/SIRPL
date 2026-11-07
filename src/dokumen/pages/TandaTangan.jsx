// Kotak masuk tanda tangan untuk semua peran (halaman mandiri).
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { KotakTtd } from '../PanelDokumen'
import '../../pemohon/pemohon.css'
import '../../tim/tim.css'
import '../dokumen.css'

export default function TandaTangan() {
  const navigate = useNavigate()
  return (
    <div className="dk-verif-latar">
      <main className="dk-mandiri pm-tumpuk-besar">
        <div className="pm-baris-aksi">
          <button type="button" className="btn btn-secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}><ArrowLeft size={14} /> Kembali</button>
        </div>
        <div><h1 className="page-title">Tanda tangan dokumen</h1><p className="page-subtitle">Periksa isi dokumen sebelum menandatangani. Tanda tangan elektronik dilengkapi kode QR yang dapat diverifikasi siapa pun.</p></div>
        <KotakTtd />
      </main>
    </div>
  )
}
