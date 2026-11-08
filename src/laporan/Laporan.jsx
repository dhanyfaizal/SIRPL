// Laporan dan analitik RPL. Data per pengajuan tanpa identitas pemohon,
// dibatasi ke program studi sendiri untuk Ka. Prodi (dijaga basis data).
import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { KELOMPOK } from '../tim/aturan'
import { JENIS_RPL, rupiah } from '../pemohon/konstanta'
import { Halaman, Kartu, Kerangka, Pemberitahuan, Tombol } from '../pemohon/ui'
import { unduhCsv } from '../admin/aturan'
import '../pemohon/pemohon.css'
import '../tim/tim.css'
import '../admin/admin.css'
import './laporan.css'

let simpanan = null
const BER_SK = ['sk_terbit', 'selesai']
const WARNA_JENIS = { transfer: 'var(--indigo-500, #6366f1)', perolehan: 'var(--amber-500, #f59e0b)', gabungan: 'var(--green-600, #16a34a)' }
const PELAPORAN = [['belum', 'Belum dilaporkan'], ['dilaporkan_sistem_rpl', 'Sistem RPL'], ['diverifikasi_lldikti', 'Diverifikasi LLDIKTI'], ['diinput_pddikti', 'Masuk PDDikti']]

async function muat() {
  const cek = ({ data, error }) => { if (error) throw new Error(error.message); return data || [] }
  const [baris, puas, prodi, periode, prodiSaya] = await Promise.all([
    supabase.rpc('laporan_rpl').then(cek),
    supabase.rpc('laporan_kepuasan').then(cek),
    supabase.from('program_studi').select('id, nama, kode, is_penyelenggara_rpl').order('nama').then(cek),
    supabase.from('periode_rpl').select('id, nama, is_aktif, created_at').order('created_at').then(cek),
    supabase.rpc('prodi_laporan_saya').then(({ data }) => data || null),
  ])
  return { baris, puas, prodi, periode, prodiSaya }
}

const median = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}
const rata = (a) => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : null)
const angka = (v, d = 0) => (v === null || v === undefined || Number.isNaN(v) ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }))

function Batang({ data, maks, warna }) {
  return (
    <div className="lp-batang">
      {data.map((d) => (
        <div key={d.label} className="lp-batang-baris">
          <span>{d.label}</span>
          <div className="lp-batang-jalur" role="img" aria-label={`${d.label}: ${d.nilai}`}>
            <div className={`lp-batang-isi${d.warna || warna ? ` is-${d.warna || warna}` : ''}`} style={{ width: `${maks ? (d.nilai / maks) * 100 : 0}%` }} />
          </div>
          <span className="lp-batang-nilai">{d.teks ?? d.nilai}</span>
        </div>
      ))}
    </div>
  )
}

export default function Laporan() {
  const { role } = useAuth()
  const [data, setData] = useState(simpanan)
  const [galat, setGalat] = useState(null)
  const [periode, setPeriode] = useState('')
  const [prodi, setProdi] = useState('')
  const kaprodi = role?.startsWith('kaprodi_')
  const lihatUang = ['admin', 'eksekutif', 'pmb', 'ketua_tim'].includes(role)

  useEffect(() => {
    let batal = false
    muat().then((d) => { if (!batal) { simpanan = d; setData(d) } }).catch((e) => { if (!batal) setGalat(e.message) })
    return () => { batal = true }
  }, [])

  const h = useMemo(() => {
    if (!data) return null
    const semua = data.baris.filter((b) => !prodi || b.prodi_id === prodi)
    const rows = semua.filter((b) => !periode || b.periode_id === periode)
    const sk = rows.filter((b) => BER_SK.includes(b.status))
    const ditolak = rows.filter((b) => b.status === 'tidak_memenuhi_syarat')
    const lama = sk.filter((b) => b.submitted_at && b.tanggal_sk).map((b) => Math.max(0, Math.round((new Date(b.tanggal_sk) - new Date(b.submitted_at)) / 86400000)))
    const diajukanSk = sk.reduce((n, b) => n + (b.sks_diajukan || 0), 0)
    const diakuiSk = sk.reduce((n, b) => n + (b.sks_diakui || 0), 0)
    const id = new Set(rows.map((b) => b.id))
    const puas = data.puas.filter((f) => id.has(f.pengajuan_id))
    const prodiTampil = data.prodi.filter((x) => data.baris.some((b) => b.prodi_id === x.id) || x.is_penyelenggara_rpl).filter((x) => !prodi || x.id === prodi)
    const pt = {}
    for (const b of rows) if (b.pt_asal) pt[b.pt_asal] = (pt[b.pt_asal] || 0) + 1
    return {
      rows, sk, ditolak, lama, diajukanSk, diakuiSk, puas,
      tren: [...data.periode].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).map((p) => ({ p, per: Object.keys(JENIS_RPL).map((j) => semua.filter((b) => b.periode_id === p.id && b.jenis_rpl === j).length) }))
        .filter((t) => t.per.some(Boolean) || t.p.is_aktif),
      tahap: KELOMPOK.map((k) => ({ label: k.label, nilai: rows.filter((b) => k.status.includes(b.status)).length })),
      jenis: Object.entries(JENIS_RPL).map(([v, j]) => ({ v, label: j.label, nilai: rows.filter((b) => b.jenis_rpl === v).length })),
      perProdi: prodiTampil.map((x) => {
        const r = rows.filter((b) => b.prodi_id === x.id)
        const s = r.filter((b) => BER_SK.includes(b.status))
        return { x, total: r.length, sk: s.length, ditolak: r.filter((b) => b.status === 'tidak_memenuhi_syarat').length,
          rataSks: rata(s.map((b) => b.sks_diakui || 0)), persen: s.reduce((n, b) => n + (b.sks_diajukan || 0), 0) ? (s.reduce((n, b) => n + (b.sks_diakui || 0), 0) / s.reduce((n, b) => n + (b.sks_diajukan || 0), 0)) * 100 : null,
          terbayar: r.reduce((n, b) => n + Number(b.terbayar || 0), 0) }
      }),
      pt: Object.entries(pt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, nilai]) => ({ label, nilai })),
      pelaporan: PELAPORAN.map(([v, l]) => ({ label: l, nilai: sk.filter((b) => (b.status_pelaporan || 'belum') === v).length, warna: v === 'diinput_pddikti' ? 'hijau' : v === 'belum' ? 'abu' : null })),
      terbayar: rows.reduce((n, b) => n + Number(b.terbayar || 0), 0),
      potongan: rows.reduce((n, b) => n + Number(b.potongan || 0), 0),
    }
  }, [data, periode, prodi])

  if (galat) return <Halaman judul="Laporan RPL"><Pemberitahuan jenis="red" judul="Laporan tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!data) return <Kerangka />

  const namaProdi = (id) => data.prodi.find((x) => x.id === id)?.nama
  const maksTren = Math.max(1, ...h.tren.map((t) => t.per.reduce((n, x) => n + x, 0)))
  const ekspor = () => unduhCsv(`laporan-rpl-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Program studi', 'Pendaftar', 'Ber-SK', 'Tidak memenuhi syarat', 'Rata-rata SKS diakui', 'Persentase SKS diakui', ...(lihatUang ? ['Pembayaran diterima'] : [])],
    ...h.perProdi.map((r) => [r.x.nama, r.total, r.sk, r.ditolak, r.rataSks === null ? '' : r.rataSks.toFixed(1), r.persen === null ? '' : r.persen.toFixed(1), ...(lihatUang ? [r.terbayar] : [])]),
  ])

  return (
    <Halaman judul={kaprodi ? `Rekap RPL ${namaProdi(data.prodiSaya) || 'program studi'}` : 'Laporan RPL'}
      sub="Ringkasan layanan RPL berdasarkan pengajuan alur Juknis. Tidak menampilkan identitas pemohon."
      aksi={<Tombol ikon={Download} onClick={ekspor}>Unduh CSV</Tombol>}>
      <div className="pm-baris-aksi">
        <select className="input tm-saring" value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Saring periode">
          <option value="">Semua periode</option>
          {[...data.periode].reverse().map((x) => <option key={x.id} value={x.id}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</option>)}
        </select>
        {!kaprodi ? (
          <select className="input tm-saring" value={prodi} onChange={(e) => setProdi(e.target.value)} aria-label="Saring program studi">
            <option value="">Semua program studi</option>
            {data.prodi.filter((x) => x.is_penyelenggara_rpl || data.baris.some((b) => b.prodi_id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
          </select>
        ) : null}
      </div>

      <div className="lp-kpi">
        <div className="stat-card"><div className="stat-card-label">Pendaftar</div><div className="stat-card-value">{h.rows.length}</div><div className="stat-card-sub">pengajuan terkirim</div></div>
        <div className="stat-card"><div className="stat-card-label">Ber-SK</div><div className="stat-card-value">{h.sk.length}</div><div className="stat-card-sub">{h.ditolak.length} tidak memenuhi syarat</div></div>
        <div className="stat-card"><div className="stat-card-label">SKS diakui</div><div className="stat-card-value">{angka(rata(h.sk.map((b) => b.sks_diakui || 0)), 1)}</div><div className="stat-card-sub">rata-rata per pemohon ber-SK</div></div>
        <div className="stat-card"><div className="stat-card-label">Tingkat pengakuan</div><div className="stat-card-value">{h.diajukanSk ? `${angka((h.diakuiSk / h.diajukanSk) * 100, 0)}%` : '-'}</div><div className="stat-card-sub">SKS diakui dari yang diajukan</div></div>
        <div className="stat-card"><div className="stat-card-label">Lama layanan</div><div className="stat-card-value">{h.lama.length ? `${median(h.lama)} hari` : '-'}</div><div className="stat-card-sub">median, diajukan sampai SK</div></div>
        {lihatUang ? <div className="stat-card"><div className="stat-card-label">Pembayaran diterima</div><div className="stat-card-value" style={{ fontSize: 20 }}>{rupiah(h.terbayar)}</div><div className="stat-card-sub">diskon {rupiah(h.potongan)}</div></div> : null}
      </div>

      <div className="tm-dua">
        <Kartu judul="Pendaftar per periode" sub="Menurut jenis RPL" padat>
          {h.tren.length ? (
            <>
              <div className="lp-tren" role="img" aria-label={h.tren.map((t) => `${t.p.nama}: ${t.per.reduce((n, x) => n + x, 0)}`).join(', ')}>
                {h.tren.map((t) => {
                  const tot = t.per.reduce((n, x) => n + x, 0)
                  return (
                    <div key={t.p.id} className="lp-tren-kolom">
                      <span className="lp-tren-nilai">{tot}</span>
                      <div className="lp-tren-tumpuk" style={{ height: `${(tot / maksTren) * 120}px` }}>
                        {Object.keys(JENIS_RPL).map((j, i) => t.per[i] ? <span key={j} style={{ height: `${(t.per[i] / tot) * 100}%`, background: WARNA_JENIS[j] }} /> : null)}
                      </div>
                      <span className="lp-tren-label">{t.p.nama}</span>
                    </div>
                  )
                })}
              </div>
              <div className="lp-legenda">{Object.entries(JENIS_RPL).map(([v, j]) => <span key={v}><i style={{ background: WARNA_JENIS[v] }} />{j.label}</span>)}</div>
            </>
          ) : <p className="pm-kosong">Belum ada data.</p>}
        </Kartu>
        <Kartu judul="Posisi pengajuan" sub={periode ? 'Periode terpilih' : 'Semua periode'} padat>
          <Batang data={h.tahap} maks={Math.max(1, ...h.tahap.map((x) => x.nilai))} />
        </Kartu>
      </div>

      <Kartu judul="Per program studi" padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr>
              <th>Program studi</th><th className="ad-kanan" style={{ width: 110 }}>Pendaftar</th><th className="ad-kanan" style={{ width: 100 }}>Ber-SK</th>
              <th className="ad-kanan" style={{ width: 120 }}>Tidak memenuhi</th><th className="ad-kanan" style={{ width: 150 }}>Rata-rata SKS diakui</th><th style={{ width: 200 }}>SKS diakui dari diajukan</th>
              {lihatUang ? <th className="ad-kanan" style={{ width: 160 }}>Pembayaran diterima</th> : null}
            </tr></thead>
            <tbody>
              {h.perProdi.map((r) => (
                <tr key={r.x.id}>
                  <td data-label="Program studi" className="pm-tebal">{r.x.nama}</td>
                  <td data-label="Pendaftar" className="ad-kanan">{r.total}</td>
                  <td data-label="Ber-SK" className="ad-kanan">{r.sk}</td>
                  <td data-label="Tidak memenuhi" className="ad-kanan">{r.ditolak}</td>
                  <td data-label="Rata-rata SKS diakui" className="ad-kanan">{angka(r.rataSks, 1)}</td>
                  <td data-label="SKS diakui dari diajukan">{r.persen === null ? '-' : <>{angka(r.persen, 0)}%<span className="lp-mini" style={{ width: `${Math.min(r.persen, 100) * 0.9}px` }} /></>}</td>
                  {lihatUang ? <td data-label="Pembayaran diterima" className="ad-kanan">{rupiah(r.terbayar)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          {!h.perProdi.length ? <p className="pm-kosong">Belum ada data.</p> : null}
        </div>
      </Kartu>

      <div className="tm-dua">
        <Kartu judul="Jenis RPL" padat>
          <Batang data={h.jenis} maks={Math.max(1, ...h.jenis.map((x) => x.nilai))} />
        </Kartu>
        <Kartu judul="Pelaporan pemohon ber-SK" sub="Sistem RPL, LLDIKTI, dan PDDikti" padat>
          {h.sk.length ? <Batang data={h.pelaporan} maks={h.sk.length} /> : <p className="pm-kosong">Belum ada pemohon ber-SK.</p>}
        </Kartu>
      </div>

      <div className="tm-dua">
        <Kartu judul="Asal perguruan tinggi" sub="Delapan terbanyak" padat>
          {h.pt.length ? <Batang data={h.pt} maks={h.pt[0].nilai} /> : <p className="pm-kosong">Belum ada data asal perguruan tinggi.</p>}
        </Kartu>
        <Kartu judul="Kepuasan layanan" sub={`${h.puas.length} tanggapan, skala 1 sampai 5`} padat>
          {h.puas.length ? (
            <Batang maks={5} data={[['kemudahan', 'Kemudahan'], ['kejelasan', 'Kejelasan informasi'], ['kecepatan', 'Kecepatan layanan']]
              .map(([k, l]) => { const v = rata(h.puas.map((f) => Number(f[k]))); return { label: l, nilai: v, teks: angka(v, 1), warna: 'hijau' } })} />
          ) : <p className="pm-kosong">Belum ada tanggapan kepuasan.</p>}
        </Kartu>
      </div>
    </Halaman>
  )
}
