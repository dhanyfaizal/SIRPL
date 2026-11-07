// Komponen bersama: daftar dokumen sasaran tertentu + tombol terbitkan,
// dan kotak masuk tanda tangan milik pengguna.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilePlus2, FileText, PenLine } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import * as api from './api'
import { DOKUMEN_PENGAJUAN, hitungSyarat, konteksPengajuan, susunPengajuan } from './isi'
import { Kartu, Lencana, Tombol } from '../pemohon/ui'
import { STATUS_DOK } from './pages/LihatDokumen'

const tgl = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')

export function BarisDokumen({ d }) {
  const st = STATUS_DOK[d.status] || STATUS_DOK.draf
  const sudah = d.ttd.filter((t) => t.status === 'ditandatangani').length
  return (
    <li className="tm-baris">
      <FileText size={16} aria-hidden="true" />
      <div className="pm-grow">
        <Link className="pm-tebal" to={`/dokumen/${d.id}`}>{d.judul}</Link>
        <div className="pm-kecil">{d.jenis_kode}{d.nomor ? ` · ${d.nomor}` : ''} · {tgl(d.tanggal_dokumen)} · {sudah}/{d.ttd.length} tanda tangan
          {d.ttd.some((t) => t.status === 'ditolak') ? ' · ada yang menolak' : ''}</div>
      </div>
      <Lencana warna={st.warna}>{st.label}</Lencana>
    </li>
  )
}

// Dokumen per pengajuan (dipakai di modul Tim)
export function PanelDokumenPengajuan({ pengajuan, bolehTerbit }) {
  const [daftar, setDaftar] = useState(null)
  const [syarat, setSyarat] = useState(null)
  const [konteks, setKonteks] = useState(null)
  const [sibuk, setSibuk] = useState(null)
  const muat = useCallback(async () => {
    try {
      const [dok, k] = await Promise.all([api.daftarDokumen({ pengajuanId: pengajuan.id }), konteksPengajuan(pengajuan.id)])
      setDaftar(dok); setKonteks(k); setSyarat(hitungSyarat(k))
    } catch (e) { toast.error(e.message) }
  }, [pengajuan.id])
  useEffect(() => { muat() }, [muat, pengajuan.status])

  const terbit = async (jenis, opsi = {}, kunci = jenis) => {
    setSibuk(kunci)
    try {
      const { isi, judul } = await susunPengajuan(jenis, pengajuan.id, opsi)
      await api.terbitkan({ jenis, isi, judul, pengajuanId: pengajuan.id, jadwalId: opsi.jadwalId, klarifikasiId: opsi.klarifikasiId })
      toast.success(`${judul} diterbitkan dan menunggu tanda tangan`)
      await muat()
    } catch (e) { toast.error(e.message, { duration: 7000 }) } finally { setSibuk(null) }
  }
  const aktif = (kode, f = () => true) => (daftar || []).find((d) => d.jenis_kode === kode && d.status !== 'dicabut' && f(d))

  return (
    <div className="pm-tumpuk-besar">
      <Kartu judul="Dokumen terbit" sub="Dokumen ditandatangani secara elektronik dengan kode QR verifikasi" padat>
        {!daftar ? <div className="card-body"><div className="sk" style={{ height: 60 }} /></div>
          : daftar.filter((d) => d.status !== 'dicabut').length ? <ul className="tm-daftar">{daftar.filter((d) => d.status !== 'dicabut').map((d) => <BarisDokumen key={d.id} d={d} />)}</ul>
          : <p className="pm-kosong">Belum ada dokumen.</p>}
      </Kartu>
      {bolehTerbit && syarat ? (
        <Kartu judul="Terbitkan dokumen" sub="Isi dokumen diambil dari data saat ini. Menerbitkan ulang menggantikan dokumen sebelumnya (nomor tetap)." padat>
          <ul className="tm-daftar">
            {DOKUMEN_PENGAJUAN.flatMap((j) => {
              const boleh = j.syarat(pengajuan, syarat)
              if (j.perJadwal) {
                return konteks.jadwal.filter((x) => x.status === 'selesai').map((x) => ({ j, kunci: `${j.kode}-${x.id}`, label: `${j.label}: ${new Date(x.waktu).toLocaleDateString('id-ID')}`, ada: aktif(j.kode, (d) => d.jadwal_id === x.id), opsi: { jadwalId: x.id }, boleh }))
              }
              if (j.perKlarifikasi) {
                return konteks.klarifikasi.filter((x) => x.keputusan).map((x) => ({ j, kunci: `${j.kode}-${x.id}`, label: `${j.label}: ${tgl(x.created_at)}`, ada: aktif(j.kode, (d) => d.klarifikasi_id === x.id), opsi: { klarifikasiId: x.id }, boleh }))
              }
              return [{ j, kunci: j.kode, label: j.label, ada: aktif(j.kode), opsi: {}, boleh }]
            }).map(({ j, kunci, label, ada, opsi, boleh }) => (
              <li key={kunci} className="tm-baris">
                <span className={`pm-grow${boleh ? '' : ' pm-kecil'}`}>{label}</span>
                {ada ? <Lencana warna={STATUS_DOK[ada.status].warna}>{STATUS_DOK[ada.status].label}</Lencana> : null}
                <Tombol ikon={FilePlus2} disabled={!boleh} sibuk={sibuk === kunci} onClick={() => terbit(j.kode, opsi, kunci)}>{ada ? 'Terbitkan ulang' : 'Terbitkan'}</Tombol>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
    </div>
  )
}

// Kotak masuk tanda tangan
export function KotakTtd({ ringkas = false }) {
  const { user } = useAuth()
  const [daftar, setDaftar] = useState(null)
  useEffect(() => { if (user?.id) api.ttdSaya(user.id).then(setDaftar).catch((e) => toast.error(e.message)) }, [user?.id])
  if (!daftar) return <Kartu><div className="sk" style={{ height: 60 }} /></Kartu>
  const tunggu = daftar.filter((t) => t.status === 'menunggu' && t.dokumen.status === 'menunggu_ttd')
  const lain = daftar.filter((t) => !tunggu.includes(t))
  if (ringkas && !tunggu.length) return null
  return (
    <>
      <Kartu judul="Menunggu tanda tangan Anda" sub={tunggu.length ? `${tunggu.length} dokumen` : null} padat>
        {tunggu.length ? (
          <ul className="tm-daftar">
            {tunggu.map((t) => (
              <li key={t.id} className="tm-baris">
                <PenLine size={16} aria-hidden="true" />
                <div className="pm-grow"><div className="pm-tebal">{t.dokumen.judul}</div><div className="pm-kecil">{t.dokumen.jenis_kode}{t.dokumen.nomor ? ` · ${t.dokumen.nomor}` : ''} · sebagai {t.jabatan_snapshot}</div></div>
                <Link className="btn btn-primary btn-sm" to={`/dokumen/${t.dokumen_id}`}>Periksa dan tandatangani</Link>
              </li>
            ))}
          </ul>
        ) : <p className="pm-kosong">Tidak ada dokumen yang menunggu tanda tangan Anda.</p>}
      </Kartu>
      {!ringkas && lain.length ? (
        <Kartu judul="Riwayat tanda tangan" padat>
          <ul className="tm-daftar">
            {lain.map((t) => (
              <li key={t.id} className="tm-baris">
                <FileText size={16} aria-hidden="true" />
                <div className="pm-grow"><Link className="pm-tebal" to={`/dokumen/${t.dokumen_id}`}>{t.dokumen.judul}</Link><div className="pm-kecil">{t.dokumen.jenis_kode}{t.dokumen.nomor ? ` · ${t.dokumen.nomor}` : ''}</div></div>
                <Lencana warna={t.status === 'ditandatangani' ? 'green' : t.status === 'ditolak' ? 'red' : 'slate'}>{t.status === 'ditandatangani' ? `Ditandatangani ${tgl(t.ditandatangani_at)}` : t.status === 'ditolak' ? 'Ditolak' : 'Dokumen dicabut'}</Lencana>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
    </>
  )
}

// Berita Acara Pleno (F11), diterbitkan setelah pleno ditetapkan.
export function PanelDokumenPleno({ pleno, boleh }) {
  const [daftar, setDaftar] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const muat = useCallback(() => api.daftarDokumen({ plenoId: pleno.id }).then(setDaftar).catch((e) => toast.error(e.message)), [pleno.id])
  useEffect(() => { muat() }, [muat])
  const terbit = async () => {
    setSibuk(true)
    try {
      const { susunPleno } = await import('./isi')
      const { isi, judul } = await susunPleno(pleno.id)
      await api.terbitkan({ jenis: 'F11', isi, judul, plenoId: pleno.id, tanggal: pleno.tanggal })
      toast.success('Berita acara diterbitkan. Seluruh peserta pleno diminta menandatangani.')
      await muat()
    } catch (e) { toast.error(e.message, { duration: 7000 }) } finally { setSibuk(false) }
  }
  const aktif = (daftar || []).filter((d) => d.status !== 'dicabut')
  return (
    <Kartu judul="Berita Acara Pleno (F11)" sub="Ditandatangani seluruh peserta pleno" padat
      aksi={boleh ? <Tombol ikon={FilePlus2} sibuk={sibuk} onClick={terbit}>{aktif.length ? 'Terbitkan ulang' : 'Terbitkan berita acara'}</Tombol> : null}>
      {!daftar ? <div className="card-body"><div className="sk" style={{ height: 40 }} /></div>
        : aktif.length ? <ul className="tm-daftar">{aktif.map((d) => <BarisDokumen key={d.id} d={d} />)}</ul>
        : <p className="pm-kosong">Belum diterbitkan.</p>}
    </Kartu>
  )
}

// Lampiran SK (F08) per pemohon, memakai nomor SK.
export async function terbitkanLampiranSk(sk, pengajuanIds) {
  let n = 0
  for (const id of pengajuanIds) {
    const { isi, judul } = await susunPengajuan('F08', id, { sk })
    await api.terbitkan({ jenis: 'F08', isi, judul, pengajuanId: id, skId: sk.id, nomor: sk.nomor_sk, tanggal: sk.tanggal_sk })
    n += 1
  }
  return n
}
