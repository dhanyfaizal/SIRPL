// Master skema bayar (templat cicilan).
import { useState } from 'react'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useKeuangan, cek } from '../KeuanganData'
import { Bidang, Dialog, Halaman, InputAngka, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'

const KOSONG = { nama: '', rincian: [{ persen: '50', hari: '0' }, { persen: '50', hari: '30' }], keterangan: '', is_aktif: true }
const uraian = (rincian) => rincian.map((r, i) => `${Number(r.persen)}%${i === 0 && !Number(r.hari) ? ' saat ditetapkan' : ` hari ke-${Number(r.hari)}`}`).join(', ')

export default function Skema() {
  const { siap, data, galat, ubah } = useKeuangan()
  const [f, setF] = useState(null)
  const [hapus, setHapus] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  if (galat && !siap) return <Halaman judul="Skema bayar"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const total = f ? f.rincian.reduce((n, r) => n + Number(r.persen || 0), 0) : 0
  const urut = f ? f.rincian.every((r, i) => i === 0 || Number(r.hari || 0) >= Number(f.rincian[i - 1].hari || 0)) : true
  const ubahR = (i, k, v) => setF((s) => ({ ...s, rincian: s.rincian.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }))

  const simpan = async () => {
    if (!f.nama.trim()) { toast.error('Isi nama skema'); return }
    setSibuk(true)
    try {
      const isi = { nama: f.nama.trim(), rincian: f.rincian.map((r) => ({ persen: Number(r.persen), hari: Number(r.hari || 0) })), keterangan: f.keterangan || null, is_aktif: f.is_aktif }
      const r = f.id ? cek(await supabase.from('skema_bayar').update(isi).eq('id', f.id).select().single()) : cek(await supabase.from('skema_bayar').insert(isi).select().single())
      ubah((d) => ({ skema: f.id ? d.skema.map((x) => (x.id === r.id ? r : x)) : [r, ...d.skema] }))
      toast.success('Skema bayar disimpan')
      setF(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const kirimHapus = async () => {
    setSibuk(true)
    try {
      cek(await supabase.from('skema_bayar').delete().eq('id', hapus.id))
      ubah((d) => ({ skema: d.skema.filter((x) => x.id !== hapus.id) }))
      toast.success('Skema bayar dihapus')
      setHapus(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Skema bayar" sub="Templat cicilan yang dipilih PMB saat mengatur tagihan. Jumlah angsuran dihitung dari persentase total dan dibulatkan ke ribuan; jatuh tempo dihitung dari tanggal skema ditetapkan. Angsuran tetap dapat disesuaikan per pemohon."
      aksi={<Tombol jenis="primary" ikon={Plus} onClick={() => setF({ ...KOSONG, rincian: KOSONG.rincian.map((r) => ({ ...r })) })}>Skema baru</Tombol>}>
      <section className="card">
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th>Nama</th><th style={{ width: 120 }}>Angsuran</th><th>Rincian</th><th style={{ width: 120 }}>Status</th><th style={{ width: 90 }}><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              {data.skema.map((s) => (
                <tr key={s.id}>
                  <td data-label="Nama"><div className="pm-tebal">{s.nama}</div>{s.keterangan ? <div className="pm-kecil">{s.keterangan}</div> : null}</td>
                  <td data-label="Angsuran">{s.rincian.length} kali</td>
                  <td data-label="Rincian" className="pm-kecil">{uraian(s.rincian)}</td>
                  <td data-label="Status">{s.is_aktif ? <Lencana warna="green">Aktif</Lencana> : <Lencana>Nonaktif</Lencana>}</td>
                  <td data-label="">
                    <div className="pm-baris-aksi ad-aksi-kanan">
                      <button type="button" className="btn btn-ghost btn-icon" title="Ubah" aria-label={`Ubah ${s.nama}`} onClick={() => setF({ ...s, keterangan: s.keterangan || '', rincian: s.rincian.map((r) => ({ persen: String(r.persen), hari: String(r.hari) })) })}><Pencil size={15} /></button>
                      <button type="button" className="btn btn-ghost btn-icon" title="Hapus" aria-label={`Hapus ${s.nama}`} onClick={() => setHapus(s)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.skema.length ? <p className="pm-kosong">Belum ada skema bayar. Tanpa skema, setiap tagihan dibayar sekali.</p> : null}
        </div>
      </section>

      <Dialog buka={!!f} judul={f?.id ? 'Ubah skema bayar' : 'Skema bayar baru'} onTutup={() => setF(null)} lebar={560}
        kaki={<><Tombol onClick={() => setF(null)}>Batal</Tombol><Tombol jenis="primary" ikon={Save} sibuk={sibuk} disabled={total !== 100 || !urut || f?.rincian.length < 2} onClick={simpan}>Simpan</Tombol></>}>
        {f ? (
          <div className="ad-form">
            <Bidang label="Nama skema" wajib><input className="input" value={f.nama} onChange={(e) => setF((s) => ({ ...s, nama: e.target.value }))} placeholder="mis. Cicilan 3 kali per bulan" /></Bidang>
            <div className="ku-editor ku-editor-kepala"><span>Ke</span><span>Persen (%)</span><span className="ku-tgl">Hari setelah ditetapkan</span><span /></div>
            {f.rincian.map((r, i) => (
              <div className="ku-editor" key={i}>
                <span className="pm-tebal">{i + 1}</span>
                <InputAngka nilai={r.persen} onUbah={(v) => ubahR(i, 'persen', v)} panjang={3} aria-label={`Persen angsuran ke-${i + 1}`} />
                <InputAngka nilai={r.hari} onUbah={(v) => ubahR(i, 'hari', v)} panjang={3} className="input ku-tgl" aria-label={`Hari angsuran ke-${i + 1}`} />
                <button type="button" className="btn btn-ghost btn-icon" disabled={f.rincian.length <= 2} aria-label={`Hapus angsuran ke-${i + 1}`}
                  onClick={() => setF((s) => ({ ...s, rincian: s.rincian.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="pm-baris-aksi">
              <Tombol ikon={Plus} disabled={f.rincian.length >= 12}
                onClick={() => setF((s) => ({ ...s, rincian: [...s.rincian, { persen: '0', hari: String(Number(s.rincian[s.rincian.length - 1]?.hari || 0) + 30) }] }))}>Tambah angsuran</Tombol>
            </div>
            <div className={`ku-jumlah-cocok${total === 100 && urut ? '' : ' is-salah'}`}><span>{urut ? 'Jumlah persen' : 'Hari harus berurutan'}</span><b>{total}%</b></div>
            <Bidang label="Keterangan"><input className="input" value={f.keterangan} onChange={(e) => setF((s) => ({ ...s, keterangan: e.target.value }))} /></Bidang>
            <div className="input-group">
              <span className="input-label">Status</span>
              <PilihSegmen pilihan={[{ v: true, l: 'Aktif' }, { v: false, l: 'Nonaktif' }]} nilai={f.is_aktif} onUbah={(v) => setF((s) => ({ ...s, is_aktif: v }))} label="Status skema" />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog buka={!!hapus} judul="Hapus skema bayar" onTutup={() => setHapus(null)}
        kaki={<><Tombol onClick={() => setHapus(null)}>Batal</Tombol><Tombol jenis="danger" sibuk={sibuk} onClick={kirimHapus}>Hapus</Tombol></>}>
        <p>Skema <b>{hapus?.nama}</b> akan dihapus. Cicilan pemohon yang sudah disusun dari skema ini tidak berubah.</p>
      </Dialog>
    </Halaman>
  )
}
