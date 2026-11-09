import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Lock, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { JENIS_RPL, STATUS_PDDIKTI, tanggal } from '../konstanta'
import { BERKAS, hitungKelengkapan, mkTertutup, perluTanggalKeluar } from '../kelengkapan'
import {
  BarTahap, Bidang, BukaBerkas, Combobox, Halaman, InputAngka, Kerangka, Lencana, LencanaModeBaca, Pemberitahuan,
  PilihBerkas, PilihSegmen, PilihTahun, TombolLanjut, useLayarKecil,
} from '../ui'

const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Kepercayaan terhadap Tuhan YME']
const NAMA_STIKOM = 'Sekolah Tinggi Ilmu Komputer Yos Sudarso'
const kosongKeNull = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]))
const gagal = (pesan) => { toast.error(pesan); return false }

// ── Bagian 1: program studi dan jenis RPL ───────────────────────
function FormProdi({ daftar, ro }) {
  const { data, pengajuan, muat } = usePemohon()
  const [prodi, setProdi] = useState(pengajuan.prodi_pilihan_id || '')
  const [jenis, setJenis] = useState(pengajuan.jenis_rpl || '')
  const p = data.prodi.find((x) => x.id === prodi)

  daftar(async () => {
    if (!prodi || !jenis) return gagal('Pilih program studi dan jenis RPL')
    if (prodi === pengajuan.prodi_pilihan_id && jenis === pengajuan.jenis_rpl) return true
    // Mengganti prodi atau jenis RPL menghapus pilihan MK yang tidak lagi sesuai.
    if (prodi !== pengajuan.prodi_pilihan_id) await api.simpanMkDiajukan(pengajuan.id, {})
    else if (jenis !== 'gabungan') {
      await api.simpanMkDiajukan(pengajuan.id, Object.fromEntries(data.mkDiajukan.filter((m) => m.mekanisme === jenis).map((m) => [m.mk_id, m.mekanisme])))
    }
    await api.ubahPengajuan(pengajuan.id, { prodi_pilihan_id: prodi, jenis_rpl: jenis })
    await muat()
    return true
  })

  return (
    <div className="pm-tumpuk-besar">
      <div className="pm-form-2">
        <Bidang label="Program studi tujuan" wajib>
          <select className="input" value={prodi} disabled={ro} onChange={(e) => setProdi(e.target.value)}>
            {data.prodi.filter((x) => x.is_penyelenggara_rpl || x.id === prodi).map((x) => (
              <option key={x.id} value={x.id}>{x.nama} ({x.jenjang || 'S1'}){x.akreditasi ? ` · ${x.akreditasi}` : ''}</option>
            ))}
          </select>
        </Bidang>
      </div>
      <fieldset className="pm-fieldset">
        <legend className="input-label">Jenis RPL <span className="pm-wajib">*</span></legend>
        <div className="pm-grid-3">
          {Object.entries(JENIS_RPL).map(([v, j]) => {
            const terkunci = (v !== 'transfer' && p && !p.menerima_perolehan_kredit) || (v !== 'perolehan' && p && !p.menerima_transfer_kredit)
            return (
              <label key={v} className={`pm-choice${jenis === v ? ' is-on' : ''}${terkunci ? ' is-off' : ''}`}>
                <input type="radio" name="jenis" value={v} checked={jenis === v} disabled={ro || terkunci} onChange={() => setJenis(v)} />
                <span><span className="pm-choice-judul">{j.label}</span><span className="pm-choice-sub">{j.ket}</span></span>
              </label>
            )
          })}
        </div>
      </fieldset>
      {!ro && pengajuan.prodi_pilihan_id && prodi !== pengajuan.prodi_pilihan_id
        ? <Pemberitahuan jenis="amber">Mengganti program studi akan mengosongkan daftar mata kuliah yang sudah dipilih.</Pemberitahuan> : null}
    </div>
  )
}

// ── Bagian 2: data pribadi (F02 bagian 1) ───────────────────────
function FormPribadi({ daftar, ro }) {
  const { data, userId, ubah } = usePemohon()
  const { profile, updateProfile } = useAuth()
  const a = data.biodata || {}
  const [hp, setHp] = useState(profile?.no_whatsapp || '')
  const [f, setF] = useState(() => ({
    tempat_lahir: a.tempat_lahir || '', tanggal_lahir: a.tanggal_lahir || '', jenis_kelamin: a.jenis_kelamin || '',
    status_perkawinan: a.status_perkawinan || '', agama: AGAMA.includes(a.agama) ? a.agama : '',
    kewarganegaraan: a.kewarganegaraan || 'WNI', kebangsaan: a.kewarganegaraan === 'WNA' ? (a.kebangsaan || '') : '',
    alamat: a.alamat || '', kode_pos: a.kode_pos || '', telepon_rumah: a.telepon_rumah || '', telepon_kantor: a.telepon_kantor || '',
    pendidikan_terakhir: a.pendidikan_terakhir || '', nama_sekolah_pt: a.nama_sekolah_pt || '',
    prodi_pendidikan_terakhir: a.prodi_pendidikan_terakhir || '', tahun_lulus: a.tahun_lulus ? String(a.tahun_lulus) : '',
  }))
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v && v.target ? v.target.value : v }))
  const opsiKota = useMemo(() => data.refWilayah.map((w) => ({ nilai: w.nama, label: w.nama, grup: w.provinsi })), [data.refWilayah])
  const batasLahir = new Date(Date.now() - 15 * 365.25 * 864e5).toISOString().slice(0, 10)
  const perguruanTinggi = ['D1', 'D2', 'D3', 'D4', 'S1'].includes(f.pendidikan_terakhir)

  daftar(async () => {
    if (!f.tempat_lahir || !f.tanggal_lahir || !f.alamat.trim()) return gagal('Tempat lahir, tanggal lahir, dan alamat wajib diisi')
    if (f.tanggal_lahir > batasLahir || f.tanggal_lahir < '1940-01-01') return gagal('Tanggal lahir tidak valid. Periksa kembali tahun lahir Anda')
    const nomorHp = hp.replace(/\D/g, '')
    if (!/^(08|628)\d{7,12}$/.test(nomorHp)) return gagal('Isi nomor HP/WhatsApp aktif, mis. 081234567890')
    if (f.kode_pos && f.kode_pos.length !== 5) return gagal('Kode pos harus 5 angka')
    if (f.kewarganegaraan === 'WNA' && !f.kebangsaan.trim()) return gagal('Isi negara asal untuk WNA')
    const isi = kosongKeNull({ ...f, kebangsaan: f.kewarganegaraan === 'WNI' ? 'Indonesia' : f.kebangsaan.trim() })
    isi.tahun_lulus = f.tahun_lulus ? Number(f.tahun_lulus) : null
    if (nomorHp !== (profile?.no_whatsapp || '').replace(/\D/g, '')) {
      const { error } = await updateProfile({ no_whatsapp: nomorHp })
      if (error) return gagal(`Nomor HP tidak dapat disimpan: ${error.message}`)
    }
    const hasil = await api.simpanBiodata(userId, isi)
    ubah(() => ({ biodata: hasil }))
    return true
  })

  return (
    <div className="pm-tumpuk-besar">
      <div className="pm-form-2">
        <Bidang label="Nama lengkap" hint="Diubah di menu Profil"><input className="input" value={profile?.nama_lengkap || ''} readOnly /></Bidang>
        <Bidang label="Email"><input className="input" value={profile?.email || ''} readOnly /></Bidang>
        <Bidang label="Nomor HP / WhatsApp" wajib hint="Dipakai di Formulir Aplikasi (F02) dan untuk pemberitahuan jadwal.">
          <InputAngka nilai={hp} onUbah={setHp} panjang={15} nonaktif={ro} inputMode="tel" placeholder="081234567890" />
        </Bidang>
        <div className="input-group">
          <span className="input-label">Tempat lahir <span className="pm-wajib">*</span></span>
          <Combobox nilai={f.tempat_lahir} onUbah={set('tempat_lahir')} opsi={opsiKota} bolehKetik nonaktif={ro}
            label="Tempat lahir" placeholder="Cari kabupaten/kota" />
          <span className="pm-hint">Ketik nama kabupaten/kota, lalu pilih dari daftar.</span>
        </div>
        <Bidang label="Tanggal lahir" wajib>
          <input className="input" type="date" max={batasLahir} value={f.tanggal_lahir} onChange={set('tanggal_lahir')} readOnly={ro} />
        </Bidang>
        <div className="input-group">
          <span className="input-label">Jenis kelamin</span>
          <PilihSegmen label="Jenis kelamin" nonaktif={ro} nilai={f.jenis_kelamin} onUbah={set('jenis_kelamin')}
            pilihan={[{ v: 'pria', l: 'Pria' }, { v: 'wanita', l: 'Wanita' }]} />
        </div>
        <Bidang label="Status perkawinan">
          <select className="input" value={f.status_perkawinan} onChange={set('status_perkawinan')} disabled={ro}>
            <option value="">Pilih status</option><option value="lajang">Lajang</option><option value="menikah">Menikah</option><option value="pernah_menikah">Pernah menikah</option>
          </select>
        </Bidang>
        <Bidang label="Agama">
          <select className="input" value={f.agama} onChange={set('agama')} disabled={ro}>
            <option value="">Pilih agama</option>
            {AGAMA.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Bidang>
        <div className="input-group">
          <span className="input-label">Kebangsaan</span>
          <PilihSegmen label="Kebangsaan" nonaktif={ro} nilai={f.kewarganegaraan} onUbah={set('kewarganegaraan')}
            pilihan={[{ v: 'WNI', l: 'WNI' }, { v: 'WNA', l: 'WNA' }]} />
        </div>
        {f.kewarganegaraan === 'WNA' ? (
          <Bidang label="Negara asal" wajib><input className="input" value={f.kebangsaan} onChange={set('kebangsaan')} readOnly={ro} /></Bidang>
        ) : null}
        <Bidang label="Alamat rumah" wajib lebar>
          <textarea className="input" rows={2} value={f.alamat} onChange={set('alamat')} readOnly={ro} />
        </Bidang>
        <Bidang label="Kode pos" hint="5 angka"><InputAngka nilai={f.kode_pos} onUbah={set('kode_pos')} panjang={5} nonaktif={ro} /></Bidang>
        <Bidang label="Telepon rumah"><InputAngka nilai={f.telepon_rumah} onUbah={set('telepon_rumah')} panjang={15} nonaktif={ro} /></Bidang>
        <Bidang label="Telepon kantor"><InputAngka nilai={f.telepon_kantor} onUbah={set('telepon_kantor')} panjang={15} nonaktif={ro} /></Bidang>
      </div>
      <h3 className="pm-subjudul">Pendidikan terakhir</h3>
      <div className="pm-form-2">
        <Bidang label="Jenjang">
          <select className="input" value={f.pendidikan_terakhir} onChange={set('pendidikan_terakhir')} disabled={ro}>
            <option value="">Pilih jenjang</option>
            {['SMA', 'SMK', 'MA', 'Paket C', 'D1', 'D2', 'D3', 'D4', 'S1'].map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </Bidang>
        <div className="input-group">
          <span className="input-label">{perguruanTinggi ? 'Nama perguruan tinggi' : 'Nama sekolah'}</span>
          {perguruanTinggi ? (
            <Combobox nilai={f.nama_sekolah_pt} onUbah={set('nama_sekolah_pt')} bolehKetik nonaktif={ro} label="Nama perguruan tinggi"
              opsi={data.refPt.map((x) => ({ nilai: x.nama, label: x.nama }))} placeholder="Cari perguruan tinggi" />
          ) : <input className="input" value={f.nama_sekolah_pt} onChange={set('nama_sekolah_pt')} readOnly={ro} />}
        </div>
        {perguruanTinggi ? (
          <Bidang label="Program studi"><input className="input" value={f.prodi_pendidikan_terakhir} onChange={set('prodi_pendidikan_terakhir')} readOnly={ro} /></Bidang>
        ) : null}
        <Bidang label="Tahun lulus"><PilihTahun nilai={f.tahun_lulus} onUbah={set('tahun_lulus')} nonaktif={ro} label="Tahun lulus" /></Bidang>
      </div>
    </div>
  )
}

// ── Bagian 3: perguruan tinggi asal (transfer kredit) ───────────
function FormPt({ daftar, ro }) {
  const { data, pengajuan, ubah } = usePemohon()
  const [f, setF] = useState({
    pt_asal: pengajuan.pt_asal || '', prodi_asal: pengajuan.prodi_asal || '',
    status_pddikti_asal: pengajuan.status_pddikti_asal || '', tanggal_mengundurkan_diri: pengajuan.tanggal_mengundurkan_diri || '',
  })
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v && v.target ? v.target.value : v }))
  const stikom = f.pt_asal.trim().toLowerCase() === NAMA_STIKOM.toLowerCase() || /stikom yos sudarso/i.test(f.pt_asal)
  const perluTanggal = perluTanggalKeluar(f.status_pddikti_asal)
  const ditolak = stikom && ['putus_studi', 'dikeluarkan'].includes(f.status_pddikti_asal)

  daftar(async () => {
    if (!f.pt_asal.trim() || !f.status_pddikti_asal) return gagal('Isi perguruan tinggi asal dan status di PDDikti')
    if (perluTanggal && !f.tanggal_mengundurkan_diri) return gagal('Isi tanggal SK keluar atau pengunduran diri')
    if (ditolak) return gagal('Pendaftar yang putus studi atau dikeluarkan hanya dapat melanjutkan melalui RPL di perguruan tinggi lain')
    const p = await api.ubahPengajuan(pengajuan.id, {
      pt_asal: f.pt_asal.trim(), prodi_asal: f.prodi_asal.trim() || null, status_pddikti_asal: f.status_pddikti_asal,
      tanggal_mengundurkan_diri: perluTanggal ? f.tanggal_mengundurkan_diri : null, pt_asal_stikom: stikom,
    })
    ubah(() => ({ pengajuan: p }))
    return true
  })

  return (
    <div className="pm-tumpuk-besar">
      <div className="pm-form-2">
        <div className="input-group">
          <span className="input-label">Perguruan tinggi asal <span className="pm-wajib">*</span></span>
          <Combobox nilai={f.pt_asal} onUbah={set('pt_asal')} bolehKetik nonaktif={ro} label="Perguruan tinggi asal"
            opsi={data.refPt.map((x) => ({ nilai: x.nama, label: x.nama }))} placeholder="Cari perguruan tinggi" />
          <span className="pm-hint">Tidak ada di daftar? Ketik nama lengkapnya, lalu pilih "Gunakan".</span>
        </div>
        <Bidang label="Program studi asal"><input className="input" value={f.prodi_asal} onChange={set('prodi_asal')} readOnly={ro} /></Bidang>
        <Bidang label="Status di PDDikti" wajib>
          <select className="input" value={f.status_pddikti_asal} onChange={set('status_pddikti_asal')} disabled={ro}>
            <option value="">Pilih status</option>
            {Object.entries(STATUS_PDDIKTI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Bidang>
        {perluTanggal ? (
          <Bidang label="Tanggal SK keluar / pengunduran diri" wajib>
            <input className="input" type="date" value={f.tanggal_mengundurkan_diri} onChange={set('tanggal_mengundurkan_diri')} readOnly={ro} />
          </Bidang>
        ) : null}
      </div>
      {ditolak ? (
        <Pemberitahuan jenis="red" judul="Tidak dapat melanjutkan di STIKOM Yos Sudarso">
          Pendaftar yang putus studi atau dikeluarkan hanya dapat melanjutkan melalui RPL di perguruan tinggi lain (Juknis Bab II.A).
        </Pemberitahuan>
      ) : null}
      {stikom && f.status_pddikti_asal === 'mengundurkan_diri' ? (
        <Pemberitahuan jenis="amber">Pendaftar yang mengundurkan diri dapat kembali ke STIKOM paling cepat 1 tahun akademik setelah SK pengunduran diri.</Pemberitahuan>
      ) : null}
    </div>
  )
}

// ── Bagian 4: berkas wajib ──────────────────────────────────────
function FormBerkas({ daftar, ro }) {
  const { pengajuan, userId, ubah } = usePemohon()
  const [sibuk, setSibuk] = useState(null)
  const wajib = BERKAS.filter((b) => b.wajibUntuk.includes(pengajuan.jenis_rpl))

  daftar(async () => {
    const kurang = wajib.filter((b) => !pengajuan[b.kolom])
    if (kurang.length) return gagal(`Unggah dulu: ${kurang.map((b) => b.label).join(', ')}`)
    return true
  })

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
    <div className="pm-tumpuk-besar">
      <p className="pm-kecil">PDF, JPG, atau PNG, maksimal 10 MB per berkas.</p>
      <ul className="pm-checklist pm-checklist-rapat">
        {BERKAS.map((b) => {
          const w = b.wajibUntuk.includes(pengajuan.jenis_rpl)
          const ada = !!pengajuan[b.kolom]
          return (
            <li key={b.kolom}>
              <span className="pm-grow"><span className="pm-tebal">{b.label}</span><span className="pm-kecil"> · {w ? 'wajib' : 'bila ada'}</span></span>
              {ada ? <Lencana warna="green">Terunggah</Lencana> : w ? <Lencana warna="amber">Belum ada</Lencana> : null}
              <BukaBerkas path={pengajuan[b.kolom]} />
              {!ro ? <PilihBerkas label={ada ? 'Ganti' : 'Unggah'} sibuk={sibuk === b.kolom} onPilih={(f) => unggah(b.kolom, f)} /> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Bagian 5: mata kuliah per tab semester ──────────────────────
function FormMataKuliah({ daftar, ro, setInfo }) {
  const { data, pengajuan, muatDetail } = usePemohon()
  const kecil = useLayarKecil()
  const awal = useMemo(() => Object.fromEntries(data.mkDiajukan.map((m) => [m.mk_id, m.mekanisme])), [data.mkDiajukan])
  const [pilih, setPilih] = useState(awal)
  const semester = useMemo(() => [...new Set(data.mataKuliah.map((m) => m.semester || 1))].sort((a, b) => a - b), [data.mataKuliah])
  const [tab, setTab] = useState(semester[0] || 1)
  const [cari, setCari] = useState('')
  useEffect(() => { setPilih(awal) }, [awal])

  const opsi = [{ v: '', l: 'Tidak' }]
  if (['transfer', 'gabungan'].includes(pengajuan.jenis_rpl)) opsi.push({ v: 'transfer', l: 'Transfer' })
  if (['perolehan', 'gabungan'].includes(pengajuan.jenis_rpl)) opsi.push({ v: 'perolehan', l: 'Perolehan' })

  const tertutup = mkTertutup
  const alasanTutup = (mk) => mk.is_tugas_akhir ? 'Tugas akhir, tidak dapat direkognisi' : mk.rangkaian_ta ? 'Rangkaian tugas akhir, tidak dapat direkognisi' : `Tidak dibuka untuk RPL${mk.alasan_tidak_rpl ? `: ${mk.alasan_tidak_rpl}` : ''}`
  const harusDiganti = data.mataKuliah.filter((mk) => tertutup(mk) && pilih[mk.id])
  const sks = (f) => Object.entries(pilih).filter(([, m]) => m && f(m)).reduce((n, [id]) => n + (data.mataKuliah.find((k) => k.id === id)?.sks || 0), 0)
  const total = sks(() => true)
  const batas = data.batasSks || 100
  const jumlahDipilih = Object.values(pilih).filter(Boolean).length

  useEffect(() => {
    setInfo(
      <div className="pm-ringkas-sks">
        <span><b>{total}</b>SKS diajukan</span>
        <span><b>{sks((m) => m === 'transfer')}</b>transfer</span>
        <span><b>{sks((m) => m === 'perolehan')}</b>perolehan</span>
        <span className="pm-meter" role="img" aria-label={`${total} dari ${batas} SKS`}><span style={{ width: `${Math.min(100, (total / batas) * 100)}%` }} className={total > batas ? 'lebih' : ''} /></span>
        <span>sisa batas <b className="kecil">{Math.max(0, batas - total)}</b>dari {batas} SKS</span>
      </div>,
    )
    return () => setInfo(null)
  }, [pilih, total, batas]) // eslint-disable-line react-hooks/exhaustive-deps

  daftar(async () => {
    if (!jumlahDipilih) return gagal('Pilih minimal satu mata kuliah')
    const berubah = JSON.stringify(Object.entries(pilih).filter(([, m]) => m).sort()) !== JSON.stringify(Object.entries(awal).sort())
    const tutupIds = data.mataKuliah.filter(tertutup).map((mk) => mk.id)
    if (berubah) { await api.simpanMkDiajukan(pengajuan.id, pilih, tutupIds); await muatDetail() }
    if (harusDiganti.length) return gagal(`Mata kuliah berikut sudah ditutup untuk RPL, ubah ke "Tidak": ${harusDiganti.map((m) => m.nama_mk).join(', ')}`)
    if (total > batas) toast(`Yang dapat diakui paling banyak ${batas} SKS. Sisanya tetap dinilai, tetapi tidak semuanya bisa diakui.`, { duration: 6000 })
    return true
  })

  const q = cari.trim().toLowerCase()
  const daftarMk = data.mataKuliah.filter((mk) => {
    if (q) return mk.nama_mk.toLowerCase().includes(q) || mk.kode_mk.toLowerCase().includes(q)
    if (tab === 'dipilih') return !!pilih[mk.id]
    return (mk.semester || 1) === tab
  })
  const hitung = (s) => data.mataKuliah.filter((mk) => (mk.semester || 1) === s && pilih[mk.id]).length
  const ubahSemua = (v) => setPilih((st) => {
    const baru = { ...st }
    data.mataKuliah.filter((mk) => (mk.semester || 1) === tab && !tertutup(mk)).forEach((mk) => { if (v) baru[mk.id] = v; else delete baru[mk.id] })
    return baru
  })
  const mekTransfer = opsi.find((o) => o.v === 'transfer')

  return (
    <div className="pm-mk">
      {kecil ? (
        <div className="pm-mk-alat-kecil">
          <select className="input" value={String(tab)} aria-label="Semester" onChange={(e) => { setCari(''); setTab(e.target.value === 'dipilih' ? 'dipilih' : Number(e.target.value)) }}>
            {semester.map((s) => <option key={s} value={s}>Semester {s} ({hitung(s)} dipilih)</option>)}
            <option value="dipilih">Semua yang dipilih ({jumlahDipilih})</option>
          </select>
        </div>
      ) : (
        <div className="pm-tabs" role="tablist" aria-label="Semester">
          {semester.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={!q && tab === s} className={!q && tab === s ? 'is-on' : ''}
              onClick={() => { setCari(''); setTab(s) }}>Smt {s}<span className="pm-hit">{hitung(s)}</span></button>
          ))}
          <span className="pm-tabs-pisah" aria-hidden="true" />
          <button type="button" role="tab" aria-selected={!q && tab === 'dipilih'} className={!q && tab === 'dipilih' ? 'is-on' : ''}
            onClick={() => { setCari(''); setTab('dipilih') }}>Dipilih<span className="pm-hit">{jumlahDipilih}</span></button>
        </div>
      )}
      {harusDiganti.length ? (
        <div style={{ padding: '12px 20px 0' }}>
          <Pemberitahuan jenis="red" judul={`${harusDiganti.length} mata kuliah yang Anda pilih sudah ditutup untuk RPL`}>
            Ubah ke "Tidak" agar pengajuan dapat dikirim: {harusDiganti.map((m) => m.nama_mk).join(', ')}.
          </Pemberitahuan>
        </div>
      ) : null}
      <div className="pm-mk-alat">
        <div className="pm-input-ikon pm-cari">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input className="input" type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau kode mata kuliah di semua semester" aria-label="Cari mata kuliah" />
        </div>
        {!ro && !q && tab !== 'dipilih' ? (
          <div className="pm-baris-aksi">
            <span className="pm-kecil">Semua di semester {tab}:</span>
            {mekTransfer ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => ubahSemua('transfer')}>Ajukan sebagai transfer</button> : null}
            {!mekTransfer ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => ubahSemua('perolehan')}>Ajukan sebagai perolehan</button> : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => ubahSemua('')}>Kosongkan</button>
          </div>
        ) : q ? <span className="pm-kecil">{daftarMk.length} hasil untuk "{cari}"</span> : null}
      </div>

      {!daftarMk.length ? <p className="pm-kosong">{tab === 'dipilih' && !q ? 'Belum ada mata kuliah yang dipilih.' : 'Tidak ada mata kuliah.'}</p> : kecil ? (
        <div className="pm-mk-kartu-daftar">
          {daftarMk.map((mk) => (
            <div key={mk.id} className={`pm-mk-kartu${pilih[mk.id] ? ' is-on' : ''}${tertutup(mk) ? ' is-off' : ''}`}>
              <div className="pm-kecil">{mk.kode_mk} · {mk.sks} SKS · Smt {mk.semester}</div>
              <div className="pm-tebal">{mk.nama_mk}</div>
              {tertutup(mk) && !pilih[mk.id] ? <span className="badge-pill badge-slate"><Lock size={11} /> {alasanTutup(mk)}</span> : tertutup(mk) ? (
                <PilihSegmen penuh label={`Mekanisme ${mk.nama_mk}`} pilihan={[{ v: '', l: 'Tidak' }, opsi.find((o) => o.v === pilih[mk.id]) || { v: pilih[mk.id], l: 'Dipilih' }]} nilai={pilih[mk.id]} nonaktif={ro}
                  onUbah={(v) => setPilih((s) => ({ ...s, [mk.id]: v }))} />
              ) : (
                <PilihSegmen penuh label={`Mekanisme ${mk.nama_mk}`} pilihan={opsi} nilai={pilih[mk.id] || ''} nonaktif={ro}
                  onUbah={(v) => setPilih((s) => ({ ...s, [mk.id]: v }))} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="pm-tabel">
            <thead><tr><th style={{ width: 130 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 60 }}>SKS</th>
              {q || tab === 'dipilih' ? <th style={{ width: 70 }}>Smt</th> : null}<th style={{ width: 280 }}>Diajukan melalui</th></tr></thead>
            <tbody>
              {daftarMk.map((mk) => (
                <tr key={mk.id} className={tertutup(mk) && !pilih[mk.id] ? 'pm-redup' : ''}>
                  <td className="pm-kecil">{mk.kode_mk}</td>
                  <td>{mk.nama_mk}{tertutup(mk) ? <div className={pilih[mk.id] ? 'pm-kecil pm-merah' : 'pm-kecil'}>{alasanTutup(mk)}{pilih[mk.id] ? '. Ubah ke "Tidak".' : ''}</div> : null}</td>
                  <td>{mk.sks}</td>
                  {q || tab === 'dipilih' ? <td className="pm-kecil">{mk.semester}</td> : null}
                  <td>{tertutup(mk) && !pilih[mk.id] ? <span className="badge-pill badge-slate"><Lock size={11} /> Tidak dibuka</span> : tertutup(mk) ? (
                    <PilihSegmen label={`Mekanisme ${mk.nama_mk}`} pilihan={[{ v: '', l: 'Tidak' }, opsi.find((o) => o.v === pilih[mk.id]) || { v: pilih[mk.id], l: 'Dipilih' }]} nilai={pilih[mk.id]} nonaktif={ro}
                      onUbah={(v) => setPilih((s) => ({ ...s, [mk.id]: v }))} />
                  ) : (
                    <PilihSegmen label={`Mekanisme ${mk.nama_mk}`} pilihan={opsi} nilai={pilih[mk.id] || ''} nonaktif={ro}
                      onUbah={(v) => setPilih((s) => ({ ...s, [mk.id]: v }))} />
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Halaman ─────────────────────────────────────────────────────
const FORM = { prodi: FormProdi, pribadi: FormPribadi, pt: FormPt, berkas: FormBerkas, mk: FormMataKuliah }

function ringkasan(id, data) {
  const p = data.pengajuan
  const b = data.biodata || {}
  if (id === 'prodi') return [data.prodi.find((x) => x.id === p.prodi_pilihan_id)?.nama, JENIS_RPL[p.jenis_rpl]?.label].filter(Boolean).join(' · ')
  if (id === 'pribadi') return [b.tempat_lahir, b.tanggal_lahir && tanggal(b.tanggal_lahir)].filter(Boolean).join(', ')
  if (id === 'pt') return [p.pt_asal, STATUS_PDDIKTI[p.status_pddikti_asal]].filter(Boolean).join(' · ')
  if (id === 'berkas') return `${BERKAS.filter((x) => p[x.kolom]).length} berkas terunggah`
  if (id === 'mk') {
    const sks = data.mkDiajukan.reduce((n, m) => n + (data.mataKuliah.find((k) => k.id === m.mk_id)?.sks || 0), 0)
    return `${data.mkDiajukan.length} mata kuliah · ${sks} SKS`
  }
  return ''
}

export default function Persyaratan() {
  const { siap, data, pengajuan, bisaDiubah } = usePemohon()
  const navigate = useNavigate()
  const simpanRef = useRef(null)
  const [aktif, setAktif] = useState(undefined)
  const [sibuk, setSibuk] = useState(false)
  const [info, setInfo] = useState(null)

  const bagian = useMemo(() => (siap && pengajuan ? hitungKelengkapan(data).bagian : []), [siap, pengajuan, data])
  useEffect(() => {
    if (aktif !== undefined || !bagian.length) return
    setAktif(bisaDiubah ? (bagian.find((x) => !x.selesai)?.id ?? null) : null)
  }, [bagian, aktif, bisaDiubah])

  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  const idxAktif = bagian.findIndex((x) => x.id === aktif)
  const pertamaBelum = bagian.findIndex((x) => !x.selesai)
  const daftar = (fn) => { simpanRef.current = fn }

  const lanjut = async () => {
    if (aktif === null) { navigate('/pemohon/pengajuan/riwayat-hidup'); return }
    setSibuk(true)
    try {
      const ok = await simpanRef.current?.()
      if (!ok) return
      toast.success(`${bagian[idxAktif].judul} disimpan`)
      const berikut = bagian[idxAktif + 1]
      if (berikut) { setAktif(berikut.id); return }
      const belum = bagian.find((x, i) => i < idxAktif && !x.selesai)
      if (belum) { setAktif(belum.id); toast.error(`Lengkapi dulu bagian ${belum.judul}`); return }
      setAktif(null)
      navigate('/pemohon/pengajuan/riwayat-hidup')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  const selesaiSemua = bagian.every((x) => x.selesai)
  return (
    <Halaman judul="Data dan persyaratan"
      sub={bisaDiubah ? `Tahap 1. Isi bagian secara berurutan; bagian berikutnya terbuka setelah bagian ini disimpan.` : 'Tahap 1. Data yang dipakai BAAK untuk memeriksa persyaratan sesuai Juknis RPL Tipe A.'}
      aksi={bisaDiubah ? (
        <div className="pm-prog-wrap">
          <div className="pm-prog" aria-label="Kemajuan tahap 1">{bagian.map((x) => <span key={x.id} className={x.selesai ? 'done' : x.id === aktif ? 'now' : ''} />)}</div>
          <div className="pm-kecil">{bagian.filter((x) => x.selesai).length} dari {bagian.length} bagian selesai</div>
        </div>
      ) : <LencanaModeBaca />}>
      {!bisaDiubah ? <Pemberitahuan>Pengajuan sudah dikirim, data hanya dapat dilihat.</Pemberitahuan> : null}

      {bagian.map((b, i) => {
        const terbuka = !bisaDiubah || pertamaBelum === -1 || i <= pertamaBelum
        const now = bisaDiubah && b.id === aktif
        const kunci = bisaDiubah && !terbuka && !now
        const Form = FORM[b.id]
        const tampil = now || !bisaDiubah
        return (
          <section key={b.id} className={`pm-bagian${now ? ' is-now' : kunci ? ' is-lock' : b.selesai ? ' is-done' : ''}`} aria-label={b.judul}>
            <div className="pm-bagian-kepala">
              <span className="pm-bagian-no">{b.selesai && !now && !kunci ? <Check size={13} /> : i + 1}</span>
              <div className="pm-grow">
                <div className="pm-bagian-judul">{b.judul}</div>
                <div className="pm-bagian-ringkas">{now ? 'Lengkapi isian di bawah' : kunci ? 'Terbuka setelah bagian sebelumnya disimpan' : b.selesai ? ringkasan(b.id, data) : 'Belum diisi'}</div>
              </div>
              {kunci ? <span className="badge-pill badge-slate"><Lock size={11} /> Terkunci</span> : null}
              {now ? <span className="badge-pill badge-indigo">Sedang diisi</span> : null}
              {bisaDiubah && !now && !kunci ? (
                <>
                  {b.selesai ? <span className="badge-pill badge-green pm-hide-kecil">Selesai</span> : null}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAktif(b.id)}><Pencil size={13} /> {b.selesai ? 'Ubah' : 'Isi'}</button>
                </>
              ) : null}
            </div>
            {tampil ? (
              <div className={`pm-bagian-isi${b.id === 'mk' ? ' pm-bagian-isi-penuh' : ''}`}>
                <Form key={`${b.id}-${pengajuan.prodi_pilihan_id}-${pengajuan.jenis_rpl}`} daftar={now ? daftar : () => {}} ro={!bisaDiubah} setInfo={now ? setInfo : () => {}} />
              </div>
            ) : null}
          </section>
        )
      })}

      {bisaDiubah ? (
        <BarTahap info={aktif === 'mk' && info ? info : aktif ? <>Bagian {idxAktif + 1} dari {bagian.length}: <b>{bagian[idxAktif]?.judul}</b></> : selesaiSemua ? 'Semua bagian tahap 1 sudah lengkap.' : 'Pilih bagian yang ingin diisi.'}>
          {idxAktif > 0 ? <button type="button" className="btn btn-secondary" onClick={() => setAktif(bagian[idxAktif - 1].id)}>Kembali</button> : null}
          {aktif ? (
            <TombolLanjut sibuk={sibuk} onClick={lanjut}>{idxAktif === bagian.length - 1 ? 'Simpan dan lanjut ke tahap 2' : 'Simpan dan lanjutkan'}</TombolLanjut>
          ) : selesaiSemua ? <TombolLanjut onClick={lanjut}>Lanjut ke tahap 2</TombolLanjut> : null}
        </BarTahap>
      ) : null}
    </Halaman>
  )
}
