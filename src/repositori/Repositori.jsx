// Repositori pelaporan RPL untuk pengguna internal, dan pengelolaan
// tautan berbagi untuk pihak luar (LLDIKTI, asesor eksternal).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Ban, Copy, Link2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { urlBerkas } from '../pemohon/api'
import { Bidang, Dialog, Kartu, Lencana, PilihSegmen, Tombol } from '../pemohon/ui'
import Penjelajah from './Penjelajah'
import '../pemohon/pemohon.css'
import '../tim/tim.css'
import '../dokumen/dokumen.css'
import './repositori.css'

function cek({ data, error }) { if (error) throw new Error(error.message); return data }
const tgl = (d) => (d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-')

function KelolaTautan({ periode, prodi }) {
  const [daftar, setDaftar] = useState(null)
  const [form, setForm] = useState(null)
  const [baru, setBaru] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const [akanCabut, setAkanCabut] = useState(null)
  // Ringkasan log akses per tautan (jumlah dan waktu terakhir).
  const [akses, setAkses] = useState({})
  useEffect(() => {
    supabase.from('log_akses_repositori').select('tautan_id, created_at').order('created_at', { ascending: false }).limit(2000)
      .then(({ data }) => {
        const r = {}
        for (const x of data || []) { if (!x.tautan_id) continue; r[x.tautan_id] = r[x.tautan_id] || { n: 0, akhir: x.created_at }; r[x.tautan_id].n += 1 }
        setAkses(r)
      })
  }, [daftar])
  const muat = useCallback(() => supabase.from('tautan_berbagi').select('id, token, nama, periode_id, prodi_ids, mekanisme, kedaluwarsa_at, kata_sandi_hash, dicabut_at, created_at').order('created_at', { ascending: false })
    .then(cek).then(setDaftar).catch((e) => toast.error(e.message)), [])
  useEffect(() => { muat() }, [muat])
  const tautan = (t) => `${window.location.origin}/berbagi/${t}`
  const salin = async (teks) => { try { await navigator.clipboard.writeText(teks); toast.success('Tautan disalin') } catch { toast.error('Salin manual tautan di atas') } }

  const simpan = async () => {
    if (!form.nama.trim()) { toast.error('Beri nama tautan'); return }
    if (form.pakaiSandi && form.sandi.length < 8) { toast.error('Kata sandi minimal 8 karakter'); return }
    setSibuk(true)
    try {
      const h = cek(await supabase.rpc('buat_tautan_berbagi', {
        p_nama: form.nama.trim(), p_periode: form.periode || null, p_prodi_ids: form.prodi ? [form.prodi] : [],
        p_mekanisme: form.mekanisme || null, p_pengajuan_ids: [],
        p_kedaluwarsa: form.berlaku === 'selamanya' ? null : new Date(Date.now() + Number(form.berlaku) * 86400000).toISOString(),
        p_kata_sandi: form.pakaiSandi ? form.sandi : null,
      }))
      setBaru({ ...h, sandi: form.pakaiSandi ? form.sandi : null }); setForm(null); muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const cabut = async () => {
    setSibuk(true)
    try { cek(await supabase.rpc('cabut_tautan_berbagi', { p_id: akanCabut.id })); toast.success('Tautan dicabut'); setAkanCabut(null); muat() } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const status = (t) => (t.dicabut_at ? ['Dicabut', 'red'] : t.kedaluwarsa_at && new Date(t.kedaluwarsa_at) < new Date() ? ['Kedaluwarsa', 'slate'] : ['Aktif', 'green'])

  return (
    <>
      <Kartu judul="Tautan berbagi" sub="Untuk pihak luar tanpa akun, mis. LLDIKTI atau asesor eksternal. Hanya pemohon yang sudah ber-SK yang terlihat." padat
        aksi={<Tombol jenis="primary" ikon={Plus} onClick={() => setForm({ nama: '', periode: periode.find((p) => p.is_aktif)?.id || '', prodi: '', mekanisme: '', berlaku: '30', pakaiSandi: true, sandi: '' })}>Buat tautan</Tombol>}>
        {!daftar ? <div className="card-body"><div className="sk" style={{ height: 50 }} /></div> : daftar.length ? (
          <ul className="tm-daftar">
            {daftar.map((t) => {
              const [lab, warna] = status(t)
              return (
                <li key={t.id} className="tm-baris">
                  <Link2 size={16} aria-hidden="true" />
                  <div className="pm-grow">
                    <div className="pm-tebal">{t.nama}</div>
                    <div className="pm-kecil">
                      {periode.find((p) => p.id === t.periode_id)?.nama || 'Semua periode'} · {(t.prodi_ids || []).length ? prodi.filter((p) => t.prodi_ids.includes(p.id)).map((p) => p.nama).join(', ') : 'Semua prodi'}
                      {t.mekanisme ? ` · ${t.mekanisme === 'transfer' ? 'Transfer kredit' : 'Perolehan kredit'}` : ''} · {t.kata_sandi_hash ? 'bersandi' : 'terbuka'} · {t.kedaluwarsa_at ? `berlaku s.d. ${tgl(t.kedaluwarsa_at)}` : 'tanpa batas waktu'}
                    </div>
                    <div className="pm-kecil">{akses[t.id] ? `Dibuka ${akses[t.id].n} kali · terakhir ${tgl(akses[t.id].akhir)}` : 'Belum pernah dibuka'}</div>
                  </div>
                  <Lencana warna={warna}>{lab}</Lencana>
                  {lab === 'Aktif' ? <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => salin(tautan(t.token))}><Copy size={13} /> Salin</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAkanCabut(t)}><Ban size={13} /> Cabut</button>
                  </> : null}
                </li>
              )
            })}
          </ul>
        ) : <p className="pm-kosong">Belum ada tautan berbagi.</p>}
      </Kartu>
      <Dialog buka={!!form} judul="Buat tautan berbagi" onTutup={() => setForm(null)} lebar={600}
        kaki={<><Tombol onClick={() => setForm(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={simpan}>Buat tautan</Tombol></>}>
        {form ? (
          <div className="pm-form-2">
            <Bidang label="Nama penerima" wajib lebar hint='Mis. "LLDIKTI Wilayah VI - pelaporan semester ganjil"'>
              <input className="input" value={form.nama} onChange={(e) => setForm((s) => ({ ...s, nama: e.target.value }))} />
            </Bidang>
            <Bidang label="Periode">
              <select className="input" value={form.periode} onChange={(e) => setForm((s) => ({ ...s, periode: e.target.value }))}>
                <option value="">Semua periode</option>{periode.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </Bidang>
            <Bidang label="Program studi">
              <select className="input" value={form.prodi} onChange={(e) => setForm((s) => ({ ...s, prodi: e.target.value }))}>
                <option value="">Semua prodi</option>{prodi.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </Bidang>
            <Bidang label="Mekanisme">
              <select className="input" value={form.mekanisme} onChange={(e) => setForm((s) => ({ ...s, mekanisme: e.target.value }))}>
                <option value="">Transfer dan perolehan</option><option value="transfer">Transfer kredit</option><option value="perolehan">Perolehan kredit</option>
              </select>
            </Bidang>
            <Bidang label="Masa berlaku">
              <select className="input" value={form.berlaku} onChange={(e) => setForm((s) => ({ ...s, berlaku: e.target.value }))}>
                {[['7', '7 hari'], ['14', '14 hari'], ['30', '30 hari'], ['90', '90 hari'], ['180', '6 bulan'], ['selamanya', 'Tanpa batas (hingga dicabut)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Bidang>
            <Bidang label="Akses" lebar>
              <PilihSegmen pilihan={[{ v: true, l: 'Dengan kata sandi' }, { v: false, l: 'Terbuka (siapa pun yang memiliki tautan)' }]} nilai={form.pakaiSandi} onUbah={(v) => setForm((s) => ({ ...s, pakaiSandi: v }))} label="Akses" />
            </Bidang>
            {form.pakaiSandi ? (
              <Bidang label="Kata sandi" lebar hint="Minimal 8 karakter. Sampaikan terpisah dari tautan; sandi tidak dapat dilihat lagi setelah disimpan.">
                <input className="input" type="password" value={form.sandi} onChange={(e) => setForm((s) => ({ ...s, sandi: e.target.value }))} autoComplete="new-password" />
              </Bidang>
            ) : null}
          </div>
        ) : null}
      </Dialog>
      <Dialog buka={!!akanCabut} judul="Cabut tautan berbagi?" onTutup={() => setAkanCabut(null)} lebar={480}
        kaki={<><Tombol onClick={() => setAkanCabut(null)}>Batal</Tombol><Tombol jenis="danger" sibuk={sibuk} onClick={cabut}>Cabut tautan</Tombol></>}>
        {akanCabut ? <p>Tautan untuk <b>{akanCabut.nama}</b> tidak dapat dibuka lagi setelah dicabut. Tindakan ini tidak dapat dibatalkan; buat tautan baru bila penerima masih memerlukan akses.</p> : null}
      </Dialog>
      <Dialog buka={!!baru} judul="Tautan berbagi siap" onTutup={() => setBaru(null)} lebar={560}
        kaki={<Tombol jenis="primary" onClick={() => setBaru(null)}>Selesai</Tombol>}>
        {baru ? (
          <div className="pm-tumpuk-besar">
            <Bidang label="Tautan"><div className="pm-baris-aksi"><input className="input dk-mono" readOnly value={tautan(baru.token)} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
              <Tombol ikon={Copy} onClick={() => salin(tautan(baru.token))}>Salin</Tombol></div></Bidang>
            {baru.sandi ? <p>Kata sandi: <b className="dk-mono">{baru.sandi}</b>. Catat sekarang; sandi tidak ditampilkan lagi.</p> : <p className="pm-kecil">Tautan terbuka: siapa pun yang memiliki tautan dapat melihat isinya.</p>}
            <p className="pm-kecil">Setiap akses tercatat. Cabut tautan kapan saja dari daftar.</p>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}

export default function Repositori() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [d, setD] = useState(null)
  const [periodeId, setPeriodeId] = useState('')
  const [hanyaSk, setHanyaSk] = useState(true)
  const [sibukId, setSibukId] = useState(null)
  useEffect(() => {
    Promise.all([
      supabase.from('v_berkas_repositori').select('*').then(cek),
      supabase.from('periode_rpl').select('*').order('created_at', { ascending: false }).then(cek),
      supabase.from('program_studi').select('id, nama, kode').order('nama').then(cek),
    ]).then(([berkas, periode, prodi]) => {
      setD({ berkas: berkas || [], periode: periode || [], prodi: prodi || [] })
      setPeriodeId(periode?.find((p) => p.is_aktif)?.id || '')
    }).catch((e) => toast.error(e.message))
  }, [])
  const berkas = useMemo(() => (d?.berkas || []).filter((b) => (!periodeId || b.periode_id === periodeId) && (!hanyaSk || b.sudah_sk))
    .map((b) => ({ ...b, id: `${b.pengajuan_id}|${b.mekanisme}|${b.sumber}|${b.sumber_id || ''}|${b.storage_path}` })), [d, periodeId, hanyaSk])

  const buka = async (b) => {
    if (b.sumber === 'dokumen') { navigate(`/dokumen/${b.sumber_id}`); return }
    setSibukId(b.id)
    const w = window.open('about:blank', '_blank')
    try { const url = await urlBerkas(b.storage_path); if (w) w.location.href = url } catch (e) { w?.close(); toast.error(e.message) } finally { setSibukId(null) }
  }

  return (
    <div className="dk-verif-latar">
      <main className="dk-mandiri pm-tumpuk-besar">
        <div className="pm-baris-aksi"><button type="button" className="btn btn-secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}><ArrowLeft size={14} /> Kembali</button></div>
        <div className="pm-kepala">
          <div><h1 className="page-title">Repositori pelaporan RPL</h1><p className="page-subtitle">Berkas setiap mahasiswa RPL disusun per program studi, mekanisme, dan NIM sesuai struktur pelaporan. Pemohon gabungan muncul di kedua folder.</p></div>
          {d ? (
            <div className="pm-kepala-aksi">
              <select className="input" style={{ width: 'auto' }} value={periodeId} onChange={(e) => setPeriodeId(e.target.value)} aria-label="Periode">
                <option value="">Semua periode</option>{d.periode.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
              <PilihSegmen pilihan={[{ v: true, l: 'Sudah ber-SK' }, { v: false, l: 'Semua' }]} nilai={hanyaSk} onUbah={setHanyaSk} label="Cakupan" />
            </div>
          ) : null}
        </div>
        {!d ? <div className="sk" style={{ height: 300, borderRadius: 12 }} /> : <Penjelajah key={`${periodeId}-${hanyaSk}`} berkas={berkas} onBuka={buka} sibukId={sibukId} />}
        {d && ['admin', 'ketua_tim'].includes(role) ? <KelolaTautan periode={d.periode} prodi={d.prodi} /> : null}
      </main>
    </div>
  )
}
