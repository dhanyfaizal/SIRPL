// Status pelaporan pemohon ber-SK: Sistem RPL -> verifikasi LLDIKTI -> PDDikti.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Undo2, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../AdminData'
import { PELAPORAN, unduhCsv } from '../aturan'
import { JENIS_RPL, tanggal } from '../../pemohon/konstanta'
import { Dialog, Halaman, Kerangka, Lencana, Pemberitahuan, Tombol } from '../../pemohon/ui'

export default function Pelaporan() {
  const { siap, data, peta, galat, muat } = useAdmin()
  const [tahap, setTahap] = useState('belum')
  const [periode, setPeriode] = useState('')
  const [prodi, setProdi] = useState('')
  const [pilih, setPilih] = useState(() => new Set())
  const [konfirmasi, setKonfirmasi] = useState(null)
  const [sibuk, setSibuk] = useState(false)

  // Hanya alur Juknis (alur_versi 2): data alur lama tidak punya SK/NIM dan tidak dilaporkan dari sini.
  // Syarat ini sama dengan badge Pelaporan di AdminLayout.
  const berSk = useMemo(() => (data?.pengajuan || []).filter((p) => p.alur_versi !== 1 && ['sk_terbit', 'selesai'].includes(p.status)), [data])
  const baris = useMemo(() => berSk
    .filter((p) => p.status_pelaporan === tahap)
    .filter((p) => !periode || p.periode_id === periode)
    .filter((p) => !prodi || p.prodi_pilihan_id === prodi), [berSk, tahap, periode, prodi])

  if (galat && !siap) return <Halaman judul="Pelaporan"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const i = PELAPORAN.findIndex((x) => x.v === tahap)
  const maju = PELAPORAN[i + 1]
  const mundur = PELAPORAN[i - 1]
  const dipilih = baris.filter((p) => pilih.has(p.id))
  const semua = baris.length > 0 && dipilih.length === baris.length
  const nama = (p) => peta.orang[p.user_id]?.nama_lengkap || peta.orang[p.user_id]?.email || 'Pemohon'
  const ubahTahap = (v) => { setTahap(v); setPilih(new Set()) }
  const togel = (id) => setPilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const jalankan = async () => {
    setSibuk(true)
    try {
      const { data: n, error } = await supabase.rpc('atur_status_pelaporan', { p_ids: dipilih.map((p) => p.id), p_status: konfirmasi.ke.v })
      if (error) throw new Error(error.message)
      toast.success(`${n} pemohon: ${konfirmasi.ke.l}`)
      setKonfirmasi(null); setPilih(new Set())
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  const ekspor = () => {
    const sumber = dipilih.length ? dipilih : baris
    unduhCsv(`pelaporan-rpl-${tahap}-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Nomor pendaftaran', 'Nama', 'Email', 'Program studi', 'Jenis RPL', 'Periode', 'PT asal', 'Prodi asal', 'NIM', 'SKS diakui', 'Sisa SKS', 'Nomor SK', 'Tanggal SK',
        'Status pelaporan', 'Dilaporkan ke Sistem RPL', 'Diverifikasi LLDIKTI', 'Masuk PDDikti'],
      ...sumber.map((p) => {
        const sk = peta.sk[p.sk_id]
        const pa = peta.penetapan[p.id]
        return [p.nomor_pendaftaran, nama(p), peta.orang[p.user_id]?.email, peta.prodi[p.prodi_pilihan_id]?.nama, JENIS_RPL[p.jenis_rpl]?.label,
          peta.periode[p.periode_id]?.nama, p.pt_asal, p.prodi_asal, p.nim, pa?.total_sks_diakui ?? '', pa?.total_sks_sisa ?? '', sk?.nomor_sk, sk?.tanggal_sk,
          PELAPORAN.find((x) => x.v === p.status_pelaporan)?.l, p.dilaporkan_sistem_rpl_at ? tanggal(p.dilaporkan_sistem_rpl_at) : '',
          p.diverifikasi_lldikti_at ? tanggal(p.diverifikasi_lldikti_at) : '', p.dilaporkan_pddikti_at ? tanggal(p.dilaporkan_pddikti_at) : '']
      }),
    ])
  }

  return (
    <Halaman judul="Pelaporan" sub="Pemohon yang sudah ber-SK dilaporkan ke Sistem Informasi RPL, diverifikasi LLDIKTI, lalu dimasukkan ke PDDikti. Tandai setiap langkah setelah dikerjakan."
      aksi={<Tombol ikon={Download} onClick={ekspor} disabled={!baris.length}>{dipilih.length ? `Unduh CSV (${dipilih.length})` : 'Unduh CSV'}</Tombol>}>
      <ol className="ad-alur" aria-label="Tahap pelaporan">
        {PELAPORAN.map((x, j) => {
          const n = berSk.filter((p) => p.status_pelaporan === x.v && (!periode || p.periode_id === periode) && (!prodi || p.prodi_pilihan_id === prodi)).length
          return (
            <li key={x.v}>
              <button type="button" className={`ad-alur-btn${x.v === tahap ? ' is-on' : ''}`} aria-pressed={x.v === tahap} onClick={() => ubahTahap(x.v)}>
                <span className="ad-alur-no">{j + 1}</span>
                <span className="pm-grow"><span className="ad-alur-label">{x.l}</span><span className="pm-kecil">{n} pemohon</span></span>
              </button>
            </li>
          )
        })}
      </ol>

      <section className="card">
        <div className="pm-mk-alat">
          <div className="pm-baris-aksi">
            <select className="input tm-saring" value={periode} onChange={(e) => { setPeriode(e.target.value); setPilih(new Set()) }} aria-label="Saring periode">
              <option value="">Semua periode</option>
              {data.periode.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
            </select>
            <select className="input tm-saring" value={prodi} onChange={(e) => { setProdi(e.target.value); setPilih(new Set()) }} aria-label="Saring program studi">
              <option value="">Semua prodi</option>
              {data.prodi.filter((x) => x.is_penyelenggara_rpl).map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
            </select>
          </div>
          <div className="pm-baris-aksi">
            {mundur ? <Tombol ikon={Undo2} disabled={!dipilih.length} onClick={() => setKonfirmasi({ ke: mundur, mundur: true })}>Kembalikan</Tombol> : null}
            {maju ? <Tombol jenis="primary" ikon={Send} disabled={!dipilih.length} onClick={() => setKonfirmasi({ ke: maju })}>{maju.aksi}{dipilih.length ? ` (${dipilih.length})` : ''}</Tombol> : null}
          </div>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr>
              <th style={{ width: 44 }}><input type="checkbox" checked={semua} onChange={() => setPilih(semua ? new Set() : new Set(baris.map((p) => p.id)))} aria-label="Pilih semua" disabled={!baris.length} /></th>
              <th>Pemohon</th><th style={{ width: 170 }}>Program studi</th><th style={{ width: 110 }}>NIM</th><th style={{ width: 100 }}>SKS diakui</th><th style={{ width: 220 }}>SK</th>
              <th style={{ width: 150 }}>{tahap === 'belum' ? 'Status' : 'Sejak'}</th>
            </tr></thead>
            <tbody>
              {baris.map((p) => {
                const sk = peta.sk[p.sk_id]
                const kolom = PELAPORAN[i]?.kolom
                return (
                  <tr key={p.id} className="tm-klik" onClick={() => togel(p.id)}>
                    <td data-label="Pilih"><input type="checkbox" checked={pilih.has(p.id)} onChange={() => togel(p.id)} onClick={(e) => e.stopPropagation()} aria-label={`Pilih ${nama(p)}`} /></td>
                    <td data-label="Pemohon">
                      <Link to={`/tim/antrean/hasil/${p.id}`} className="pm-tebal tm-nama" onClick={(e) => e.stopPropagation()}>{nama(p)}</Link>
                      <div className="pm-kecil">{p.nomor_pendaftaran} · {JENIS_RPL[p.jenis_rpl]?.label}</div>
                    </td>
                    <td data-label="Program studi">{peta.prodi[p.prodi_pilihan_id]?.nama}</td>
                    <td data-label="NIM">{p.nim || <Lencana warna="amber">Belum</Lencana>}</td>
                    <td data-label="SKS diakui">{peta.penetapan[p.id]?.total_sks_diakui ?? '-'}</td>
                    <td data-label="SK" className="pm-kecil">{sk ? <>{sk.nomor_sk}<br />{tanggal(sk.tanggal_sk)}</> : '-'}</td>
                    <td data-label={tahap === 'belum' ? 'Status' : 'Sejak'} className="pm-kecil">{kolom && p[kolom] ? tanggal(p[kolom]) : <Lencana warna={PELAPORAN[i].warna}>{PELAPORAN[i].l}</Lencana>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">{berSk.length ? 'Tidak ada pemohon pada tahap ini.' : 'Belum ada pemohon yang ber-SK.'}</p> : null}
        </div>
      </section>

      <Dialog buka={!!konfirmasi} judul={konfirmasi?.mundur ? 'Kembalikan status pelaporan' : konfirmasi?.ke.aksi} onTutup={() => setKonfirmasi(null)}
        kaki={<><Tombol onClick={() => setKonfirmasi(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={jalankan}>Simpan</Tombol></>}>
        {konfirmasi ? (
          <p>{dipilih.length} pemohon akan ditandai <b>{konfirmasi.ke.l}</b>{konfirmasi.mundur ? ' (koreksi satu langkah)' : ''}. Perubahan tercatat pada riwayat setiap pengajuan.</p>
        ) : null}
      </Dialog>
    </Halaman>
  )
}
