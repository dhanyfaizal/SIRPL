import { useState } from 'react'
import { useTim } from '../TimData'
import { STATUS_BAYAR } from '../aturan'
import { rupiah } from '../../pemohon/konstanta'
import { Halaman, Kerangka, PilihSegmen } from '../../pemohon/ui'
import { DaftarBayar } from './detail/TabBayar'

export default function Pembayaran() {
  const { siap, data, bisaVerifikasiBayar } = useTim()
  const [status, setStatus] = useState('menunggu')
  if (!siap) return <Kerangka />
  const hit = (s) => data.pembayaran.filter((b) => b.status === s).length
  const baris = data.pembayaran.filter((b) => status === 'semua' || b.status === status)
  const lunas = data.pembayaran.filter((b) => b.status === 'lunas').reduce((n, b) => n + Number(b.jumlah), 0)
  return (
    <Halaman judul="Pembayaran" sub={`${bisaVerifikasiBayar ? 'Verifikasi bukti bayar pendaftaran dan asesmen.' : 'Pantau pembayaran pemohon; verifikasi bukti bayar dilakukan bagian PMB.'} Total lunas ${rupiah(lunas)}.`}
      aksi={<PilihSegmen nilai={status} onUbah={setStatus} label="Saring status pembayaran"
        pilihan={[...Object.entries(STATUS_BAYAR).map(([v, s]) => ({ v, l: `${s.label.split(' ')[0]} (${hit(v)})` })), { v: 'semua', l: 'Semua' }]} />}>
      <section className="card"><DaftarBayar baris={baris} denganPemohon /></section>
    </Halaman>
  )
}
