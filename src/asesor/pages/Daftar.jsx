import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAsesor } from '../AsesorData'
import { KELOMPOK, PERAN, kelompokDari } from '../aturan'
import { JENIS_RPL } from '../../pemohon/konstanta'
import { Halaman, Kerangka, Lencana, LencanaStatus, Pemberitahuan } from '../../pemohon/ui'

export const tautanPenilaian = (p, tab) => `/asesor/tugas/${kelompokDari(p.status)}/${p.id}${tab ? `?tab=${tab}` : ''}`

export function useBarisTugas(filter) {
  const { data, peta, tugasSaya } = useAsesor()
  return useMemo(() => {
    if (!data) return []
    const mk = {}
    for (const m of data.mkDiajukan) (mk[m.pengajuan_id] ||= { transfer: 0, perolehan: 0, total: 0 })[m.mekanisme] += 1
    for (const k of Object.keys(mk)) mk[k].total = mk[k].transfer + mk[k].perolehan
    const dinilai = {}
    for (const r of data.penilaian) if (r.keputusan !== 'belum_dinilai') dinilai[r.pengajuan_id] = (dinilai[r.pengajuan_id] || 0) + 1
    return data.pengajuan.filter(filter).map((p) => ({
      p, u: peta.orang[p.user_id], mk: mk[p.id] || { transfer: 0, perolehan: 0, total: 0 },
      dinilai: dinilai[p.id] || 0, tugas: tugasSaya(p.id),
    }))
  }, [data, peta, tugasSaya, filter])
}

export default function Daftar() {
  const { kelompok = 'dinilai' } = useParams()
  const navigate = useNavigate()
  const { siap, data, galat } = useAsesor()
  const [cari, setCari] = useState('')
  const [lingkup, setLingkup] = useState('saya')
  const k = KELOMPOK.find((x) => x.id === kelompok)
  const saya = useMemo(() => new Set(data?.idTugas || []), [data])
  const q = cari.trim().toLowerCase()
  const filter = useMemo(() => (p) => (!k || k.status.includes(p.status)) && (lingkup === 'semua' || saya.has(p.id)), [k, lingkup, saya])
  const semua = useBarisTugas(filter)
  const baris = semua.filter(({ p, u }) => !q || [u?.nama_lengkap, u?.email, p.nomor_pendaftaran].some((v) => (v || '').toLowerCase().includes(q)))

  if (galat && !siap) return <Halaman judul="Tugas penilaian"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />
  const adaLain = data.pengajuan.some((p) => !saya.has(p.id))
  const hitung = (st) => data.pengajuan.filter((p) => st.includes(p.status) && (lingkup === 'semua' || saya.has(p.id))).length

  return (
    <Halaman judul={k ? k.label : 'Semua tugas penilaian'} sub="Pengajuan yang ditugaskan kepada Anda oleh Ketua Tim Pengelola RPL."
      aksi={adaLain ? (
        <select className="input tm-saring" value={lingkup} onChange={(e) => setLingkup(e.target.value)} aria-label="Lingkup pengajuan">
          <option value="saya">Ditugaskan kepada saya</option>
          <option value="semua">Semua yang dapat saya lihat</option>
        </select>
      ) : null}>
      <section className="card">
        <div className="pm-tabs" role="tablist" aria-label="Kelompok status">
          {KELOMPOK.map((x) => (
            <Link key={x.id} role="tab" aria-selected={x.id === kelompok} className={`tm-tab${x.id === kelompok ? ' is-on' : ''}`} to={`/asesor/tugas/${x.id}`}>
              {x.label}<span className="pm-hit">{hitung(x.status)}</span>
            </Link>
          ))}
          <Link role="tab" aria-selected={kelompok === 'semua'} className={`tm-tab${kelompok === 'semua' ? ' is-on' : ''}`} to="/asesor/tugas/semua">Semua</Link>
        </div>
        <div className="pm-mk-alat">
          <div className="pm-input-ikon pm-cari">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input className="input" type="search" placeholder="Cari nama atau nomor pendaftaran" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pengajuan" />
          </div>
          <span className="pm-kecil">{baris.length} pengajuan</span>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel tm-tabel">
            <thead><tr>
              <th>Pemohon</th><th style={{ width: 170 }}>Program studi</th><th style={{ width: 140 }}>Jenis RPL</th>
              <th style={{ width: 150 }}>Kemajuan</th><th style={{ width: 160 }}>Peran saya</th><th style={{ width: 190 }}>Status</th>
            </tr></thead>
            <tbody>
              {baris.map(({ p, u, mk, dinilai, tugas }) => (
                <tr key={p.id} className="tm-klik" tabIndex={0} onClick={() => navigate(tautanPenilaian(p))} onKeyDown={(e) => { if (e.key === 'Enter') navigate(tautanPenilaian(p)) }}>
                  <td className="tm-c-nama">
                    <Link to={tautanPenilaian(p)} className="pm-tebal tm-nama" onClick={(e) => e.stopPropagation()}>{u?.nama_lengkap || u?.email || 'Pemohon'}</Link>
                    <div className="pm-kecil">{p.nomor_pendaftaran}</div>
                  </td>
                  <td className="tm-c-prodi">{data.prodi.find((x) => x.id === p.prodi_pilihan_id)?.nama || '-'}</td>
                  <td className="tm-c-jenis">{JENIS_RPL[p.jenis_rpl]?.label || '-'}</td>
                  <td className="tm-c-mk">
                    <div className="as-kemajuan" aria-label={`${dinilai} dari ${mk.total} mata kuliah dinilai`}>
                      <span style={{ width: `${mk.total ? (dinilai / mk.total) * 100 : 0}%` }} />
                    </div>
                    <div className="pm-kecil">{dinilai} dari {mk.total} MK dinilai</div>
                  </td>
                  <td className="tm-c-asesor">{tugas ? <Lencana warna={tugas.peran === 'koordinator' ? 'indigo' : 'slate'}>{PERAN[tugas.peran]}</Lencana> : <span className="pm-kecil">Hanya melihat</span>}</td>
                  <td className="tm-c-status"><LencanaStatus status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">{saya.size || lingkup === 'semua' ? 'Tidak ada pengajuan di kelompok ini.' : 'Belum ada pengajuan yang ditugaskan kepada Anda.'}</p> : null}
        </div>
      </section>
    </Halaman>
  )
}
