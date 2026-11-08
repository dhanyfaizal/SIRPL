// Master skema diskon.
import { useState } from 'react'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useKeuangan, cek } from '../KeuanganData'
import { KOMPONEN_TAGIHAN } from '../tagihan'
import { rupiah } from '../../pemohon/konstanta'
import { Bidang, Dialog, Halaman, InputAngka, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'

const KOSONG = { nama: '', jenis: 'persen', nilai: '', komponen: '', periode_id: '', keterangan: '', is_aktif: true }

export default function Diskon() {
  const { siap, data, peta, galat, ubah } = useKeuangan()
  const [f, setF] = useState(null)
  const [hapus, setHapus] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  if (galat && !siap) return <Halaman judul="Diskon"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const dipakai = (id) => data.tagihan.filter((t) => t.diskon_id === id).length
  const simpan = async () => {
    const nilai = Number(f.nilai || 0)
    if (!f.nama.trim()) { toast.error('Isi nama diskon'); return }
    if (!(nilai > 0) || (f.jenis === 'persen' && nilai > 100)) { toast.error(f.jenis === 'persen' ? 'Persen diskon 1 sampai 100' : 'Isi besar potongan'); return }
    setSibuk(true)
    try {
      const isi = { nama: f.nama.trim(), jenis: f.jenis, nilai, komponen: f.komponen || null, periode_id: f.periode_id || null, keterangan: f.keterangan || null, is_aktif: f.is_aktif }
      const r = f.id ? cek(await supabase.from('skema_diskon').update(isi).eq('id', f.id).select().single()) : cek(await supabase.from('skema_diskon').insert(isi).select().single())
      ubah((d) => ({ diskon: f.id ? d.diskon.map((x) => (x.id === r.id ? r : x)) : [r, ...d.diskon] }))
      toast.success('Diskon disimpan')
      setF(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const kirimHapus = async () => {
    setSibuk(true)
    try {
      cek(await supabase.from('skema_diskon').delete().eq('id', hapus.id))
      ubah((d) => ({ diskon: d.diskon.filter((x) => x.id !== hapus.id) }))
      toast.success('Diskon dihapus')
      setHapus(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Diskon" sub="Daftar diskon yang dapat diberikan PMB pada tagihan pemohon, misalnya untuk alumni atau kerja sama instansi. Diskon yang sudah dipakai cukup dinonaktifkan."
      aksi={<Tombol jenis="primary" ikon={Plus} onClick={() => setF({ ...KOSONG })}>Diskon baru</Tombol>}>
      <section className="card">
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th>Nama</th><th style={{ width: 140 }}>Besar</th><th style={{ width: 170 }}>Berlaku untuk</th><th style={{ width: 160 }}>Periode</th><th style={{ width: 110 }}>Dipakai</th><th style={{ width: 120 }}>Status</th><th style={{ width: 90 }}><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              {data.diskon.map((d) => (
                <tr key={d.id}>
                  <td data-label="Nama"><div className="pm-tebal">{d.nama}</div>{d.keterangan ? <div className="pm-kecil">{d.keterangan}</div> : null}</td>
                  <td data-label="Besar" className="pm-tebal">{d.jenis === 'persen' ? `${Number(d.nilai)}%` : rupiah(d.nilai)}</td>
                  <td data-label="Berlaku untuk">{d.komponen ? KOMPONEN_TAGIHAN[d.komponen] : 'Semua komponen'}</td>
                  <td data-label="Periode">{d.periode_id ? peta.periode[d.periode_id]?.nama : 'Semua periode'}</td>
                  <td data-label="Dipakai">{dipakai(d.id)} tagihan</td>
                  <td data-label="Status">{d.is_aktif ? <Lencana warna="green">Aktif</Lencana> : <Lencana>Nonaktif</Lencana>}</td>
                  <td data-label="">
                    <div className="pm-baris-aksi ad-aksi-kanan">
                      <button type="button" className="btn btn-ghost btn-icon" title="Ubah" aria-label={`Ubah ${d.nama}`} onClick={() => setF({ ...KOSONG, ...d, nilai: String(Number(d.nilai)), komponen: d.komponen || '', periode_id: d.periode_id || '', keterangan: d.keterangan || '' })}><Pencil size={15} /></button>
                      {!dipakai(d.id) ? <button type="button" className="btn btn-ghost btn-icon" title="Hapus" aria-label={`Hapus ${d.nama}`} onClick={() => setHapus(d)}><Trash2 size={15} /></button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.diskon.length ? <p className="pm-kosong">Belum ada diskon.</p> : null}
        </div>
      </section>

      <Dialog buka={!!f} judul={f?.id ? 'Ubah diskon' : 'Diskon baru'} onTutup={() => setF(null)}
        kaki={<><Tombol onClick={() => setF(null)}>Batal</Tombol><Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan</Tombol></>}>
        {f ? (
          <div className="pm-form-2">
            <Bidang label="Nama diskon" wajib lebar><input className="input" value={f.nama} onChange={(e) => setF((s) => ({ ...s, nama: e.target.value }))} placeholder="mis. Alumni STIKOM Yos Sudarso" /></Bidang>
            <div className="input-group">
              <span className="input-label">Jenis</span>
              <PilihSegmen pilihan={[{ v: 'persen', l: 'Persen' }, { v: 'nominal', l: 'Nominal' }]} nilai={f.jenis} onUbah={(v) => setF((s) => ({ ...s, jenis: v }))} label="Jenis diskon" />
            </div>
            <Bidang label={f.jenis === 'persen' ? 'Besar (%)' : 'Besar (Rp)'} wajib><InputAngka nilai={f.nilai} onUbah={(v) => setF((s) => ({ ...s, nilai: v }))} panjang={f.jenis === 'persen' ? 3 : 12} /></Bidang>
            <Bidang label="Berlaku untuk">
              <select className="input" value={f.komponen} onChange={(e) => setF((s) => ({ ...s, komponen: e.target.value }))}>
                <option value="">Semua komponen</option>
                {Object.entries(KOMPONEN_TAGIHAN).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Bidang>
            <Bidang label="Periode">
              <select className="input" value={f.periode_id} onChange={(e) => setF((s) => ({ ...s, periode_id: e.target.value }))}>
                <option value="">Semua periode</option>
                {data.periode.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
              </select>
            </Bidang>
            <Bidang label="Keterangan / syarat" lebar><input className="input" value={f.keterangan} onChange={(e) => setF((s) => ({ ...s, keterangan: e.target.value }))} placeholder="mis. Melampirkan ijazah D3 STIKOM Yos Sudarso" /></Bidang>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <span className="input-label">Status</span>
              <PilihSegmen pilihan={[{ v: true, l: 'Aktif' }, { v: false, l: 'Nonaktif' }]} nilai={f.is_aktif} onUbah={(v) => setF((s) => ({ ...s, is_aktif: v }))} label="Status diskon" />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog buka={!!hapus} judul="Hapus diskon" onTutup={() => setHapus(null)}
        kaki={<><Tombol onClick={() => setHapus(null)}>Batal</Tombol><Tombol jenis="danger" sibuk={sibuk} onClick={kirimHapus}>Hapus</Tombol></>}>
        <p>Diskon <b>{hapus?.nama}</b> akan dihapus.</p>
      </Dialog>
    </Halaman>
  )
}
