// Verifikasi bukti bayar oleh PMB.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useKeuangan, cek } from '../KeuanganData'
import { KOMPONEN_TAGIHAN } from '../tagihan'
import { STATUS_BAYAR } from '../../tim/aturan'
import { rupiah, tanggal } from '../../pemohon/konstanta'
import { Bidang, BukaBerkas, Dialog, Halaman, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'

export default function Verifikasi() {
  const { siap, data, peta, galat, ubah } = useKeuangan()
  const [status, setStatus] = useState('menunggu')
  const [cari, setCari] = useState('')
  const [aksi, setAksi] = useState(null)
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return (data?.pembayaran || [])
      .filter((b) => peta.pengajuan[b.pengajuan_id])
      .filter((b) => status === 'semua' || b.status === status)
      .filter((b) => {
        if (!q) return true
        const p = peta.pengajuan[b.pengajuan_id]
        const u = peta.orang[p.user_id]
        return [u?.nama_lengkap, u?.email, p.nomor_pendaftaran].some((v) => (v || '').toLowerCase().includes(q))
      })
      .sort((x, y) => (status === 'menunggu' ? (x.created_at < y.created_at ? -1 : 1) : (x.created_at < y.created_at ? 1 : -1)))
  }, [data, peta, status, cari])

  if (galat && !siap) return <Halaman judul="Verifikasi pembayaran"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const hit = (s) => data.pembayaran.filter((b) => b.status === s && peta.pengajuan[b.pengajuan_id]).length
  const simpan = async () => {
    setSibuk(true)
    try {
      const hasil = cek(await supabase.from('pembayaran_rpl').update({ status: aksi.status, catatan: aksi.status === 'ditolak' ? alasan.trim() : null })
        .eq('id', aksi.b.id).select().single())
      ubah((d) => ({ pembayaran: d.pembayaran.map((x) => (x.id === hasil.id ? hasil : x)) }))
      toast.success(aksi.status === 'lunas' ? 'Pembayaran dinyatakan lunas' : 'Bukti bayar ditolak')
      setAksi(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Verifikasi pembayaran" sub="Cocokkan bukti transfer dengan mutasi rekening STIKOM Yos Sudarso sebelum menyatakan lunas. Yang paling lama menunggu tampil di atas.">
      <section className="card">
        <div className="pm-mk-alat">
          <div className="pm-baris-aksi">
            <PilihSegmen nilai={status} onUbah={setStatus} label="Saring status"
              pilihan={[{ v: 'menunggu', l: `Menunggu (${hit('menunggu')})` }, { v: 'lunas', l: `Lunas (${hit('lunas')})` }, { v: 'ditolak', l: `Ditolak (${hit('ditolak')})` }, { v: 'semua', l: 'Semua' }]} />
            <div className="pm-input-ikon pm-cari">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input className="input" type="search" placeholder="Cari nama, email, atau nomor" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pembayaran" />
            </div>
          </div>
          <span className="pm-kecil">{baris.length} pembayaran</span>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr>
              <th>Pemohon</th><th style={{ width: 200 }}>Tagihan</th><th style={{ width: 140 }}>Jumlah</th><th style={{ width: 120 }}>Diunggah</th>
              <th style={{ width: 190 }}>Status</th><th style={{ width: 280 }}><span className="sr-only">Aksi</span></th>
            </tr></thead>
            <tbody>
              {baris.map((b) => {
                const p = peta.pengajuan[b.pengajuan_id]
                const u = peta.orang[p.user_id]
                const t = peta.tagihan[b.tagihan_id]
                const st = STATUS_BAYAR[b.status] || { label: b.status, warna: 'slate' }
                return (
                  <tr key={b.id}>
                    <td data-label="Pemohon">
                      <Link className="pm-tebal" to={`/keuangan/tagihan/${p.id}`}>{u?.nama_lengkap || u?.email || 'Pemohon'}</Link>
                      <div className="pm-kecil">{p.nomor_pendaftaran} · {peta.prodi[p.prodi_pilihan_id]?.nama}</div>
                    </td>
                    <td data-label="Tagihan">{KOMPONEN_TAGIHAN[b.komponen] || b.komponen}{t?.angsuran ? <div className="pm-kecil">Angsuran ke-{b.angsuran_ke} dari {t.angsuran.length}</div> : null}</td>
                    <td data-label="Jumlah" className="pm-tebal ku-angka">{rupiah(b.jumlah)}</td>
                    <td data-label="Diunggah" className="pm-kecil">{tanggal(b.created_at, true)}</td>
                    <td data-label="Status">
                      <Lencana warna={st.warna}>{st.label}</Lencana>
                      {b.status !== 'menunggu' && b.diverifikasi_at ? <div className="pm-kecil">{tanggal(b.diverifikasi_at)}{peta.orang[b.diverifikasi_oleh] ? ` · ${peta.orang[b.diverifikasi_oleh].nama_lengkap}` : ''}</div> : null}
                      {b.status === 'ditolak' && b.catatan ? <div className="pm-kecil pm-merah">{b.catatan}</div> : null}
                    </td>
                    <td data-label="">
                      <div className="pm-baris-aksi ad-aksi-kanan">
                        <BukaBerkas path={b.bukti_bayar_url} label="Bukti" />
                        {b.status === 'menunggu' ? <>
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
          {!baris.length ? <p className="pm-kosong">{status === 'menunggu' ? 'Tidak ada bukti bayar yang menunggu verifikasi.' : 'Tidak ada data pembayaran.'}</p> : null}
        </div>
      </section>

      <Dialog buka={!!aksi} judul={aksi?.status === 'lunas' ? 'Nyatakan lunas' : 'Tolak bukti bayar'} onTutup={() => setAksi(null)}
        kaki={<><Tombol onClick={() => setAksi(null)}>Batal</Tombol>
          <Tombol jenis={aksi?.status === 'lunas' ? 'primary' : 'danger'} sibuk={sibuk} disabled={aksi?.status === 'ditolak' && !alasan.trim()} onClick={simpan}>
            {aksi?.status === 'lunas' ? 'Nyatakan lunas' : 'Tolak'}</Tombol></>}>
        {aksi ? (
          <div className="ad-form">
            <p>{KOMPONEN_TAGIHAN[aksi.b.komponen] || aksi.b.komponen} sebesar <b>{rupiah(aksi.b.jumlah)}</b> dari <b>{peta.orang[peta.pengajuan[aksi.b.pengajuan_id]?.user_id]?.nama_lengkap}</b>.
              {aksi.status === 'lunas' ? ' Pastikan dana sudah masuk ke rekening STIKOM Yos Sudarso.' : ' Pemohon akan melihat alasan ini dan dapat mengunggah ulang bukti bayar.'}</p>
            {aksi.status === 'ditolak' ? (
              <Bidang label="Alasan penolakan" wajib>
                <textarea className="input" rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. Nominal transfer kurang Rp50.000; bukti tidak terbaca" />
              </Bidang>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </Halaman>
  )
}
