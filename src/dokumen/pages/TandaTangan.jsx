// Kotak masuk tanda tangan untuk semua peran.
// - TandaTanganModul: dipasang di dalam tata letak modul (Pimpinan, Tim, Asesor, Admin) agar sidebar tetap tampil.
// - TandaTangan (default): halaman mandiri /tanda-tangan, dipertahankan untuk tautan lama.
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { KotakTtd } from '../PanelDokumen'
import { Halaman } from '../../pemohon/ui'
import '../../pemohon/pemohon.css'
import '../../tim/tim.css'
import '../dokumen.css'

const SUB = 'Periksa isi dokumen sebelum menandatangani. Tanda tangan elektronik dilengkapi kode QR yang dapat diverifikasi siapa pun.'

export function TandaTanganModul() {
  return (
    <Halaman judul="Tanda tangan dokumen" sub={SUB}>
      <KotakTtd />
    </Halaman>
  )
}

export default function TandaTangan() {
  const navigate = useNavigate()
  return (
    <div className="dk-verif-latar">
      <main className="dk-mandiri pm-tumpuk-besar">
        <div className="pm-baris-aksi">
          <button type="button" className="btn btn-secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}><ArrowLeft size={14} /> Kembali</button>
        </div>
        <div><h1 className="page-title">Tanda tangan dokumen</h1><p className="page-subtitle">{SUB}</p></div>
        <KotakTtd />
      </main>
    </div>
  )
}
