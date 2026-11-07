// Pengaturan dokumen: format dan nomor awal (lalu berjalan otomatis),
// serta penanda tangan tetap untuk dokumen yang ditandatangani jabatan.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../api'
import { Bidang, Kartu, Lencana, Pemberitahuan, Tombol } from '../../pemohon/ui'
import '../../pemohon/pemohon.css'
import '../../tim/tim.css'
import '../dokumen.css'

const contohNomor = (fmt, no) => (fmt || '')
  .replace(/\{no:(\d+)\}/g, (_, n) => String(no).padStart(Number(n), '0')).replace('{no}', String(no))
  .replace('{bulan_romawi}', ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][new Date().getMonth()])
  .replace('{bulan}', String(new Date().getMonth() + 1).padStart(2, '0')).replace('{tahun}', String(new Date().getFullYear())).replace('{kode_prodi}', 'SI')

function KartuNomor({ n, jenis, boleh, onSimpan }) {
  const [f, setF] = useState({ format: n.format || '', mulai: n.sudah_diatur ? '' : '1', reset_tahunan: n.reset_tahunan })
  const [sibuk, setSibuk] = useState(false)
  const berikut = n.sudah_diatur ? (f.mulai ? Number(f.mulai) : n.nomor_terakhir + 1) : Number(f.mulai || 1)
  const simpan = async () => {
    if (!f.format.includes('{no')) { toast.error('Format harus memuat {no} atau {no:3}'); return }
    if (f.mulai && (!Number.isInteger(Number(f.mulai)) || Number(f.mulai) < 1)) { toast.error('Nomor awal harus bilangan bulat positif'); return }
    setSibuk(true)
    try {
      const nilai = { format: f.format.trim(), reset_tahunan: f.reset_tahunan, sudah_diatur: true }
      if (f.mulai) nilai.nomor_terakhir = Number(f.mulai) - 1
      onSimpan(await api.simpanPenomoran(n.jenis_kode, nilai))
      setF((s) => ({ ...s, mulai: '' }))
      toast.success(`Penomoran ${jenis?.nama || n.jenis_kode} disimpan`)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  return (
    <Kartu judul={jenis?.nama || n.jenis_kode} sub={n.sudah_diatur ? `Nomor terakhir terpakai: ${n.nomor_terakhir}${n.tahun_berjalan ? ` (tahun ${n.tahun_berjalan})` : ''}` : 'Belum diatur: dokumen ini belum dapat diterbitkan'}
      aksi={n.sudah_diatur ? <Lencana warna="green">Aktif</Lencana> : <Lencana warna="amber">Belum diatur</Lencana>}
      kaki={boleh ? <Tombol ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan</Tombol> : null}>
      <div className="pm-form-2">
        <Bidang label="Format nomor" lebar hint="Penanda: {no:3} nomor urut 3 digit, {bulan_romawi}, {bulan}, {tahun}, {kode_prodi}">
          <input className="input" value={f.format} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, format: e.target.value }))} placeholder="{no:3}/RPL/STIKOM-YS/{bulan_romawi}/{tahun}" />
        </Bidang>
        <Bidang label={n.sudah_diatur ? 'Ubah nomor berikutnya (opsional)' : 'Nomor awal'} hint={n.sudah_diatur ? 'Kosongkan untuk melanjutkan urutan otomatis.' : 'Isi sesuai nomor terakhir di buku agenda, ditambah satu.'}>
          <input className="input" type="number" min="1" value={f.mulai} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, mulai: e.target.value }))} />
        </Bidang>
        <Bidang label="Urutan">
          <label className="pm-centang"><input type="checkbox" checked={f.reset_tahunan} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, reset_tahunan: e.target.checked }))} /> Mulai dari 1 setiap tahun baru</label>
        </Bidang>
      </div>
      {f.format ? <p className="pm-kecil">Contoh nomor berikutnya: <b>{contohNomor(f.format, berikut)}</b></p> : null}
    </Kartu>
  )
}

export default function Pengaturan() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [d, setD] = useState(null)
  const [sibuk, setSibuk] = useState(null)
  useEffect(() => { api.muatPengaturan().then(setD).catch((e) => toast.error(e.message)) }, [])
  const bolehNomor = ['admin', 'ketua_tim'].includes(role)
  const bolehTtd = role === 'admin'
  const ubahTtd = async (t, profileId) => {
    setSibuk(t.id)
    try {
      const h = await api.simpanPenandatangan(t.id, { profile_id: profileId || null })
      setD((s) => ({ ...s, ttd: s.ttd.map((x) => (x.id === h.id ? h : x)) }))
      toast.success('Penanda tangan disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  const SUMBER = { pemohon: 'Pemohon yang bersangkutan', asesor_ditugaskan: 'Asesor yang ditugaskan', peserta_pleno: 'Seluruh peserta pleno' }

  return (
    <div className="dk-verif-latar">
      <main className="dk-mandiri pm-tumpuk-besar">
        <div className="pm-baris-aksi"><button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Kembali</button></div>
        <div><h1 className="page-title">Pengaturan dokumen</h1><p className="page-subtitle">Nomor dokumen diisi awal sekali, lalu berjalan otomatis setiap kali dokumen diterbitkan.</p></div>
        {!d ? <div className="sk" style={{ height: 200 }} /> : <>
          {!bolehNomor ? <Pemberitahuan>Pengaturan hanya dapat diubah oleh Admin atau Ketua Tim Pengelola RPL.</Pemberitahuan> : null}
          <h2 className="pm-kartu-judul">Penomoran</h2>
          {d.nomor.map((n) => <KartuNomor key={n.jenis_kode} n={n} jenis={d.jenis.find((j) => j.kode === n.jenis_kode)} boleh={bolehNomor}
            onSimpan={(h) => setD((s) => ({ ...s, nomor: s.nomor.map((x) => (x.jenis_kode === h.jenis_kode ? h : x)) }))} />)}
          <p className="pm-kecil">Lampiran SK (F08) memakai nomor SK yang dicatat di menu SK Rekognisi.</p>
          <h2 className="pm-kartu-judul">Penanda tangan</h2>
          <Kartu padat>
            <div className="table-wrap">
              <table className="pm-tabel pm-tabel-responsif">
                <thead><tr><th style={{ width: 260 }}>Dokumen</th><th style={{ width: 220 }}>Jabatan</th><th>Penanda tangan</th></tr></thead>
                <tbody>
                  {d.ttd.map((t) => (
                    <tr key={t.id}>
                      <td data-label="Dokumen">{d.jenis.find((j) => j.kode === t.jenis_kode)?.nama || t.jenis_kode} <span className="pm-kecil">({t.jenis_kode})</span></td>
                      <td data-label="Jabatan">{t.label_jabatan || '-'}</td>
                      <td data-label="Penanda tangan">
                        {t.sumber === 'peran' ? (
                          <select className="input" value={t.profile_id || ''} disabled={!bolehTtd || sibuk === t.id} onChange={(e) => ubahTtd(t, e.target.value)}>
                            <option value="">Otomatis: pengguna pertama berperan {t.peran}</option>
                            {d.orang.filter((o) => o.role === t.peran || o.role === 'admin').map((o) => <option key={o.id} value={o.id}>{o.nama_lengkap || o.email}</option>)}
                          </select>
                        ) : <span className="pm-kecil">{SUMBER[t.sumber] || t.sumber}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kartu>
        </>}
      </main>
    </div>
  )
}
