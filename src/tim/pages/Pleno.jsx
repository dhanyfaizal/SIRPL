// Daftar pleno: pleno awal (perolehan kredit) dan pleno hasil rekognisi.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTim } from '../TimData'
import * as api from '../api'
import { tanggal } from '../../pemohon/konstanta'
import { Bidang, Dialog, Halaman, Kartu, Kerangka, Lencana, PilihSegmen, Tombol } from '../../pemohon/ui'

export const JENIS_PLENO = { awal: 'Pleno awal', akhir: 'Pleno hasil rekognisi' }
const BOLEH_CATAT = ['admin', 'ketua_tim', 'sekretaris']

export default function Pleno() {
  const { siap, data, peta, role, ubah } = useTim()
  const navigate = useNavigate()
  const [baru, setBaru] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  if (!siap) return <Kerangka />

  const menunggu = (st) => data.pengajuan.filter((p) => p.status === st)
  const prodiAda = (st) => [...new Set(menunggu(st).map((p) => p.prodi_pilihan_id))].map((id) => ({ id, n: menunggu(st).filter((p) => p.prodi_pilihan_id === id).length }))
  const jumlah = (id) => new Set(data.plenoPengajuan.filter((x) => x.pleno_id === id).map((x) => x.pengajuan_id)).size
  const aktif = data.periode.find((p) => p.is_aktif)

  const buat = async () => {
    if (!baru.prodi_id || !baru.tanggal) { toast.error('Pilih program studi dan tanggal'); return }
    setSibuk(true)
    try {
      const hasil = await api.buatPleno({ jenis: baru.jenis, prodi_id: baru.prodi_id, tanggal: baru.tanggal, tempat: baru.tempat || null, periode_id: aktif?.id || null })
      ubah((d) => ({ pleno: [hasil, ...d.pleno] }))
      navigate(`/tim/pleno/${hasil.id}`)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Pleno" sub="Pleno awal membahas hasil penilaian portofolio perolehan kredit. Pleno hasil rekognisi menetapkan mata kuliah, nilai, dan SKS yang diakui."
      aksi={BOLEH_CATAT.includes(role) ? <Tombol jenis="primary" ikon={Plus} onClick={() => setBaru({ jenis: 'akhir', prodi_id: '', tanggal: new Date().toLocaleDateString('sv-SE'), tempat: '' })}>Buat pleno</Tombol> : null}>
      <div className="tm-dua">
        {['pleno_awal', 'pleno'].map((st) => (
          <Kartu key={st} judul={st === 'pleno_awal' ? 'Menunggu pleno awal' : 'Menunggu pleno hasil rekognisi'} sub="Diajukan asesor koordinator" padat>
            {prodiAda(st).length ? (
              <ul className="tm-daftar">
                {prodiAda(st).map((x) => (
                  <li key={x.id} className="tm-baris">
                    <span className="pm-grow pm-tebal">{peta.prodi[x.id]?.nama || '-'}</span>
                    <Lencana warna="indigo">{x.n} pengajuan</Lencana>
                    {BOLEH_CATAT.includes(role) ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBaru({ jenis: st === 'pleno_awal' ? 'awal' : 'akhir', prodi_id: x.id, tanggal: new Date().toLocaleDateString('sv-SE'), tempat: '' })}>Buat pleno</button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="pm-kosong">Tidak ada pengajuan yang menunggu.</p>}
          </Kartu>
        ))}
      </div>
      <Kartu judul="Riwayat pleno" padat>
        {data.pleno.length ? (
          <div className="table-wrap">
            <table className="pm-tabel pm-tabel-responsif">
              <thead><tr><th style={{ width: 140 }}>Tanggal</th><th>Pleno</th><th style={{ width: 200 }}>Program studi</th><th style={{ width: 120 }}>Pengajuan</th><th style={{ width: 150 }}>Status</th></tr></thead>
              <tbody>
                {data.pleno.map((x) => (
                  <tr key={x.id}>
                    <td data-label="Tanggal">{tanggal(x.tanggal)}</td>
                    <td data-label="Pleno"><Link className="pm-tebal" to={`/tim/pleno/${x.id}`}>{JENIS_PLENO[x.jenis] || x.jenis}</Link>{x.nomor_berita_acara ? <div className="pm-kecil">BA {x.nomor_berita_acara}</div> : null}</td>
                    <td data-label="Program studi">{peta.prodi[x.prodi_id]?.nama || 'Semua prodi'}</td>
                    <td data-label="Pengajuan">{jumlah(x.id)}</td>
                    <td data-label="Status">{x.status === 'ditetapkan' ? <Lencana warna="green">Ditetapkan</Lencana> : <Lencana warna="amber">Draf</Lencana>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="pm-kosong">Belum ada pleno.</p>}
      </Kartu>
      <Dialog buka={!!baru} judul="Buat pleno" onTutup={() => setBaru(null)}
        kaki={<><Tombol onClick={() => setBaru(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={buat}>Buat</Tombol></>}>
        {baru ? (
          <div className="pm-tumpuk-besar">
            <Bidang label="Jenis pleno"><PilihSegmen pilihan={[{ v: 'awal', l: 'Pleno awal' }, { v: 'akhir', l: 'Pleno hasil rekognisi' }]} nilai={baru.jenis} onUbah={(v) => setBaru((s) => ({ ...s, jenis: v }))} label="Jenis pleno" penuh /></Bidang>
            <Bidang label="Program studi" wajib>
              <select className="input" value={baru.prodi_id} onChange={(e) => setBaru((s) => ({ ...s, prodi_id: e.target.value }))}>
                <option value="">Pilih program studi</option>
                {data.prodi.filter((x) => x.is_penyelenggara_rpl || data.pengajuan.some((p) => p.prodi_pilihan_id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
              </select>
            </Bidang>
            <div className="pm-form-2">
              <Bidang label="Tanggal" wajib><input className="input" type="date" value={baru.tanggal} onChange={(e) => setBaru((s) => ({ ...s, tanggal: e.target.value }))} /></Bidang>
              <Bidang label="Tempat"><input className="input" value={baru.tempat} onChange={(e) => setBaru((s) => ({ ...s, tempat: e.target.value }))} placeholder="Ruang rapat / daring" /></Bidang>
            </div>
          </div>
        ) : null}
      </Dialog>
    </Halaman>
  )
}
