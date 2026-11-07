import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePimpinan } from '../PimpinanData'
import { bolehLihat } from '../aturan'
import { Halaman, Kerangka, Pemberitahuan } from '../../pemohon/ui'

export default function Beranda() {
  const { siap, data, galat, role } = usePimpinan()
  const { profile } = useAuth()
  if (galat && !siap) return <Halaman judul="Beranda"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />
  const n = (st) => data.pengajuan.filter((p) => st.includes(p.status)).length
  const kartu = [
    bolehLihat(role, 'komite') && { to: '/pimpinan/komite', label: 'Menunggu Komite', v: n(['menunggu_komite']), sub: 'hasil disetujui pemohon' },
    bolehLihat(role, 'komite') && { to: '/pimpinan/komite?tab=dikembalikan', label: 'Dikembalikan Komite', v: n(['dikembalikan_komite']), sub: 'ditinjau Tim Pengelola' },
    bolehLihat(role, 'sk') && { to: '/pimpinan/sk', label: 'Siap ditetapkan SK', v: n(['menunggu_sk']), sub: 'disetujui Komite' },
    bolehLihat(role, 'nim') && { to: '/pimpinan/nim', label: 'Menunggu NIM', v: n(['sk_terbit']), sub: 'SK sudah terbit' },
    { to: bolehLihat(role, 'nim') ? '/pimpinan/nim?lingkup=sudah' : '/pimpinan', label: 'Selesai', v: n(['selesai']), sub: 'sudah menjadi mahasiswa' },
  ].filter(Boolean)
  const nama = (profile?.nama_lengkap || '').replace(/^((dr|drs|ir|prof|h|hj)\.?\s+)+/i, '').split(/[\s,]/)[0]
  return (
    <Halaman judul={`Selamat datang${nama ? `, ${nama}` : ''}`} sub="Tahap akhir RPL: persetujuan Komite, SK Ketua STIKOM Yos Sudarso, dan penetapan NIM oleh BAAK.">
      <div className="tm-stat">
        {kartu.map((k) => (
          <Link key={k.label} to={k.to} className="stat-card tm-stat-link">
            <div className="stat-card-label">{k.label}</div>
            <div className="stat-card-value">{k.v}</div>
            <div className="stat-card-sub">{k.sub}</div>
          </Link>
        ))}
      </div>
      <section className="card">
        <div className="card-header"><h2 className="pm-kartu-judul">Alur tahap akhir</h2></div>
        <ol className="pm-daftar-bernomor card-body">
          <li>Pemohon menyetujui hasil rekognisi yang ditetapkan pleno.</li>
          <li>Komite RPL memeriksa dan menyetujui, atau mengembalikan ke Tim Pengelola RPL.</li>
          <li>Ketua STIKOM Yos Sudarso menetapkan hasil dengan SK; Sekretariat mencatat nomor SK di sistem.</li>
          <li>BAAK menetapkan NIM, dan pemohon resmi menjadi mahasiswa RPL.</li>
        </ol>
      </section>
    </Halaman>
  )
}
