import { Link } from 'react-router-dom'
import { ArrowRight, Video } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTim } from '../TimData'
import { kelompokDari, lamaHari, STATUS_JADWAL, JENIS_ASESMEN } from '../aturan'
import { JENIS_RPL, rupiah, tanggal } from '../../pemohon/konstanta'
import { Halaman, Kartu, Kerangka, Lencana, LencanaStatus, Pemberitahuan } from '../../pemohon/ui'

const LABEL_JENIS = Object.fromEntries(JENIS_ASESMEN.map((j) => [j.v, j.l]))

export function tautanDetail(p) { return `/tim/antrean/${kelompokDari(p.status)}/${p.id}` }

export default function Beranda() {
  const { siap, data, peta, galat } = useTim()
  const { profile } = useAuth()
  if (galat && !siap) return <Halaman judul="Beranda"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const p = data.pengajuan
  const ditugaskan = new Set(data.penugasan.map((x) => x.pengajuan_id))
  const antre = p.filter((x) => x.status === 'diajukan')
  const tanpaAsesor = p.filter((x) => x.status === 'terverifikasi' && !ditugaskan.has(x.id))
  const siapMulai = p.filter((x) => x.status === 'terverifikasi' && ditugaskan.has(x.id))
  const sekarang = Date.now()
  const jadwal = data.jadwal.filter((j) => j.status === 'dijadwalkan' && new Date(j.waktu).getTime() > sekarang - 3600000).slice(0, 6)
  const bayar = data.pembayaran.filter((b) => b.status === 'menunggu')
  const pgj = Object.fromEntries(p.map((x) => [x.id, x]))
  const nama = (x) => peta.pemohon[x?.user_id]?.nama_lengkap || peta.pemohon[x?.user_id]?.email || 'Pemohon'

  return (
    <Halaman judul={`Selamat bekerja, ${(profile?.nama_lengkap || '').split(' ')[0] || 'Tim RPL'}`}
      sub="Ringkasan pekerjaan Tim Pengelola RPL yang perlu ditindaklanjuti.">
      <div className="tm-stat">
        <Link to="/tim/antrean/verifikasi" className="stat-card tm-stat-link">
          <div className="stat-card-label">Menunggu verifikasi berkas</div>
          <div className="stat-card-value">{antre.length}</div>
          <div className="stat-card-sub">{antre.length ? `terlama ${lamaHari(antre[0].submitted_at)} hari` : 'tidak ada antrean'}</div>
        </Link>
        <Link to="/tim/antrean/siap" className="stat-card tm-stat-link">
          <div className="stat-card-label">Belum ada asesor</div>
          <div className="stat-card-value">{tanpaAsesor.length}</div>
          <div className="stat-card-sub">{siapMulai.length} siap mulai asesmen</div>
        </Link>
        <Link to="/tim/jadwal" className="stat-card tm-stat-link">
          <div className="stat-card-label">Jadwal mendatang</div>
          <div className="stat-card-value">{data.jadwal.filter((j) => j.status === 'dijadwalkan' && new Date(j.waktu).getTime() > sekarang).length}</div>
          <div className="stat-card-sub">wawancara dan asesmen lanjutan</div>
        </Link>
        <Link to="/tim/pembayaran" className="stat-card tm-stat-link">
          <div className="stat-card-label">Bukti bayar menunggu</div>
          <div className="stat-card-value">{bayar.length}</div>
          <div className="stat-card-sub">{bayar.length ? rupiah(bayar.reduce((n, b) => n + Number(b.jumlah), 0)) : 'semua sudah diperiksa'}</div>
        </Link>
      </div>

      <div className="tm-dua">
        <Kartu judul="Antrean verifikasi berkas" sub="Urut dari yang paling lama menunggu" padat
          aksi={<Link to="/tim/antrean/verifikasi" className="btn btn-ghost btn-sm">Semua <ArrowRight size={13} /></Link>}>
          {antre.length ? (
            <ul className="tm-daftar">
              {antre.slice(0, 8).map((x) => {
                const hari = lamaHari(x.submitted_at)
                return (
                  <li key={x.id}>
                    <Link to={tautanDetail(x)} className="tm-baris">
                      <div className="pm-grow">
                        <div className="pm-tebal">{nama(x)}</div>
                        <div className="pm-kecil">{x.nomor_pendaftaran} · {peta.prodi[x.prodi_pilihan_id]?.nama} · {JENIS_RPL[x.jenis_rpl]?.label}</div>
                      </div>
                      <Lencana warna={hari >= 7 ? 'red' : hari >= 3 ? 'amber' : 'slate'}>{hari} hari</Lencana>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <p className="pm-kosong">Tidak ada pengajuan yang menunggu verifikasi.</p>}
        </Kartu>

        <Kartu judul="Jadwal terdekat" padat aksi={<Link to="/tim/jadwal" className="btn btn-ghost btn-sm">Semua <ArrowRight size={13} /></Link>}>
          {jadwal.length ? (
            <ul className="tm-daftar">
              {jadwal.map((j) => {
                const x = pgj[j.pengajuan_id]
                return (
                  <li key={j.id}>
                    <Link to={x ? `${tautanDetail(x)}?tab=jadwal` : '/tim/jadwal'} className="tm-baris">
                      <div className="tm-tgl" aria-hidden="true">
                        <b>{new Date(j.waktu).getDate()}</b>
                        <span>{new Date(j.waktu).toLocaleString('id-ID', { month: 'short' })}</span>
                      </div>
                      <div className="pm-grow">
                        <div className="pm-tebal">{LABEL_JENIS[j.jenis] || j.jenis} · {nama(x)}</div>
                        <div className="pm-kecil">{tanggal(j.waktu, true)} WIB · {j.mode === 'daring' ? 'Daring' : (j.ruangan || 'Luring')}</div>
                      </div>
                      {j.mode === 'daring' ? <Video size={15} className="pm-none" aria-label="Daring" /> : null}
                      <Lencana warna={j.konfirmasi_hadir_at ? 'green' : STATUS_JADWAL[j.status].warna}>{j.konfirmasi_hadir_at ? 'Pemohon konfirmasi' : 'Belum konfirmasi'}</Lencana>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <p className="pm-kosong">Belum ada jadwal asesmen.</p>}
        </Kartu>
      </div>

      {tanpaAsesor.length ? (
        <Kartu judul="Terverifikasi, menunggu penugasan asesor" sub="Ketua Tim menugaskan Tim Penilai sesuai program studi" padat>
          <ul className="tm-daftar">
            {tanpaAsesor.slice(0, 8).map((x) => (
              <li key={x.id}>
                <Link to={`${tautanDetail(x)}?tab=asesor`} className="tm-baris">
                  <div className="pm-grow">
                    <div className="pm-tebal">{nama(x)}</div>
                    <div className="pm-kecil">{x.nomor_pendaftaran} · {peta.prodi[x.prodi_pilihan_id]?.nama}</div>
                  </div>
                  <LencanaStatus status={x.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
    </Halaman>
  )
}
