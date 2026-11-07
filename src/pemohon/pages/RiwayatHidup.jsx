import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Plus, Printer, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { KATEGORI_RIWAYAT } from '../konstanta'
import { hitungKelengkapan } from '../kelengkapan'
import {
  BarTahap, Bidang, BukaBerkas, GerbangTahap, Halaman, InputAngka, Kartu, Kerangka, Lencana, LencanaModeBaca, Pemberitahuan,
  PenyediaSimpan, PilihBerkas, PilihTahun, TombolLanjut, useDaftarSimpan, useRegistriSimpan,
} from '../ui'

function KartuPekerjaan({ ro, statusRef }) {
  const { data, userId, ubah } = usePemohon()
  const r = data.riwayat || {}
  const awal = {
    institusi_kerja: r.institusi_kerja || '', jabatan: r.jabatan || '', status_pekerjaan: r.status_pekerjaan || '',
    status_pekerjaan_lainnya: r.status_pekerjaan_lainnya || '', alamat_kerja: r.alamat_kerja || '', telepon_kerja: r.telepon_kerja || '',
  }
  const [f, setF] = useState(awal)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v && v.target ? v.target.value : v }))

  useDaftarSimpan('pekerjaan', async () => {
    if (!f.status_pekerjaan) throw new Error('Pilih status pekerjaan')
    if (!data.riwayat || JSON.stringify(f) !== JSON.stringify(awal)) {
      const hasil = await api.simpanRiwayat(userId, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null])))
      ubah(() => ({ riwayat: hasil }))
    }
    statusRef.current = f.status_pekerjaan
  })

  const bekerja = f.status_pekerjaan && f.status_pekerjaan !== 'tidak_bekerja'
  return (
    <Kartu judul="Identitas dan pekerjaan saat ini">
      <div className="pm-form-2">
        <Bidang label="Status pekerjaan" wajib>
          <select className="input" value={f.status_pekerjaan} onChange={set('status_pekerjaan')} disabled={ro}>
            <option value="">Pilih status</option>
            <option value="pegawai_tetap">Pegawai tetap</option>
            <option value="pegawai_honorer">Pegawai honorer</option>
            <option value="pns">Pegawai negeri sipil</option>
            <option value="lainnya">Lainnya</option>
            <option value="tidak_bekerja">Tidak bekerja</option>
          </select>
        </Bidang>
        {f.status_pekerjaan === 'lainnya'
          ? <Bidang label="Sebutkan"><input className="input" value={f.status_pekerjaan_lainnya} onChange={set('status_pekerjaan_lainnya')} readOnly={ro} /></Bidang>
          : <div className="pm-hide-kecil" />}
        {bekerja ? <>
          <Bidang label="Institusi tempat bekerja"><input className="input" value={f.institusi_kerja} onChange={set('institusi_kerja')} readOnly={ro} /></Bidang>
          <Bidang label="Jabatan"><input className="input" value={f.jabatan} onChange={set('jabatan')} readOnly={ro} /></Bidang>
          <Bidang label="Alamat tempat bekerja"><input className="input" value={f.alamat_kerja} onChange={set('alamat_kerja')} readOnly={ro} /></Bidang>
          <Bidang label="Telepon kantor"><InputAngka nilai={f.telepon_kerja} onUbah={set('telepon_kerja')} panjang={15} nonaktif={ro} /></Bidang>
        </> : null}
      </div>
    </Kartu>
  )
}

const barisKosong = (kolom) => Object.fromEntries(kolom.map((k) => [k, '']))

function KartuKategori({ kat, ro }) {
  const { data, userId, ubah } = usePemohon()
  const awal = data.butirRiwayat.filter((b) => b.kategori === kat.v)
  const [baris, setBaris] = useState(() => awal.map((b) => Object.fromEntries(kat.kolom.map((k) => [k, b[k] == null ? '' : String(b[k])]))))
  const [kotor, setKotor] = useState(false)

  useDaftarSimpan(`kat-${kat.v}`, async () => {
    if (!kotor) return
    const hasil = await api.simpanButirRiwayat(userId, kat.v, baris)
    ubah((d) => ({ butirRiwayat: [...d.butirRiwayat.filter((b) => b.kategori !== kat.v), ...hasil] }))
    setKotor(false)
  })

  const ubahSel = (i, k, v) => { setKotor(true); setBaris((s) => s.map((b, j) => (j === i ? { ...b, [k]: v } : b))) }
  const sel = (b, i, k) => {
    if (k === 'tahun') return <PilihTahun nilai={b[k]} onUbah={(v) => ubahSel(i, k, v)} nonaktif={ro} label={kat.label[k]} kosong="Tahun" />
    if (k === 'uraian') return <textarea className="input" rows={2} value={b[k]} readOnly={ro} aria-label={kat.label[k]} onChange={(e) => ubahSel(i, k, e.target.value)} />
    const tipe = k === 'mulai' || k === 'selesai' ? 'date' : 'text'
    return <input className="input" type={tipe} value={b[k]} readOnly={ro} aria-label={kat.label[k]} onChange={(e) => ubahSel(i, k, e.target.value)} />
  }

  return (
    <Kartu judul={kat.l} padat sub={kotor ? 'Ada perubahan, tersimpan saat Anda menekan "Simpan dan lanjutkan"' : null}
      aksi={!ro ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setKotor(true); setBaris((s) => [...s, barisKosong(kat.kolom)]) }}><Plus size={14} /> Tambah baris</button> : null}>
      {baris.length ? (
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-isian pm-tabel-responsif">
            <thead><tr>{kat.kolom.map((k) => <th key={k}>{kat.label[k]}</th>)}{!ro ? <th style={{ width: 48 }}><span className="pm-sr">Hapus</span></th> : null}</tr></thead>
            <tbody>
              {baris.map((b, i) => (
                <tr key={i}>
                  {kat.kolom.map((k) => <td key={k} data-label={kat.label[k]} style={k === 'tahun' ? { width: 120 } : undefined}>{sel(b, i, k)}</td>)}
                  {!ro ? <td data-label=""><button type="button" className="btn btn-ghost btn-icon" aria-label="Hapus baris"
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

function KartuTtdAtasan({ ro }) {
  const { data, pengajuan, userId, ubah } = usePemohon()
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
        <li>Simpan semua data, lalu cetak F07 dari tombol <b>Cetak F07</b> di atas.</li>
        <li>Tandatangani bersama atasan langsung pada bagian "Mengetahui".</li>
        <li>Pindai dan unggah kembali di sini.</li>
      </ol>
      <div className="pm-baris-aksi" style={{ marginTop: 12 }}>
        {pengajuan.file_f07_ttd_url ? <Lencana warna="green">Sudah diunggah</Lencana> : <Lencana warna="amber">Belum diunggah</Lencana>}
        <BukaBerkas path={pengajuan.file_f07_ttd_url} />
        {!ro ? <PilihBerkas label={pengajuan.file_f07_ttd_url ? 'Ganti berkas' : 'Unggah F07'} sibuk={sibuk} onPilih={unggah} /> : null}
      </div>
    </Kartu>
  )
}

export default function RiwayatHidup() {
  const { siap, data, pengajuan, bisaDiubah } = usePemohon()
  const navigate = useNavigate()
  const registri = useRegistriSimpan()
  const statusRef = useRef(null)
  const [sibuk, setSibuk] = useState(false)
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  const k = hitungKelengkapan(data)
  const tahap = k.tahap('f07')
  const ro = !bisaDiubah || !tahap.terbuka

  const lanjut = async () => {
    setSibuk(true)
    try {
      await registri.jalankan()
      if (statusRef.current === 'pegawai_tetap' && !pengajuan.file_f07_ttd_url) {
        toast.success('Data riwayat hidup disimpan')
        toast.error('Untuk melanjutkan, unggah F07 yang sudah ditandatangani atasan (kartu paling bawah).', { duration: 6000 })
        return
      }
      toast.success('Riwayat hidup disimpan')
      navigate(k.sesudah('f07').to)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Daftar Riwayat Hidup (F07)" sub="Tahap 2. Tulis riwayat dari yang paling akhir (terkini)."
      aksi={<div className="pm-baris-aksi">{ro ? <LencanaModeBaca /> : null}
        <a className="btn btn-secondary" href="/pemohon/cetak/f07" target="_blank" rel="noreferrer"><Printer size={14} /> Cetak F07</a></div>}>
      {!bisaDiubah ? <Pemberitahuan>Pengajuan sudah dikirim, data hanya dapat dilihat.</Pemberitahuan> : null}
      <GerbangTahap tahap={tahap} sebelum={k.sebelumBelum('f07')}>
        <PenyediaSimpan value={registri}>
          <KartuPekerjaan ro={ro} statusRef={statusRef} />
          {KATEGORI_RIWAYAT.map((x) => <KartuKategori key={x.v} kat={x} ro={ro} />)}
          <KartuTtdAtasan ro={ro} />
        </PenyediaSimpan>
      </GerbangTahap>
      {bisaDiubah ? (
        <BarTahap info={<>Tahap 2 dari {k.langkah.length}: <b>Riwayat hidup (F07)</b></>}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/pemohon/pengajuan/data')}>Kembali</button>
          <TombolLanjut sibuk={sibuk} disabled={!tahap.terbuka} onClick={lanjut} />
        </BarTahap>
      ) : null}
    </Halaman>
  )
}
