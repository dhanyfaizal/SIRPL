// Daftar tagihan per pemohon.
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useKeuangan } from '../KeuanganData'
import { STATUS_TAGIHAN, ringkasPengajuan } from '../tagihan'
import { unduhCsv } from '../../admin/aturan'
import { JENIS_RPL, rupiah } from '../../pemohon/konstanta'
import { Halaman, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'

export default function Tagihan() {
  const { siap, data, peta, galat } = useKeuangan()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const status = sp.get('status') || 'semua'
  const [periode, setPeriode] = useState('')
  const [prodi, setProdi] = useState('')
  const [cari, setCari] = useState('')

  const semua = useMemo(() => (data?.pengajuan || []).map((p) => ({ p, r: ringkasPengajuan(peta.tagihanPer[p.id] || [], peta.bayarPer[p.id] || []) })), [data, peta])
  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return semua
      .filter(({ p }) => !periode || p.periode_id === periode)
      .filter(({ p }) => !prodi || p.prodi_pilihan_id === prodi)
      .filter(({ r }) => status === 'semua' || (status === 'belum_lunas' ? r.sisa > 0 : status === 'terlambat' ? r.terlambat > 0 : status === 'diskon' ? r.potongan > 0 : status === 'cicilan' ? r.cicilan : true))
      .filter(({ p }) => {
        if (!q) return true
        const u = peta.orang[p.user_id]
        return [u?.nama_lengkap, u?.email, p.nomor_pendaftaran, p.nim].some((v) => (v || '').toLowerCase().includes(q))
      })
  }, [semua, periode, prodi, status, cari, peta])

  if (galat && !siap) return <Halaman judul="Tagihan pemohon"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const setStatus = (v) => { const n = new URLSearchParams(sp); if (v === 'semua') n.delete('status'); else n.set('status', v); setSp(n, { replace: true }) }
  const nama = (p) => peta.orang[p.user_id]?.nama_lengkap || peta.orang[p.user_id]?.email || 'Pemohon'
  const jumlah = baris.reduce((a, { r }) => ({ total: a.total + r.total, terbayar: a.terbayar + r.terbayar, sisa: a.sisa + r.sisa }), { total: 0, terbayar: 0, sisa: 0 })
  const ekspor = () => unduhCsv(`tagihan-rpl-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Nomor pendaftaran', 'Nama', 'Email', 'Program studi', 'Jenis RPL', 'Periode', 'Total tagihan', 'Diskon', 'Terbayar', 'Sisa', 'Status', 'Cicilan'],
    ...baris.map(({ p, r }) => [p.nomor_pendaftaran, nama(p), peta.orang[p.user_id]?.email, peta.prodi[p.prodi_pilihan_id]?.nama, JENIS_RPL[p.jenis_rpl]?.label,
      peta.periode[p.periode_id]?.nama, r.total, r.potongan, r.terbayar, r.sisa, STATUS_TAGIHAN[r.status]?.label, r.cicilan ? 'Ya' : 'Tidak']),
  ])

  return (
    <Halaman judul="Tagihan pemohon" sub="Tagihan pendaftaran dan asesmen dihitung otomatis dari tarif periode saat pengajuan dikirim. Klik baris untuk memberi diskon, mengatur cicilan, atau menambah tagihan."
      aksi={<Tombol ikon={Download} onClick={ekspor} disabled={!baris.length}>Unduh CSV</Tombol>}>
      <div className="ku-ringkas">
        <div><span className="pm-kecil">Pemohon</span><b>{baris.length}</b></div>
        <div><span className="pm-kecil">Total tagihan</span><b>{rupiah(jumlah.total)}</b></div>
        <div><span className="pm-kecil">Terbayar</span><b>{rupiah(jumlah.terbayar)}</b></div>
        <div><span className="pm-kecil">Sisa</span><b>{rupiah(jumlah.sisa)}</b></div>
      </div>
      <section className="card">
        <div className="pm-mk-alat">
          <div className="pm-baris-aksi">
            <PilihSegmen nilai={status} onUbah={setStatus} label="Saring tagihan"
              pilihan={[{ v: 'semua', l: 'Semua' }, { v: 'belum_lunas', l: 'Belum lunas' }, { v: 'terlambat', l: 'Terlambat' }, { v: 'cicilan', l: 'Cicilan' }, { v: 'diskon', l: 'Diskon' }]} />
            <div className="pm-input-ikon pm-cari">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input className="input" type="search" placeholder="Cari nama, email, nomor, atau NIM" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pemohon" />
            </div>
            <select className="input tm-saring" value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Saring periode">
              <option value="">Semua periode</option>
              {data.periode.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
            </select>
            <select className="input tm-saring" value={prodi} onChange={(e) => setProdi(e.target.value)} aria-label="Saring program studi">
              <option value="">Semua prodi</option>
              {data.prodi.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr>
              <th>Pemohon</th><th style={{ width: 170 }}>Program studi</th><th className="ku-kanan" style={{ width: 140 }}>Total</th>
              <th className="ku-kanan" style={{ width: 140 }}>Terbayar</th><th className="ku-kanan" style={{ width: 140 }}>Sisa</th><th style={{ width: 200 }}>Status</th>
            </tr></thead>
            <tbody>
              {baris.map(({ p, r }) => (
                <tr key={p.id} className="tm-klik" tabIndex={0} onClick={() => navigate(`/keuangan/tagihan/${p.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/keuangan/tagihan/${p.id}`) }}>
                  <td data-label="Pemohon"><div className="pm-tebal tm-nama">{nama(p)}</div><div className="pm-kecil">{p.nomor_pendaftaran} · {JENIS_RPL[p.jenis_rpl]?.label}</div></td>
                  <td data-label="Program studi">{peta.prodi[p.prodi_pilihan_id]?.nama || '-'}</td>
                  <td data-label="Total" className="ku-kanan">{rupiah(r.total)}{r.potongan ? <div className="pm-kecil ku-potong">diskon {rupiah(r.potongan)}</div> : null}</td>
                  <td data-label="Terbayar" className="ku-kanan">{rupiah(r.terbayar)}</td>
                  <td data-label="Sisa" className="ku-kanan pm-tebal">{rupiah(r.sisa)}</td>
                  <td data-label="Status">
                    <div className="pm-baris-aksi">
                      <Lencana warna={STATUS_TAGIHAN[r.status]?.warna}>{STATUS_TAGIHAN[r.status]?.label}</Lencana>
                      {r.terlambat ? <Lencana warna="red">Terlambat</Lencana> : null}
                      {r.cicilan ? <Lencana warna="slate">Cicilan</Lencana> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">Tidak ada pemohon yang cocok.</p> : null}
        </div>
      </section>
    </Halaman>
  )
}
