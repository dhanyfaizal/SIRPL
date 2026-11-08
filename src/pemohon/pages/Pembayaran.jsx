import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { rupiah, tanggal } from '../konstanta'
import { KOMPONEN_TAGIHAN, STATUS_TAGIHAN, ringkasPengajuan } from '../../keuangan/tagihan'
import { BukaBerkas, Dialog, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, PilihBerkas, Tombol } from '../ui'

const LABEL_TARIF = {
  pendaftaran: 'Biaya pendaftaran', asesmen_per_sks: 'Biaya asesmen per SKS diajukan', kuliah_per_semester: 'Biaya kuliah per semester',
  matrikulasi_per_mk: 'Biaya matrikulasi per mata kuliah', moocs_per_mk: 'Biaya MOOCs per mata kuliah', cuti_per_semester: 'Biaya cuti per semester', lain_lain: 'Biaya lain-lain',
}
const STATUS_B = { menunggu: ['Menunggu verifikasi', 'amber'], lunas: ['Lunas', 'green'], ditolak: ['Ditolak', 'red'] }

export default function Pembayaran() {
  const { siap, data, pengajuan, userId, ubah } = usePemohon()
  const [buka, setBuka] = useState(null)
  const [file, setFile] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState(null)

  // Tagihan disusun dari tarif periode; disegarkan setiap halaman dibuka.
  useEffect(() => {
    if (!pengajuan?.id) return
    let batal = false
    supabase.rpc('siapkan_tagihan', { p_pengajuan: pengajuan.id }).then(async ({ data: rows, error }) => {
      if (batal) return
      if (error) { setGalat(error.message); return }
      const ids = [...new Set((rows || []).map((t) => t.diskon_id).filter(Boolean))]
      const diskon = ids.length ? (await supabase.from('skema_diskon').select('id, nama').in('id', ids)).data || [] : []
      if (!batal) ubah(() => ({ tagihan: rows || [], diskon }))
    })
    return () => { batal = true }
  }, [pengajuan?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />
  if (!data.tagihan && !galat) return <Kerangka />

  const r = ringkasPengajuan(data.tagihan || [], data.pembayaran)
  const namaDiskon = (id) => (data.diskon || []).find((d) => d.id === id)?.nama || 'Diskon'

  const kirim = async () => {
    setSibuk(true)
    try {
      const path = await api.unggahBerkas(userId, pengajuan.id, file, `bayar_${buka.t.komponen}_${buka.a.ke}`)
      const baris = await api.kirimBuktiBayar({ pengajuanId: pengajuan.id, tagihanId: buka.t.id, angsuranKe: buka.a.ke, komponen: buka.t.komponen, jumlah: buka.a.jumlah, path })
      ubah((d) => ({ pembayaran: [baris, ...d.pembayaran] }))
      toast.success('Bukti pembayaran dikirim untuk diverifikasi PMB')
      setBuka(null); setFile(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Pembayaran" sub="Biaya mengikuti Bab IV Pedoman RPL STIKOM Yos Sudarso dan diverifikasi oleh bagian PMB. Biaya yang sudah dibayar tidak dapat ditarik kembali.">
      {galat ? <Pemberitahuan jenis="red" judul="Tagihan tidak dapat dimuat">{galat}</Pemberitahuan> : null}
      {r.rinci.length ? (
        <div className="pm-dl-ringkas">
          <div><span className="pm-kecil">Total tagihan</span><b>{rupiah(r.total)}</b></div>
          <div><span className="pm-kecil">Sudah dibayar</span><b>{rupiah(r.terbayar)}</b></div>
          <div><span className="pm-kecil">Sisa</span><b>{rupiah(r.sisa)}</b></div>
        </div>
      ) : null}

      {r.rinci.map(({ t, r: rt }) => (
        <Kartu key={t.id} judul={KOMPONEN_TAGIHAN[t.komponen]} sub={t.keterangan || undefined} padat
          aksi={<Lencana warna={STATUS_TAGIHAN[rt.status].warna}>{STATUS_TAGIHAN[rt.status].label}</Lencana>}>
          <div className="pm-tagihan-ringkas">
            <span>Nominal <b>{rupiah(t.nominal)}</b></span>
            {Number(t.potongan) > 0 ? <span className="pm-hijau">{namaDiskon(t.diskon_id)} <b>-{rupiah(t.potongan)}</b></span> : null}
            <span>Total <b>{rupiah(rt.total)}</b></span>
            {rt.cicilan ? <span>Dibayar {rt.angsuran.length} kali angsuran</span> : null}
          </div>
          {rt.total > 0 ? (
            <div className="table-wrap">
              <table className="pm-tabel pm-tabel-responsif">
                <thead><tr><th style={{ width: 110 }}>Pembayaran</th><th style={{ width: 150 }}>Jumlah</th><th style={{ width: 150 }}>Jatuh tempo</th><th style={{ width: 190 }}>Status</th><th><span className="pm-sr">Aksi</span></th></tr></thead>
                <tbody>
                  {rt.angsuran.map((a) => {
                    const [l, w] = a.bukti ? STATUS_B[a.bukti.status] : a.terlambat ? ['Lewat jatuh tempo', 'red'] : ['Belum dibayar', 'slate']
                    return (
                      <tr key={a.ke}>
                        <td data-label="Pembayaran">{rt.cicilan ? `Angsuran ${a.ke}` : 'Sekali bayar'}</td>
                        <td className="pm-tebal" data-label="Jumlah">{rupiah(a.jumlah)}</td>
                        <td className="pm-kecil" data-label="Jatuh tempo">{a.jatuh_tempo ? tanggal(a.jatuh_tempo) : '-'}</td>
                        <td data-label="Status">
                          <Lencana warna={w}>{l}</Lencana>
                          {a.ditolak ? <div className="pm-kecil pm-merah">Bukti sebelumnya ditolak: {a.ditolak.catatan}. Kirim ulang bukti bayar.</div> : null}
                        </td>
                        <td className="pm-kanan" data-label="">
                          {a.bukti ? <BukaBerkas path={a.bukti.bukti_bayar_url} label="Bukti" />
                            : <Tombol onClick={() => { setFile(null); setBuka({ t, a, label: KOMPONEN_TAGIHAN[t.komponen] }) }}>Kirim bukti bayar</Tombol>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="pm-kosong">Tidak ada yang perlu dibayar untuk komponen ini.</p>}
        </Kartu>
      ))}
      {!r.rinci.length && !galat ? <Pemberitahuan>Belum ada tagihan. Tagihan pendaftaran dan asesmen muncul setelah tarif periode diatur.</Pemberitahuan> : null}

      {data.pembayaran.length ? (
        <Kartu judul="Riwayat pembayaran" padat>
          <div className="table-wrap">
            <table className="pm-tabel pm-tabel-responsif">
              <thead><tr><th style={{ width: 150 }}>Tanggal</th><th>Komponen</th><th style={{ width: 150 }}>Jumlah</th><th style={{ width: 200 }}>Status</th></tr></thead>
              <tbody>
                {data.pembayaran.map((b) => (
                  <tr key={b.id}>
                    <td className="pm-kecil" data-label="Tanggal">{tanggal(b.created_at)}</td>
                    <td data-label="Komponen">{KOMPONEN_TAGIHAN[b.komponen] || 'Lainnya'}{(data.tagihan || []).find((t) => t.id === b.tagihan_id)?.angsuran ? ` · angsuran ${b.angsuran_ke}` : ''}</td>
                    <td data-label="Jumlah">{rupiah(b.jumlah)}</td>
                    <td data-label="Status"><Lencana warna={STATUS_B[b.status]?.[1]}>{STATUS_B[b.status]?.[0]}</Lencana>{b.status === 'ditolak' && b.catatan ? <div className="pm-kecil pm-merah">{b.catatan}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kartu>
      ) : null}

      <Kartu judul="Daftar biaya periode ini" sub="Butuh keringanan atau cicilan? Hubungi bagian PMB STIKOM Yos Sudarso.">
        {data.tarif.filter((x) => !x.is_internal).length ? (
          <dl className="pm-dl">
            {data.tarif.filter((x) => !x.is_internal && (!x.prodi_id || x.prodi_id === pengajuan.prodi_pilihan_id)).map((x) => (
              <div key={x.id} style={{ display: 'contents' }}><dt>{LABEL_TARIF[x.komponen] || x.komponen}</dt><dd>{rupiah(x.besaran)}{x.keterangan ? ` · ${x.keterangan}` : ''}</dd></div>
            ))}
          </dl>
        ) : <Pemberitahuan>Daftar biaya periode ini belum diatur.</Pemberitahuan>}
      </Kartu>

      <Dialog buka={!!buka} judul={`Kirim bukti ${buka?.label.toLowerCase() || ''}`} onTutup={() => setBuka(null)}
        kaki={<><Tombol onClick={() => setBuka(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} disabled={!file} onClick={kirim}>Kirim</Tombol></>}>
        <p>Jumlah yang dibayar{buka?.t.angsuran ? ` (angsuran ${buka?.a.ke})` : ''}: <b>{rupiah(buka?.a.jumlah)}</b>. Unggah foto atau PDF bukti transfer. Bagian PMB akan memverifikasinya.</p>
        <div className="input-group">
          <span className="input-label">Bukti transfer <span className="pm-wajib">*</span></span>
          <div className="pm-baris-aksi"><PilihBerkas onPilih={setFile} /><span className="pm-kecil">{file?.name || 'Belum ada berkas'}</span></div>
        </div>
      </Dialog>
    </Halaman>
  )
}
