import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { JENIS_RPL, STATUS, TAHAPAN, rupiah, tanggal } from '../konstanta'
import { Bidang, Dialog, Halaman, IkonStatusLangkah, Kartu, Kerangka, LencanaStatus, Pemberitahuan, Tombol } from '../ui'
import { hitungKelengkapan } from '../kelengkapan'
import { KotakTtd } from '../../dokumen/PanelDokumen'
import '../../tim/tim.css'

function Tahapan({ status }) {
  const tahap = STATUS[status]?.tahap ?? 1
  return (
    <ol className="pm-steps" aria-label="Tahapan pengajuan">
      {TAHAPAN.map((t, i) => {
        const no = i + 1
        const kelas = no < tahap ? 'done' : no === tahap ? 'now' : ''
        return (
          <li key={t} className={kelas} aria-current={no === tahap ? 'step' : undefined}>
            <span className="bar" />
            <b>{no} · {t}</b>
          </li>
        )
      })}
    </ol>
  )
}

function MulaiPengajuan() {
  const { data, userId, muat } = usePemohon()
  const navigate = useNavigate()
  const [buka, setBuka] = useState(false)
  const [prodi, setProdi] = useState('')
  const [jenis, setJenis] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const prodiRpl = data.prodi.filter((p) => p.is_penyelenggara_rpl)

  const mulai = async () => {
    setSibuk(true)
    try {
      await api.buatPengajuan({ userId, prodiId: prodi, jenisRpl: jenis, periodeId: data.periode?.id })
      await muat()
      setBuka(false)
      navigate('/pemohon/pengajuan/data')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <>
      <Kartu judul="Mulai pengajuan RPL"
        sub={data.periode ? `Periode ${data.periode.nama}${data.periode.tanggal_tutup ? `, ditutup ${tanggal(data.periode.tanggal_tutup)}` : ''}` : 'Belum ada periode pendaftaran yang dibuka'}>
        <p className="pm-teks">
          Pilih program studi tujuan dan jenis RPL. Setelah itu Anda mengisi Formulir Aplikasi (F02),
          Daftar Riwayat Hidup (F07), bukti portofolio, dan Formulir Evaluasi Diri (F03) untuk mata kuliah perolehan kredit.
        </p>
        <div style={{ marginTop: 16 }}>
          <Tombol jenis="primary" ikon={ArrowRight} disabled={!data.periode} onClick={() => setBuka(true)}>Mulai pengajuan</Tombol>
        </div>
      </Kartu>
      <Dialog buka={buka} judul="Mulai pengajuan RPL" onTutup={() => setBuka(false)}
        kaki={<>
          <Tombol onClick={() => setBuka(false)}>Batal</Tombol>
          <Tombol jenis="primary" sibuk={sibuk} disabled={!prodi || !jenis} onClick={mulai}>Buat pengajuan</Tombol>
        </>}>
        <Bidang label="Program studi tujuan" wajib>
          <select className="input" value={prodi} onChange={(e) => setProdi(e.target.value)}>
            <option value="">Pilih program studi</option>
            {prodiRpl.map((p) => <option key={p.id} value={p.id}>{p.nama} ({p.jenjang || 'S1'})</option>)}
          </select>
        </Bidang>
        <fieldset className="pm-fieldset">
          <legend className="input-label">Jenis RPL <span className="pm-wajib">*</span></legend>
          {Object.entries(JENIS_RPL).map(([v, j]) => (
            <label key={v} className={`pm-choice${jenis === v ? ' is-on' : ''}`}>
              <input type="radio" name="jenis" value={v} checked={jenis === v} onChange={() => setJenis(v)} />
              <span><span className="pm-choice-judul">{j.label}</span><span className="pm-choice-sub">{j.ket}</span></span>
            </label>
          ))}
        </fieldset>
        <span className="pm-hint">Jenis RPL masih bisa diubah selama pengajuan belum dikirim.</span>
      </Dialog>
    </>
  )
}

export default function Beranda() {
  const { siap, data, pengajuan, galat } = usePemohon()
  const { profile } = useAuth()
  if (!siap) return galat ? <Pemberitahuan jenis="red" judul="Data gagal dimuat">{galat}</Pemberitahuan> : <Kerangka />

  const nama = (profile?.nama_lengkap || '').split(' ')[0] || 'Pemohon'
  const prodi = data.prodi.find((p) => p.id === pengajuan?.prodi_pilihan_id)

  if (!pengajuan) {
    return (
      <Halaman judul={`Selamat datang, ${nama}`} sub="Portal Rekognisi Pembelajaran Lampau STIKOM Yos Sudarso">
        <MulaiPengajuan />
        <Ketentuan data={data} />
      </Halaman>
    )
  }

  const k = hitungKelengkapan(data)
  const tarifAsesmen = data.tarif.find((t) => t.komponen === 'asesmen_per_sks' && !t.is_internal)
  const tarifDaftar = data.tarif.find((t) => t.komponen === 'pendaftaran')
  const bayarDaftar = data.pembayaran.find((b) => b.komponen === 'pendaftaran' && b.status !== 'ditolak') || data.pembayaran.find((b) => b.komponen === 'pendaftaran')

  return (
    <Halaman
      judul={`Selamat datang, ${nama}`}
      sub={[pengajuan.nomor_pendaftaran, prodi?.nama, pengajuan.jenis_rpl && `Jenis RPL: ${JENIS_RPL[pengajuan.jenis_rpl]?.label.toLowerCase()}`].filter(Boolean).join(' · ')}
      aksi={k.langkahBerikut ? <Link className="btn btn-primary" to={k.langkahBerikut.to}>Lanjutkan pengajuan <ArrowRight size={14} /></Link> : null}
    >
      <KotakTtd ringkas />
      {pengajuan.alur_versi === 1 ? (
        <Pemberitahuan judul="Pengajuan dari alur sebelumnya">
          Pengajuan ini dibuat sebelum sistem mengikuti Juknis RPL 2025 dan hanya dapat dilihat. Hubungi Sekretariat RPL bila ada pertanyaan.
        </Pemberitahuan>
      ) : null}
      {pengajuan.status === 'dikembalikan_sekretariat' ? (
        <Pemberitahuan jenis="red" judul="Pengajuan dikembalikan untuk perbaikan">
          <div style={{ whiteSpace: 'pre-line' }}>{pengajuan.catatan_revisi || 'Periksa kembali berkas Anda, lalu kirim ulang.'}</div>
        </Pemberitahuan>
      ) : null}
      {pengajuan.status === 'tidak_memenuhi_syarat' ? (
        <Pemberitahuan jenis="red" judul="Pengajuan tidak memenuhi syarat">
          <div style={{ whiteSpace: 'pre-line' }}>{pengajuan.catatan_revisi || 'Hubungi Sekretariat RPL untuk keterangan lebih lanjut.'}</div>
        </Pemberitahuan>
      ) : null}
      {pengajuan.status === 'hasil_disampaikan' ? (
        <Pemberitahuan jenis="amber" judul="Hasil rekognisi sudah disampaikan"
          aksi={<Link className="btn btn-primary btn-sm" to="/pemohon/hasil">Lihat hasil</Link>}>
          Setujui hasilnya atau ajukan sanggahan sebelum diteruskan ke Komite RPL.
        </Pemberitahuan>
      ) : null}

      <Kartu judul="Status pengajuan" aksi={<LencanaStatus status={pengajuan.status} />}>
        <Tahapan status={pengajuan.status} />
        {k.langkahBerikut ? (
          <div style={{ marginTop: 18 }}>
            <Pemberitahuan judul={`Langkah berikutnya: ${k.langkahBerikut.label}`}>{k.langkahBerikut.ket}</Pemberitahuan>
          </div>
        ) : null}
      </Kartu>

      <div className="pm-grid-3">
        <Kartu judul="Kelengkapan pengajuan" aksi={<span className="pm-kartu-sub">{k.selesai} dari {k.langkah.length}</span>} padat>
          <ul className="pm-checklist">
            {k.langkah.map((l) => (
              <li key={l.to}>
                <IkonStatusLangkah status={l.status} />
                <Link to={l.to} className="pm-grow">{l.label}</Link>
                {l.info ? <span className={`pm-kecil${l.status === 'proses' ? ' pm-wait' : ''}`}>{l.info}</span> : null}
              </li>
            ))}
          </ul>
        </Kartu>

        <Kartu judul="Pembayaran">
          <div className="pm-baris-bayar">
            <div>
              <div className="pm-tebal">Biaya pendaftaran</div>
              <div className="pm-kecil">{tarifDaftar ? rupiah(tarifDaftar.besaran) : '-'}</div>
            </div>
            {bayarDaftar ? <LencanaBayar s={bayarDaftar.status} /> : <span className="badge-pill badge-slate">Belum dibayar</span>}
          </div>
          <div className="pm-baris-bayar">
            <div>
              <div className="pm-tebal">Biaya asesmen</div>
              <div className="pm-kecil">{k.sksDiajukan} SKS diajukan × {tarifAsesmen ? rupiah(tarifAsesmen.besaran) : '-'}</div>
              <div className="pm-kecil">Estimasi {tarifAsesmen ? rupiah(k.sksDiajukan * Number(tarifAsesmen.besaran)) : '-'}</div>
            </div>
            <span className="badge-pill badge-slate">Saat dikirim</span>
          </div>
          <Link to="/pemohon/pembayaran" className="pm-tautan">Rincian pembayaran</Link>
        </Kartu>

        <Kartu judul="Jadwal terdekat">
          {(() => {
            const j = data.jadwal.find((x) => x.status === 'dijadwalkan')
            if (!j) return <p className="pm-kecil">Belum ada jadwal asesmen. Jadwal wawancara muncul di sini setelah asesor menjadwalkannya.</p>
            return (
              <div className="pm-tumpuk">
                <div className="pm-tebal">{j.jenis === 'wawancara' ? 'Wawancara' : j.jenis}</div>
                <div className="pm-kecil">{tanggal(j.waktu, true)} · {j.mode}</div>
                <Link to="/pemohon/jadwal" className="pm-tautan">Lihat jadwal</Link>
              </div>
            )
          })()}
        </Kartu>
      </div>

      <Kartu judul="Riwayat aktivitas" padat id="aktivitas">
        {data.log.length ? (
          <div className="table-wrap">
            <table className="pm-tabel">
              <thead><tr><th style={{ width: 180 }}>Waktu</th><th>Aktivitas</th></tr></thead>
              <tbody>
                {data.log.map((l) => (
                  <tr key={l.id}>
                    <td className="pm-kecil">{tanggal(l.created_at, true)}</td>
                    <td>{l.aksi === 'ubah_status'
                      ? `Status berubah menjadi ${STATUS[l.ke_status]?.label || l.ke_status}${l.catatan ? `: ${l.catatan}` : ''}`
                      : (l.catatan || l.aksi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="pm-kosong">Belum ada aktivitas.</p>}
      </Kartu>

      <Ketentuan data={data} />
    </Halaman>
  )
}

function LencanaBayar({ s }) {
  if (s === 'lunas') return <span className="badge-pill badge-green">Lunas</span>
  if (s === 'ditolak') return <span className="badge-pill badge-red">Ditolak</span>
  return <span className="badge-pill badge-amber">Diverifikasi</span>
}

function Ketentuan({ data }) {
  const prodi = data.prodi.find((p) => p.id === data.pengajuan?.prodi_pilihan_id)
  return (
    <Kartu judul="Ketentuan yang perlu diperhatikan">
      <ul className="pm-daftar">
        <li>Paling banyak {data.batasSks ?? 100} SKS{prodi ? ` dari beban ${prodi.beban_sks_minimal} SKS` : ''} dapat diakui melalui RPL, dan tidak lebih dari 70% beban studi.</li>
        <li>Tugas akhir dan rangkaiannya tidak dapat direkognisi dan tetap wajib ditempuh.</li>
        <li>Bukti dinilai berdasarkan prinsip valid, autentik, terkini, dan memadai.</li>
        <li>Pemohon perolehan kredit wajib mengikuti wawancara dengan asesor.</li>
      </ul>
    </Kartu>
  )
}
