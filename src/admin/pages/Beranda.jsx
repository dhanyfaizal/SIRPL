import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAdmin } from '../AdminData'
import { LABEL_PERAN, STATUS_AKTIF } from '../aturan'
import { KELOMPOK } from '../../tim/aturan'
import { tanggal } from '../../pemohon/konstanta'
import { Halaman, Kartu, Kerangka, Lencana, Pemberitahuan } from '../../pemohon/ui'

export default function Beranda() {
  const { siap, data, galat } = useAdmin()
  const { profile } = useAuth()
  if (galat && !siap) return <Halaman judul="Beranda"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const aktif = data.periode.find((p) => p.is_aktif)
  const baru = data.pengajuan.filter((p) => p.alur_versi !== 1)
  const lama = data.pengajuan.filter((p) => p.alur_versi === 1 && !p.is_archived)
  const diPeriode = aktif ? baru.filter((p) => p.periode_id === aktif.id) : baru
  const berjalan = baru.filter((p) => STATUS_AKTIF.includes(p.status))
  const belumVerif = data.pengguna.filter((u) => !u.is_verified)
  const berSk = baru.filter((p) => ['sk_terbit', 'selesai'].includes(p.status))
  const belumLapor = berSk.filter((p) => p.status_pelaporan === 'belum')
  const tarifAktif = aktif ? data.tarif.filter((t) => t.periode_id === aktif.id) : []
  const prodiRpl = data.prodi.filter((x) => x.is_penyelenggara_rpl)
  const hari = aktif?.tanggal_tutup ? Math.ceil((new Date(aktif.tanggal_tutup).getTime() - Date.now()) / 86400000) : null

  const periksa = [
    !aktif && { judul: 'Belum ada periode aktif', isi: 'Pemohon tidak dapat mendaftar sampai satu periode diaktifkan.', ke: '/admin/periode' },
    aktif && !tarifAktif.length && { judul: `Tarif periode ${aktif.nama} belum diisi`, isi: 'Biaya pendaftaran dan asesmen dipakai pada tagihan pemohon dan F01.', ke: '/admin/periode' },
    !prodiRpl.length && { judul: 'Belum ada program studi penyelenggara RPL', isi: 'Tandai program studi yang membuka RPL beserta batas SKS-nya.', ke: '/admin/prodi' },
    !data.pengguna.some((u) => u.role === 'ketua_tim' && u.is_verified) && { judul: 'Belum ada Ketua Tim Pengelola', isi: 'Ketua Tim menugaskan asesor, menetapkan pleno, dan menandatangani Surat Hasil.', ke: '/admin/pengguna' },
    prodiRpl.some((x) => !x.maks_sks_rpl) && { judul: 'Batas SKS RPL belum diisi', isi: `${prodiRpl.filter((x) => !x.maks_sks_rpl).map((x) => x.nama).join(', ')}.`, ke: '/admin/prodi' },
  ].filter(Boolean)

  const perProdi = prodiRpl.map((x) => {
    const p = diPeriode.filter((y) => y.prodi_pilihan_id === x.id)
    return { x, total: p.filter((y) => y.status !== 'draft').length, draf: p.filter((y) => y.status === 'draft').length,
      berjalan: p.filter((y) => STATUS_AKTIF.includes(y.status)).length, sk: p.filter((y) => ['sk_terbit', 'selesai'].includes(y.status)).length }
  })

  return (
    <Halaman judul={`Selamat bekerja, ${(profile?.nama_lengkap || '').replace(/^((dr|drs|ir|prof|h|hj)\.?\s+)+/i, '').split(/[\s,]/)[0] || 'Admin'}`}
      sub={aktif ? `Periode aktif ${aktif.nama}${aktif.tanggal_tutup ? ` · pendaftaran ditutup ${tanggal(aktif.tanggal_tutup)}${hari !== null && hari >= 0 ? ` (${hari} hari lagi)` : ' (sudah lewat)'}` : ''}` : 'Belum ada periode aktif.'}>
      {periksa.length ? (
        <Kartu judul="Perlu disiapkan" sub="Pengaturan yang memengaruhi alur pemohon" padat>
          <ul className="tm-daftar">
            {periksa.map((c) => (
              <li key={c.judul}>
                <Link to={c.ke} className="tm-baris">
                  <div className="pm-grow"><div className="pm-tebal">{c.judul}</div><div className="pm-kecil">{c.isi}</div></div>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}

      <div className="tm-stat">
        <Link to="/admin/pengajuan" className="stat-card tm-stat-link">
          <div className="stat-card-label">Pengajuan berjalan</div>
          <div className="stat-card-value">{berjalan.length}</div>
          <div className="stat-card-sub">{baru.filter((p) => p.status === 'draft').length} masih draf</div>
        </Link>
        <Link to="/admin/pelaporan" className="stat-card tm-stat-link">
          <div className="stat-card-label">Ber-SK, belum dilaporkan</div>
          <div className="stat-card-value">{belumLapor.length}</div>
          <div className="stat-card-sub">dari {berSk.length} pemohon ber-SK</div>
        </Link>
        <Link to="/admin/pengguna?saring=belum" className="stat-card tm-stat-link">
          <div className="stat-card-label">Akun menunggu verifikasi</div>
          <div className="stat-card-value">{belumVerif.length}</div>
          <div className="stat-card-sub">{data.pengguna.length} akun terdaftar</div>
        </Link>
        <Link to="/admin/periode" className="stat-card tm-stat-link">
          <div className="stat-card-label">Pendaftar periode ini</div>
          <div className="stat-card-value">{diPeriode.filter((p) => p.status !== 'draft').length}</div>
          <div className="stat-card-sub">{aktif ? aktif.nama : 'semua periode'}</div>
        </Link>
      </div>

      <div className="tm-dua">
        <Kartu judul="Pengajuan per tahap" sub="Semua periode, alur Juknis" padat>
          <ul className="tm-daftar">
            {KELOMPOK.map((k) => {
              const n = baru.filter((p) => k.status.includes(p.status)).length
              return (
                <li key={k.id}>
                  <Link to={`/admin/pengajuan?kelompok=${k.id}`} className="tm-baris">
                    <div className="pm-grow pm-tebal">{k.label}</div>
                    <span className="ad-angka">{n}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Kartu>
        <Kartu judul="Per program studi" sub={aktif ? `Periode ${aktif.nama}` : 'Semua periode'} padat>
          {perProdi.length ? (
            <div className="table-wrap">
              <table className="pm-tabel">
                <thead><tr><th>Program studi</th><th className="ad-kanan">Diajukan</th><th className="ad-kanan">Berjalan</th><th className="ad-kanan">Ber-SK</th></tr></thead>
                <tbody>
                  {perProdi.map(({ x, total, berjalan: b, sk, draf }) => (
                    <tr key={x.id}>
                      <td><div className="pm-tebal">{x.nama}</div>{draf ? <div className="pm-kecil">{draf} draf</div> : null}</td>
                      <td className="ad-kanan">{total}</td><td className="ad-kanan">{b}</td><td className="ad-kanan">{sk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="pm-kosong">Belum ada program studi penyelenggara RPL.</p>}
        </Kartu>
      </div>

      {belumVerif.length ? (
        <Kartu judul="Akun menunggu verifikasi" sub="Akun baru yang masuk lewat Google perlu diverifikasi; akun staf juga perlu diberi peran" padat
          aksi={<Link to="/admin/pengguna?saring=belum" className="btn btn-ghost btn-sm">Kelola <ArrowRight size={13} /></Link>}>
          <ul className="tm-daftar">
            {belumVerif.slice(0, 6).map((u) => (
              <li key={u.id}>
                <Link to={`/admin/pengguna?saring=belum&cari=${encodeURIComponent(u.email)}`} className="tm-baris">
                  <div className="pm-grow"><div className="pm-tebal">{u.nama_lengkap || u.email}</div><div className="pm-kecil">{u.email} · daftar {tanggal(u.created_at)}</div></div>
                  <Lencana warna="amber">{LABEL_PERAN[u.role] || u.role}</Lencana>
                </Link>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}

      {lama.length ? (
        <Pemberitahuan jenis="amber" judul={`${lama.length} pengajuan masih memakai alur lama`}
          aksi={<Link to="/dashboard?lama=1" className="btn btn-secondary btn-sm">Buka dasbor lama</Link>}>
          Pengajuan sebelum alur Juknis tetap dapat dilihat di dasbor lama sampai dimigrasikan atau diarsipkan.
        </Pemberitahuan>
      ) : null}
    </Halaman>
  )
}
