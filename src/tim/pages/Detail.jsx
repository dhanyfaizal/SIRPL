import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { useTim } from '../TimData'
import { KELOMPOK, lamaHari } from '../aturan'
import { JENIS_RPL, tanggal } from '../../pemohon/konstanta'
import { Halaman, Kerangka, Lencana, LencanaStatus, Pemberitahuan } from '../../pemohon/ui'
import TabBerkas from './detail/TabBerkas'
import TabAsesor from './detail/TabAsesor'
import TabJadwal from './detail/TabJadwal'
import TabBayar from './detail/TabBayar'
import TabRiwayat from './detail/TabRiwayat'

const TAB = [
  { id: 'berkas', label: 'Berkas dan verifikasi' },
  { id: 'asesor', label: 'Asesor' },
  { id: 'jadwal', label: 'Jadwal asesmen' },
  { id: 'bayar', label: 'Pembayaran' },
  { id: 'riwayat', label: 'Riwayat' },
]

export default function Detail() {
  const { kelompok = 'semua', id } = useParams()
  const [param, setParam] = useSearchParams()
  const tab = TAB.some((t) => t.id === param.get('tab')) ? param.get('tab') : 'berkas'
  const { siap, data, detail, muatDetail, peta } = useTim()
  const p = data?.pengajuan.find((x) => x.id === id)
  const d = p ? detail[p.id] : null

  useEffect(() => { if (p) muatDetail(p) }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // Setelah status berubah (aksi tim), segarkan detail di latar belakang agar riwayat ikut terbaru.
  const statusAwal = useRef(p?.status)
  useEffect(() => {
    if (p && statusAwal.current !== p.status) { statusAwal.current = p.status; muatDetail(p, true) }
  }, [p?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!siap) return <Kerangka />
  const kembali = `/tim/antrean/${kelompok}`
  const labelKembali = KELOMPOK.find((k) => k.id === kelompok)?.label || 'Semua pengajuan'
  if (!p) {
    return (
      <Halaman judul="Pengajuan tidak ditemukan">
        <Pemberitahuan jenis="amber">Pengajuan ini tidak ada atau Anda tidak memiliki akses. <Link to={kembali}>Kembali ke daftar</Link></Pemberitahuan>
      </Halaman>
    )
  }

  const u = peta.pemohon[p.user_id]
  const prodi = peta.prodi[p.prodi_pilihan_id]
  const nAsesor = data.penugasan.filter((a) => a.pengajuan_id === p.id).length
  const nJadwal = data.jadwal.filter((j) => j.pengajuan_id === p.id && j.status === 'dijadwalkan').length
  const nBayar = data.pembayaran.filter((b) => b.pengajuan_id === p.id && b.status === 'menunggu').length
  const lencana = { asesor: nAsesor || null, jadwal: nJadwal || null, bayar: nBayar || null }

  return (
    <Halaman
      judul={u?.nama_lengkap || u?.email || 'Pemohon'}
      sub={<>{p.nomor_pendaftaran} · {prodi?.nama} · {JENIS_RPL[p.jenis_rpl]?.label}{p.submitted_at ? ` · diajukan ${tanggal(p.submitted_at)}` : ''}</>}
      aksi={<Link to={kembali} className="btn btn-secondary"><ArrowLeft size={14} /> {labelKembali}</Link>}>
      <div className="tm-kepala-info">
        <LencanaStatus status={p.status} />
        {p.status === 'diajukan' ? <Lencana warna={lamaHari(p.submitted_at) >= 7 ? 'red' : 'slate'}>menunggu {lamaHari(p.submitted_at)} hari</Lencana> : null}
        {u?.email ? <a className="tm-kontak" href={`mailto:${u.email}`}><Mail size={13} aria-hidden="true" /> {u.email}</a> : null}
        {u?.no_whatsapp ? <a className="tm-kontak" href={`https://wa.me/${u.no_whatsapp.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer"><Phone size={13} aria-hidden="true" /> {u.no_whatsapp}</a> : null}
      </div>

      <section className="card tm-tab-kartu">
        <div className="pm-tabs" role="tablist" aria-label="Bagian pengajuan">
          {TAB.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''}
              onClick={() => setParam(t.id === 'berkas' ? {} : { tab: t.id })}>
              {t.label}{lencana[t.id] ? <span className="pm-hit">{lencana[t.id]}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {!d || (d.memuat && !d.mkDiajukan) ? <Kerangka baris={3} />
        : d.galat && !d.mkDiajukan ? <Pemberitahuan jenis="red" judul="Detail tidak dapat dimuat">{d.galat}</Pemberitahuan>
        : tab === 'berkas' ? <TabBerkas p={p} d={d} />
        : tab === 'asesor' ? <TabAsesor p={p} d={d} />
        : tab === 'jadwal' ? <TabJadwal p={p} d={d} />
        : tab === 'bayar' ? <TabBayar p={p} />
        : <TabRiwayat p={p} d={d} />}
    </Halaman>
  )
}
