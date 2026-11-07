// Dokumen pengajuan milik pemohon dan tanda tangan yang menunggu.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as dokApi from '../../dokumen/api'
import { BarisDokumen, KotakTtd } from '../../dokumen/PanelDokumen'
import { Halaman, Kartu, Kerangka } from '../ui'
import '../../tim/tim.css'

export default function Dokumen() {
  const { siap, pengajuan } = usePemohon()
  const [daftar, setDaftar] = useState(null)
  useEffect(() => {
    if (pengajuan?.id) dokApi.daftarDokumen({ pengajuanId: pengajuan.id }).then(setDaftar).catch((e) => toast.error(e.message))
  }, [pengajuan?.id, pengajuan?.status])
  if (!siap) return <Kerangka />
  return (
    <Halaman judul="Dokumen" sub="Formulir dan surat RPL Anda. Setiap tanda tangan elektronik dilengkapi kode QR yang dapat diverifikasi.">
      <KotakTtd ringkas />
      <Kartu judul="Dokumen pengajuan" padat>
        {!daftar ? <div className="card-body"><div className="sk" style={{ height: 60 }} /></div>
          : daftar.filter((d) => d.status !== 'dicabut').length ? <ul className="tm-daftar">{daftar.filter((d) => d.status !== 'dicabut').map((d) => <BarisDokumen key={d.id} d={d} />)}</ul>
          : <p className="pm-kosong">Belum ada dokumen. Dokumen diterbitkan Tim Pengelola RPL sesuai tahapan.</p>}
      </Kartu>
    </Halaman>
  )
}
