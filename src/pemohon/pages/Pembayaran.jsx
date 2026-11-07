import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { rupiah, tanggal } from '../konstanta'
import { hitungKelengkapan } from '../kelengkapan'
import { BukaBerkas, Dialog, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, PilihBerkas, Tombol } from '../ui'

const LABEL_TARIF = {
  pendaftaran: 'Biaya pendaftaran', asesmen_per_sks: 'Biaya asesmen per SKS diajukan', kuliah_per_semester: 'Biaya kuliah per semester',
  matrikulasi_per_mk: 'Biaya matrikulasi per mata kuliah', cuti_per_semester: 'Biaya cuti per semester', lain_lain: 'Biaya lain-lain',
}
const STATUS_B = { menunggu: ['Menunggu verifikasi', 'amber'], lunas: ['Lunas', 'green'], ditolak: ['Ditolak', 'red'] }

export default function Pembayaran() {
  const { siap, data, pengajuan, userId, ubah } = usePemohon()
  const [buka, setBuka] = useState(null)
  const [file, setFile] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  const k = hitungKelengkapan(data)
  const t = (kode) => data.tarif.find((x) => x.komponen === kode && !x.is_internal)
  const tagihan = [
    { komponen: 'pendaftaran', label: 'Biaya pendaftaran', jumlah: Number(t('pendaftaran')?.besaran || 0), rinci: 'Dibayar saat mendaftar' },
    { komponen: 'asesmen', label: 'Biaya asesmen', jumlah: k.sksDiajukan * Number(t('asesmen_per_sks')?.besaran || 0),
      rinci: `${k.sksDiajukan} SKS diajukan × ${rupiah(t('asesmen_per_sks')?.besaran)}` },
  ]

  const kirim = async () => {
    setSibuk(true)
    try {
      const path = await api.unggahBerkas(userId, pengajuan.id, file, `bayar_${buka.komponen}`)
      const baris = await api.kirimBuktiBayar({ pengajuanId: pengajuan.id, komponen: buka.komponen, jumlah: buka.jumlah, path })
      ubah((d) => ({ pembayaran: [baris, ...d.pembayaran] }))
      toast.success('Bukti pembayaran dikirim untuk diverifikasi')
      setBuka(null); setFile(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Pembayaran" sub="Biaya mengikuti Bab IV Pedoman RPL STIKOM Yos Sudarso. Biaya yang sudah dibayar tidak dapat ditarik kembali.">
      <Kartu judul="Tagihan" padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th>Komponen</th><th style={{ width: 160 }}>Jumlah</th><th style={{ width: 170 }}>Status</th><th style={{ width: 170 }}><span className="pm-sr">Aksi</span></th></tr></thead>
            <tbody>
              {tagihan.map((g) => {
                const bayar = data.pembayaran.find((b) => b.komponen === g.komponen && b.status !== 'ditolak')
                const [l, w] = bayar ? STATUS_B[bayar.status] : ['Belum dibayar', 'slate']
                return (
                  <tr key={g.komponen}>
                    <td data-label="Komponen"><div className="pm-tebal">{g.label}</div><div className="pm-kecil">{g.rinci}</div></td>
                    <td className="pm-tebal" data-label="Jumlah">{rupiah(g.jumlah)}</td>
                    <td data-label="Status"><Lencana warna={w}>{l}</Lencana></td>
                    <td className="pm-kanan" data-label="">
                      {bayar ? <BukaBerkas path={bayar.bukti_bayar_url} label="Bukti" />
                        : g.jumlah > 0 ? <Tombol onClick={() => { setFile(null); setBuka(g) }}>Kirim bukti bayar</Tombol> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Kartu>

      {data.pembayaran.length ? (
        <Kartu judul="Riwayat pembayaran" padat>
          <div className="table-wrap">
            <table className="pm-tabel pm-tabel-responsif">
              <thead><tr><th style={{ width: 150 }}>Tanggal</th><th>Komponen</th><th style={{ width: 150 }}>Jumlah</th><th style={{ width: 170 }}>Status</th></tr></thead>
              <tbody>
                {data.pembayaran.map((b) => (
                  <tr key={b.id}>
                    <td className="pm-kecil" data-label="Tanggal">{tanggal(b.created_at)}</td>
                    <td data-label="Komponen">{b.komponen === 'asesmen' ? 'Biaya asesmen' : b.komponen === 'pendaftaran' ? 'Biaya pendaftaran' : 'Lainnya'}</td>
                    <td data-label="Jumlah">{rupiah(b.jumlah)}</td>
                    <td data-label="Status"><Lencana warna={STATUS_B[b.status]?.[1]}>{STATUS_B[b.status]?.[0]}</Lencana></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kartu>
      ) : null}

      <Kartu judul="Daftar biaya periode ini">
        {data.tarif.filter((x) => !x.is_internal).length ? (
          <dl className="pm-dl">
            {data.tarif.filter((x) => !x.is_internal).map((x) => (
              <div key={x.id} style={{ display: 'contents' }}><dt>{LABEL_TARIF[x.komponen] || x.komponen}</dt><dd>{rupiah(x.besaran)}{x.keterangan ? ` · ${x.keterangan}` : ''}</dd></div>
            ))}
          </dl>
        ) : <Pemberitahuan>Daftar biaya periode ini belum diatur.</Pemberitahuan>}
      </Kartu>

      <Dialog buka={!!buka} judul={`Kirim bukti ${buka?.label.toLowerCase()}`} onTutup={() => setBuka(null)}
        kaki={<><Tombol onClick={() => setBuka(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} disabled={!file} onClick={kirim}>Kirim</Tombol></>}>
        <p>Jumlah yang dibayar: <b>{rupiah(buka?.jumlah)}</b>. Unggah foto atau PDF bukti transfer. Sekretariat akan memverifikasinya.</p>
        <div className="input-group">
          <span className="input-label">Bukti transfer <span className="pm-wajib">*</span></span>
          <div className="pm-baris-aksi"><PilihBerkas onPilih={setFile} /><span className="pm-kecil">{file?.name || 'Belum ada berkas'}</span></div>
        </div>
      </Dialog>
    </Halaman>
  )
}
