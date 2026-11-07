import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { JENIS_RPL, STATUS_PDDIKTI } from '../konstanta'
import { Bidang, BukaBerkas, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, PilihBerkas, Segmen, Tombol } from '../ui'
import { Navigate } from 'react-router-dom'

function KartuProdi() {
  const { data, pengajuan, bisaDiubah, muat } = usePemohon()
  const [prodi, setProdi] = useState(pengajuan.prodi_pilihan_id || '')
  const [jenis, setJenis] = useState(pengajuan.jenis_rpl || '')
  const [sibuk, setSibuk] = useState(false)
  const berubah = prodi !== pengajuan.prodi_pilihan_id || jenis !== pengajuan.jenis_rpl
  const p = data.prodi.find((x) => x.id === prodi)

  const simpan = async () => {
    setSibuk(true)
    try {
      // Mengganti prodi atau jenis RPL menghapus pilihan MK yang tidak lagi sesuai.
      if (prodi !== pengajuan.prodi_pilihan_id) await api.simpanMkDiajukan(pengajuan.id, {})
      else if (jenis !== 'gabungan') {
        const sisa = Object.fromEntries(data.mkDiajukan.filter((m) => m.mekanisme === jenis).map((m) => [m.mk_id, m.mekanisme]))
        await api.simpanMkDiajukan(pengajuan.id, sisa)
      }
      await api.ubahPengajuan(pengajuan.id, { prodi_pilihan_id: prodi, jenis_rpl: jenis })
      await muat()
      toast.success('Program studi dan jenis RPL disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Kartu judul="Program studi dan jenis RPL"
      kaki={bisaDiubah ? <div className="pm-kaki-aksi"><span>Mengganti program studi akan mengosongkan daftar mata kuliah yang diajukan.</span>
        <Tombol jenis="primary" ikon={Save} sibuk={sibuk} disabled={!berubah || !prodi || !jenis} onClick={simpan}>Simpan</Tombol></div> : null}>
      <div className="pm-form-2">
        <Bidang label="Program studi tujuan" wajib>
          <select className="input" value={prodi} disabled={!bisaDiubah} onChange={(e) => setProdi(e.target.value)}>
            {data.prodi.filter((x) => x.is_penyelenggara_rpl || x.id === prodi).map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
          </select>
        </Bidang>
        <Bidang label="Akreditasi program studi">
          <input className="input" value={p?.akreditasi || '-'} readOnly />
        </Bidang>
      </div>
      <fieldset className="pm-fieldset" style={{ marginTop: 16 }}>
        <legend className="input-label">Jenis RPL</legend>
        <div className="pm-grid-3">
          {Object.entries(JENIS_RPL).map(([v, j]) => {
            const terkunci = (v !== 'transfer' && p && !p.menerima_perolehan_kredit) || (v !== 'perolehan' && p && !p.menerima_transfer_kredit)
            return (
              <label key={v} className={`pm-choice${jenis === v ? ' is-on' : ''}${terkunci ? ' is-off' : ''}`}>
                <input type="radio" name="jenis" value={v} checked={jenis === v} disabled={!bisaDiubah || terkunci} onChange={() => setJenis(v)} />
                <span><span className="pm-choice-judul">{j.label}</span><span className="pm-choice-sub">{j.ket}</span></span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </Kartu>
  )
}

function KartuBiodata() {
  const { data, userId, bisaDiubah, ubah } = usePemohon()
  const { profile } = useAuth()
  const awal = data.biodata || {}
  const [f, setF] = useState(() => ({
    tempat_lahir: awal.tempat_lahir || '', tanggal_lahir: awal.tanggal_lahir || '', jenis_kelamin: awal.jenis_kelamin || '',
    status_perkawinan: awal.status_perkawinan || '', agama: awal.agama || '', kebangsaan: awal.kebangsaan || 'Indonesia',
    alamat: awal.alamat || '', kode_pos: awal.kode_pos || '', telepon_rumah: awal.telepon_rumah || '', telepon_kantor: awal.telepon_kantor || '',
    pendidikan_terakhir: awal.pendidikan_terakhir || '', nama_sekolah_pt: awal.nama_sekolah_pt || '',
    prodi_pendidikan_terakhir: awal.prodi_pendidikan_terakhir || '', tahun_lulus: awal.tahun_lulus || '',
  }))
  const [sibuk, setSibuk] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const simpan = async () => {
    setSibuk(true)
    try {
      const isi = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' ? null : v]))
      if (isi.tahun_lulus) isi.tahun_lulus = Number(isi.tahun_lulus)
      const hasil = await api.simpanBiodata(userId, isi)
      ubah(() => ({ biodata: hasil }))
      toast.success('Data pribadi disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  const ro = !bisaDiubah
  return (
    <Kartu judul="Data pribadi" sub="Formulir Aplikasi (F02) bagian 1"
      kaki={bisaDiubah ? <div className="pm-kaki-aksi"><span>Nama, email, dan nomor HP diubah di menu Profil.</span>
        <Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan data pribadi</Tombol></div> : null}>
      <div className="pm-form-2">
        <Bidang label="Nama lengkap"><input className="input" value={profile?.nama_lengkap || ''} readOnly /></Bidang>
        <Bidang label="Email dan HP"><input className="input" value={[profile?.email, profile?.no_whatsapp].filter(Boolean).join(' · ')} readOnly /></Bidang>
        <Bidang label="Tempat lahir" wajib><input className="input" value={f.tempat_lahir} onChange={set('tempat_lahir')} readOnly={ro} /></Bidang>
        <Bidang label="Tanggal lahir" wajib><input className="input" type="date" value={f.tanggal_lahir} onChange={set('tanggal_lahir')} readOnly={ro} /></Bidang>
        <Bidang label="Jenis kelamin">
          <select className="input" value={f.jenis_kelamin} onChange={set('jenis_kelamin')} disabled={ro}>
            <option value="">Pilih</option><option value="pria">Pria</option><option value="wanita">Wanita</option>
          </select>
        </Bidang>
        <Bidang label="Status perkawinan">
          <select className="input" value={f.status_perkawinan} onChange={set('status_perkawinan')} disabled={ro}>
            <option value="">Pilih</option><option value="lajang">Lajang</option><option value="menikah">Menikah</option><option value="pernah_menikah">Pernah menikah</option>
          </select>
        </Bidang>
        <Bidang label="Agama"><input className="input" value={f.agama} onChange={set('agama')} readOnly={ro} /></Bidang>
        <Bidang label="Kebangsaan"><input className="input" value={f.kebangsaan} onChange={set('kebangsaan')} readOnly={ro} /></Bidang>
        <Bidang label="Alamat rumah" wajib lebar><textarea className="input" rows={2} value={f.alamat} onChange={set('alamat')} readOnly={ro} /></Bidang>
        <Bidang label="Kode pos"><input className="input" inputMode="numeric" value={f.kode_pos} onChange={set('kode_pos')} readOnly={ro} /></Bidang>
        <Bidang label="Telepon rumah"><input className="input" value={f.telepon_rumah} onChange={set('telepon_rumah')} readOnly={ro} /></Bidang>
        <Bidang label="Telepon kantor"><input className="input" value={f.telepon_kantor} onChange={set('telepon_kantor')} readOnly={ro} /></Bidang>
      </div>
      <h3 className="pm-subjudul">Pendidikan terakhir</h3>
      <div className="pm-form-2">
        <Bidang label="Jenjang pendidikan terakhir">
          <select className="input" value={f.pendidikan_terakhir} onChange={set('pendidikan_terakhir')} disabled={ro}>
            <option value="">Pilih</option>
            {['SMA', 'SMK', 'MA', 'Paket C', 'D1', 'D2', 'D3', 'D4', 'S1'].map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </Bidang>
        <Bidang label="Nama sekolah / perguruan tinggi"><input className="input" value={f.nama_sekolah_pt} onChange={set('nama_sekolah_pt')} readOnly={ro} /></Bidang>
        <Bidang label="Program studi" hint="Kosongkan untuk lulusan SMA atau sederajat"><input className="input" value={f.prodi_pendidikan_terakhir} onChange={set('prodi_pendidikan_terakhir')} readOnly={ro} /></Bidang>
        <Bidang label="Tahun lulus"><input className="input" inputMode="numeric" value={f.tahun_lulus} onChange={set('tahun_lulus')} readOnly={ro} /></Bidang>
      </div>
    </Kartu>
  )
}

function KartuPtAsal() {
  const { pengajuan, bisaDiubah, ubah } = usePemohon()
  const [f, setF] = useState({
    pt_asal: pengajuan.pt_asal || '', prodi_asal: pengajuan.prodi_asal || '',
    status_pddikti_asal: pengajuan.status_pddikti_asal || '', tanggal_mengundurkan_diri: pengajuan.tanggal_mengundurkan_diri || '',
    pt_asal_stikom: !!pengajuan.pt_asal_stikom,
  })
  const [sibuk, setSibuk] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const perluTanggal = ['mengundurkan_diri', 'putus_studi', 'dikeluarkan'].includes(f.status_pddikti_asal)
  const ditolak = f.pt_asal_stikom && ['putus_studi', 'dikeluarkan'].includes(f.status_pddikti_asal)

  const simpan = async () => {
    setSibuk(true)
    try {
      const isi = { ...f, status_pddikti_asal: f.status_pddikti_asal || null, tanggal_mengundurkan_diri: perluTanggal ? (f.tanggal_mengundurkan_diri || null) : null,
        pt_asal: f.pt_asal || null, prodi_asal: f.prodi_asal || null }
      const p = await api.ubahPengajuan(pengajuan.id, isi)
      ubah(() => ({ pengajuan: p }))
      toast.success('Data perguruan tinggi asal disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Kartu judul="Perguruan tinggi asal" sub="Wajib untuk transfer kredit. Status keluar diperiksa sesuai data PDDikti (Juknis Bab II.A)."
      kaki={bisaDiubah ? <div className="pm-kaki-aksi"><span />
        <Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan</Tombol></div> : null}>
      <div className="pm-form-2">
        <Bidang label="Nama perguruan tinggi asal"><input className="input" value={f.pt_asal} onChange={set('pt_asal')} readOnly={!bisaDiubah} /></Bidang>
        <Bidang label="Program studi asal"><input className="input" value={f.prodi_asal} onChange={set('prodi_asal')} readOnly={!bisaDiubah} /></Bidang>
        <Bidang label="Status di PDDikti">
          <select className="input" value={f.status_pddikti_asal} onChange={set('status_pddikti_asal')} disabled={!bisaDiubah}>
            <option value="">Pilih status</option>
            {Object.entries(STATUS_PDDIKTI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Bidang>
        {perluTanggal ? (
          <Bidang label="Tanggal SK keluar / pengunduran diri">
            <input className="input" type="date" value={f.tanggal_mengundurkan_diri} onChange={set('tanggal_mengundurkan_diri')} readOnly={!bisaDiubah} />
          </Bidang>
        ) : <div />}
        <label className="pm-centang" style={{ gridColumn: '1 / -1' }}>
          <input type="checkbox" checked={f.pt_asal_stikom} onChange={set('pt_asal_stikom')} disabled={!bisaDiubah} />
          Perguruan tinggi asal saya adalah STIKOM Yos Sudarso
        </label>
      </div>
      {ditolak ? (
        <div style={{ marginTop: 12 }}>
          <Pemberitahuan jenis="red" judul="Tidak dapat melanjutkan di STIKOM Yos Sudarso">
            Pendaftar yang putus studi atau dikeluarkan hanya dapat melanjutkan melalui RPL di perguruan tinggi lain.
          </Pemberitahuan>
        </div>
      ) : null}
      {f.pt_asal_stikom && f.status_pddikti_asal === 'mengundurkan_diri' ? (
        <div style={{ marginTop: 12 }}>
          <Pemberitahuan jenis="amber">Pendaftar yang mengundurkan diri dapat kembali paling cepat 1 tahun akademik setelah SK pengunduran diri.</Pemberitahuan>
        </div>
      ) : null}
    </Kartu>
  )
}

const BERKAS = [
  { kolom: 'file_ijazah_sma_url', label: 'Ijazah SMA/SMK/MA atau sederajat', wajibUntuk: ['perolehan', 'gabungan'] },
  { kolom: 'file_transkrip_sma_url', label: 'Transkrip nilai SLTA', wajibUntuk: [] },
  { kolom: 'file_ijazah_url', label: 'Ijazah perguruan tinggi asal', wajibUntuk: [] },
  { kolom: 'file_transkrip_url', label: 'Transkrip nilai perguruan tinggi asal', wajibUntuk: ['transfer', 'gabungan'] },
]

function KartuBerkas() {
  const { pengajuan, userId, bisaDiubah, ubah } = usePemohon()
  const [sibuk, setSibuk] = useState(null)
  const unggah = async (kolom, file) => {
    setSibuk(kolom)
    try {
      const path = await api.unggahBerkas(userId, pengajuan.id, file, kolom.replace(/^file_|_url$/g, ''))
      const p = await api.ubahPengajuan(pengajuan.id, { [kolom]: path })
      ubah(() => ({ pengajuan: p }))
      toast.success('Berkas diunggah')
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  return (
    <Kartu judul="Berkas wajib" sub="PDF, JPG, atau PNG, maksimal 10 MB per berkas." padat>
      <ul className="pm-checklist">
        {BERKAS.map((b) => {
          const wajib = b.wajibUntuk.includes(pengajuan.jenis_rpl)
          const ada = !!pengajuan[b.kolom]
          return (
            <li key={b.kolom}>
              <span className="pm-grow">
                <span className="pm-tebal">{b.label}</span>
                {wajib ? <span className="pm-kecil"> · wajib</span> : <span className="pm-kecil"> · bila ada</span>}
              </span>
              {ada ? <Lencana warna="green">Terunggah</Lencana> : wajib ? <Lencana warna="amber">Belum ada</Lencana> : null}
              <BukaBerkas path={pengajuan[b.kolom]} />
              {bisaDiubah ? <PilihBerkas label={ada ? 'Ganti' : 'Unggah'} sibuk={sibuk === b.kolom} onPilih={(f) => unggah(b.kolom, f)} /> : null}
            </li>
          )
        })}
      </ul>
    </Kartu>
  )
}

function KartuMataKuliah() {
  const { data, pengajuan, bisaDiubah, muatDetail } = usePemohon()
  const awal = useMemo(() => Object.fromEntries(data.mkDiajukan.map((m) => [m.mk_id, m.mekanisme])), [data.mkDiajukan])
  const [pilih, setPilih] = useState(awal)
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => { setPilih(awal) }, [awal])

  const opsi = [{ v: '', l: 'Tidak' }]
  if (['transfer', 'gabungan'].includes(pengajuan.jenis_rpl)) opsi.push({ v: 'transfer', l: 'Transfer' })
  if (['perolehan', 'gabungan'].includes(pengajuan.jenis_rpl)) opsi.push({ v: 'perolehan', l: 'Perolehan' })

  const total = Object.entries(pilih).filter(([, m]) => m).reduce((n, [id]) => n + (data.mataKuliah.find((k) => k.id === id)?.sks || 0), 0)
  const batas = data.batasSks
  const berubah = JSON.stringify(Object.entries(pilih).filter(([, m]) => m).sort()) !== JSON.stringify(Object.entries(awal).sort())

  const simpan = async () => {
    setSibuk(true)
    try {
      await api.simpanMkDiajukan(pengajuan.id, pilih)
      await muatDetail()
      toast.success('Daftar mata kuliah disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  if (!pengajuan.jenis_rpl) return null
  return (
    <Kartu judul="Mata kuliah yang diajukan" sub="Formulir Aplikasi (F02) bagian 2"
      aksi={<span className={`pm-kecil${batas && total > batas ? ' pm-merah' : ''}`}>{total} SKS diajukan{batas ? ` · batas pengakuan ${batas} SKS` : ''}</span>}
      padat
      kaki={bisaDiubah ? <div className="pm-kaki-aksi"><span>Mata kuliah tugas akhir dan rangkaiannya tidak dapat diajukan.</span>
        <Tombol jenis="primary" ikon={Save} sibuk={sibuk} disabled={!berubah} onClick={simpan}>Simpan daftar mata kuliah</Tombol></div> : null}>
      {batas && total > batas ? (
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Pemberitahuan jenis="amber">SKS yang diajukan melebihi batas pengakuan. Pengajuan tetap boleh, tetapi yang dapat diakui paling banyak {batas} SKS.</Pemberitahuan>
        </div>
      ) : null}
      <div className="table-wrap">
        <table className="pm-tabel">
          <thead><tr><th style={{ width: 70 }}>Smt</th><th style={{ width: 110 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 60 }}>SKS</th><th style={{ width: 260 }}>Diajukan melalui</th></tr></thead>
          <tbody>
            {data.mataKuliah.map((mk) => {
              const tertutup = mk.is_tugas_akhir || mk.rangkaian_ta || mk.dapat_rpl === false
              return (
                <tr key={mk.id} className={tertutup ? 'pm-redup' : ''}>
                  <td>{mk.semester}</td>
                  <td className="pm-kecil">{mk.kode_mk}</td>
                  <td>{mk.nama_mk}{tertutup ? <span className="pm-kecil"> · tidak dibuka untuk RPL</span> : null}</td>
                  <td>{mk.sks}</td>
                  <td>{tertutup ? <span className="pm-kecil">-</span> : (
                    <Segmen label={`Mekanisme ${mk.nama_mk}`} pilihan={opsi} nilai={pilih[mk.id] || ''} nonaktif={!bisaDiubah}
                      onUbah={(v) => setPilih((s) => ({ ...s, [mk.id]: v }))} />
                  )}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Kartu>
  )
}

export default function Persyaratan() {
  const { siap, pengajuan, bisaDiubah } = usePemohon()
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />
  const transfer = ['transfer', 'gabungan'].includes(pengajuan.jenis_rpl)
  return (
    <Halaman judul="Data dan persyaratan" sub="Langkah 1. Data ini dipakai Sekretariat untuk memeriksa persyaratan sesuai Juknis RPL Tipe A.">
      {!bisaDiubah ? <Pemberitahuan>Pengajuan sudah dikirim, data hanya dapat dilihat.</Pemberitahuan> : null}
      <KartuProdi key={`prodi-${pengajuan.prodi_pilihan_id}-${pengajuan.jenis_rpl}`} />
      <KartuBiodata />
      {transfer ? <KartuPtAsal /> : null}
      <KartuBerkas />
      <KartuMataKuliah />
    </Halaman>
  )
}
