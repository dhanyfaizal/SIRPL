import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTim } from '../TimData'
import { KELOMPOK, lamaHari } from '../aturan'
import { JENIS_RPL, tanggal } from '../../pemohon/konstanta'
import { Halaman, Kerangka, Lencana, LencanaStatus, Pemberitahuan } from '../../pemohon/ui'

export default function Daftar() {
  const { kelompok = 'verifikasi' } = useParams()
  const navigate = useNavigate()
  const { siap, data, peta, galat } = useTim()
  const [prodi, setProdi] = useState('')
  const [jenis, setJenis] = useState('')
  const [cari, setCari] = useState('')

  const k = KELOMPOK.find((x) => x.id === kelompok)
  const baris = useMemo(() => {
    if (!data) return []
    const q = cari.trim().toLowerCase()
    const mk = {}
    for (const m of data.mkDiajukan) (mk[m.pengajuan_id] ||= { transfer: 0, perolehan: 0 })[m.mekanisme] += 1
    const asesor = {}
    for (const a of data.penugasan) (asesor[a.pengajuan_id] ||= []).push(a)
    return data.pengajuan
      .filter((p) => !k || k.status.includes(p.status))
      .filter((p) => !prodi || p.prodi_pilihan_id === prodi)
      .filter((p) => !jenis || p.jenis_rpl === jenis)
      .filter((p) => {
        if (!q) return true
        const u = peta.pemohon[p.user_id]
        return [u?.nama_lengkap, u?.email, p.nomor_pendaftaran, p.nim].some((v) => (v || '').toLowerCase().includes(q))
      })
      .map((p) => ({ p, u: peta.pemohon[p.user_id], mk: mk[p.id] || { transfer: 0, perolehan: 0 }, asesor: asesor[p.id] || [] }))
  }, [data, k, prodi, jenis, cari, peta])

  if (galat && !siap) return <Halaman judul="Pengajuan"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const hitung = (st) => data.pengajuan.filter((p) => st.includes(p.status)).length
  const prodiRpl = data.prodi.filter((x) => x.is_penyelenggara_rpl || data.pengajuan.some((p) => p.prodi_pilihan_id === x.id))
  const ke = (p) => navigate(`/tim/antrean/${kelompok}/${p.id}`)

  return (
    <Halaman judul={k ? k.label : 'Semua pengajuan'} sub="Klik baris untuk membuka berkas, verifikasi, penugasan asesor, dan jadwal.">
      <section className="card">
        <div className="pm-tabs" role="tablist" aria-label="Kelompok status">
          {KELOMPOK.map((x) => (
            <Link key={x.id} role="tab" aria-selected={x.id === kelompok} className={`tm-tab${x.id === kelompok ? ' is-on' : ''}`} to={`/tim/antrean/${x.id}`}>
              {x.label}<span className="pm-hit">{hitung(x.status)}</span>
            </Link>
          ))}
          <Link role="tab" aria-selected={kelompok === 'semua'} className={`tm-tab${kelompok === 'semua' ? ' is-on' : ''}`} to="/tim/antrean/semua">
            Semua<span className="pm-hit">{data.pengajuan.length}</span>
          </Link>
        </div>
        <div className="pm-mk-alat">
          <div className="pm-baris-aksi">
            <div className="pm-input-ikon pm-cari">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input className="input" type="search" placeholder="Cari nama, email, atau nomor pendaftaran" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pengajuan" />
            </div>
            <select className="input tm-saring" value={prodi} onChange={(e) => setProdi(e.target.value)} aria-label="Saring program studi">
              <option value="">Semua prodi</option>
              {prodiRpl.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
            </select>
            <select className="input tm-saring" value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label="Saring jenis RPL">
              <option value="">Semua jenis RPL</option>
              {Object.entries(JENIS_RPL).map(([v, j]) => <option key={v} value={v}>{j.label}</option>)}
            </select>
          </div>
          <span className="pm-kecil">{baris.length} pengajuan</span>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel tm-tabel">
            <thead><tr>
              <th>Pemohon</th><th style={{ width: 170 }}>Program studi</th><th style={{ width: 140 }}>Jenis RPL</th>
              <th style={{ width: 110 }}>Mata kuliah</th><th style={{ width: 130 }}>Diajukan</th><th style={{ width: 90 }}>Asesor</th><th style={{ width: 190 }}>Status</th>
            </tr></thead>
            <tbody>
              {baris.map(({ p, u, mk, asesor }) => {
                const hari = lamaHari(p.submitted_at)
                return (
                  <tr key={p.id} className="tm-klik" tabIndex={0} onClick={() => ke(p)} onKeyDown={(e) => { if (e.key === 'Enter') ke(p) }}>
                    <td className="tm-c-nama">
                      <Link to={`/tim/antrean/${kelompok}/${p.id}`} className="pm-tebal tm-nama" onClick={(e) => e.stopPropagation()}>{u?.nama_lengkap || u?.email || 'Pemohon'}</Link>
                      <div className="pm-kecil">{p.nomor_pendaftaran}{p.nim ? ` · NIM ${p.nim}` : ''}</div>
                    </td>
                    <td className="tm-c-prodi">{peta.prodi[p.prodi_pilihan_id]?.nama || '-'}</td>
                    <td className="tm-c-jenis">{JENIS_RPL[p.jenis_rpl]?.label || '-'}</td>
                    <td className="tm-c-mk pm-kecil">{mk.transfer ? `${mk.transfer} transfer` : ''}{mk.transfer && mk.perolehan ? ' · ' : ''}{mk.perolehan ? `${mk.perolehan} perolehan` : ''}{!mk.transfer && !mk.perolehan ? '-' : ''}</td>
                    <td className="tm-c-tgl">
                      <div className="pm-kecil">{tanggal(p.submitted_at)}</div>
                      {p.status === 'diajukan' && hari !== null ? <Lencana warna={hari >= 7 ? 'red' : hari >= 3 ? 'amber' : 'slate'}>{hari} hari</Lencana> : null}
                    </td>
                    <td className="tm-c-asesor pm-kecil">{asesor.length ? `${asesor.length} orang` : '-'}</td>
                    <td className="tm-c-status"><LencanaStatus status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">Tidak ada pengajuan di kelompok ini.</p> : null}
        </div>
      </section>
    </Halaman>
  )
}
