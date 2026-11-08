import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useKeuangan } from '../KeuanganData'
import { KOMPONEN_TAGIHAN, ringkasPengajuan } from '../tagihan'
import { rupiah, tanggal } from '../../pemohon/konstanta'
import { Halaman, Kartu, Kerangka, Lencana, Pemberitahuan } from '../../pemohon/ui'

export default function Beranda() {
  const { siap, data, peta, galat } = useKeuangan()
  const { profile } = useAuth()

  const hitung = useMemo(() => {
    if (!data) return null
    const per = data.pengajuan.map((p) => ({ p, r: ringkasPengajuan(peta.tagihanPer[p.id] || [], peta.bayarPer[p.id] || []) }))
    const kini = new Date().toISOString().slice(0, 10)
    const tujuh = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const jatuh = []
    for (const { p, r } of per) {
      for (const { t, r: rt } of r.rinci) {
        for (const a of rt.angsuran) {
          if (a.status === 'belum' && a.jatuh_tempo && a.jatuh_tempo <= tujuh) jatuh.push({ p, t, a, lewat: a.jatuh_tempo < kini })
        }
      }
    }
    jatuh.sort((x, y) => (x.a.jatuh_tempo < y.a.jatuh_tempo ? -1 : 1))
    const aktif = data.periode.find((x) => x.is_aktif)
    const diterima = data.pembayaran.filter((b) => b.status === 'lunas' && (!aktif || peta.pengajuan[b.pengajuan_id]?.periode_id === aktif.id))
      .reduce((n, b) => n + Number(b.jumlah), 0)
    return {
      per, jatuh, aktif, diterima,
      belumLunas: per.filter((x) => x.r.sisa > 0),
      sisa: per.reduce((n, x) => n + x.r.sisa, 0),
      potongan: per.reduce((n, x) => n + x.r.potongan, 0),
      menunggu: data.pembayaran.filter((b) => b.status === 'menunggu'),
    }
  }, [data, peta])

  if (galat && !siap) return <Halaman judul="Beranda"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />
  const { jatuh, aktif, diterima, belumLunas, sisa, potongan, menunggu } = hitung
  const nama = (p) => peta.orang[p.user_id]?.nama_lengkap || peta.orang[p.user_id]?.email || 'Pemohon'

  return (
    <Halaman judul={`Selamat bekerja, ${(profile?.nama_lengkap || '').replace(/^((dr|drs|ir|prof|h|hj)\.?\s+)+/i, '').split(/[\s,]/)[0] || 'PMB'}`}
      sub="Verifikasi pembayaran, tagihan, diskon, dan skema bayar pemohon RPL.">
      <div className="tm-stat">
        <Link to="/keuangan/verifikasi" className="stat-card tm-stat-link">
          <div className="stat-card-label">Bukti bayar menunggu</div>
          <div className="stat-card-value">{menunggu.length}</div>
          <div className="stat-card-sub">{rupiah(menunggu.reduce((n, b) => n + Number(b.jumlah), 0))}</div>
        </Link>
        <Link to="/keuangan/tagihan?status=belum_lunas" className="stat-card tm-stat-link">
          <div className="stat-card-label">Pemohon belum lunas</div>
          <div className="stat-card-value">{belumLunas.length}</div>
          <div className="stat-card-sub">Sisa {rupiah(sisa)}</div>
        </Link>
        <div className="stat-card">
          <div className="stat-card-label">Diterima {aktif ? `periode ${aktif.nama}` : ''}</div>
          <div className="stat-card-value ku-angka" style={{ fontSize: 22 }}>{rupiah(diterima)}</div>
          <div className="stat-card-sub">Pembayaran berstatus lunas</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Diskon diberikan</div>
          <div className="stat-card-value ku-angka" style={{ fontSize: 22 }}>{rupiah(potongan)}</div>
          <div className="stat-card-sub">{data.tagihan.filter((t) => Number(t.potongan) > 0).length} tagihan</div>
        </div>
      </div>

      <div className="tm-dua">
        <Kartu judul="Bukti bayar terbaru" sub="Menunggu verifikasi" padat
          aksi={menunggu.length ? <Link to="/keuangan/verifikasi" className="btn btn-ghost btn-sm">Semua <ArrowRight size={13} /></Link> : null}>
          {menunggu.length ? (
            <ul className="tm-daftar">
              {menunggu.slice(0, 6).map((b) => {
                const p = peta.pengajuan[b.pengajuan_id]
                return (
                  <li key={b.id}>
                    <Link to={`/keuangan/tagihan/${b.pengajuan_id}`} className="tm-baris">
                      <div className="pm-grow"><div className="pm-tebal">{p ? nama(p) : 'Pemohon'}</div>
                        <div className="pm-kecil">{KOMPONEN_TAGIHAN[b.komponen] || b.komponen}{peta.tagihan[b.tagihan_id]?.angsuran ? ` · angsuran ke-${b.angsuran_ke}` : ''} · {tanggal(b.created_at)}</div></div>
                      <span className="pm-tebal ku-angka">{rupiah(b.jumlah)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <p className="pm-kosong">Tidak ada bukti bayar yang menunggu.</p>}
        </Kartu>
        <Kartu judul="Jatuh tempo angsuran" sub="Terlambat dan 7 hari ke depan" padat>
          {jatuh.length ? (
            <ul className="tm-daftar">
              {jatuh.slice(0, 8).map(({ p, t, a, lewat }) => (
                <li key={`${t.id}-${a.ke}`}>
                  <Link to={`/keuangan/tagihan/${p.id}`} className="tm-baris">
                    <div className="pm-grow"><div className="pm-tebal">{nama(p)}</div>
                      <div className="pm-kecil">{KOMPONEN_TAGIHAN[t.komponen]} · angsuran ke-{a.ke} · {rupiah(a.jumlah)}</div></div>
                    <Lencana warna={lewat ? 'red' : 'amber'}>{lewat ? 'Terlambat' : 'Jatuh tempo'} {tanggal(a.jatuh_tempo)}</Lencana>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="pm-kosong">Tidak ada angsuran yang jatuh tempo.</p>}
        </Kartu>
      </div>
      {!data.diskon.length || !data.skema.length ? (
        <Pemberitahuan jenis="indigo" judul="Siapkan master diskon dan skema bayar">
          {!data.diskon.length ? <>Belum ada <Link to="/keuangan/diskon">skema diskon</Link>. </> : null}
          {!data.skema.length ? <>Belum ada <Link to="/keuangan/skema">skema bayar</Link> (cicilan). </> : null}
          Keduanya dipakai saat mengatur tagihan pemohon.
        </Pemberitahuan>
      ) : null}
    </Halaman>
  )
}
