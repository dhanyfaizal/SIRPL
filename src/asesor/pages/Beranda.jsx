import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Video } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAsesor } from '../AsesorData'
import { PERAN } from '../aturan'
import { JENIS_ASESMEN } from '../../tim/aturan'
import { tanggal } from '../../pemohon/konstanta'
import { Halaman, Kartu, Kerangka, Lencana, LencanaStatus, Pemberitahuan } from '../../pemohon/ui'
import { tautanPenilaian, useBarisTugas } from './Daftar'

const LABEL_JENIS = Object.fromEntries(JENIS_ASESMEN.map((j) => [j.v, j.l]))

export default function Beranda() {
  const { siap, data, galat, peta } = useAsesor()
  const { profile } = useAuth()
  const saya = useMemo(() => new Set(data?.idTugas || []), [data])
  const filter = useMemo(() => (p) => saya.has(p.id), [saya])
  const baris = useBarisTugas(filter)
  if (galat && !siap) return <Halaman judul="Beranda"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const perlu = baris.filter((b) => ['asesmen', 'menunggu_bukti_tambahan', 'terverifikasi'].includes(b.p.status))
  const lanjutan = baris.filter((b) => ['penilaian_lanjutan', 'klarifikasi'].includes(b.p.status))
  const pleno = baris.filter((b) => ['pleno_awal', 'pleno'].includes(b.p.status))
  const kini = Date.now()
  const jadwal = data.jadwal.filter((j) => saya.has(j.pengajuan_id) && j.status === 'dijadwalkan').slice(0, 6)
  const belumDitandai = data.jadwal.filter((j) => saya.has(j.pengajuan_id) && j.status === 'dijadwalkan' && new Date(j.waktu).getTime() < kini).length
  const pgj = Object.fromEntries(data.pengajuan.map((p) => [p.id, p]))
  const nama = (p) => peta.orang[p?.user_id]?.nama_lengkap || peta.orang[p?.user_id]?.email || 'Pemohon'

  const Daftar = ({ isi, kosong }) => (isi.length ? (
    <ul className="tm-daftar">
      {isi.slice(0, 8).map(({ p, mk, dinilai, tugas }) => (
        <li key={p.id}>
          <Link to={tautanPenilaian(p)} className="tm-baris">
            <div className="pm-grow">
              <div className="pm-tebal">{nama(p)}</div>
              <div className="pm-kecil">{p.nomor_pendaftaran} · {peta.prodi[p.prodi_pilihan_id]?.kode} · {dinilai} dari {mk.total} MK dinilai{tugas ? ` · ${PERAN[tugas.peran]}` : ''}</div>
            </div>
            <LencanaStatus status={p.status} />
          </Link>
        </li>
      ))}
    </ul>
  ) : <p className="pm-kosong">{kosong}</p>)

  return (
    <Halaman judul={`Selamat bekerja, ${(profile?.nama_lengkap || '').replace(/^((dr|drs|ir|prof|h|hj)\.?\s+)+/i, '').split(/[\s,]/)[0] || 'Asesor'}`}
      sub="Ringkasan tugas penilaian RPL Anda.">
      <div className="tm-stat">
        <Link to="/asesor/tugas/dinilai" className="stat-card tm-stat-link">
          <div className="stat-card-label">Perlu dinilai</div>
          <div className="stat-card-value">{perlu.length}</div>
          <div className="stat-card-sub">penilaian portofolio dan transkrip</div>
        </Link>
        <Link to="/asesor/tugas/lanjutan" className="stat-card tm-stat-link">
          <div className="stat-card-label">Penilaian lanjutan</div>
          <div className="stat-card-value">{lanjutan.length}</div>
          <div className="stat-card-sub">wawancara dan keputusan akhir</div>
        </Link>
        <Link to="/asesor/jadwal" className="stat-card tm-stat-link">
          <div className="stat-card-label">Jadwal mendatang</div>
          <div className="stat-card-value">{jadwal.filter((j) => new Date(j.waktu).getTime() >= kini).length}</div>
          <div className="stat-card-sub">{belumDitandai ? `${belumDitandai} jadwal lewat belum ditandai` : 'semua jadwal tercatat'}</div>
        </Link>
        <Link to="/asesor/tugas/pleno" className="stat-card tm-stat-link">
          <div className="stat-card-label">Menunggu pleno</div>
          <div className="stat-card-value">{pleno.length}</div>
          <div className="stat-card-sub">dibahas Tim Pengelola RPL</div>
        </Link>
      </div>
      {!saya.size ? (
        <Pemberitahuan judul="Belum ada penugasan">Pengajuan akan muncul di sini setelah Ketua Tim Pengelola RPL menugaskan Anda sebagai asesor.</Pemberitahuan>
      ) : null}
      <div className="tm-dua">
        <Kartu judul="Perlu dinilai" sub="Penilaian awal: transkrip (transfer) dan portofolio F03 (perolehan)" padat
          aksi={<Link to="/asesor/tugas/dinilai" className="btn btn-ghost btn-sm">Semua <ArrowRight size={13} /></Link>}>
          <Daftar isi={perlu} kosong="Tidak ada pengajuan yang menunggu penilaian." />
        </Kartu>
        <Kartu judul="Jadwal saya" padat aksi={<Link to="/asesor/jadwal" className="btn btn-ghost btn-sm">Semua <ArrowRight size={13} /></Link>}>
          {jadwal.length ? (
            <ul className="tm-daftar">
              {jadwal.map((j) => {
                const p = pgj[j.pengajuan_id]
                return (
                  <li key={j.id}>
                    <Link to={p ? tautanPenilaian(p, 'lanjutan') : '/asesor/jadwal'} className="tm-baris">
                      <div className="tm-tgl" aria-hidden="true"><b>{new Date(j.waktu).getDate()}</b><span>{new Date(j.waktu).toLocaleString('id-ID', { month: 'short' })}</span></div>
                      <div className="pm-grow">
                        <div className="pm-tebal">{LABEL_JENIS[j.jenis] || j.jenis} · {nama(p)}</div>
                        <div className="pm-kecil">{tanggal(j.waktu, true)} WIB · {j.mode === 'daring' ? 'Daring' : (j.ruangan || 'Luring')}</div>
                      </div>
                      {j.mode === 'daring' ? <Video size={15} aria-label="Daring" /> : null}
                      {new Date(j.waktu).getTime() < kini ? <Lencana warna="amber">Tandai hasil</Lencana> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <p className="pm-kosong">Belum ada jadwal.</p>}
        </Kartu>
      </div>
      {lanjutan.length ? (
        <Kartu judul="Penilaian lanjutan" sub="Isi lembar penilaian lanjutan (F10), lalu tetapkan keputusan akhir per mata kuliah" padat>
          <Daftar isi={lanjutan} kosong="" />
        </Kartu>
      ) : null}
    </Halaman>
  )
}
