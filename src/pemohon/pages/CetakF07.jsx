// Lembar cetak F07 (Daftar Riwayat Hidup) untuk ditandatangani atasan langsung.
import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../api'
import { KATEGORI_RIWAYAT, tanggal } from '../konstanta'
import '../pemohon.css'

const STATUS_KERJA = { pegawai_tetap: 'Pegawai tetap', pegawai_honorer: 'Pegawai honorer', pns: 'Pegawai negeri sipil', lainnya: 'Lainnya', tidak_bekerja: 'Tidak bekerja' }

export default function CetakF07() {
  const { user, profile } = useAuth()
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState(null)
  useEffect(() => {
    if (!user?.id) return
    api.muatSemua(user.id).then(setD).catch((e) => setGalat(e.message))
  }, [user?.id])

  if (galat) return <div className="cetak-halaman"><p>{galat}</p></div>
  if (!d) return <div className="cetak-halaman"><p>Menyiapkan lembar cetak...</p></div>

  const b = d.biodata || {}
  const r = d.riwayat || {}
  const butir = (k) => d.butirRiwayat.filter((x) => x.kategori === k)
  const nilai = (x, k) => (k === 'mulai' || k === 'selesai' ? tanggal(x[k]) : (x[k] ?? ''))
  const identitas = [
    ['Nama', profile?.nama_lengkap],
    ['Tempat dan tanggal lahir', [b.tempat_lahir, b.tanggal_lahir && tanggal(b.tanggal_lahir)].filter(Boolean).join(', ')],
    ['Jenis kelamin', b.jenis_kelamin === 'pria' ? 'Pria' : b.jenis_kelamin === 'wanita' ? 'Wanita' : ''],
    ['Status perkawinan', { lajang: 'Lajang', menikah: 'Menikah', pernah_menikah: 'Pernah menikah' }[b.status_perkawinan] || ''],
    ['Agama', b.agama],
    ['Institusi tempat bekerja', r.institusi_kerja],
    ['Jabatan', r.jabatan],
    ['Status pekerjaan', r.status_pekerjaan === 'lainnya' ? r.status_pekerjaan_lainnya : STATUS_KERJA[r.status_pekerjaan]],
    ['Alamat tempat bekerja', r.alamat_kerja],
    ['Telp./Faks. kantor', r.telepon_kerja],
    ['Alamat rumah', b.alamat],
    ['Telp./HP', [b.telepon_rumah, profile?.no_whatsapp].filter(Boolean).join(' / ')],
    ['Alamat email', profile?.email],
  ]

  return (
    <div className="cetak-latar">
      <div className="cetak-alat no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Cetak</button>
        <span className="pm-kecil">Gunakan ukuran kertas A4. Tanda tangan dibubuhkan setelah dicetak.</span>
      </div>
      <article className="cetak-halaman">
        <header className="cetak-kop">
          <img src="/logo-sys.png" alt="" />
          <div>
            <div className="cetak-kop-nama">SEKOLAH TINGGI ILMU KOMPUTER YOS SUDARSO</div>
            <div>Rekognisi Pembelajaran Lampau (RPL) Tipe A</div>
          </div>
          <div className="cetak-kode">F07</div>
        </header>
        <h1 className="cetak-judul">FORMULIR DAFTAR RIWAYAT HIDUP (CURRICULUM VITAE)</h1>
        <p className="cetak-kecil">Nomor pendaftaran: {d.pengajuan?.nomor_pendaftaran || '-'}</p>

        <h2>Identitas diri</h2>
        <table className="cetak-identitas"><tbody>
          {identitas.map(([k, v]) => <tr key={k}><td>{k}</td><td>:</td><td>{v || ''}</td></tr>)}
        </tbody></table>

        {KATEGORI_RIWAYAT.map((kat) => (
          <section key={kat.v}>
            <h2>{kat.l}</h2>
            <table className="cetak-tabel">
              <thead><tr><th style={{ width: 28 }}>No</th>{kat.kolom.map((k) => <th key={k}>{kat.label[k]}</th>)}</tr></thead>
              <tbody>
                {(butir(kat.v).length ? butir(kat.v) : [null, null]).map((x, i) => (
                  <tr key={i}><td>{x ? i + 1 : ''}</td>{kat.kolom.map((k) => <td key={k}>{x ? nilai(x, k) : ' '}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <p className="cetak-pernyataan">
          Saya menyatakan bahwa semua keterangan dalam Daftar Riwayat Hidup ini sepenuhnya benar dan saya bertanggung jawab atas
          seluruh data dalam formulir ini. Apabila di kemudian hari informasi yang saya sampaikan tidak benar, saya bersedia menerima
          sanksi sesuai ketentuan yang berlaku.
        </p>
        <div className="cetak-ttd">
          <div>
            <div>Mengetahui,</div>
            <div>Atasan langsung</div>
            <div className="cetak-ttd-ruang" />
            <div>(..........................................)</div>
          </div>
          <div>
            <div>........................., {new Date().getFullYear()}</div>
            <div>Yang menyatakan,</div>
            <div className="cetak-ttd-ruang" />
            <div>({profile?.nama_lengkap || '..........................................'})</div>
          </div>
        </div>
      </article>
    </div>
  )
}
