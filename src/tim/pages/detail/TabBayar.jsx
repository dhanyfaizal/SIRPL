import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTim } from '../../TimData'
import * as api from '../../api'
import { KOMPONEN_BAYAR, STATUS_BAYAR, kelompokDari } from '../../aturan'
import { rupiah, tanggal } from '../../../pemohon/konstanta'
import { Bidang, BukaBerkas, Dialog, Kartu, Lencana, Tombol } from '../../../pemohon/ui'

// Dipakai di detail pengajuan dan di halaman Pembayaran (dengan kolom pemohon).
export function DaftarBayar({ baris, denganPemohon }) {
  const { data, peta, bisaVerifikasi, ubah } = useTim()
  const [aksi, setAksi] = useState(null)
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const pgj = Object.fromEntries(data.pengajuan.map((p) => [p.id, p]))

  const simpan = async () => {
    setSibuk(true)
    try {
      const hasil = await api.ubahPembayaran(aksi.b.id, { status: aksi.status, catatan: aksi.status === 'ditolak' ? alasan.trim() : null })
      ubah((d) => ({ pembayaran: d.pembayaran.map((x) => (x.id === hasil.id ? hasil : x)) }))
      toast.success(aksi.status === 'lunas' ? 'Pembayaran dinyatakan lunas' : 'Bukti bayar ditolak')
      setAksi(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  if (!baris.length) return <p className="pm-kosong">Tidak ada data pembayaran.</p>
  return (
    <>
      <div className="table-wrap">
        <table className="pm-tabel pm-tabel-responsif">
          <thead><tr>
            {denganPemohon ? <th>Pemohon</th> : null}
            <th style={{ width: 170 }}>Komponen</th><th style={{ width: 140 }}>Jumlah</th><th style={{ width: 130 }}>Diunggah</th>
            <th style={{ width: 170 }}>Status</th><th style={{ width: 310 }}><span className="pm-sr">Aksi</span></th>
          </tr></thead>
          <tbody>
            {baris.map((b) => {
              const p = pgj[b.pengajuan_id]
              const st = STATUS_BAYAR[b.status] || { label: b.status, warna: 'slate' }
              return (
                <tr key={b.id}>
                  {denganPemohon ? (
                    <td data-label="Pemohon">
                      {p ? <Link className="pm-tebal" to={`/tim/antrean/${kelompokDari(p.status)}/${p.id}?tab=bayar`}>{peta.pemohon[p.user_id]?.nama_lengkap || 'Pemohon'}</Link> : '-'}
                      <div className="pm-kecil">{p?.nomor_pendaftaran}</div>
                    </td>
                  ) : null}
                  <td data-label="Komponen">{KOMPONEN_BAYAR[b.komponen] || b.komponen}</td>
                  <td data-label="Jumlah" className="pm-tebal">{rupiah(b.jumlah)}</td>
                  <td data-label="Diunggah" className="pm-kecil">{tanggal(b.created_at)}</td>
                  <td data-label="Status">
                    <Lencana warna={st.warna}>{st.label}</Lencana>
                    {b.status !== 'menunggu' && b.diverifikasi_at ? <div className="pm-kecil">{tanggal(b.diverifikasi_at)}{peta.staf[b.diverifikasi_oleh] ? ` · ${peta.staf[b.diverifikasi_oleh].nama_lengkap}` : ''}</div> : null}
                    {b.status === 'ditolak' && b.catatan ? <div className="pm-kecil pm-merah">{b.catatan}</div> : null}
                  </td>
                  <td data-label="">
                    <div className="pm-baris-aksi">
                      <BukaBerkas path={b.bukti_bayar_url} label="Bukti bayar" />
                      {bisaVerifikasi && b.status === 'menunggu' ? <>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAksi({ b, status: 'lunas' })}><Check size={13} /> Lunas</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAlasan(''); setAksi({ b, status: 'ditolak' }) }}><X size={13} /> Tolak</button>
                      </> : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Dialog buka={!!aksi} judul={aksi?.status === 'lunas' ? 'Nyatakan lunas' : 'Tolak bukti bayar'} onTutup={() => setAksi(null)}
        kaki={<><Tombol onClick={() => setAksi(null)}>Batal</Tombol>
          <Tombol jenis={aksi?.status === 'lunas' ? 'primary' : 'danger'} sibuk={sibuk} disabled={aksi?.status === 'ditolak' && !alasan.trim()} onClick={simpan}>
            {aksi?.status === 'lunas' ? 'Nyatakan lunas' : 'Tolak'}</Tombol></>}>
        {aksi ? <p>{KOMPONEN_BAYAR[aksi.b.komponen]} sebesar <b>{rupiah(aksi.b.jumlah)}</b>. {aksi.status === 'lunas' ? 'Pastikan dana sudah masuk ke rekening STIKOM Yos Sudarso.' : 'Pemohon akan melihat alasan ini dan dapat mengunggah ulang bukti bayar.'}</p> : null}
        {aksi?.status === 'ditolak' ? (
          <Bidang label="Alasan penolakan">
            <textarea className="input" rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: nominal tidak sesuai, bukti tidak terbaca" />
          </Bidang>
        ) : null}
      </Dialog>
    </>
  )
}

export default function TabBayar({ p }) {
  const { data } = useTim()
  const baris = data.pembayaran.filter((b) => b.pengajuan_id === p.id)
  return (
    <Kartu judul="Pembayaran" sub="Bukti bayar yang diunggah pemohon" padat>
      <DaftarBayar baris={baris} />
    </Kartu>
  )
}
