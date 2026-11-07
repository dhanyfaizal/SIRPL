// Biodata asesor: F04 (akademisi) atau F05 (praktisi/profesi), lalu
// diterbitkan sebagai dokumen bertanda tangan elektronik.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSignature, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import * as dokApi from '../../dokumen/api'
import { BarisDokumen } from '../../dokumen/PanelDokumen'
import { BarTahap, Bidang, Halaman, Kartu, Kerangka, PilihSegmen, Tombol } from '../../pemohon/ui'

const KOSONG = {
  jenis: 'akademisi', jenis_kelamin: '', tempat_lahir: '', tanggal_lahir: '', no_hp: '', telepon_fax: '', alamat_rumah: '',
  pendidikan_terakhir: '', bidang_keilmuan: '', pangkat_golongan: '', jabatan_fungsional: '', nip_nidn: '', nama_pt: 'STIKOM Yos Sudarso',
  alamat_pt: '', asosiasi_nama: '', asosiasi_nomor: '', asosiasi_jabatan: '', asosiasi_alamat: '', pekerjaan: '', instansi: '', jabatan: '', bidang_keahlian: '',
}
const JK = { pria: 'Pria', wanita: 'Wanita' }

export function barisBiodata(f, profil) {
  const ttl = [f.tempat_lahir, f.tanggal_lahir ? new Date(f.tanggal_lahir).toLocaleDateString('id-ID', { dateStyle: 'long' }) : ''].filter(Boolean).join(', ')
  if (f.jenis === 'akademisi') {
    return [['Nama lengkap', profil?.nama_lengkap], ['Jenis kelamin', JK[f.jenis_kelamin]], ['Pangkat/golongan', f.pangkat_golongan],
      ['Jabatan fungsional akademik', f.jabatan_fungsional], ['NIP/NIDN', f.nip_nidn], ['Tempat dan tanggal lahir', ttl], ['E-mail', profil?.email],
      ['Nomor telepon/HP', f.no_hp], ['Nama perguruan tinggi', f.nama_pt], ['Alamat perguruan tinggi', f.alamat_pt], ['Alamat rumah', f.alamat_rumah],
      ['Nomor telepon/faks', f.telepon_fax], ['Pendidikan terakhir', f.pendidikan_terakhir], ['Bidang keilmuan/program studi', f.bidang_keilmuan],
      ['Keanggotaan asosiasi profesi', f.asosiasi_nama], ['Nomor keanggotaan', f.asosiasi_nomor]]
  }
  return [['Nama lengkap', profil?.nama_lengkap], ['Jenis kelamin', JK[f.jenis_kelamin]], ['Tempat dan tanggal lahir', ttl], ['E-mail', profil?.email],
    ['Nomor telepon/HP', f.no_hp], ['Pendidikan terakhir', f.pendidikan_terakhir], ['Program studi', f.bidang_keilmuan],
    ['Nama asosiasi/organisasi profesi', f.asosiasi_nama], ['Nomor keanggotaan', f.asosiasi_nomor], ['Jabatan dalam asosiasi/organisasi profesi', f.asosiasi_jabatan],
    ['Alamat kantor asosiasi/organisasi profesi', f.asosiasi_alamat], ['Nomor telepon/faks', f.telepon_fax], ['Pekerjaan', f.pekerjaan], ['Nama instansi', f.instansi],
    ['Jabatan', f.jabatan], ['Bidang keahlian/profesi yang ditekuni', f.bidang_keahlian]]
}

export default function Biodata() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState(null)
  const [dok, setDok] = useState([])
  const [sibuk, setSibuk] = useState(null)
  useEffect(() => {
    if (!user?.id) return
    supabase.from('biodata_asesor').select('*').eq('profile_id', user.id).maybeSingle()
      .then(({ data }) => setF({ ...KOSONG, ...Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, v ?? ''])) }))
    supabase.from('dokumen_terbit').select('*').eq('asesor_id', user.id).in('jenis_kode', ['F04', 'F05']).order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const ids = (data || []).map((d) => d.id)
        const ttd = ids.length ? (await supabase.from('tanda_tangan_dokumen').select('*').in('dokumen_id', ids)).data || [] : []
        setDok((data || []).map((d) => ({ ...d, ttd: ttd.filter((t) => t.dokumen_id === d.id) })))
      })
  }, [user?.id])
  if (!f) return <Kerangka />
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }))
  const akad = f.jenis === 'akademisi'

  const simpan = async () => {
    const nilai = Object.fromEntries(Object.entries(f).filter(([k]) => k in KOSONG).map(([k, v]) => [k, v === '' ? null : v]))
    const { error } = await supabase.from('biodata_asesor').upsert({ ...nilai, profile_id: user.id, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
  }
  const jalankan = async (terbit) => {
    setSibuk(terbit ? 'terbit' : 'simpan')
    try {
      await simpan()
      if (!terbit) { toast.success('Biodata disimpan'); return }
      if (!f.jenis_kelamin || !f.no_hp || !f.pendidikan_terakhir) throw new Error('Lengkapi jenis kelamin, nomor HP, dan pendidikan terakhir')
      const kode = akad ? 'F04' : 'F05'
      const id = await dokApi.terbitkan({ jenis: kode, judul: `Biodata Asesor ${akad ? 'Akademisi' : 'Praktisi/Profesi'} - ${profile?.nama_lengkap || ''}`,
        isi: { jenis: f.jenis, nama: profile?.nama_lengkap || '', baris: barisBiodata(f, profile) } })
      navigate(`/dokumen/${id}`)
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }

  return (
    <Halaman judul="Biodata asesor" sub="Isian Formulir Biodata Asesor (F04 akademisi, F05 praktisi/profesi). Setelah diterbitkan dan Anda tandatangani, biodata masuk ke berkas penilaian setiap pemohon yang Anda nilai.">
      <Kartu judul="Jenis asesor">
        <PilihSegmen pilihan={[{ v: 'akademisi', l: 'Asesor akademisi (F04)' }, { v: 'praktisi', l: 'Asesor praktisi/profesi (F05)' }]} nilai={f.jenis} onUbah={set('jenis')} label="Jenis asesor" />
      </Kartu>
      <Kartu judul="Identitas">
        <div className="pm-form-2">
          <Bidang label="Jenis kelamin" wajib><PilihSegmen pilihan={[{ v: 'pria', l: 'Pria' }, { v: 'wanita', l: 'Wanita' }]} nilai={f.jenis_kelamin} onUbah={set('jenis_kelamin')} label="Jenis kelamin" /></Bidang>
          <Bidang label="Nomor HP" wajib><input className="input" value={f.no_hp} onChange={set('no_hp')} inputMode="tel" /></Bidang>
          <Bidang label="Tempat lahir"><input className="input" value={f.tempat_lahir} onChange={set('tempat_lahir')} /></Bidang>
          <Bidang label="Tanggal lahir"><input className="input" type="date" value={f.tanggal_lahir} onChange={set('tanggal_lahir')} /></Bidang>
          <Bidang label="Pendidikan terakhir" wajib>
            <select className="input" value={f.pendidikan_terakhir} onChange={set('pendidikan_terakhir')}>
              <option value="">Pilih</option>{['D3', 'D4', 'S1', 'S2', 'S3', 'Profesi', 'Spesialis'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Bidang>
          <Bidang label={akad ? 'Bidang keilmuan/program studi' : 'Program studi'}><input className="input" value={f.bidang_keilmuan} onChange={set('bidang_keilmuan')} /></Bidang>
          <Bidang label="Nomor telepon/faks"><input className="input" value={f.telepon_fax} onChange={set('telepon_fax')} /></Bidang>
          {akad ? <Bidang label="Alamat rumah" lebar><input className="input" value={f.alamat_rumah} onChange={set('alamat_rumah')} /></Bidang> : null}
        </div>
      </Kartu>
      {akad ? (
        <Kartu judul="Data akademik">
          <div className="pm-form-2">
            <Bidang label="NIP/NIDN"><input className="input" value={f.nip_nidn} onChange={set('nip_nidn')} /></Bidang>
            <Bidang label="Jabatan fungsional akademik">
              <select className="input" value={f.jabatan_fungsional} onChange={set('jabatan_fungsional')}>
                <option value="">Pilih</option>{['Tenaga Pengajar', 'Asisten Ahli', 'Lektor', 'Lektor Kepala', 'Profesor'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </Bidang>
            <Bidang label="Pangkat/golongan"><input className="input" value={f.pangkat_golongan} onChange={set('pangkat_golongan')} placeholder="mis. Penata Muda Tk. I / III-b" /></Bidang>
            <Bidang label="Nama perguruan tinggi"><input className="input" value={f.nama_pt} onChange={set('nama_pt')} /></Bidang>
            <Bidang label="Alamat perguruan tinggi" lebar><input className="input" value={f.alamat_pt} onChange={set('alamat_pt')} /></Bidang>
            <Bidang label="Asosiasi profesi"><input className="input" value={f.asosiasi_nama} onChange={set('asosiasi_nama')} /></Bidang>
            <Bidang label="Nomor keanggotaan"><input className="input" value={f.asosiasi_nomor} onChange={set('asosiasi_nomor')} /></Bidang>
          </div>
        </Kartu>
      ) : (
        <Kartu judul="Data profesi">
          <div className="pm-form-2">
            <Bidang label="Asosiasi/organisasi profesi"><input className="input" value={f.asosiasi_nama} onChange={set('asosiasi_nama')} /></Bidang>
            <Bidang label="Nomor keanggotaan"><input className="input" value={f.asosiasi_nomor} onChange={set('asosiasi_nomor')} /></Bidang>
            <Bidang label="Jabatan dalam asosiasi"><input className="input" value={f.asosiasi_jabatan} onChange={set('asosiasi_jabatan')} /></Bidang>
            <Bidang label="Alamat kantor asosiasi"><input className="input" value={f.asosiasi_alamat} onChange={set('asosiasi_alamat')} /></Bidang>
            <Bidang label="Pekerjaan"><input className="input" value={f.pekerjaan} onChange={set('pekerjaan')} /></Bidang>
            <Bidang label="Nama instansi"><input className="input" value={f.instansi} onChange={set('instansi')} /></Bidang>
            <Bidang label="Jabatan"><input className="input" value={f.jabatan} onChange={set('jabatan')} /></Bidang>
            <Bidang label="Bidang keahlian/profesi yang ditekuni" lebar><textarea className="input" rows={2} value={f.bidang_keahlian} onChange={set('bidang_keahlian')} /></Bidang>
          </div>
        </Kartu>
      )}
      {dok.length ? <Kartu judul="Biodata yang pernah diterbitkan" padat><ul className="tm-daftar">{dok.filter((d) => d.status !== 'dicabut').map((d) => <BarisDokumen key={d.id} d={d} />)}</ul></Kartu> : null}
      <BarTahap info="Terbitkan ulang bila biodata berubah; dokumen lama otomatis digantikan.">
        <Tombol ikon={Save} sibuk={sibuk === 'simpan'} onClick={() => jalankan(false)}>Simpan</Tombol>
        <Tombol jenis="primary" ikon={FileSignature} sibuk={sibuk === 'terbit'} onClick={() => jalankan(true)}>Simpan dan terbitkan {akad ? 'F04' : 'F05'}</Tombol>
      </BarTahap>
    </Halaman>
  )
}
