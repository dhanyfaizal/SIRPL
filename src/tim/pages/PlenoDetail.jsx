// Satu pleno: peserta (penanda tangan F11), pengajuan yang dibahas, penetapan.
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Gavel, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTim } from '../TimData'
import * as api from '../api'
import { kelompokDari } from '../aturan'
import { JENIS_RPL, tanggal } from '../../pemohon/konstanta'
import { BarTahap, Bidang, Dialog, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, Tombol } from '../../pemohon/ui'
import { JENIS_PLENO } from './Pleno'

const LABEL_PERAN = { admin: 'Admin', ketua_tim: 'Ketua Tim', sekretaris: 'Sekretaris', asessor: 'Asesor', komite: 'Komite', eksekutif: 'Pimpinan', lpmp: 'LPMP', kaprodi_si: 'Ka. Prodi SI', kaprodi_ti: 'Ka. Prodi TI', kaprodi_dkv: 'Ka. Prodi DKV', kaprodi_ka: 'Ka. Prodi KA' }

export default function PlenoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { siap, data, peta, role, ubah, muat } = useTim()
  const [sibuk, setSibuk] = useState(null)
  const [tetapkan, setTetapkan] = useState(false)
  const [hapus, setHapus] = useState(false)
  const pleno = data?.pleno.find((x) => x.id === id)
  const [info, setInfo] = useState(null)
  const [pesertaBaru, setPesertaBaru] = useState({ profile_id: '', jabatan: 'Anggota' })
  const [keputusan, setKeputusan] = useState({})

  const statusSyarat = pleno?.jenis === 'awal' ? 'pleno_awal' : 'pleno'
  const dibahas = useMemo(() => {
    if (!data || !pleno) return []
    const ids = [...new Set(data.plenoPengajuan.filter((x) => x.pleno_id === id).map((x) => x.pengajuan_id))]
    return ids.map((pid) => data.pengajuan.find((p) => p.id === pid)).filter(Boolean)
  }, [data, pleno, id])
  const calon = useMemo(() => {
    if (!data || !pleno) return []
    const sudahDraf = new Set(data.plenoPengajuan.filter((x) => data.pleno.find((pl) => pl.id === x.pleno_id)?.status === 'draft').map((x) => x.pengajuan_id))
    return data.pengajuan.filter((p) => p.status === statusSyarat && (!pleno.prodi_id || p.prodi_pilihan_id === pleno.prodi_id) && !sudahDraf.has(p.id))
  }, [data, pleno, statusSyarat])

  if (!siap) return <Kerangka />
  if (!pleno) return <Halaman judul="Pleno tidak ditemukan"><Pemberitahuan jenis="amber"><Link to="/tim/pleno">Kembali ke daftar pleno</Link></Pemberitahuan></Halaman>

  const draf = pleno.status !== 'ditetapkan'
  const bolehCatat = draf && ['admin', 'ketua_tim', 'sekretaris'].includes(role)
  const bolehTetapkan = draf && ['admin', 'ketua_tim'].includes(role)
  const f = info || { tanggal: pleno.tanggal || '', tempat: pleno.tempat || '', nomor_berita_acara: pleno.nomor_berita_acara || '', notulen: pleno.notulen || '' }
  const peserta = data.pesertaPleno.filter((x) => x.pleno_id === id)
  const nama = (pid) => peta.pemohon[data.pengajuan.find((p) => p.id === pid)?.user_id]?.nama_lengkap || 'Pemohon'
  const ringkas = (p) => {
    const mk = data.mkDiajukan.filter((m) => m.pengajuan_id === p.id)
    const pn = data.penilaian.filter((x) => x.pengajuan_id === p.id)
    const diakui = pn.filter((x) => x.keputusan === 'diakui').length
    const lanjut = pn.filter((x) => x.keputusan === 'perlu_asesmen_lanjutan').length
    return `${mk.length} MK diajukan · ${diakui} diakui${lanjut ? ` · ${lanjut} perlu asesmen lanjutan` : ''}`
  }
  const kepPengajuan = (pid) => keputusan[pid] ?? (data.plenoPengajuan.find((x) => x.pleno_id === id && x.pengajuan_id === pid)?.keputusan || '')

  const jalankan = async (kunci, fn, pesan) => {
    setSibuk(kunci)
    try { await fn(); if (pesan) toast.success(pesan) } catch (e) { toast.error(e.message, { duration: 7000 }) } finally { setSibuk(null) }
  }
  const simpanInfo = () => jalankan('info', async () => {
    const hasil = await api.ubahPleno(id, { tanggal: f.tanggal || null, tempat: f.tempat || null, nomor_berita_acara: f.nomor_berita_acara || null, notulen: f.notulen || null })
    ubah((d) => ({ pleno: d.pleno.map((x) => (x.id === id ? hasil : x)) })); setInfo(null)
  }, 'Data pleno disimpan')
  const tambahPeserta = () => jalankan('peserta', async () => {
    if (!pesertaBaru.profile_id) throw new Error('Pilih peserta')
    const hasil = await api.tambahPeserta({ pleno_id: id, profile_id: pesertaBaru.profile_id, jabatan_dalam_pleno: pesertaBaru.jabatan || null, urutan: peserta.length + 1 })
    ubah((d) => ({ pesertaPleno: [...d.pesertaPleno, hasil] })); setPesertaBaru({ profile_id: '', jabatan: 'Anggota' })
  })
  const buangPeserta = (pid) => jalankan(`ps-${pid}`, async () => {
    await api.hapusPeserta(id, pid)
    ubah((d) => ({ pesertaPleno: d.pesertaPleno.filter((x) => !(x.pleno_id === id && x.profile_id === pid)) }))
  })
  const tambahPengajuan = (p) => jalankan(`pg-${p.id}`, async () => {
    const mek = pleno.jenis === 'awal' ? ['perolehan'] : [...new Set(data.mkDiajukan.filter((m) => m.pengajuan_id === p.id).map((m) => m.mekanisme))]
    const hasil = await api.tambahPengajuanPleno(mek.map((m) => ({ pleno_id: id, pengajuan_id: p.id, mekanisme: m })))
    ubah((d) => ({ plenoPengajuan: [...d.plenoPengajuan, ...hasil] }))
  })
  const buangPengajuan = (pid) => jalankan(`pg-${pid}`, async () => {
    await api.hapusPengajuanPleno(id, pid)
    ubah((d) => ({ plenoPengajuan: d.plenoPengajuan.filter((x) => !(x.pleno_id === id && x.pengajuan_id === pid)) }))
  })
  const simpanKeputusan = (pid) => jalankan(`kp-${pid}`, async () => {
    const hasil = await api.ubahKeputusanPleno(id, pid, kepPengajuan(pid).trim() || null)
    ubah((d) => ({ plenoPengajuan: [...d.plenoPengajuan.filter((x) => !(x.pleno_id === id && x.pengajuan_id === pid)), ...hasil] }))
    setKeputusan((s) => { const n = { ...s }; delete n[pid]; return n })
  }, 'Catatan keputusan disimpan')
  const jalankanTetapkan = () => jalankan('tetapkan', async () => {
    await api.tetapkanPleno(id)
    setTetapkan(false)
    await muat()
  }, 'Hasil pleno ditetapkan')
  const jalankanHapus = () => jalankan('hapus', async () => {
    await api.hapusPleno(id)
    ubah((d) => ({ pleno: d.pleno.filter((x) => x.id !== id), plenoPengajuan: d.plenoPengajuan.filter((x) => x.pleno_id !== id), pesertaPleno: d.pesertaPleno.filter((x) => x.pleno_id !== id) }))
    navigate('/tim/pleno')
  }, 'Pleno dihapus')

  const kurang = [!f.tanggal && 'tanggal', !peserta.length && 'peserta', !dibahas.length && 'pengajuan'].filter(Boolean)
  const stafPilih = data.staf.filter((s) => !peserta.some((x) => x.profile_id === s.id))

  return (
    <Halaman judul={`${JENIS_PLENO[pleno.jenis]} · ${peta.prodi[pleno.prodi_id]?.nama || 'Semua prodi'}`}
      sub={draf ? 'Catat peserta dan pengajuan yang dibahas. Ketua Tim menetapkan hasil setelah pleno selesai.' : `Ditetapkan ${tanggal(pleno.ditetapkan_at, true)} oleh ${peta.staf[pleno.ditetapkan_oleh]?.nama_lengkap || 'Ketua Tim'}.`}
      aksi={<><Link to="/tim/pleno" className="btn btn-secondary"><ArrowLeft size={14} /> Daftar pleno</Link>{bolehCatat && !dibahas.length ? <Tombol ikon={Trash2} onClick={() => setHapus(true)}>Hapus</Tombol> : null}</>}>
      <div className="tm-kepala-info">
        {draf ? <Lencana warna="amber">Draf</Lencana> : <Lencana warna="green">Ditetapkan</Lencana>}
        <span className="pm-kecil">{pleno.jenis === 'awal' ? 'Hasil: pengajuan masuk penilaian lanjutan (wawancara).' : 'Hasil: rekognisi disampaikan kepada pemohon.'}</span>
      </div>

      <Kartu judul="Data pleno" kaki={bolehCatat && info ? <Tombol ikon={Save} sibuk={sibuk === 'info'} onClick={simpanInfo}>Simpan</Tombol> : null}>
        <div className="pm-form-2">
          <Bidang label="Tanggal" wajib><input className="input" type="date" value={f.tanggal} disabled={!bolehCatat} onChange={(e) => setInfo({ ...f, tanggal: e.target.value })} /></Bidang>
          <Bidang label="Tempat"><input className="input" value={f.tempat} disabled={!bolehCatat} onChange={(e) => setInfo({ ...f, tempat: e.target.value })} /></Bidang>
          <Bidang label="Nomor berita acara (F11)" hint="Boleh dikosongkan; nomor otomatis disiapkan bersama modul dokumen."><input className="input" value={f.nomor_berita_acara} disabled={!bolehCatat} onChange={(e) => setInfo({ ...f, nomor_berita_acara: e.target.value })} /></Bidang>
          <div />
          <Bidang label="Notulen / catatan pleno" lebar><textarea className="input" rows={3} value={f.notulen} disabled={!bolehCatat} onChange={(e) => setInfo({ ...f, notulen: e.target.value })} /></Bidang>
        </div>
      </Kartu>

      <Kartu judul="Peserta pleno" sub="Seluruh peserta menandatangani Berita Acara Pleno (F11)." padat>
        <ul className="tm-daftar">
          {peserta.map((x) => (
            <li key={x.profile_id} className="tm-baris">
              <span className="pm-grow"><span className="pm-tebal">{peta.staf[x.profile_id]?.nama_lengkap || 'Peserta'}</span><span className="pm-kecil"> · {LABEL_PERAN[peta.staf[x.profile_id]?.role] || ''}</span></span>
              <span className="pm-kecil">{x.jabatan_dalam_pleno || '-'}</span>
              {bolehCatat ? <button type="button" className="btn btn-ghost btn-icon" aria-label="Hapus peserta" disabled={sibuk === `ps-${x.profile_id}`} onClick={() => buangPeserta(x.profile_id)}><Trash2 size={14} /></button> : null}
            </li>
          ))}
          {!peserta.length ? <li><p className="pm-kosong">Belum ada peserta.</p></li> : null}
        </ul>
        {bolehCatat ? (
          <div className="card-body pl-peserta-baris">
            <select className="input" value={pesertaBaru.profile_id} onChange={(e) => setPesertaBaru((s) => ({ ...s, profile_id: e.target.value }))} aria-label="Pilih peserta">
              <option value="">Pilih peserta</option>
              {stafPilih.map((s) => <option key={s.id} value={s.id}>{s.nama_lengkap || s.email} ({LABEL_PERAN[s.role] || s.role})</option>)}
            </select>
            <input className="input" value={pesertaBaru.jabatan} onChange={(e) => setPesertaBaru((s) => ({ ...s, jabatan: e.target.value }))} aria-label="Jabatan dalam pleno" placeholder="Ketua / Sekretaris / Anggota" />
            <button type="button" className="btn btn-secondary btn-icon" aria-label="Tambah peserta" disabled={sibuk === 'peserta'} onClick={tambahPeserta}><Plus size={15} /></button>
          </div>
        ) : null}
      </Kartu>

      <Kartu judul={`Pengajuan yang dibahas (${dibahas.length})`} padat>
        {dibahas.length ? (
          <ul className="tm-daftar">
            {dibahas.map((p) => (
              <li key={p.id} className="pl-calon">
                <div className="pm-grow pm-tumpuk-besar" style={{ gap: 6 }}>
                  <div>
                    <Link className="pm-tebal" to={`/tim/antrean/${kelompokDari(p.status)}/${p.id}`}>{nama(p.id)}</Link>
                    <div className="pm-kecil">{p.nomor_pendaftaran} · {JENIS_RPL[p.jenis_rpl]?.label} · {ringkas(p)}</div>
                  </div>
                  {bolehCatat || kepPengajuan(p.id) ? (
                    <div className="pm-baris-aksi">
                      <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Catatan keputusan pleno untuk pengajuan ini (opsional)" value={kepPengajuan(p.id)} disabled={!bolehCatat}
                        onChange={(e) => setKeputusan((s) => ({ ...s, [p.id]: e.target.value }))} aria-label="Catatan keputusan" />
                      {bolehCatat && p.id in keputusan ? <Tombol ikon={Save} sibuk={sibuk === `kp-${p.id}`} onClick={() => simpanKeputusan(p.id)}>Simpan</Tombol> : null}
                    </div>
                  ) : null}
                </div>
                {bolehCatat ? <button type="button" className="btn btn-ghost btn-sm" disabled={sibuk === `pg-${p.id}`} onClick={() => buangPengajuan(p.id)}>Keluarkan</button> : null}
              </li>
            ))}
          </ul>
        ) : <p className="pm-kosong">Belum ada pengajuan yang dibahas.</p>}
      </Kartu>

      {bolehCatat ? (
        <Kartu judul="Tambahkan pengajuan" sub={`Pengajuan berstatus "${pleno.jenis === 'awal' ? 'Pleno awal' : 'Pleno hasil'}" dari program studi ini yang belum masuk pleno lain.`} padat>
          {calon.length ? (
            <ul className="tm-daftar">
              {calon.map((p) => (
                <li key={p.id} className="tm-baris">
                  <span className="pm-grow"><span className="pm-tebal">{nama(p.id)}</span><span className="pm-kecil"> · {p.nomor_pendaftaran} · {ringkas(p)}</span></span>
                  <Tombol ikon={Plus} sibuk={sibuk === `pg-${p.id}`} onClick={() => tambahPengajuan(p)}>Tambahkan</Tombol>
                </li>
              ))}
            </ul>
          ) : <p className="pm-kosong">Tidak ada pengajuan lain yang menunggu pleno ini.</p>}
        </Kartu>
      ) : null}

      {draf ? (
        <BarTahap info={kurang.length ? `Lengkapi ${kurang.join(', ')} sebelum penetapan` : bolehTetapkan ? 'Siap ditetapkan' : 'Menunggu penetapan Ketua Tim Pengelola RPL'}>
          {bolehTetapkan ? <Tombol jenis="primary" ikon={Gavel} disabled={!!kurang.length} onClick={() => setTetapkan(true)}>Tetapkan hasil pleno</Tombol> : null}
        </BarTahap>
      ) : null}

      <Dialog buka={tetapkan} judul="Tetapkan hasil pleno" onTutup={() => setTetapkan(false)} lebar={560}
        kaki={<><Tombol onClick={() => setTetapkan(false)}>Batal</Tombol><Tombol jenis="primary" ikon={Gavel} sibuk={sibuk === 'tetapkan'} onClick={jalankanTetapkan}>Tetapkan</Tombol></>}>
        <p>{dibahas.length} pengajuan akan {pleno.jenis === 'awal' ? 'masuk tahap penilaian lanjutan. Sekretariat kemudian menjadwalkan wawancara.' : 'berstatus "Hasil menunggu tanggapan". Pemohon dapat melihat hasil rekognisi dan menyetujui atau mengajukan sanggahan.'}</p>
        <Pemberitahuan jenis="amber">Pleno yang sudah ditetapkan tidak dapat diubah.</Pemberitahuan>
      </Dialog>
      <Dialog buka={hapus} judul="Hapus pleno" onTutup={() => setHapus(false)}
        kaki={<><Tombol onClick={() => setHapus(false)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk === 'hapus'} onClick={jalankanHapus}>Hapus</Tombol></>}>
        <p>Pleno draf ini beserta daftar pesertanya akan dihapus.</p>
      </Dialog>
    </Halaman>
  )
}
