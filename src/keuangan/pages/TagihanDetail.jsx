// Tagihan satu pemohon: diskon, skema bayar (cicilan), dan tagihan tambahan.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useKeuangan, cek } from '../KeuanganData'
import { KOMPONEN_TAGIHAN, KOMPONEN_TAMBAHAN, STATUS_TAGIHAN, angsuranDariSkema, potonganDiskon, ringkasPengajuan } from '../tagihan'
import { STATUS_BAYAR } from '../../tim/aturan'
import { JENIS_RPL, rupiah, tanggal } from '../../pemohon/konstanta'
import { Bidang, BukaBerkas, Dialog, Halaman, InputAngka, Kartu, Kerangka, Lencana, LencanaStatus, Pemberitahuan, Tombol } from '../../pemohon/ui'

const disegarkan = new Set()

function DialogAtur({ t, r, data, periodeId, onTutup, onSimpan }) {
  const pilihanDiskon = data.diskon.filter((d) => (d.is_aktif || d.id === t.diskon_id) && (!d.komponen || d.komponen === t.komponen) && (!d.periode_id || d.periode_id === periodeId))
  const [diskon, setDiskon] = useState(t.diskon_id || (Number(t.potongan) > 0 ? 'manual' : ''))
  const [manual, setManual] = useState(!t.diskon_id && Number(t.potongan) > 0 ? String(Math.round(Number(t.potongan))) : '')
  const [alasan, setAlasan] = useState(t.alasan_potongan || '')
  const [skema, setSkema] = useState(t.angsuran?.length > 1 ? 'manual' : '')
  const [angsuran, setAngsuran] = useState(t.angsuran?.length > 1 ? t.angsuran.map((a) => ({ ...a, jumlah: String(a.jumlah) })) : [])
  const [sibuk, setSibuk] = useState(false)

  const d = data.diskon.find((x) => x.id === diskon)
  const potongan = diskon === 'manual' ? Math.min(Number(manual || 0), Number(t.nominal)) : potonganDiskon(t.nominal, d)
  const total = Number(t.nominal) - potongan
  const jumlahAngsuran = angsuran.reduce((n, a) => n + Number(a.jumlah || 0), 0)
  const pakaiSkema = (id) => {
    setSkema(id)
    const s = data.skema.find((x) => x.id === id)
    if (s) setAngsuran(angsuranDariSkema(s.rincian, total).map((a) => ({ ...a, jumlah: String(a.jumlah) })))
    else if (id === 'manual') setAngsuran(angsuranDariSkema([{ persen: 50, hari: 0 }, { persen: 50, hari: 30 }], total).map((a) => ({ ...a, jumlah: String(a.jumlah) })))
    else setAngsuran([])
  }
  // Total berubah karena diskon: susun ulang angsuran dari skema yang dipilih.
  const totalLalu = useRef(total)
  useEffect(() => {
    if (totalLalu.current !== total && skema) pakaiSkema(skema)
    totalLalu.current = total
  }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

  const ubahA = (i, k, v) => { setSkema('manual'); setAngsuran((x) => x.map((a, j) => (j === i ? { ...a, [k]: v } : a))) }
  const simpan = async () => {
    setSibuk(true)
    try {
      const hasil = cek(await supabase.rpc('atur_tagihan', {
        p_id: t.id, p_diskon: diskon && diskon !== 'manual' ? diskon : null, p_potongan: diskon === 'manual' ? Number(manual || 0) : 0,
        p_alasan: alasan, p_angsuran: skema && angsuran.length > 1 ? angsuran.map((a, i) => ({ ke: i + 1, jumlah: Number(a.jumlah || 0), jatuh_tempo: a.jatuh_tempo })) : null,
      }))
      toast.success('Tagihan diperbarui')
      onSimpan(hasil)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const cocok = !skema || angsuran.length < 2 || jumlahAngsuran === total

  return (
    <Dialog buka judul={`Atur ${KOMPONEN_TAGIHAN[t.komponen]?.toLowerCase()}`} onTutup={onTutup} lebar={620}
      kaki={<><Tombol onClick={onTutup}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} disabled={!cocok || (potongan > 0 && !alasan.trim())} onClick={simpan}>Simpan</Tombol></>}>
      <div className="ad-form">
        <div className="ku-jumlah-cocok"><span>Nominal {t.keterangan ? `(${t.keterangan})` : ''}</span><b>{rupiah(t.nominal)}</b></div>
        <Bidang label="Diskon">
          <select className="input" value={diskon} onChange={(e) => setDiskon(e.target.value)}>
            <option value="">Tanpa diskon</option>
            {pilihanDiskon.map((x) => <option key={x.id} value={x.id}>{x.nama} ({x.jenis === 'persen' ? `${Number(x.nilai)}%` : rupiah(x.nilai)})</option>)}
            <option value="manual">Potongan khusus (nominal)</option>
          </select>
        </Bidang>
        {diskon === 'manual' ? (
          <Bidang label="Besar potongan (Rp)" wajib><InputAngka nilai={manual} onUbah={setManual} panjang={12} /></Bidang>
        ) : null}
        {diskon ? (
          <Bidang label="Alasan diskon" wajib hint="Tercatat pada riwayat pengajuan; pemohon melihat nama diskonnya.">
            <input className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. Alumni D3 STIKOM Yos Sudarso angkatan 2019" />
          </Bidang>
        ) : null}
        <div className="ku-jumlah-cocok"><span>Total setelah diskon</span><b>{rupiah(total)}{potongan ? <span className="pm-kecil ku-potong"> (potongan {rupiah(potongan)})</span> : null}</b></div>

        <Bidang label="Skema bayar">
          <select className="input" value={skema} onChange={(e) => pakaiSkema(e.target.value)} disabled={total <= 0}>
            <option value="">Dibayar sekali (lunas)</option>
            {data.skema.filter((s) => s.is_aktif).map((s) => <option key={s.id} value={s.id}>{s.nama} ({s.rincian.length} kali)</option>)}
            <option value="manual">Atur angsuran sendiri</option>
          </select>
        </Bidang>
        {skema && angsuran.length ? (
          <div className="ad-form">
            <div className="ku-editor ku-editor-kepala"><span>Ke</span><span>Jumlah (Rp)</span><span className="ku-tgl">Jatuh tempo</span><span /></div>
            {angsuran.map((a, i) => (
              <div className="ku-editor" key={i}>
                <span className="pm-tebal">{i + 1}</span>
                <InputAngka nilai={a.jumlah} onUbah={(v) => ubahA(i, 'jumlah', v)} panjang={12} aria-label={`Jumlah angsuran ke-${i + 1}`} />
                <input className="input ku-tgl" type="date" value={a.jatuh_tempo || ''} onChange={(e) => ubahA(i, 'jatuh_tempo', e.target.value)} aria-label={`Jatuh tempo angsuran ke-${i + 1}`} />
                <button type="button" className="btn btn-ghost btn-icon" disabled={angsuran.length <= 2} title="Hapus angsuran" aria-label={`Hapus angsuran ke-${i + 1}`}
                  onClick={() => { setSkema('manual'); setAngsuran((x) => x.filter((_, j) => j !== i)) }}><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="pm-baris-aksi">
              <Tombol ikon={Plus} disabled={angsuran.length >= 12} onClick={() => { setSkema('manual'); setAngsuran((x) => [...x, { ke: x.length + 1, jumlah: '0', jatuh_tempo: x[x.length - 1]?.jatuh_tempo || '' }]) }}>Tambah angsuran</Tombol>
            </div>
            <div className={`ku-jumlah-cocok${cocok ? '' : ' is-salah'}`}><span>Jumlah angsuran</span><b>{rupiah(jumlahAngsuran)}{cocok ? '' : ` (selisih ${rupiah(total - jumlahAngsuran)})`}</b></div>
          </div>
        ) : null}
        {r.terkunci ? <Pemberitahuan jenis="amber">Tagihan ini sudah dibayar atau sedang diperiksa sehingga tidak dapat diubah.</Pemberitahuan> : null}
      </div>
    </Dialog>
  )
}

export default function TagihanDetail() {
  const { id } = useParams()
  const { siap, data, peta, galat, ubah } = useKeuangan()
  const [atur, setAtur] = useState(null)
  const [tambah, setTambah] = useState(null)
  const [hapus, setHapus] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const p = peta.pengajuan[id]

  // Segarkan tagihan otomatis dari tarif sekali setiap pemohon dibuka.
  useEffect(() => {
    if (!p || disegarkan.has(p.id)) return
    disegarkan.add(p.id)
    supabase.rpc('siapkan_tagihan', { p_pengajuan: p.id }).then(({ data: rows, error }) => {
      if (error || !rows) return
      ubah((d) => ({ tagihan: [...d.tagihan.filter((t) => t.pengajuan_id !== p.id), ...rows] }))
    })
  }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const r = useMemo(() => (p ? ringkasPengajuan(peta.tagihanPer[p.id] || [], peta.bayarPer[p.id] || []) : null), [p, peta])
  if (galat && !siap) return <Halaman judul="Tagihan"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />
  if (!p) return <Halaman judul="Pemohon tidak ditemukan"><Pemberitahuan jenis="amber">Pengajuan ini tidak ada. <Link to="/keuangan/tagihan">Kembali ke daftar</Link></Pemberitahuan></Halaman>

  const u = peta.orang[p.user_id]
  const gantiTagihan = (t) => ubah((d) => ({ tagihan: d.tagihan.some((x) => x.id === t.id) ? d.tagihan.map((x) => (x.id === t.id ? t : x)) : [...d.tagihan, t] }))
  const kirimTambah = async () => {
    setSibuk(true)
    try {
      const t = cek(await supabase.rpc('tambah_tagihan', { p_pengajuan: p.id, p_komponen: tambah.komponen, p_nominal: Number(tambah.nominal || 0), p_keterangan: tambah.keterangan }))
      gantiTagihan(t)
      toast.success('Tagihan ditambahkan')
      setTambah(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const kirimHapus = async () => {
    setSibuk(true)
    try {
      cek(await supabase.rpc('hapus_tagihan', { p_id: hapus.id }))
      ubah((d) => ({ tagihan: d.tagihan.filter((x) => x.id !== hapus.id) }))
      toast.success('Tagihan dihapus')
      setHapus(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul={u?.nama_lengkap || u?.email || 'Pemohon'}
      sub={<>{p.nomor_pendaftaran} · {peta.prodi[p.prodi_pilihan_id]?.nama} · {JENIS_RPL[p.jenis_rpl]?.label} · {peta.periode[p.periode_id]?.nama}{u?.no_whatsapp ? ` · WA ${u.no_whatsapp}` : ''}</>}
      aksi={<div className="pm-baris-aksi">
        <Link to="/keuangan/tagihan" className="btn btn-ghost"><ArrowLeft size={14} /> Daftar tagihan</Link>
        <Tombol ikon={Plus} onClick={() => setTambah({ komponen: 'matrikulasi', nominal: '', keterangan: '' })}>Tambah tagihan</Tombol>
      </div>}>
      <div className="ku-ringkas">
        <div><span className="pm-kecil">Status pengajuan</span><LencanaStatus status={p.status} /></div>
        <div><span className="pm-kecil">Total tagihan</span><b>{rupiah(r.total)}</b>{r.potongan ? <span className="pm-kecil ku-potong">sudah dipotong diskon {rupiah(r.potongan)}</span> : null}</div>
        <div><span className="pm-kecil">Terbayar</span><b>{rupiah(r.terbayar)}</b></div>
        <div><span className="pm-kecil">Sisa</span><b>{rupiah(r.sisa)}</b></div>
      </div>

      <Kartu judul="Tagihan" padat>
        {!r.rinci.length ? <p className="pm-kosong">Belum ada tagihan. Tagihan disusun dari tarif periode; periksa tarif di Konsol Admin bila tetap kosong.</p> : null}
        {r.rinci.map(({ t, r: rt }) => {
          const d = peta.diskon[t.diskon_id]
          const st = STATUS_TAGIHAN[rt.status]
          return (
            <div key={t.id} className="ku-tagihan">
              <div className="ku-tagihan-kepala">
                <div className="pm-grow">
                  <div className="pm-baris-aksi"><span className="pm-tebal">{KOMPONEN_TAGIHAN[t.komponen]}</span><Lencana warna={st.warna}>{st.label}</Lencana>{rt.cicilan ? <Lencana warna="slate">{rt.angsuran.length} kali angsuran</Lencana> : null}</div>
                  <div className="pm-kecil">{t.keterangan || (t.otomatis ? 'Dihitung dari tarif periode' : '')}</div>
                  {Number(t.potongan) > 0 ? <div className="pm-kecil ku-potong">{d ? d.nama : 'Potongan khusus'}: {rupiah(t.potongan)}{t.alasan_potongan ? ` · ${t.alasan_potongan}` : ''}</div> : null}
                </div>
                <div className="ku-total">
                  {Number(t.potongan) > 0 ? <span className="ku-coret">{rupiah(t.nominal)}</span> : null}
                  <div className="ku-total-angka">{rupiah(rt.total)}</div>
                  {rt.terbayar ? <div className="pm-kecil">terbayar {rupiah(rt.terbayar)}</div> : null}
                </div>
                <div className="pm-baris-aksi">
                  <Tombol ikon={SlidersHorizontal} disabled={rt.terkunci || Number(t.nominal) <= 0} onClick={() => setAtur(t)}
                    title={rt.terkunci ? 'Sudah dibayar atau sedang diperiksa' : undefined}>Diskon dan skema</Tombol>
                  {!t.otomatis && !rt.terkunci ? <button type="button" className="btn btn-ghost btn-icon" title="Hapus tagihan" aria-label={`Hapus ${KOMPONEN_TAGIHAN[t.komponen]}`} onClick={() => setHapus(t)}><Trash2 size={15} /></button> : null}
                </div>
              </div>
              {rt.total > 0 ? (
                <div className="ku-angsuran table-wrap">
                  <table className="pm-tabel pm-tabel-responsif">
                    <thead><tr><th style={{ width: 70 }}>Ke</th><th style={{ width: 150 }}>Jumlah</th><th style={{ width: 150 }}>Jatuh tempo</th><th>Pembayaran</th></tr></thead>
                    <tbody>
                      {rt.angsuran.map((a) => (
                        <tr key={a.ke}>
                          <td data-label="Ke">{rt.cicilan ? a.ke : 'Sekali bayar'}</td>
                          <td data-label="Jumlah" className="pm-tebal ku-angka">{rupiah(a.jumlah)}</td>
                          <td data-label="Jatuh tempo" className={a.terlambat ? 'ku-merah' : 'pm-kecil'}>{a.jatuh_tempo ? tanggal(a.jatuh_tempo) : '-'}{a.terlambat ? ' (terlambat)' : ''}</td>
                          <td data-label="Pembayaran">
                            <div className="pm-baris-aksi">
                              {a.bukti ? <><Lencana warna={STATUS_BAYAR[a.bukti.status]?.warna}>{STATUS_BAYAR[a.bukti.status]?.label}</Lencana><BukaBerkas path={a.bukti.bukti_bayar_url} label="Bukti" /></>
                                : <Lencana>Belum dibayar</Lencana>}
                              {a.ditolak ? <span className="pm-kecil pm-merah">Bukti terakhir ditolak: {a.ditolak.catatan}</span> : null}
                              {a.bukti?.status === 'menunggu' ? <Link to="/keuangan/verifikasi" className="pm-kecil">Verifikasi</Link> : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )
        })}
      </Kartu>

      {atur ? <DialogAtur t={atur} r={r.rinci.find((x) => x.t.id === atur.id)?.r || {}} data={data} periodeId={p.periode_id} onTutup={() => setAtur(null)} onSimpan={(t) => { gantiTagihan(t); setAtur(null) }} /> : null}

      <Dialog buka={!!tambah} judul="Tambah tagihan" onTutup={() => setTambah(null)}
        kaki={<><Tombol onClick={() => setTambah(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} disabled={!Number(tambah?.nominal) || !tambah?.keterangan.trim()} onClick={kirimTambah}>Tambahkan</Tombol></>}>
        {tambah ? (
          <div className="ad-form">
            <Bidang label="Komponen" wajib>
              <select className="input" value={tambah.komponen} onChange={(e) => setTambah((s) => ({ ...s, komponen: e.target.value }))}>
                {KOMPONEN_TAMBAHAN.map((k) => <option key={k} value={k}>{KOMPONEN_TAGIHAN[k]}</option>)}
              </select>
            </Bidang>
            <Bidang label="Nominal (Rp)" wajib><InputAngka nilai={tambah.nominal} onUbah={(v) => setTambah((s) => ({ ...s, nominal: v }))} panjang={12} /></Bidang>
            <Bidang label="Keterangan" wajib hint="Tampil kepada pemohon, mis. Matrikulasi 2 mata kuliah (Algoritma, Basis Data).">
              <input className="input" value={tambah.keterangan} onChange={(e) => setTambah((s) => ({ ...s, keterangan: e.target.value }))} />
            </Bidang>
          </div>
        ) : null}
      </Dialog>

      <Dialog buka={!!hapus} judul="Hapus tagihan" onTutup={() => setHapus(null)}
        kaki={<><Tombol onClick={() => setHapus(null)}>Batal</Tombol><Tombol jenis="danger" sibuk={sibuk} onClick={kirimHapus}>Hapus</Tombol></>}>
        {hapus ? <p>{KOMPONEN_TAGIHAN[hapus.komponen]} sebesar <b>{rupiah(hapus.nominal)}</b> ({hapus.keterangan}) akan dihapus dari tagihan pemohon.</p> : null}
      </Dialog>
    </Halaman>
  )
}
