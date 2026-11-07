import { useState } from 'react'
import { CalendarPlus, Check, ExternalLink, Pencil, UserX, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTim } from '../../TimData'
import * as api from '../../api'
import { JENIS_ASESMEN, STATUS_JADWAL, TAHAP_JADWAL } from '../../aturan'
import { tanggal } from '../../../pemohon/konstanta'
import { Bidang, Dialog, InputAngka, Kartu, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../../pemohon/ui'

const LABEL_JENIS = Object.fromEntries(JENIS_ASESMEN.map((j) => [j.v, j.l]))
const LABEL_TAHAP = Object.fromEntries(TAHAP_JADWAL.map((j) => [j.v, j.l]))
const BELUM_BOLEH = ['diajukan', 'dikembalikan_sekretariat', 'dibatalkan', 'tidak_memenuhi_syarat', 'selesai']

// Nilai datetime-local dalam waktu setempat.
const keLokal = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

function FormJadwal({ p, d, awal, onTutup }) {
  const { data, peta, ubah } = useTim()
  const tugas = data.penugasan.filter((a) => a.pengajuan_id === p.id)
  const mkP = d.mkDiajukan.filter((m) => m.mekanisme === 'perolehan').map((m) => d.mataKuliah.find((x) => x.id === m.mk_id)).filter(Boolean)
  const mkSemua = d.mkDiajukan.map((m) => d.mataKuliah.find((x) => x.id === m.mk_id)).filter(Boolean)
  const [f, setF] = useState(() => awal ? {
    ...awal, waktu: keLokal(awal.waktu), tautan_undangan: awal.tautan_undangan || '', ruangan: awal.ruangan || '', mk_ids: awal.mk_ids || [],
  } : {
    jenis: 'wawancara', tahap: 'penilaian_lanjutan', mode: 'daring', waktu: '', durasi_menit: 60, tautan_undangan: '', ruangan: '',
    mk_ids: mkP.map((m) => m.id), asesor_id: tugas.find((a) => a.peran === 'koordinator')?.asesor_id || tugas[0]?.asesor_id || '', asesor_lain: [],
  })
  const [sibuk, setSibuk] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))
  const pilihanMk = f.jenis === 'wawancara' && mkP.length ? mkP : mkSemua
  const toggleMk = (id) => setF((s) => ({ ...s, mk_ids: s.mk_ids.includes(id) ? s.mk_ids.filter((x) => x !== id) : [...s.mk_ids, id] }))
  const toggleLain = (id) => setF((s) => ({ ...s, asesor_lain: s.asesor_lain.includes(id) ? s.asesor_lain.filter((x) => x !== id) : [...s.asesor_lain, id] }))

  const galat = !f.waktu ? 'Isi tanggal dan jam'
    : f.mode === 'daring' && !/^https:\/\/\S+$/i.test(f.tautan_undangan.trim()) ? 'Tautan undangan harus diawali https://'
    : f.mode === 'luring' && !f.ruangan.trim() ? 'Isi ruangan' : !f.mk_ids.length ? 'Pilih minimal satu mata kuliah' : null

  const simpan = async () => {
    setSibuk(true)
    try {
      const isi = {
        id: awal?.id, pengajuan_id: p.id, jenis: f.jenis, tahap: f.tahap, mode: f.mode, waktu: new Date(f.waktu).toISOString(),
        durasi_menit: Number(f.durasi_menit) || 60, mk_ids: f.mk_ids, asesor_id: f.asesor_id || null, asesor_lain: f.asesor_lain.filter((x) => x !== f.asesor_id),
        tautan_undangan: f.mode === 'daring' ? f.tautan_undangan.trim() : null, ruangan: f.mode === 'luring' ? f.ruangan.trim() : null,
        status: 'dijadwalkan',
      }
      if (awal && awal.waktu !== isi.waktu) isi.konfirmasi_hadir_at = null
      const hasil = await api.simpanJadwal(isi)
      ubah((x) => ({ jadwal: awal ? x.jadwal.map((j) => (j.id === hasil.id ? hasil : j)) : [...x.jadwal, hasil].sort((a, b) => a.waktu.localeCompare(b.waktu)) }))
      toast.success(awal ? 'Jadwal diperbarui' : 'Jadwal dibuat. Pemohon dapat melihatnya di menu Jadwal asesmen.')
      onTutup()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Dialog buka judul={awal ? 'Ubah jadwal asesmen' : 'Buat jadwal asesmen'} lebar={680} onTutup={onTutup}
      kaki={<><span className="pm-kecil pm-grow">{galat}</span><Tombol onClick={onTutup}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} disabled={!!galat} onClick={simpan}>Simpan jadwal</Tombol></>}>
      <div className="pm-form-2">
        <Bidang label="Jenis asesmen">
          <select className="input" value={f.jenis} onChange={(e) => set('jenis')(e.target.value)}>
            {JENIS_ASESMEN.map((j) => <option key={j.v} value={j.v}>{j.l}</option>)}
          </select>
        </Bidang>
        <Bidang label="Tahap">
          <select className="input" value={f.tahap} onChange={(e) => set('tahap')(e.target.value)}>
            {TAHAP_JADWAL.map((j) => <option key={j.v} value={j.v}>{j.l}</option>)}
          </select>
        </Bidang>
        <Bidang label="Tanggal dan jam (WIB)" wajib>
          <input className="input" type="datetime-local" value={f.waktu} onChange={(e) => set('waktu')(e.target.value)} />
        </Bidang>
        <Bidang label="Durasi (menit)">
          <InputAngka nilai={String(f.durasi_menit ?? '')} panjang={3} onUbah={(v) => set('durasi_menit')(v)} />
        </Bidang>
        <Bidang label="Cara pelaksanaan" lebar>
          <PilihSegmen pilihan={[{ v: 'daring', l: 'Daring (Google Meet atau sejenis)' }, { v: 'luring', l: 'Luring di kampus' }]} nilai={f.mode} onUbah={set('mode')} label="Cara pelaksanaan" />
        </Bidang>
        {f.mode === 'daring' ? (
          <Bidang label="Tautan undangan" wajib lebar hint="Buat rapat di Google Meet, lalu tempel tautannya. Sistem tidak merekam pertemuan.">
            <input className="input" type="url" placeholder="https://meet.google.com/abc-defg-hij" value={f.tautan_undangan} onChange={(e) => set('tautan_undangan')(e.target.value)} />
          </Bidang>
        ) : (
          <Bidang label="Ruangan" wajib lebar>
            <input className="input" placeholder="Contoh: Lab Komputer 2, Gedung B" value={f.ruangan} onChange={(e) => set('ruangan')(e.target.value)} />
          </Bidang>
        )}
        <Bidang label="Asesor utama">
          <select className="input" value={f.asesor_id || ''} onChange={(e) => set('asesor_id')(e.target.value)}>
            <option value="">Belum ditentukan</option>
            {tugas.map((a) => <option key={a.asesor_id} value={a.asesor_id}>{peta.staf[a.asesor_id]?.nama_lengkap || 'Asesor'}</option>)}
          </select>
        </Bidang>
        <div className="input-group">
          <span className="input-label">Asesor lain yang hadir</span>
          <div className="tm-centang-baris">
            {tugas.filter((a) => a.asesor_id !== f.asesor_id).map((a) => (
              <label key={a.asesor_id} className="pm-centang"><input type="checkbox" checked={f.asesor_lain.includes(a.asesor_id)} onChange={() => toggleLain(a.asesor_id)} /> {peta.staf[a.asesor_id]?.nama_lengkap || 'Asesor'}</label>
            ))}
            {tugas.length <= 1 ? <span className="pm-kecil">Tidak ada asesor lain yang ditugaskan.</span> : null}
          </div>
        </div>
      </div>
      <div className="input-group" style={{ marginTop: 14 }}>
        <span className="input-label">Mata kuliah yang dinilai <span className="pm-kecil">({f.mk_ids.length} dipilih)</span></span>
        <div className="tm-mk-pilih">
          {pilihanMk.map((m) => (
            <label key={m.id} className="pm-centang"><input type="checkbox" checked={f.mk_ids.includes(m.id)} onChange={() => toggleMk(m.id)} /> {m.kode_mk} · {m.nama_mk} ({m.sks} SKS)</label>
          ))}
        </div>
      </div>
    </Dialog>
  )
}

export default function TabJadwal({ p, d }) {
  const { data, peta, bisaVerifikasi, ubah } = useTim()
  const [form, setForm] = useState(null)
  const [aksi, setAksi] = useState(null)
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const jadwal = data.jadwal.filter((j) => j.pengajuan_id === p.id)
  const mkNama = Object.fromEntries(d.mataKuliah.map((m) => [m.id, m]))
  const perolehan = d.mkDiajukan.filter((m) => m.mekanisme === 'perolehan')
  const wawancara = jadwal.filter((j) => j.jenis === 'wawancara' && ['dijadwalkan', 'selesai'].includes(j.status))
  const tanpa = perolehan.filter((m) => !wawancara.some((j) => j.mk_ids.includes(m.mk_id)))
  const belumBoleh = BELUM_BOLEH.includes(p.status)

  const ubahStatus = async () => {
    setSibuk(true)
    try {
      const nilai = { id: aksi.j.id, status: aksi.status }
      if (aksi.status !== 'selesai' || catatan.trim()) nilai.catatan_kehadiran = catatan.trim() || null
      const hasil = await api.simpanJadwal(nilai)
      ubah((x) => ({ jadwal: x.jadwal.map((j) => (j.id === hasil.id ? hasil : j)) }))
      toast.success(`Jadwal ditandai ${STATUS_JADWAL[aksi.status].label.toLowerCase()}`)
      setAksi(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <>
      {perolehan.length ? (
        tanpa.length ? (
          <Pemberitahuan jenis="amber" judul={`${tanpa.length} mata kuliah perolehan kredit belum punya jadwal wawancara`}>
            Juknis mewajibkan wawancara untuk perolehan kredit. Pleno akhir tidak dapat dilakukan sebelum semua wawancara selesai.
            <div className="pm-kecil" style={{ marginTop: 4 }}>{tanpa.map((m) => mkNama[m.mk_id]?.nama_mk).filter(Boolean).join(', ')}</div>
          </Pemberitahuan>
        ) : <Pemberitahuan jenis="green">Semua mata kuliah perolehan kredit sudah dijadwalkan atau selesai diwawancarai.</Pemberitahuan>
      ) : null}
      {belumBoleh && !jadwal.length ? <Pemberitahuan jenis="indigo">Jadwal asesmen dibuat setelah berkas dinyatakan lengkap.</Pemberitahuan> : null}

      <Kartu judul="Jadwal asesmen" sub="Tampil di menu Jadwal asesmen milik pemohon beserta tautan undangan" padat
        aksi={bisaVerifikasi && !belumBoleh ? <Tombol jenis="primary" ikon={CalendarPlus} onClick={() => setForm({})}>Buat jadwal</Tombol> : null}>
        {jadwal.length ? (
          <ul className="tm-jadwal">
            {jadwal.map((j) => {
              const st = STATUS_JADWAL[j.status] || { label: j.status, warna: 'slate' }
              const lewat = new Date(j.waktu).getTime() < Date.now()
              return (
                <li key={j.id}>
                  <div className="tm-tgl" aria-hidden="true"><b>{new Date(j.waktu).getDate()}</b><span>{new Date(j.waktu).toLocaleString('id-ID', { month: 'short' })}</span></div>
                  <div className="pm-grow">
                    <div className="tm-jadwal-judul">
                      <span className="pm-tebal">{LABEL_JENIS[j.jenis] || j.jenis}</span>
                      <Lencana warna={st.warna}>{st.label}</Lencana>
                      <span className="pm-kecil">{LABEL_TAHAP[j.tahap]}</span>
                    </div>
                    <div className="pm-kecil">{tanggal(j.waktu, true)} WIB · {j.durasi_menit || 60} menit · {j.mode === 'daring' ? 'Daring' : `Luring, ${j.ruangan || j.tempat_atau_tautan || '-'}`}</div>
                    <div className="pm-kecil">Asesor: {[j.asesor_id, ...(j.asesor_lain || [])].filter(Boolean).map((id) => peta.staf[id]?.nama_lengkap || 'Asesor').join(', ') || '-'}</div>
                    <div className="pm-kecil">Mata kuliah: {(j.mk_ids || []).map((id) => mkNama[id]?.nama_mk).filter(Boolean).join(', ') || '-'}</div>
                    {j.status === 'dijadwalkan' ? <div className="pm-kecil">{j.konfirmasi_hadir_at ? <span className="pm-ok">Pemohon mengonfirmasi hadir {tanggal(j.konfirmasi_hadir_at, true)}</span> : 'Pemohon belum mengonfirmasi kehadiran'}</div> : null}
                    {j.catatan_kehadiran ? <div className="pm-kecil">Catatan: {j.catatan_kehadiran}</div> : null}
                  </div>
                  <div className="tm-jadwal-aksi">
                    {j.mode === 'daring' && j.tautan_undangan && j.status === 'dijadwalkan' ? <a className="btn btn-secondary btn-sm" href={j.tautan_undangan} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Buka tautan</a> : null}
                    {bisaVerifikasi && j.status === 'dijadwalkan' ? <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(j)}><Pencil size={13} /> Ubah</button>
                      {lewat ? <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCatatan(''); setAksi({ j, status: 'selesai' }) }}><Check size={13} /> Selesai</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCatatan(''); setAksi({ j, status: 'tidak_hadir' }) }}><UserX size={13} /> Tidak hadir</button>
                      </> : null}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCatatan(''); setAksi({ j, status: 'dibatalkan' }) }}><X size={13} /> Batalkan</button>
                    </> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : <p className="pm-kosong">Belum ada jadwal.</p>}
      </Kartu>

      {form ? <FormJadwal p={p} d={d} awal={form.id ? form : null} onTutup={() => setForm(null)} /> : null}
      <Dialog buka={!!aksi} judul={aksi ? `Tandai ${STATUS_JADWAL[aksi.status].label.toLowerCase()}` : ''} onTutup={() => setAksi(null)}
        kaki={<><Tombol onClick={() => setAksi(null)}>Batal</Tombol>
          <Tombol jenis={aksi?.status === 'selesai' ? 'primary' : 'danger'} sibuk={sibuk} disabled={aksi?.status !== 'selesai' && !catatan.trim()} onClick={ubahStatus}>Simpan</Tombol></>}>
        {aksi?.status === 'selesai' ? <p>Wawancara yang ditandai selesai membuka syarat pleno akhir untuk mata kuliah terkait. Hasil penilaian diisi asesor di Lembar Penilaian Lanjutan (F10).</p> : null}
        {aksi?.status === 'tidak_hadir' ? <p>Buat jadwal pengganti bila pemohon berhalangan dengan alasan yang dapat diterima.</p> : null}
        <Bidang label={aksi?.status === 'selesai' ? 'Catatan (opsional)' : 'Alasan'}>
          <textarea className="input" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Bidang>
      </Dialog>
    </>
  )
}
