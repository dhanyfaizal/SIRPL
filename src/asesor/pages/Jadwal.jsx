import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useAsesor } from '../AsesorData'
import { JENIS_ASESMEN, STATUS_JADWAL } from '../../tim/aturan'
import { Halaman, Kerangka, Lencana, PilihSegmen } from '../../pemohon/ui'
import { tautanPenilaian } from './Daftar'

const LABEL_JENIS = Object.fromEntries(JENIS_ASESMEN.map((j) => [j.v, j.l]))
const RENTANG = [{ v: 'mendatang', l: 'Mendatang' }, { v: 'lewat', l: 'Perlu ditandai' }, { v: 'semua', l: 'Semua' }]
const kunciHari = (d) => new Date(d).toLocaleDateString('sv-SE')

export default function Jadwal() {
  const { siap, data, peta } = useAsesor()
  const [rentang, setRentang] = useState('mendatang')
  const saya = useMemo(() => new Set(data?.idTugas || []), [data])
  const grup = useMemo(() => {
    if (!data) return []
    const kini = Date.now()
    const pgj = Object.fromEntries(data.pengajuan.map((p) => [p.id, p]))
    const daftar = data.jadwal.filter((j) => saya.has(j.pengajuan_id)).filter((j) => {
      const t = new Date(j.waktu).getTime()
      if (rentang === 'mendatang') return j.status === 'dijadwalkan' && t >= kini - 3600000
      if (rentang === 'lewat') return j.status === 'dijadwalkan' && t < kini
      return true
    }).map((j) => ({ ...j, p: pgj[j.pengajuan_id] }))
    if (rentang === 'semua') daftar.reverse()
    const m = new Map()
    for (const j of daftar) { const k = kunciHari(j.waktu); if (!m.has(k)) m.set(k, []); m.get(k).push(j) }
    return [...m.entries()]
  }, [data, rentang, saya])

  if (!siap) return <Kerangka />
  const nLewat = data.jadwal.filter((j) => saya.has(j.pengajuan_id) && j.status === 'dijadwalkan' && new Date(j.waktu).getTime() < Date.now()).length

  return (
    <Halaman judul="Jadwal saya" sub="Wawancara dan asesmen lanjutan pemohon yang Anda nilai. Jadwal dibuat Sekretariat RPL; Anda mencatat pelaksanaan dan hasilnya."
      aksi={<PilihSegmen pilihan={RENTANG.map((r) => (r.v === 'lewat' && nLewat ? { ...r, l: `${r.l} (${nLewat})` } : r))} nilai={rentang} onUbah={setRentang} label="Rentang jadwal" />}>
      {grup.length ? grup.map(([hari, isi]) => (
        <section key={hari} className="card">
          <div className="card-header"><h2 className="pm-kartu-judul">{new Date(hari).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2><span className="pm-kecil">{isi.length} jadwal</span></div>
          <ul className="tm-daftar">
            {isi.map((j) => {
              const st = STATUS_JADWAL[j.status] || { label: j.status, warna: 'slate' }
              const lewat = j.status === 'dijadwalkan' && new Date(j.waktu).getTime() < Date.now()
              return (
                <li key={j.id} className="tm-baris">
                  <div className="tm-jam">{new Date(j.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="pm-grow">
                    {j.p ? <Link className="pm-tebal" to={tautanPenilaian(j.p, 'lanjutan')}>{peta.orang[j.p.user_id]?.nama_lengkap || 'Pemohon'}</Link> : <span className="pm-tebal">Pemohon</span>}
                    <div className="pm-kecil">{LABEL_JENIS[j.jenis] || j.jenis} · {j.durasi_menit || 60} menit · {j.mode === 'daring' ? 'Daring' : `Luring, ${j.ruangan || '-'}`} · {(j.mk_ids || []).length} mata kuliah</div>
                  </div>
                  {lewat ? <Lencana warna="amber">Tandai hasil</Lencana> : <Lencana warna={st.warna}>{st.label}</Lencana>}
                  {j.mode === 'daring' && j.tautan_undangan && j.status === 'dijadwalkan' ? <a className="btn btn-secondary btn-sm" href={j.tautan_undangan} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Buka Meet</a> : null}
                </li>
              )
            })}
          </ul>
        </section>
      )) : <section className="card"><p className="pm-kosong">{rentang === 'lewat' ? 'Semua jadwal yang lewat sudah ditandai.' : 'Tidak ada jadwal.'}</p></section>}
    </Halaman>
  )
}
