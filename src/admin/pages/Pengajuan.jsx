// Pemantauan semua pengajuan (alur Juknis) dan pembatalan oleh Admin.
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Ban, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../AdminData'
import { BISA_DIBATALKAN, unduhCsv } from '../aturan'
import { KELOMPOK, kelompokDari } from '../../tim/aturan'
import { JENIS_RPL, STATUS, tanggal } from '../../pemohon/konstanta'
import { Bidang, Dialog, Halaman, Kerangka, LencanaStatus, Pemberitahuan, Tombol } from '../../pemohon/ui'

const TAB = [{ id: 'draf', label: 'Draf', status: ['draft'] }, ...KELOMPOK]

export default function Pengajuan() {
  const { siap, data, peta, galat, muat } = useAdmin()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const kelompok = sp.get('kelompok') || 'semua'
  const [periode, setPeriode] = useState('')
  const [prodi, setProdi] = useState('')
  const [jenis, setJenis] = useState('')
  const [cari, setCari] = useState('')
  const [batal, setBatal] = useState(null)
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const k = TAB.find((x) => x.id === kelompok)
  const sumber = useMemo(() => (data?.pengajuan || []).filter((p) => p.alur_versi !== 1), [data])
  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return sumber
      .filter((p) => !k || k.status.includes(p.status))
      .filter((p) => !periode || p.periode_id === periode)
      .filter((p) => !prodi || p.prodi_pilihan_id === prodi)
      .filter((p) => !jenis || p.jenis_rpl === jenis)
      .filter((p) => {
        if (!q) return true
        const u = peta.orang[p.user_id]
        return [u?.nama_lengkap, u?.email, p.nomor_pendaftaran, p.nim, p.pt_asal].some((v) => (v || '').toLowerCase().includes(q))
      })
  }, [sumber, k, periode, prodi, jenis, cari, peta])

  if (galat && !siap) return <Halaman judul="Semua pengajuan"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const ganti = (id) => { const n = new URLSearchParams(sp); if (id === 'semua') n.delete('kelompok'); else n.set('kelompok', id); setSp(n, { replace: true }) }
  const hitung = (st) => sumber.filter((p) => st.includes(p.status) && (!periode || p.periode_id === periode)).length
  const ke = (p) => { if (p.status !== 'draft') navigate(`/tim/antrean/${kelompokDari(p.status)}/${p.id}`) }
  const nama = (p) => peta.orang[p.user_id]?.nama_lengkap || peta.orang[p.user_id]?.email || 'Pemohon'

  const ekspor = () => {
    unduhCsv(`pengajuan-rpl-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Nomor pendaftaran', 'Nama', 'Email', 'Program studi', 'Jenis RPL', 'Periode', 'Status', 'Diajukan', 'NIM', 'PT asal'],
      ...baris.map((p) => [p.nomor_pendaftaran, nama(p), peta.orang[p.user_id]?.email, peta.prodi[p.prodi_pilihan_id]?.nama, JENIS_RPL[p.jenis_rpl]?.label,
        peta.periode[p.periode_id]?.nama, STATUS[p.status]?.label || p.status, p.submitted_at ? tanggal(p.submitted_at) : '', p.nim, p.pt_asal]),
    ])
  }

  const kirimBatal = async () => {
    setSibuk(true)
    try {
      const { error } = await supabase.rpc('batalkan_pengajuan', { p_id: batal.id, p_alasan: alasan })
      if (error) throw new Error(error.message)
      toast.success('Pengajuan dibatalkan')
      setBatal(null); setAlasan('')
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Semua pengajuan" sub="Pemantauan seluruh pengajuan RPL. Klik baris untuk membuka detail di modul Tim Pengelola."
      aksi={<Tombol ikon={Download} onClick={ekspor} disabled={!baris.length}>Unduh CSV</Tombol>}>
      <section className="card">
        <div className="pm-tabs" role="tablist" aria-label="Kelompok status">
          <button type="button" role="tab" aria-selected={kelompok === 'semua'} className={`tm-tab${kelompok === 'semua' ? ' is-on' : ''}`} onClick={() => ganti('semua')}>
            Semua<span className="pm-hit">{sumber.filter((p) => !periode || p.periode_id === periode).length}</span>
          </button>
          {TAB.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === kelompok} className={`tm-tab${x.id === kelompok ? ' is-on' : ''}`} onClick={() => ganti(x.id)}>
              {x.label}<span className="pm-hit">{hitung(x.status)}</span>
            </button>
          ))}
        </div>
        <div className="pm-mk-alat">
          <div className="pm-baris-aksi">
            <div className="pm-input-ikon pm-cari">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input className="input" type="search" placeholder="Cari nama, email, nomor, NIM, atau PT asal" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pengajuan" />
            </div>
            <select className="input tm-saring" value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Saring periode">
              <option value="">Semua periode</option>
              {data.periode.map((x) => <option key={x.id} value={x.id}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</option>)}
            </select>
            <select className="input tm-saring" value={prodi} onChange={(e) => setProdi(e.target.value)} aria-label="Saring program studi">
              <option value="">Semua prodi</option>
              {data.prodi.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
            </select>
            <select className="input tm-saring" value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label="Saring jenis RPL">
              <option value="">Semua jenis RPL</option>
              {Object.entries(JENIS_RPL).map(([v, j]) => <option key={v} value={v}>{j.label}</option>)}
            </select>
          </div>
          <span className="pm-kecil">{baris.length} pengajuan</span>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr>
              <th>Pemohon</th><th style={{ width: 170 }}>Program studi</th><th style={{ width: 130 }}>Jenis RPL</th>
              <th style={{ width: 120 }}>Periode</th><th style={{ width: 120 }}>Diajukan</th><th style={{ width: 190 }}>Status</th><th style={{ width: 56 }}><span className="sr-only">Aksi</span></th>
            </tr></thead>
            <tbody>
              {baris.map((p) => (
                <tr key={p.id} className={p.status !== 'draft' ? 'tm-klik' : undefined} tabIndex={p.status !== 'draft' ? 0 : undefined} onClick={() => ke(p)} onKeyDown={(e) => { if (e.key === 'Enter') ke(p) }}>
                  <td data-label="Pemohon">
                    {p.status !== 'draft'
                      ? <Link to={`/tim/antrean/${kelompokDari(p.status)}/${p.id}`} className="pm-tebal tm-nama" onClick={(e) => e.stopPropagation()}>{nama(p)}</Link>
                      : <span className="pm-tebal">{nama(p)}</span>}
                    <div className="pm-kecil">{p.nomor_pendaftaran || 'belum bernomor'}{p.nim ? ` · NIM ${p.nim}` : ''}</div>
                  </td>
                  <td data-label="Program studi">{peta.prodi[p.prodi_pilihan_id]?.nama || '-'}</td>
                  <td data-label="Jenis RPL">{JENIS_RPL[p.jenis_rpl]?.label || '-'}</td>
                  <td data-label="Periode" className="pm-kecil">{peta.periode[p.periode_id]?.nama || '-'}</td>
                  <td data-label="Diajukan" className="pm-kecil">{p.submitted_at ? tanggal(p.submitted_at) : '-'}</td>
                  <td data-label="Status"><LencanaStatus status={p.status} /></td>
                  <td data-label="Aksi">
                    {BISA_DIBATALKAN(p.status) ? (
                      <button type="button" className="btn btn-ghost btn-icon" title="Batalkan pengajuan" aria-label={`Batalkan pengajuan ${nama(p)}`}
                        onClick={(e) => { e.stopPropagation(); setBatal(p); setAlasan('') }}><Ban size={15} /></button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">Tidak ada pengajuan yang cocok.</p> : null}
        </div>
      </section>

      <Dialog buka={!!batal} judul="Batalkan pengajuan" onTutup={() => setBatal(null)}
        kaki={<><Tombol onClick={() => setBatal(null)}>Kembali</Tombol><Tombol jenis="danger" ikon={Ban} sibuk={sibuk} disabled={alasan.trim().length < 10} onClick={kirimBatal}>Batalkan pengajuan</Tombol></>}>
        {batal ? (
          <div className="pm-tumpuk">
            <p>Pengajuan <b>{batal.nomor_pendaftaran || 'draf'}</b> atas nama <b>{nama(batal)}</b> berstatus <b>{STATUS[batal.status]?.label}</b> akan dibatalkan. Tindakan ini tercatat di log dan tidak dapat diurungkan dari aplikasi.</p>
            <Bidang label="Alasan pembatalan" wajib hint="Minimal 10 karakter. Alasan tercatat pada riwayat pengajuan.">
              <textarea className="input" rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. Pengajuan ganda, pemohon mengundurkan diri" />
            </Bidang>
          </div>
        ) : null}
      </Dialog>
    </Halaman>
  )
}
