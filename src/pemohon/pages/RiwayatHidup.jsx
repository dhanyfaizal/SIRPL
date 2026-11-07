import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Printer, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { KATEGORI_RIWAYAT } from '../konstanta'
import { Bidang, BukaBerkas, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, PilihBerkas, Tombol } from '../ui'

function KartuPekerjaan() {
  const { data, userId, bisaDiubah, ubah } = usePemohon()
  const r = data.riwayat || {}
  const [f, setF] = useState({
    institusi_kerja: r.institusi_kerja || '', jabatan: r.jabatan || '', status_pekerjaan: r.status_pekerjaan || '',
    status_pekerjaan_lainnya: r.status_pekerjaan_lainnya || '', alamat_kerja: r.alamat_kerja || '', telepon_kerja: r.telepon_kerja || '',
  })
  const [sibuk, setSibuk] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const simpan = async () => {
    setSibuk(true)
    try {
      const hasil = await api.simpanRiwayat(userId, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null])))
      ubah(() => ({ riwayat: hasil }))
      toast.success('Data pekerjaan disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const ro = !bisaDiubah
  return (
    <Kartu judul="Identitas dan pekerjaan saat ini"
      kaki={bisaDiubah ? <div className="pm-kaki-aksi"><span /><Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan</Tombol></div> : null}>
      <div className="pm-form-2">
        <Bidang label="Status pekerjaan" wajib>
          <select className="input" value={f.status_pekerjaan} onChange={set('status_pekerjaan')} disabled={ro}>
            <option value="">Pilih</option>
            <option value="pegawai_tetap">Pegawai tetap</option>
            <option value="pegawai_honorer">Pegawai honorer</option>
            <option value="pns">Pegawai negeri sipil</option>
            <option value="lainnya">Lainnya</option>
            <option value="tidak_bekerja">Tidak bekerja</option>
          </select>
        </Bidang>
        {f.status_pekerjaan === 'lainnya'
          ? <Bidang label="Sebutkan"><input className="input" value={f.status_pekerjaan_lainnya} onChange={set('status_pekerjaan_lainnya')} readOnly={ro} /></Bidang>
          : <div />}
        {f.status_pekerjaan !== 'tidak_bekerja' ? <>
          <Bidang label="Institusi tempat bekerja"><input className="input" value={f.institusi_kerja} onChange={set('institusi_kerja')} readOnly={ro} /></Bidang>
          <Bidang label="Jabatan"><input className="input" value={f.jabatan} onChange={set('jabatan')} readOnly={ro} /></Bidang>
          <Bidang label="Alamat tempat bekerja"><input className="input" value={f.alamat_kerja} onChange={set('alamat_kerja')} readOnly={ro} /></Bidang>
          <Bidang label="Telepon / faks kantor"><input className="input" value={f.telepon_kerja} onChange={set('telepon_kerja')} readOnly={ro} /></Bidang>
        </> : null}
      </div>
    </Kartu>
  )
}

function barisKosong(kolom) { return Object.fromEntries(kolom.map((k) => [k, ''])) }

function KartuKategori({ kat }) {
  const { data, userId, bisaDiubah, ubah } = usePemohon()
  const awal = data.butirRiwayat.filter((b) => b.kategori === kat.v)
  const [baris, setBaris] = useState(() => awal.length ? awal.map((b) => ({ ...barisKosong(kat.kolom), ...Object.fromEntries(kat.kolom.map((k) => [k, b[k] ?? ''])) })) : [])
  const [sibuk, setSibuk] = useState(false)
  const [kotor, setKotor] = useState(false)

  const ubahSel = (i, k, v) => { setKotor(true); setBaris((s) => s.map((b, j) => (j === i ? { ...b, [k]: v } : b))) }
  const simpan = async () => {
    setSibuk(true)
    try {
      const hasil = await api.simpanButirRiwayat(userId, kat.v, baris)
      ubah((d) => ({ butirRiwayat: [...d.butirRiwayat.filter((b) => b.kategori !== kat.v), ...hasil] }))
      setKotor(false)
      toast.success(`${kat.l} disimpan`)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  const tipe = (k) => (k === 'mulai' || k === 'selesai' ? 'date' : k === 'tahun' ? 'number' : 'text')
  return (
    <Kartu judul={kat.l} padat
      aksi={bisaDiubah ? <Tombol ikon={Plus} onClick={() => { setKotor(true); setBaris((s) => [...s, barisKosong(kat.kolom)]) }}>Tambah baris</Tombol> : null}
      kaki={bisaDiubah && kotor ? <div className="pm-kaki-aksi"><span>Ada perubahan yang belum disimpan.</span>
        <Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan</Tombol></div> : null}>
      {baris.length ? (
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-isian">
            <thead><tr>{kat.kolom.map((k) => <th key={k}>{kat.label[k]}</th>)}{bisaDiubah ? <th style={{ width: 48 }}><span className="pm-sr">Hapus</span></th> : null}</tr></thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i}>
                  {kat.kolom.map((k) => (
                    <td key={k}>
                      {k === 'uraian'
                        ? <textarea className="input" rows={2} value={b[k]} readOnly={!bisaDiubah} aria-label={kat.label[k]} onChange={(e) => ubahSel(i, k, e.target.value)} />
                        : <input className="input" type={tipe(k)} value={b[k]} readOnly={!bisaDiubah} aria-label={kat.label[k]}
                            style={k === 'tahun' ? { width: 96 } : undefined} onChange={(e) => ubahSel(i, k, e.target.value)} />}
                    </td>
                  ))}
                  {bisaDiubah ? <td><button type="button" className="btn btn-ghost btn-icon" aria-label="Hapus baris"
                    onClick={() => { setKotor(true); setBaris((s) => s.filter((_, j) => j !== i)) }}><Trash2 size={14} /></button></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="pm-kosong">Belum ada data.</p>}
    </Kartu>
  )
}

function KartuTtdAtasan() {
  const { data, pengajuan, userId, bisaDiubah, ubah } = usePemohon()
  const [sibuk, setSibuk] = useState(false)
  if (data.riwayat?.status_pekerjaan !== 'pegawai_tetap') return null
  const unggah = async (file) => {
    setSibuk(true)
    try {
      const path = await api.unggahBerkas(userId, pengajuan.id, file, 'f07_ttd_atasan')
      const p = await api.ubahPengajuan(pengajuan.id, { file_f07_ttd_url: path })
      ubah(() => ({ pengajuan: p }))
      toast.success('F07 bertanda tangan atasan diunggah')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  return (
    <Kartu judul="Tanda tangan atasan langsung" sub="Wajib untuk pegawai tetap">
      <ol className="pm-daftar-bernomor">
        <li>Cetak F07 dari tombol <b>Cetak F07</b> di atas setelah semua data tersimpan.</li>
        <li>Tandatangani bersama atasan langsung pada bagian "Mengetahui".</li>
        <li>Pindai dan unggah kembali di sini.</li>
      </ol>
      <div className="pm-baris-aksi">
        {pengajuan.file_f07_ttd_url ? <Lencana warna="green">Sudah diunggah</Lencana> : <Lencana warna="amber">Belum diunggah</Lencana>}
        <BukaBerkas path={pengajuan.file_f07_ttd_url} />
        {bisaDiubah ? <PilihBerkas label={pengajuan.file_f07_ttd_url ? 'Ganti berkas' : 'Unggah F07'} sibuk={sibuk} onPilih={unggah} /> : null}
      </div>
    </Kartu>
  )
}

export default function RiwayatHidup() {
  const { siap, pengajuan, bisaDiubah } = usePemohon()
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />
  return (
    <Halaman judul="Daftar Riwayat Hidup (F07)" sub="Langkah 2. Tulis riwayat dari yang paling akhir (terkini). Simpan setiap bagian setelah diisi."
      aksi={<a className="btn btn-secondary" href="/pemohon/cetak/f07" target="_blank" rel="noreferrer"><Printer size={14} /> Cetak F07</a>}>
      {!bisaDiubah ? <Pemberitahuan>Pengajuan sudah dikirim, data hanya dapat dilihat.</Pemberitahuan> : null}
      <KartuPekerjaan />
      {KATEGORI_RIWAYAT.map((k) => <KartuKategori key={k.v} kat={k} />)}
      <KartuTtdAtasan />
    </Halaman>
  )
}
