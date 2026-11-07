import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useTim } from '../TimData'
import { JENIS_ASESMEN, STATUS_JADWAL, kelompokDari } from '../aturan'
import { tanggal } from '../../pemohon/konstanta'
import { Halaman, Kerangka, Lencana, PilihSegmen } from '../../pemohon/ui'

const LABEL_JENIS = Object.fromEntries(JENIS_ASESMEN.map((j) => [j.v, j.l]))
const RENTANG = [{ v: 'mendatang', l: 'Mendatang' }, { v: 'lewat', l: 'Perlu ditandai' }, { v: 'semua', l: 'Semua' }]

const kunciHari = (d) => new Date(d).toLocaleDateString('sv-SE')

export default function Jadwal() {
  const { siap, data, peta } = useTim()
  const [rentang, setRentang] = useState('mendatang')
  const grup = useMemo(() => {
    if (!data) return []
    const kini = Date.now()
    const pgj = Object.fromEntries(data.pengajuan.map((p) => [p.id, p]))
    const daftar = data.jadwal.filter((j) => {
      const t = new Date(j.waktu).getTime()
      if (rentang === 'mendatang') return j.status === 'dijadwalkan' && t >= kini - 3600000
      if (rentang === 'lewat') return j.status === 'dijadwalkan' && t < kini
      return true
    }).map((j) => ({ ...j, p: pgj[j.pengajuan_id] }))
    if (rentang === 'semua') daftar.reverse()
    const peta2 = new Map()
    for (const j of daftar) { const k = kunciHari(j.waktu); if (!peta2.has(k)) peta2.set(k, []); peta2.get(k).push(j) }
    return [...peta2.entries()]
  }, [data, rentang])

  if (!siap) return <Kerangka />
  const nLewat = data.jadwal.filter((j) => j.status === 'dijadwalkan' && new Date(j.waktu).getTime() < Date.now()).length

  return (
    <Halaman judul="Jadwal asesmen" sub="Wawancara dan asesmen lanjutan seluruh pemohon. Jadwal dibuat dari halaman detail pengajuan."
      aksi={<PilihSegmen pilihan={RENTANG.map((r) => (r.v === 'lewat' && nLewat ? { ...r, l: `${r.l} (${nLewat})` } : r))} nilai={rentang} onUbah={setRentang} label="Rentang jadwal" />}>
      {grup.length ? grup.map(([hari, isi]) => (
        <section key={hari} className="card">
          <div className="card-header"><h2 className="pm-kartu-judul">{new Date(hari).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2><span className="pm-kecil">{isi.length} jadwal</span></div>
          <ul className="tm-daftar">
            {isi.map((j) => {
              const nama = peta.pemohon[j.p?.user_id]?.nama_lengkap || 'Pemohon'
              const st = STATUS_JADWAL[j.status] || { label: j.status, warna: 'slate' }
              return (
                <li key={j.id} className="tm-baris">
                  <div className="tm-jam">{new Date(j.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="pm-grow">
                    {j.p ? <Link className="pm-tebal" to={`/tim/antrean/${kelompokDari(j.p.status)}/${j.p.id}?tab=jadwal`}>{nama}</Link> : <span className="pm-tebal">{nama}</span>}
                    <div className="pm-kecil">{LABEL_JENIS[j.jenis] || j.jenis} · {j.durasi_menit || 60} menit · {j.mode === 'daring' ? 'Daring' : `Luring, ${j.ruangan || '-'}`} · {peta.prodi[j.p?.prodi_pilihan_id]?.kode || ''}</div>
                    <div className="pm-kecil">Asesor: {[j.asesor_id, ...(j.asesor_lain || [])].filter(Boolean).map((id) => peta.staf[id]?.nama_lengkap || 'Asesor').join(', ') || '-'}</div>
                  </div>
                  {j.status === 'dijadwalkan' ? <Lencana warna={j.konfirmasi_hadir_at ? 'green' : 'slate'}>{j.konfirmasi_hadir_at ? 'Konfirmasi hadir' : 'Belum konfirmasi'}</Lencana> : <Lencana warna={st.warna}>{st.label}</Lencana>}
                  {j.mode === 'daring' && j.tautan_undangan && j.status === 'dijadwalkan' ? <a className="btn btn-secondary btn-sm" href={j.tautan_undangan} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Tautan</a> : null}
                </li>
              )
            })}
          </ul>
        </section>
      )) : <section className="card"><p className="pm-kosong">{rentang === 'lewat' ? 'Semua jadwal yang lewat sudah ditandai.' : 'Tidak ada jadwal.'}</p></section>}
    </Halaman>
  )
}
